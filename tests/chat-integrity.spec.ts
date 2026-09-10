import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {tableOf,seatedWith} from '../server/seating.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};

test('one seating helper, and it agrees with the chairs',()=>{
 const chair=chairs.find(c=>c.tableId)!;
 expect(tableOf({chairId:chair.id})).toBe(chair.tableId);
 expect(tableOf({chairId:'nonsense'})).toBeUndefined();
 expect(tableOf({})).toBeUndefined();
 const players=new Map([['a',{id:'a',chairId:chair.id}],['b',{id:'b',chairId:'nonsense'}]] as any);
 expect(seatedWith(players as any,chair.tableId).map((p:any)=>p.id)).toEqual(['a']);
 expect(seatedWith(players as any,undefined as any)).toEqual([]);
});

const PORT='8251';
const spawnServer=()=>spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
type Client={ws:WebSocket;id:string;chat:any[];notices:any[]};
const join=(room:string,name:string,sockets:WebSocket[])=>new Promise<Client>((resolve,reject)=>{
 const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`); sockets.push(ws);
 const client:Client={ws,id:'',chat:[],notices:[]};
 ws.on('error',reject);
 ws.on('open',()=>ws.send(JSON.stringify({type:'join',room,guest:true,name})));
 ws.on('message',raw=>{const m=JSON.parse(String(raw));
  if(m.type==='welcome'){client.id=m.id;resolve(client);}
  if(m.type==='chat')client.chat.push(m);
  if(m.type==='notice')client.notices.push(m);});
});
const settle=()=>new Promise(r=>setTimeout(r,300));
// chair-sit refuses from across the room, so walk them onto the chair first.
const sit=async(client:Client,seat:{id:string;x:number;z:number})=>{
 client.ws.send(JSON.stringify({type:'state',x:seat.x,z:seat.z,yaw:0,riding:false,speed:0,jumpHeight:0,seated:false,vehicle:'bike'}));
 await settle();
 client.ws.send(JSON.stringify({type:'chair-sit',chairId:seat.id}));
 await settle();
};
const throttle=()=>new Promise(r=>setTimeout(r,800));

test('a table message reaches that table and nobody else, and is never saved',async()=>{
 const server=spawnServer(); const sockets:WebSocket[]=[];
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);
  const seats=chairs.filter(c=>c.tableId==='meja-1').slice(0,2);
  const ali=await join('tables','Ali',sockets), mei=await join('tables','Mei',sockets), ravi=await join('tables','Ravi',sockets);

  // Nobody seated yet: the table channel has nowhere to send.
  ali.ws.send(JSON.stringify({type:'chat',channel:'table',text:'anyone there'}));
  await settle();
  expect(ali.notices.at(-1)?.message).toMatch(/Duduk di meja/);
  expect(mei.chat).toHaveLength(0);

  await sit(ali,seats[0]); await sit(mei,seats[1]);

  await throttle();
  ali.ws.send(JSON.stringify({type:'chat',channel:'table',text:'jom main uno'}));
  await settle();
  // Both people on the chairs hear it; the man standing three metres away does not.
  expect(mei.chat.filter(m=>m.channel==='table').map(m=>m.text)).toEqual(['jom main uno']);
  expect(ali.chat.filter(m=>m.channel==='table')).toHaveLength(1);
  expect(ravi.chat.filter(m=>m.channel==='table')).toHaveLength(0);

  // A newcomer gets the public history and nothing from the table.
  const later=await join('tables','Later',sockets);
  await settle();
  expect(later.chat.some(m=>m.text==='jom main uno')).toBe(false);
 } finally { for(const ws of sockets) ws.close(); server.kill(); }
});

test('party and DM are shut while a hidden-information match is live',async()=>{
 const server=spawnServer(); const sockets:WebSocket[]=[];
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);
  const seats=chairs.filter(c=>c.tableId==='meja-1').slice(0,2);
  const wolf=await join('village','Wolf',sockets), pal=await join('village','Pal',sockets);
  await sit(wolf,seats[0]); await sit(pal,seats[1]);

  // With no match running, private channels behave normally: party says "no party yet".
  wolf.ws.send(JSON.stringify({type:'chat',channel:'party',text:'hello'}));
  await settle();
  expect(wolf.notices.map(n=>n.message).join(' | ')).toMatch(/not in a Geng/i);

  // Start a Lukis round at the table — a live hidden-information match.
  wolf.ws.send(JSON.stringify({type:'lukis-start'}));
  await settle();

  // Exploit: the drawer DMs the word to a friend.
  await throttle();
  wolf.notices.length=0;
  wolf.ws.send(JSON.stringify({type:'chat',channel:'dm',to:pal.id,text:'the word is kucing'}));
  await settle();
  expect(wolf.notices.map(n=>n.message).join(' | ')).toMatch(/Geng dan DM ditutup/);
  expect(pal.chat.filter(m=>m.channel==='dm')).toHaveLength(0);

  // Exploit: the same pair coordinate in party chat.
  await throttle();
  wolf.notices.length=0;
  wolf.ws.send(JSON.stringify({type:'chat',channel:'party',text:'kucing lah'}));
  await settle();
  expect(wolf.notices.map(n=>n.message).join(' | ')).toMatch(/Geng dan DM ditutup/);

  // The table channel is exactly what they are told to use, and it still works.
  await throttle();
  wolf.ws.send(JSON.stringify({type:'chat',channel:'table',text:'susah nya'}));
  await settle();
  expect(pal.chat.filter(m=>m.channel==='table').map(m=>m.text)).toContain('susah nya');
 } finally { for(const ws of sockets) ws.close(); server.kill(); }
});
