import {test,expect} from '@playwright/test';
import {spawn,type ChildProcess} from 'node:child_process';
import http from 'node:http';
import WebSocket from 'ws';

const GAME='8131', STUB='8132';
const bans:any[]=[];

const b64=(value:any)=>Buffer.from(JSON.stringify(value)).toString('base64url');
// identify() reads the account from Supabase and the expiry from the token's own claims,
// so a stubbed token has to carry a real-looking exp.
const tokenFor=(sub:string)=>`${b64({alg:'none'})}.${b64({sub,exp:Math.floor(Date.now()/1000)+3600})}.signature`;

// A stand-in Supabase: real enough for the auth lookup and the player_bans read, and a
// permissive empty answer for every other table the server touches while joining.
function startStub(){
 return new Promise<http.Server>(resolve=>{
  const server=http.createServer((request,response)=>{
   const url=new URL(request.url||'/','http://stub');
   request.resume();
   response.setHeader('content-type','application/json');
   if(url.pathname==='/auth/v1/user'){
    let sub='';
    try{sub=JSON.parse(Buffer.from((request.headers.authorization||'').replace(/^Bearer /,'').split('.')[1],'base64url').toString()).sub;}catch{}
    if(!sub){response.writeHead(401);response.end('{}');return;}
    response.writeHead(200);response.end(JSON.stringify({id:sub,email:`${sub}@test.my`,user_metadata:{display_name:sub}}));return;
   }
   if(url.pathname==='/rest/v1/player_bans'&&request.method==='GET'){
    const filter=url.searchParams.get('user_id')||'';
    const wanted=filter.startsWith('eq.')?[filter.slice(3)]
     :filter.startsWith('in.')?filter.slice(3).replace(/^\(|\)$/g,'').split(',').map(value=>value.replace(/"/g,''))
     :[];
    response.writeHead(200);response.end(JSON.stringify(bans.filter(ban=>wanted.includes(ban.user_id))));return;
   }
   response.writeHead(request.method==='POST'?201:200);response.end('[]');
  });
  server.listen(Number(STUB),'127.0.0.1',()=>resolve(server));
 });
}

function startGame(){
 const child=spawn(process.execPath,['server/index.mjs'],{env:{
  ...process.env,PORT:GAME,ALLOW_GUESTS:'false',
  SUPABASE_URL:`http://127.0.0.1:${STUB}`,SUPABASE_PUBLISHABLE_KEY:'stub',SUPABASE_SERVICE_ROLE_KEY:'stub',
  OPENAI_API_KEY:'',
 },stdio:'ignore'});
 return child;
}
const ready=()=>expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${GAME}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);

type Session={ws:WebSocket;messages:any[];closeCode:()=>number};
function connect(sub:string,room='moderation'):Promise<Session>{
 return new Promise(resolve=>{
  const ws=new WebSocket(`ws://127.0.0.1:${GAME}/ws`);
  const messages:any[]=[];let code=0,settled=false;
  const session={ws,messages,closeCode:()=>code};
  const done=()=>{if(!settled){settled=true;resolve(session);}};
  ws.on('open',()=>ws.send(JSON.stringify({type:'join',room,accessToken:tokenFor(sub)})));
  ws.on('message',raw=>{const message=JSON.parse(String(raw));messages.push(message);if(message.type==='welcome'||message.type==='error')setTimeout(done,60);});
  ws.on('close',event=>{code=event;done();});
  ws.on('error',done);
 });
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,400));

test('a banned account cannot get in, a muted one cannot speak, and a clear one can',async()=>{
 bans.length=0;
 bans.push({user_id:'banned-player',kind:'ban',expires_at:null,reason:'threatened another player'});
 bans.push({user_id:'muted-player',kind:'mute',expires_at:new Date(Date.now()+3600000).toISOString(),reason:'slurs'});
 const stub=await startStub();
 let game=startGame();
 const open:WebSocket[]=[];
 try{
  await ready();

  // The door. A ban is refused before the player is ever put in a room.
  const banned=await connect('banned-player');
  open.push(banned.ws);
  const refusal=banned.messages.find(message=>message.type==='error');
  expect(refusal?.code).toBe('BANNED');
  expect(refusal?.message).toContain('threatened another player');
  expect(banned.messages.some(message=>message.type==='welcome')).toBe(false);

  // A mute is not a ban: the player is in the city, they just cannot broadcast.
  const muted=await connect('muted-player');
  open.push(muted.ws);
  expect(muted.messages.some(message=>message.type==='welcome')).toBe(true);

  const clear=await connect('clear-player');
  open.push(clear.ws);
  expect(clear.messages.some(message=>message.type==='welcome')).toBe(true);

  muted.messages.length=0; clear.messages.length=0;
  muted.ws.send(JSON.stringify({type:'chat',text:'this must not reach anybody'}));
  await settle();
  // The only thing that counts: nothing the muted player said left the server. Checked on
  // the other player's socket too, because a mute enforced only in the sender's own client
  // would still look quiet from the sender's side.
  expect(muted.messages.some(message=>message.type==='chat')).toBe(false);
  expect(clear.messages.some(message=>message.type==='chat')).toBe(false);
  expect(muted.messages.find(message=>message.type==='notice')?.message).toContain('muted');

  clear.messages.length=0;
  clear.ws.send(JSON.stringify({type:'chat',text:'this one is fine'}));
  await settle();
  expect(clear.messages.find(message=>message.type==='chat')?.text).toBe('this one is fine');

  // Voice is the surface a wordlist can never touch, so the mute has to hold there too.
  muted.messages.length=0;
  muted.ws.send(JSON.stringify({type:'voice-state',mic:true,speaker:false}));
  muted.ws.send(JSON.stringify({type:'voice-audio',codec:'opus',audio:'AAAA'}));
  await settle();
  expect(clear.messages.some(message=>message.type==='voice-audio')).toBe(false);

  // Railway restarts wipe every room. The ban lives in Supabase, so it comes back with the
  // process rather than dying with it.
  game.kill('SIGKILL');
  game=startGame();
  await ready();
  const again=await connect('banned-player');
  open.push(again.ws);
  expect(again.messages.find(message=>message.type==='error')?.code).toBe('BANNED');
  expect(again.messages.some(message=>message.type==='welcome')).toBe(false);
 }finally{
  for(const ws of open)try{ws.close();}catch{}
  game.kill('SIGKILL');
  await new Promise(resolve=>stub.close(resolve));
 }
});
