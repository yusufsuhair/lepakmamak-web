import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
test('explicit name-only guests join without account privileges and cannot downgrade an invalid token',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8092',ALLOW_GUESTS:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});const clients:WebSocket[]=[];
 async function join(message:any){const ws=new WebSocket('ws://127.0.0.1:8092/ws');clients.push(ws);return await new Promise<any>((resolve,reject)=>{ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'guest-test',...message})));ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='welcome'||m.type==='error')resolve(m);});});}
 try{
 await expect.poll(async()=>{try{return (await fetch('http://127.0.0.1:8092/health')).ok;}catch{return false;}}).toBe(true);
 const result=await join({guest:true,name:'New Friend',gameMaster:true,accessories:['cap']});expect(result.type).toBe('welcome');expect(result.players[0]).toMatchObject({name:'New Friend',guest:true,gameMaster:false,accessories:[]});
 expect((await join({guest:true,name:'  '})).type).toBe('error');
 expect((await join({guest:true,name:'bodoh'})).type).toBe('error');
 expect((await join({guest:true,name:'Fake',accessToken:'bad-token'})).type).toBe('error');
 expect((await join({name:'No explicit guest'})).type).toBe('error');
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
