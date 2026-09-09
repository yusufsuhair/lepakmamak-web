import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import chairs from '../shared/chairs.json' with {type:'json'};

const seatOf=(id:string)=>chairs.find(c=>c.id===id)!;

const PORT='8132';
const seatsAt=(tableId:string)=>chairs.filter(c=>c.tableId===tableId).map(c=>c.id);

type Client={ws:WebSocket;id:string;seen:any[]};
const join=(room:string,name:string)=>new Promise<Client>((resolve,reject)=>{
 const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
 const client:Client={ws,id:'',seen:[]};
 ws.on('error',reject);
 ws.on('open',()=>ws.send(JSON.stringify({type:'join',room,guest:true,name})));
 ws.on('message',raw=>{const m=JSON.parse(String(raw));client.seen.push(m);if(m.type==='welcome'){client.id=m.id;resolve(client);}});
});
const settle=(ms=400)=>new Promise(r=>setTimeout(r,ms));
const spawnServer=()=>spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
const healthy=()=>expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);
const last=(c:Client,type:string)=>c.seen.filter(m=>m.type===type).at(-1);

// The lobby suite drives stub games, which can never have an empty roster. These drive the
// real modules, which is where the roster actually has to arrive.
test('SEDIA deals a real UNO hand, not an empty game',async()=>{
 const server=spawnServer(); const clients:Client[]=[];
 try{
  await healthy();
  const seats=seatsAt('meja-1');
  const ali=await join('uno-real','Ali'), mei=await join('uno-real','Mei');
  clients.push(ali,mei);
  for(const [c,id] of [[ali,seats[0]],[mei,seats[1]]] as const){
   const seat=seatOf(id);
   c.ws.send(JSON.stringify({type:'state',x:seat.x,z:seat.z}));
  }
  await settle();
  ali.ws.send(JSON.stringify({type:'chair-sit',chairId:seats[0]}));
  mei.ws.send(JSON.stringify({type:'chair-sit',chairId:seats[1]}));
  await settle();

  for(const c of clients) c.ws.send(JSON.stringify({type:'lobby-join',game:'uno'}));
  await settle();
  for(const c of clients) c.ws.send(JSON.stringify({type:'lobby-ready',ready:true}));

  await expect.poll(()=>last(ali,'lobby-state')?.lobby?.phase,{timeout:10000}).toBe('playing');
  // The point of the whole thing: the game has to know about the people the lobby gathered.
  await expect.poll(()=>last(ali,'uno-state')?.game?.players?.length ?? 0,{timeout:10000}).toBe(2);
  const game=last(ali,'uno-state')!.game;
  expect(game.phase).not.toBe('lobby');
 } finally { clients.forEach(c=>c.ws.close()); server.kill(); }
});

test('a Werewolf village started by the lobby has everybody in it',async()=>{
 const server=spawnServer(); const clients:Client[]=[];
 try{
  await healthy();
  // Werewolf gathers city-wide, so spread them over whatever seats exist.
  const seats=[...seatsAt('meja-9'),...seatsAt('meja-1'),...seatsAt('meja-3')];
  for(let i=0;i<7;i++){
   const c=await join('ww-real',`P${i}`);
   clients.push(c);
   const seat=seatOf(seats[i]);
   c.ws.send(JSON.stringify({type:'state',x:seat.x,z:seat.z}));
   await settle(120);
   c.ws.send(JSON.stringify({type:'chair-sit',chairId:seats[i]}));
  }
  await settle(600);
  for(const c of clients) c.ws.send(JSON.stringify({type:'lobby-join',game:'werewolf'}));
  await settle();
  expect(last(clients[0],'lobby-state')?.lobby?.members?.length).toBe(7);

  for(const c of clients) c.ws.send(JSON.stringify({type:'lobby-ready',ready:true}));
  await expect.poll(()=>last(clients[0],'lobby-state')?.lobby?.phase,{timeout:10000}).toBe('playing');

  // Everyone the lobby gathered must be in the village the game started.
  await expect.poll(()=>last(clients[0],'werewolf-state')?.game?.players?.length ?? 0,{timeout:10000}).toBe(clients.length);
  const game=last(clients[0],'werewolf-state')!.game;
  expect(game.phase).not.toBe('lobby');
  expect(game.players.every((p:any)=>p.alive)).toBe(true);
 } finally { clients.forEach(c=>c.ws.close()); server.kill(); }
});
