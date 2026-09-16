import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

const PORT='8130';

test('the server answers a ping with the same stamp so the client can time it',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 let ws:WebSocket|undefined;
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);
  const pong=await new Promise<any>((resolve,reject)=>{
   ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
   ws.on('error',reject);
   ws.on('open',()=>ws!.send(JSON.stringify({type:'join',room:'ping',guest:true,name:'Pinger'})));
   ws.on('message',raw=>{const m=JSON.parse(String(raw));
    if(m.type==='welcome')ws!.send(JSON.stringify({type:'ping',t:12345}));
    if(m.type==='pong')resolve(m);});
  });
  expect(pong.t).toBe(12345);
 } finally { ws?.close(); server.kill(); }
});

const mountStatus=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {createNetStatus}=await import('/src/netstatus.ts');
  (window as any).net=createNetStatus(document.getElementById('hud')!);
 });
};

test('the meter shows the round trip and grades the connection by it',async({page})=>{
 await mountStatus(page,'net-harness');
 await page.evaluate(()=>(window as any).net.sample(42));
 await expect(page.locator('#net-ping')).toHaveText('42 ms');
 await expect(page.locator('#net-status')).toHaveAttribute('data-grade','good');

 await page.evaluate(()=>(window as any).net.sample(220));
 await expect(page.locator('#net-ping')).toHaveText('220 ms');
 await expect(page.locator('#net-status')).toHaveAttribute('data-grade','poor');

 await page.evaluate(()=>(window as any).net.sample(900));
 await expect(page.locator('#net-status')).toHaveAttribute('data-grade','bad');
});

test('the bars fill according to the grade, and empty when the city is gone',async({page})=>{
 await mountStatus(page,'bars-harness');
 await page.evaluate(()=>(window as any).net.sample(30));
 const strong=await page.evaluate(()=>document.querySelectorAll('#net-status .bar.on').length);
 await page.evaluate(()=>(window as any).net.sample(400));
 const weak=await page.evaluate(()=>document.querySelectorAll('#net-status .bar.on').length);
 expect(strong).toBeGreaterThan(weak);

 await page.evaluate(()=>(window as any).net.offline());
 await expect(page.locator('#net-ping')).toHaveText('—');
 expect(await page.evaluate(()=>document.querySelectorAll('#net-status .bar.on').length)).toBe(0);
});

test('FPS appears below the round-trip time using a stable frame window',async({page})=>{
 await mountStatus(page,'fps-harness');
 await page.evaluate(()=>{
  const net=(window as any).net;
  net.sample(42);
  for(let frame=0;frame<60;frame++)net.frame(1/60);
 });
 await expect(page.locator('#net-ping')).toHaveText('42 ms');
 await expect(page.locator('#net-fps')).toHaveText('60 FPS');
 await page.evaluate(()=>(window as any).net.quality('low'));
 await expect(page.locator('#net-graphics')).toHaveText('GRAPHIC: LOW');
 const readings=page.locator('#net-status .net-readings');
 await expect(readings.locator('b').nth(0)).toHaveAttribute('id','net-ping');
 await expect(readings.locator('b').nth(1)).toHaveAttribute('id','net-fps');
 await expect(readings.locator('b').nth(2)).toHaveAttribute('id','net-graphics');
});

const mountSpeaking=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {createSpeakingList}=await import('/src/speaking.ts');
  (window as any).sp=createSpeakingList(document.getElementById('hud')!,300);
 });
};

test('only whoever is talking right now appears under the map',async({page})=>{
 await mountSpeaking(page,'speaking-harness');
 await expect(page.locator('#speaking .speaker')).toHaveCount(0);

 await page.evaluate(()=>(window as any).sp.heard('u1','Aina'));
 await expect(page.locator('#speaking .speaker')).toHaveCount(1);
 await expect(page.locator('#speaking .speaker')).toContainText('Aina');
 // A small live character face, the way Discord shows an avatar.
 await expect(page.locator('#speaking .speaker-face .player-face-head')).toHaveCount(1);

 await page.evaluate(()=>(window as any).sp.heard('u2','Bala'));
 await expect(page.locator('#speaking .speaker')).toHaveCount(2);

 // Silence removes them again without anything else having to tell it.
 await expect(page.locator('#speaking .speaker')).toHaveCount(0,{timeout:5000});
});

test('a run of packets from one person is one row, not a pile of them',async({page})=>{
 await mountSpeaking(page,'repeat-harness');
 await page.evaluate(()=>{const sp=(window as any).sp;for(let i=0;i<12;i++)sp.heard('u1','Aina');});
 await expect(page.locator('#speaking .speaker')).toHaveCount(1);
});
