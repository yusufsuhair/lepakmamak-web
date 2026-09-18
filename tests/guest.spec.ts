import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import tables from '../shared/tables.json' with {type:'json'};
// Accounts configured and guests on is the shape production runs in. A guest there cannot be
// reported into a ban, so they bring nothing of their own: not a name, not a word.
test('a production guest takes a name off the menu, lands by a mamak table and cannot speak',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8092',ALLOW_GUESTS:'true',GUEST_SEATS:'2',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});const clients:WebSocket[]=[];
 async function join(message:any){const ws=new WebSocket('ws://127.0.0.1:8092/ws');clients.push(ws);const heard:any[]=[];const first=await new Promise<any>((resolve,reject)=>{ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'guest-test',...message})));ws.on('message',raw=>{const m=JSON.parse(String(raw));heard.push(m);if(m.type==='welcome'||m.type==='error')resolve(m);});});return {ws,heard,first};}
 try{
 await expect.poll(async()=>{try{return (await fetch('http://127.0.0.1:8092/health')).ok;}catch{return false;}}).toBe(true);
 const guest=await join({guest:true,name:'Roti Canai 42',gameMaster:true,accessories:['cap']});expect(guest.first.type).toBe('welcome');
 const self=guest.first.players[0];expect(self).toMatchObject({name:'Roti Canai 42',guest:true,gameMaster:false,accessories:[]});
 expect(tables.filter(t=>t.id.startsWith('meja-')).some(t=>t.arrivalX===self.x&&t.arrivalZ===self.z)).toBe(true);
 for(const name of ['New Friend','Roti Canai 4','Roti Canai 420','roti canai 42','  ','bodoh'])expect((await join({guest:true,name})).first.type,name).toBe('error');
 expect((await join({guest:true,name:'Teh Tarik 07',accessToken:'bad-token'})).first.type).toBe('error');
 expect((await join({name:'No explicit guest'})).first.type).toBe('error');
 // Every verb that carries words is refused at the one gate, game chat included.
 const listener=await join({guest:true,name:'Teh Tarik 07'});expect(listener.first.type).toBe('welcome');
 for(const message of [{type:'chat',text:'hello'},{type:'werewolf-chat',text:'hello'},{type:'afk-note',text:'hello'}])guest.ws.send(JSON.stringify(message));
 await expect.poll(()=>guest.heard.filter(m=>m.type==='notice'&&/free account/i.test(m.message)).length).toBe(3);
 expect(listener.heard.some(m=>m.type==='chat')).toBe(false);
 // Two guests hold both guest seats. A third is turned away from a room that is 98 short of
 // full, and told what would get them in; a script cannot fill the city without accounts.
 const third=await join({guest:true,name:'Milo Ais 33'});
 expect(third.first).toMatchObject({type:'error',code:'ROOM_FULL'});expect(third.first.message).toMatch(/free account/i);
 }finally{clients.forEach(ws=>ws.close());server.kill();}
});

test('production server rejects attempts to bypass disabled guest login',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8096',ALLOW_GUESTS:'',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'public-test-key',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});let ws:WebSocket|undefined;
 try{
  await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8096/health')).ok;}catch{return false;}}).toBe(true);
  ws=new WebSocket('ws://127.0.0.1:8096/ws');const result=await new Promise<any>((resolve,reject)=>{ws!.on('error',reject);ws!.on('open',()=>ws!.send(JSON.stringify({type:'join',room:'kampung',guest:true,name:'Bypass'})));ws!.on('message',raw=>resolve(JSON.parse(String(raw))));});
  expect(result).toMatchObject({type:'error',code:'AUTH_REQUIRED'});
 }finally{ws?.close();server.kill();}
});
