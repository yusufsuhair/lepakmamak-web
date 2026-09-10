import {test,expect} from '@playwright/test';
import {createServer,type Server} from 'node:http';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import city from '../shared/city.json' with {type:'json'};

// Joining a player reaches Supabase over the network several times: the auth lookup, the shop
// inventory fetched inside it, and the room's chat history. Each is a real await, and the join
// handler reads the room limit and the account's existing session BEFORE them, then inserts the
// player AFTER. Two clients that arrive together both pass the checks while parked on that I/O.
//
// Every other server spec blanks SUPABASE_SERVICE_ROLE_KEY, so those calls short-circuit to a
// resolved value, the microtask queue drains before the next socket is served, and joins can
// never interleave. That is why a green suite has never seen this. These tests stand the server
// up with the keys populated, the way production runs, and let two clients arrive at once.
function stubSupabase(userId:string){
 return createServer((request,response)=>{
  const body=request.url?.startsWith('/auth/v1/user')
   ?{id:userId,is_anonymous:false,user_metadata:{display_name:'Twin'}}:[];
  response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify(body));
 });
}
const listen=(server:Server)=>new Promise<number>(resolve=>server.listen(0,'127.0.0.1',()=>resolve((server.address() as any).port)));
const close=(server:Server)=>new Promise<void>(resolve=>server.close(()=>resolve()));
async function ready(port:number){
 await expect.poll(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);
}
const players=async(port:number)=>(await (await fetch(`http://127.0.0.1:${port}/health`)).json()).players;
// Opened first, joined later: the join frames have to leave in one tick to model a crowd
// arriving together, which is what a serial suite never does.
async function openAll(count:number,port:number){
 const sockets:WebSocket[]=[];
 await Promise.all(Array.from({length:count},()=>new Promise<void>(resolve=>{
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);sockets.push(ws);ws.on('open',()=>resolve());ws.on('error',()=>resolve());
 })));
 return sockets;
}

test('a crowd arriving at once cannot push the room past its limit',async()=>{
 const PORT=8241,EXTRA=20,total=city.maxPlayers+EXTRA;
 const auth=stubSupabase('unused'),authPort=await listen(auth);
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(PORT),ALLOW_GUESTS:'true',SUPABASE_URL:`http://127.0.0.1:${authPort}`,SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'stub'},stdio:'ignore'});
 let sockets:WebSocket[]=[];
 try{
  await ready(PORT);
  sockets=await openAll(total,PORT);
  const seen:string[]=[];
  const settled=new Promise<void>(resolve=>{let done=0;
   sockets.forEach(ws=>{const record=(what:string)=>{if((ws as any).settled)return;(ws as any).settled=true;seen.push(what);if(++done===total)resolve();};
    ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='welcome')record('welcome');else if(m.type==='error')record('rejected');});
    ws.on('close',()=>record('rejected'));ws.on('error',()=>record('rejected'));});});
  for(const ws of sockets) if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:'join',room:'stampede',guest:true,name:`P${sockets.indexOf(ws)}`}));
  await settled;
  const welcomed=seen.filter(entry=>entry==='welcome').length;
  expect(welcomed).toBeLessThanOrEqual(city.maxPlayers);
  expect(await players(PORT)).toBeLessThanOrEqual(city.maxPlayers);
 } finally { sockets.forEach(ws=>ws.close()); server.kill(); await close(auth); }
});

test('one account joining twice at the same moment still ends up in the city once',async()=>{
 const PORT=8242,USER='11111111-1111-4111-8111-111111111111';
 const auth=stubSupabase(USER),authPort=await listen(auth);
 const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const token=`${encode({alg:'HS256'})}.${encode({exp:Math.floor(Date.now()/1000)+3600,sub:USER})}.signature`;
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(PORT),SUPABASE_URL:`http://127.0.0.1:${authPort}`,SUPABASE_PUBLISHABLE_KEY:'stub',SUPABASE_SERVICE_ROLE_KEY:'stub'},stdio:'ignore'});
 let sockets:WebSocket[]=[];
 try{
  await ready(PORT);
  sockets=await openAll(2,PORT);
  const codes:string[]=[];
  sockets.forEach(ws=>ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.code)codes.push(m.code);}));
  for(const ws of sockets) if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:'join',room:'twin',accessToken:token}));
  // One of the two has to lose: otherwise the loser's player object stays in the room while
  // accountConnections points at the winner, so nothing can ever evict it again - not a later
  // session replacement, and not the close that account deletion relies on.
  await expect.poll(()=>players(PORT),{timeout:15000}).toBe(1);
  expect(codes).toContain('SESSION_REPLACED');
 } finally { sockets.forEach(ws=>ws.close()); server.kill(); await close(auth); }
});
