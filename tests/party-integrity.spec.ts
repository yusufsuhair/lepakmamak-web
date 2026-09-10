import {test,expect} from '@playwright/test';
import {createParty} from '../server/party.mjs';
import {createServer} from 'node:net';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import WebSocket from 'ws';
import chairs from '../shared/chairs.json' with {type:'json'};

test('an invite cannot add somebody after its inviter joins another leader\'s party',()=>{
 const sent:any[]=[];
 const party=createParty((ws:any,message:any)=>sent.push({ws,...message}));
 const players=new Map<string,any>();
 const add=(id:string)=>{const player={id,name:id.toUpperCase(),ws:id,x:0,z:0};players.set(id,player);return player;};
 const ali=add('ali'),bala=add('bala'),chong=add('chong');

 // Ali has authority over nobody when this invitation is issued.
 party.handle(players,ali,{type:'party-invite',id:bala.id});
 // Chong then forms a party and remains its leader; Ali is only a member.
 party.handle(players,chong,{type:'party-invite',id:ali.id});
 party.handle(players,ali,{type:'party-accept'});
 expect(chong.partyId).toBe(ali.partyId);

 // An old solo invitation must not let a non-leader smuggle Bala into Chong's party.
 party.handle(players,bala,{type:'party-accept'});
 expect(bala.partyId).toBeFalsy();
 expect(sent.filter(message=>message.type==='party-state').at(-1).party.members.map((member:any)=>member.id).sort()).toEqual(['ali','chong']);
});

test('an invitation from a former leader expires when leadership changes',()=>{
 const party=createParty(()=>{});
 const players=new Map<string,any>();
 const add=(id:string)=>{const player={id,name:id.toUpperCase(),ws:id,x:0,z:0};players.set(id,player);return player;};
 const leader=add('leader'),member=add('member'),invitee=add('invitee');

 party.handle(players,leader,{type:'party-invite',id:member.id});
 party.handle(players,member,{type:'party-accept'});
 party.handle(players,leader,{type:'party-invite',id:invitee.id});
 party.handle(players,leader,{type:'party-leave'});
 expect(member.partyId).toBeTruthy();

 party.handle(players,invitee,{type:'party-accept'});
 expect(invitee.partyId).toBeFalsy();
});

test('crossed invitations resolve to one party rather than two',()=>{
 const party=createParty(()=>{});
 const ali:any={id:'ali',name:'ALI',ws:'ali'},bala:any={id:'bala',name:'BALA',ws:'bala'};
 const players=new Map([['ali',ali],['bala',bala]]);
 party.handle(players,ali,{type:'party-invite',id:bala.id});
 party.handle(players,bala,{type:'party-invite',id:ali.id});
 party.handle(players,ali,{type:'party-accept'});
 party.handle(players,bala,{type:'party-accept'});
 expect(ali.partyId).toBeTruthy();
 expect(bala.partyId).toBe(ali.partyId);
 expect(party.members(players,ali).map((player:any)=>player.id).sort()).toEqual(['ali','bala']);
});

let server:ChildProcess;
let port:number;
test.beforeAll(async()=>{
 const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
 port=(reservation.address() as {port:number}).port;await new Promise<void>(resolve=>reservation.close(()=>resolve()));
 server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',OPENAI_API_KEY:'',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:''},stdio:['ignore','pipe','pipe']});
 await new Promise<void>((resolve,reject)=>{
  let stdout='',stderr='';const timeout=setTimeout(()=>done(Error(`Server readiness timeout: ${stderr}`)),10000);
  function done(error?:Error){clearTimeout(timeout);error?reject(error):resolve();}
  server.on('error',done);server.once('exit',code=>done(Error(`Server exited ${code}: ${stderr}`)));
  server.stderr!.on('data',chunk=>stderr+=String(chunk));server.stdout!.on('data',chunk=>{stdout+=String(chunk);if(stdout.includes(`listening on ${port}`))done();});
 });
});
test.afterAll(async()=>{if(server&&server.exitCode===null&&server.signalCode===null){const exited=once(server,'exit');server.kill();await exited;}});

type Client={ws:WebSocket;id:string;messages:any[]};
const opened:Client[]=[];
const latest=(client:Client,type:string)=>client.messages.filter(message=>message.type===type).at(-1);
const send=(client:Client,message:object)=>client.ws.send(JSON.stringify(message));
test.afterEach(()=>{for(const client of opened.splice(0))client.ws.terminate();});
async function connectMany(count:number,tableId:string){
 const room=`party-integrity-${randomUUID().slice(0,10)}`,seats=chairs.filter(chair=>chair.tableId===tableId);
 const clients:Client[]=[];
 for(let index=0;index<count;index++){
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),client={ws,id:'',messages:[]};opened.push(client);clients.push(client);
  ws.on('message',raw=>{const message=JSON.parse(String(raw));client.messages.push(message);if(message.type==='welcome')client.id=message.id;});
  await Promise.race([once(ws,'open'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Socket did not open')),5000).unref())]);
  send(client,{type:'join',room,guest:true,name:`Player ${index}`});await expect.poll(()=>client.id).not.toBe('');
  send(client,{type:'state',x:seats[index].x,z:seats[index].z});send(client,{type:'chair-sit',chairId:seats[index].id});
  await expect.poll(()=>latest(client,'players')?.players.find((player:any)=>player.id===client.id)?.chairId).toBe(seats[index].id);
 }
 return clients;
}
async function formParty(first:Client,second:Client){
 send(first,{type:'party-invite',id:second.id});await expect.poll(()=>latest(second,'party-invited')).toBeTruthy();
 send(second,{type:'party-accept'});await expect.poll(()=>latest(first,'party-state')?.party?.members.length).toBe(2);
 send(first,{type:'voice-state',mic:true,speaker:true,micScope:'party'});
 send(second,{type:'voice-state',mic:false,speaker:true,speakerScope:'party'});
}
async function startViaLobby(clients:Client[],game:string){
 for(const client of clients)send(client,{type:'lobby-join',game});
 await expect.poll(()=>latest(clients[0],'lobby-state')?.lobby?.members.length).toBe(clients.length);
 for(const client of clients)send(client,{type:'lobby-ready',ready:true});
 await expect.poll(()=>latest(clients[0],'lobby-state')?.lobby?.phase,{timeout:8000}).toBe('playing');
 await expect.poll(()=>latest(clients[0],`${game}-state`)?.game).toBeTruthy();
}
const audio=Buffer.alloc(1280).toString('base64');

test('Werewolf cannot be bypassed with private party voice',async()=>{
 const clients=await connectMany(5,'meja-9');await formParty(clients[0],clients[1]);await startViaLobby(clients,'werewolf');
 expect(latest(clients[0],'werewolf-state').game.phase).toBe('night');
 const before=clients[1].messages.filter(message=>message.type==='voice-audio').length;
 send(clients[0],{type:'voice-audio',audio});
 await new Promise(resolve=>setTimeout(resolve,500));
 expect(clients[1].messages.filter(message=>message.type==='voice-audio')).toHaveLength(before);
});

test('the Lukis drawer cannot reveal the answer with private party voice',async()=>{
 const clients=await connectMany(2,'meja-1');await formParty(clients[0],clients[1]);await startViaLobby(clients,'lukis');
 expect(['choosing','drawing']).toContain(latest(clients[0],'lukis-state').game.phase);
 const before=clients[1].messages.filter(message=>message.type==='voice-audio').length;
 send(clients[0],{type:'voice-audio',audio});
 await new Promise(resolve=>setTimeout(resolve,500));
 expect(clients[1].messages.filter(message=>message.type==='voice-audio')).toHaveLength(before);
});

test('a former member receives no party chat or voice after leaving',async()=>{
 const clients=await connectMany(2,'meja-1');await formParty(clients[0],clients[1]);
 send(clients[1],{type:'party-leave'});
 await expect.poll(()=>latest(clients[1],'party-state')?.party).toBeNull();
 await expect.poll(()=>latest(clients[0],'party-state')?.party?.members.length).toBe(1);
 const chatBefore=clients[1].messages.filter(message=>message.type==='chat').length;
 const voiceBefore=clients[1].messages.filter(message=>message.type==='voice-audio').length;
 send(clients[0],{type:'chat',channel:'party',text:'bekas ahli tidak patut dengar'});
 send(clients[0],{type:'voice-audio',audio});
 await new Promise(resolve=>setTimeout(resolve,800));
 expect(clients[1].messages.filter(message=>message.type==='chat')).toHaveLength(chatBefore);
 expect(clients[1].messages.filter(message=>message.type==='voice-audio')).toHaveLength(voiceBefore);
});
