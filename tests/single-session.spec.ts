import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

test('new account connection replaces the old across rooms without stale cleanup removing the new one',async()=>{
 const auth=createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'account-one',user_metadata:{display_name:'One'}}));});
 await new Promise<void>(resolve=>auth.listen(0,'127.0.0.1',resolve));
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8094',SUPABASE_URL:`http://127.0.0.1:${(auth.address() as any).port}`,SUPABASE_PUBLISHABLE_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 const clients:WebSocket[]=[];
 const token=`x.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.x`;
 async function join(room:string){const ws=new WebSocket('ws://127.0.0.1:8094/ws');clients.push(ws);const messages:any[]=[];let closed=0;ws.on('close',code=>closed=code);
 await new Promise<void>((resolve,reject)=>{ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room,accessToken:token})));ws.on('message',raw=>{const m=JSON.parse(String(raw));messages.push(m);if(m.type==='welcome')resolve();});});return {ws,messages,get closed(){return closed;}};}
 try{
 await expect.poll(async()=>{try{return (await fetch('http://127.0.0.1:8094/health')).ok;}catch{return false;}}).toBe(true);
 const first=await join('room-a');const second=await join('room-b');
 await expect.poll(()=>first.closed).toBe(4002);
 expect(first.messages.some(m=>m.code==='SESSION_REPLACED')).toBe(true);
 second.ws.send(JSON.stringify({type:'chat',text:'still here'}));
 await expect.poll(()=>second.messages.some(m=>m.type==='chat'&&m.text==='still here')).toBe(true);
 const third=await join('room-b');await expect.poll(()=>second.closed).toBe(4002);
 expect(third.messages.find(m=>m.type==='welcome').players).toHaveLength(1);
 third.ws.send(JSON.stringify({type:'ping'}));await expect.poll(()=>third.messages.some(m=>m.type==='pong')).toBe(true);
 }finally{clients.forEach(ws=>ws.close());server.kill();await new Promise<void>(resolve=>auth.close(()=>resolve()));}
});
