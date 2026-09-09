import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import http from 'node:http';
import WebSocket from 'ws';

const PORT='8213', ALERT_PORT=8214, PLAYERS=6;

test('health reports what the instance is actually doing, and saturation reaches a webhook',async()=>{
 const alerts:string[]=[]; const beats:string[]=[];
 const receiver=http.createServer((request,response)=>{
  let body='';request.on('data',chunk=>body+=chunk);
  request.on('end',()=>{(request.url==='/beat'?beats:alerts).push(body);response.writeHead(200);response.end('ok');});
 }).listen(ALERT_PORT);
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,
  PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',
  // One byte a second is not a realistic ceiling; it is the smallest one that proves the
  // threshold, the sustain window and the webhook are wired to each other.
  ALERT_WEBHOOK_URL:`http://127.0.0.1:${ALERT_PORT}/alert`,ALERT_BYTES_PER_SECOND:'1',ALERT_SAMPLES:'2',
  HEARTBEAT_URL:`http://127.0.0.1:${ALERT_PORT}/beat`,HEARTBEAT_SECONDS:'1'},stdio:'ignore'});
 const health=async()=>(await (await fetch(`http://127.0.0.1:${PORT}/health`)).json());
 const clients:WebSocket[]=[];let timer:NodeJS.Timeout|undefined;
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);

  const idle=await health();
  expect(idle.sockets).toBe(0);
  expect(idle.rooms).toEqual([]);
  expect(idle.bytesOutPerSecond).toBe(0);

  for(let i=0;i<PLAYERS;i++){
   const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);clients.push(ws);
   await new Promise<void>((resolve,reject)=>{ws.on('error',reject);
    ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'metrics',guest:true,name:`Player ${i}`,opus:true})));
    ws.on('message',raw=>{if(JSON.parse(String(raw)).type==='welcome')resolve();});});
   // One mouth, everybody else listening: the fan-out is the number that costs money.
   ws.send(JSON.stringify({type:'voice-state',mic:i===0,speaker:true}));
  }
  let tick=0;
  timer=setInterval(()=>{tick++;
   clients.forEach((ws,i)=>ws.send(JSON.stringify({type:'state',x:-18+Math.sin(tick*.1)+i*.2,z:52,yaw:0,speed:3,riding:false})));
   clients[0].send(JSON.stringify({type:'voice-audio',codec:'opus',audio:'A'.repeat(200)}));
  },50);

  await expect.poll(async()=>(await health()).voicePacketsOutPerSecond,{timeout:15000}).toBeGreaterThan(0);
  const loaded=await health();
  expect(loaded.sockets).toBe(PLAYERS);
  expect(loaded.players).toBe(PLAYERS);
  expect(loaded.rooms).toHaveLength(1);
  expect(loaded.rooms[0].name).toBe('metrics');
  expect(loaded.rooms[0].sockets).toBe(PLAYERS);
  expect(loaded.rooms[0].bytesOutPerSecond).toBeGreaterThan(0);
  expect(loaded.bytesInPerSecond).toBeGreaterThan(0);
  expect(loaded.bytesOutPerSecond).toBeGreaterThanOrEqual(loaded.rooms[0].bytesOutPerSecond);
  expect(loaded.voicePacketsInPerSecond).toBeGreaterThan(0);
  // Every accepted frame is relayed to the other five, so the relay count leads the intake.
  expect(loaded.voicePacketsOutPerSecond).toBeGreaterThan(loaded.voicePacketsInPerSecond);
  expect(loaded.uptimeSeconds).toBeGreaterThan(0);
  expect(loaded.residentMegabytes).toBeGreaterThan(0);

  await expect.poll(()=>alerts.length,{timeout:15000}).toBeGreaterThan(0);
  expect(JSON.parse(alerts[0]).content).toContain('saturated');
  // One alert per crossing, not one per second: a page that repeats stops being read.
  const fired=alerts.length;
  await new Promise(resolve=>setTimeout(resolve,3000));
  expect(alerts.length).toBe(fired);
  expect((await health()).saturated).toBe(true);
  // Still HTTP 200 while saturated: a 503 here would have Railway restart the instance and
  // wipe the rooms it was complaining about.
  expect((await fetch(`http://127.0.0.1:${PORT}/health`)).status).toBe(200);

  await expect.poll(()=>beats.length,{timeout:15000}).toBeGreaterThan(0);
 } finally { clearInterval(timer);clients.forEach(ws=>ws.close());server.kill();receiver.close(); }
});
