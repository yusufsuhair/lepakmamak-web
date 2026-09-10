import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

const PORT='8125';
const AUDIO=Buffer.alloc(1280).toString('base64');

type Client={ws:WebSocket;id:string;chat:any[];voice:any[];party:any[];invited:any[];dmClosed:string[];notices:any[]};

function connect(room:string,name:string):Promise<Client>{
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const client:Client={ws,id:'',chat:[],voice:[],party:[],invited:[],dmClosed:[],notices:[]};
  ws.on('error',reject);
  ws.on('open',()=>ws.send(JSON.stringify({type:'join',room,guest:true,name})));
  ws.on('message',raw=>{
   const m=JSON.parse(String(raw));
   if(m.type==='welcome'){client.id=m.id;ws.send(JSON.stringify({type:'voice-state',mic:true,speaker:true}));resolve(client);}
   if(m.type==='chat')client.chat.push(m);
   if(m.type==='voice-audio')client.voice.push(m);
   if(m.type==='party-state')client.party.push(m);
   if(m.type==='party-invited')client.invited.push(m);
   if(m.type==='dm-closed')client.dmClosed.push(m.id);
   if(m.type==='notice')client.notices.push(m);
  });
 });
}

test('private DM threads close when either participant goes offline',async()=>{
 const server=spawnServer();
 const clients:Client[]=[];
 try{
  await healthy();
  const ali=await connect('dm-lifecycle','Ali'), mei=await connect('dm-lifecycle','Mei'), sara=await connect('dm-lifecycle','Sara');
  clients.push(ali,mei,sara);
  ali.ws.send(JSON.stringify({type:'chat',text:'satu dua tiga',channel:'dm',to:mei.id}));
  await expect.poll(()=>mei.chat.filter(m=>m.text==='satu dua tiga').length).toBe(1);
  mei.ws.close();
  await expect.poll(()=>ali.dmClosed).toContain(mei.id);
  await throttle();
  ali.ws.send(JSON.stringify({type:'chat',text:'tak patut sampai',channel:'dm',to:mei.id}));
  await expect.poll(()=>ali.dmClosed.filter(id=>id===mei.id).length).toBeGreaterThan(1);

  await throttle();
  ali.ws.send(JSON.stringify({type:'chat',text:'round two',channel:'dm',to:sara.id}));
  await expect.poll(()=>sara.chat.filter(m=>m.text==='round two').length).toBe(1);
  ali.ws.close();
  await expect.poll(()=>sara.dmClosed).toContain(ali.id);
 } finally { clients.forEach(c=>c.ws.close()); server.kill(); }
});
const settle=()=>new Promise(r=>setTimeout(r,250));
// The server throttles chat to one message per 700ms, and that applies to every channel.
const throttle=()=>new Promise(r=>setTimeout(r,800));
const spawnServer=()=>spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
const healthy=()=>expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);

test('party chat and private messages reach exactly the right people',async()=>{
 const server=spawnServer();
 const clients:Client[]=[];
 try{
  await healthy();
  const ali=await connect('geng','Ali'), mei=await connect('geng','Mei'), sara=await connect('geng','Sara');
  clients.push(ali,mei,sara);
  await settle();

  ali.ws.send(JSON.stringify({type:'party-invite',id:mei.id}));
  await expect.poll(()=>mei.invited.length).toBe(1);
  expect(mei.invited[0].inviter.name).toBe('Ali');
  mei.ws.send(JSON.stringify({type:'party-accept'}));
  await expect.poll(()=>ali.party.at(-1)?.party?.members?.length).toBe(2);
  expect(sara.party).toHaveLength(0);

  ali.ws.send(JSON.stringify({type:'chat',text:'geng only',channel:'party'}));
  await expect.poll(()=>mei.chat.filter(m=>m.text==='geng only').length).toBe(1);
  expect(mei.chat.at(-1).channel).toBe('party');
  await settle();
  expect(sara.chat.some(m=>m.text==='geng only')).toBe(false);

  await throttle();
  ali.ws.send(JSON.stringify({type:'chat',text:'psst sara',channel:'dm',to:sara.id}));
  await expect.poll(()=>sara.chat.filter(m=>m.text==='psst sara').length).toBe(1);
  expect(sara.chat.at(-1).channel).toBe('dm');
  // The sender sees their own private message, so the thread reads as a conversation.
  await expect.poll(()=>ali.chat.filter(m=>m.text==='psst sara').length).toBe(1);
  await settle();
  expect(mei.chat.some(m=>m.text==='psst sara')).toBe(false);

  await throttle();
  ali.ws.send(JSON.stringify({type:'chat',text:'oi semua',channel:'all'}));
  await expect.poll(()=>sara.chat.filter(m=>m.text==='oi semua').length).toBe(1);
  await expect.poll(()=>mei.chat.filter(m=>m.text==='oi semua').length).toBe(1);
 } finally { clients.forEach(c=>c.ws.close()); server.kill(); }
});

test('party voice crosses the whole city while proximity voice does not',async()=>{
 const server=spawnServer();
 const clients:Client[]=[];
 try{
  await healthy();
  const ali=await connect('voice','Ali'), mei=await connect('voice','Mei'), sara=await connect('voice','Sara');
  clients.push(ali,mei,sara);
  await settle();

  ali.ws.send(JSON.stringify({type:'party-invite',id:mei.id}));
  await expect.poll(()=>mei.invited.length).toBe(1);
  mei.ws.send(JSON.stringify({type:'party-accept'}));
  await expect.poll(()=>ali.party.at(-1)?.party?.members?.length).toBe(2);

  // Mei is far across the city; Sara is standing right next to Ali.
  ali.ws.send(JSON.stringify({type:'state',x:0,z:0}));
  mei.ws.send(JSON.stringify({type:'state',x:120,z:0}));
  sara.ws.send(JSON.stringify({type:'state',x:2,z:0}));
  await settle();

  // Proximity: Sara hears, Mei is far too away.
  ali.ws.send(JSON.stringify({type:'voice-audio',audio:AUDIO}));
  await expect.poll(()=>sara.voice.length).toBe(1);
  await settle();
  expect(mei.voice).toHaveLength(0);

  // Party scope: the distant member hears at full volume, the neighbour hears nothing more.
  ali.ws.send(JSON.stringify({type:'voice-state',mic:true,speaker:true,micScope:'party'}));
  await settle();
  ali.ws.send(JSON.stringify({type:'voice-audio',audio:AUDIO}));
  await expect.poll(()=>mei.voice.length).toBe(1);
  expect(mei.voice[0].volume).toBe(1);
  await settle();
  expect(sara.voice).toHaveLength(1);
 } finally { clients.forEach(c=>c.ws.close()); server.kill(); }
});

test('a party-only listener stops hearing the street',async()=>{
 const server=spawnServer();
 const clients:Client[]=[];
 try{
  await healthy();
  const ali=await connect('ears','Ali'), sara=await connect('ears','Sara');
  clients.push(ali,sara);
  await settle();
  ali.ws.send(JSON.stringify({type:'state',x:0,z:0}));
  sara.ws.send(JSON.stringify({type:'state',x:2,z:0}));
  // Sara only wants her party, and she has none, so the street goes quiet for her.
  sara.ws.send(JSON.stringify({type:'voice-state',mic:true,speaker:true,speakerScope:'party'}));
  await settle();
  ali.ws.send(JSON.stringify({type:'voice-audio',audio:AUDIO}));
  await settle();
  expect(sara.voice).toHaveLength(0);
 } finally { clients.forEach(c=>c.ws.close()); server.kill(); }
});
