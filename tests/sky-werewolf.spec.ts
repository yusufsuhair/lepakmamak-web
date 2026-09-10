import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import chairs from '../shared/chairs.json' with {type:'json'};
import {SKY} from '../shared/sky-dining.mjs';

// Driven through the shipped ritual — sit, join the lobby, ready up, let the countdown run —
// rather than by poking werewolf-size in by hand. werewolf.spec's fixture does exactly that
// poke, which is why a village of 8 or 9 could never start in production and the suite still
// looked green: the fixture was encoding the workaround.
const PORT='8248';
const bigTable=chairs.filter(c=>c.tableId==='sky-7');
type Client={ws:WebSocket;id:string;lobby:any[];village:any[]};
const connect=(name:string,sockets:WebSocket[])=>new Promise<Client>((resolve,reject)=>{
 const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`); sockets.push(ws);
 const client:Client={ws,id:'',lobby:[],village:[]};
 ws.on('error',reject);
 ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'village',guest:true,name})));
 ws.on('message',raw=>{const m=JSON.parse(String(raw));
  if(m.type==='welcome'){client.id=m.id;resolve(client);}
  if(m.type==='lobby-state')client.lobby.push(m.lobby);
  if(m.type==='werewolf-state')client.village.push(m.game);});
});
const settle=(ms=450)=>new Promise(r=>setTimeout(r,ms));

for(const size of [9])
test(`Wet Deck seats ${size} players and starts Werewolf through the real lobby`,async()=>{
 test.setTimeout(90000);
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 const sockets:WebSocket[]=[];
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);
  const players:Client[]=[];
  for(let i=0;i<size;i++){
   const client=await connect(`P${i}`,sockets);
   const seat=bigTable[i];
   client.ws.send(JSON.stringify({type:'state',...SKY.entry,yaw:0}));await settle(150);
   client.ws.send(JSON.stringify({type:'sky-lift'}));await settle(150);
   client.ws.send(JSON.stringify({type:'state',x:seat.x,z:seat.z,yaw:0,riding:false,speed:0,jumpHeight:0,seated:false,vehicle:'bike'}));
   await settle(120);
   client.ws.send(JSON.stringify({type:'chair-sit',chairId:seat.id}));
   players.push(client);
  }
  await settle();
  for(const client of players) client.ws.send(JSON.stringify({type:'lobby-join',game:'werewolf'}));
  await settle();
  for(const client of players) client.ws.send(JSON.stringify({type:'lobby-ready',ready:true}));

  // The countdown runs, then the village should actually be dealt in.
  await expect.poll(()=>players[0].village.at(-1)?.phase,{timeout:20000}).toBe('night');
  const game=players[0].village.at(-1);
  // Everyone who sat down is in it — members 8 and 9 used to be turned away silently.
  expect(game.players).toHaveLength(size);
  expect(game.size).toBe(size);
  if (size === 5) {
   players[1].ws.send(JSON.stringify({type:'leave-city'}));
   await expect.poll(()=>players[0].village.at(-1)?.players.find((p:any)=>p.id===game.players[1].id)?.alive).toBe(false);
  }
  expect(new Set(game.players.map((p:any)=>p.id)).size).toBe(size);
 } finally { for(const ws of sockets) ws.close(); server.kill(); }
});
