import{mkdtempSync,writeFileSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';
import{join}from'node:path';
import {test,expect,chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
// Explicit opt-in: this test creates real media sessions in the supplied test SFU app.
test('real SFU carries audio, revokes distant listeners and restores a returning listener',async()=>{
 test.skip(process.env.RUN_SFU_LIVE!=='true','Needs an isolated SFU credential');
 test.setTimeout(180000);
 const peerCount=Math.max(2,Math.min(10,Number(process.env.SFU_LIVE_PEERS)||2));
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'18994',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:['ignore','ignore','pipe']});let errors='';server.stderr.on('data',b=>errors+=b);
 const pages:any[]=[];
 const audioDir=mkdtempSync(join(tmpdir(),'lepak-sfu-audio-'));const path=join(audioDir,'speech-tone.wav');
 const samples=16000*8, wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/16000)*8000),44+i*2);writeFileSync(path,wav);

 const browser=await chromium.launch({channel:'chrome',args:[`--use-file-for-fake-audio-capture=${path}`,'--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 try{
  await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:18994/health')).ok;}catch{return false;}}).toBe(true);

  for(let i=0;i<peerCount;i++){
   const context=await browser.newContext({permissions:['microphone','local-network-access']});const page=await context.newPage();pages.push(page);
   await page.route('**/sfu-harness',r=>r.fulfill({contentType:'text/html',body:`<div id="hud"></div><script type="module">
import{setupVoice}from'/src/voice.ts';
window.events=[];window.activity=[];window.sent=[];
const ws=new WebSocket('ws://127.0.0.1:18994/ws');window.ws=ws;
const voice=setupVoice(m=>{window.sent.push(m.type);if(ws.readyState!==1)return false;ws.send(JSON.stringify(m));return true;},(id,name,level)=>window.activity.push({id,name,level}));window.voice=voice;
document.querySelector('#voice-panel').hidden=false;
ws.onopen=()=>ws.send(JSON.stringify({type:'join',room:'sfu-live',name:'Probe${i}',sfu:true}));
ws.onmessage=e=>{const m=JSON.parse(e.data);window.events.push(m);if(m.type==='welcome'){voice.transport(m.voiceTransport);voice.connected(true);}voice.signal(m);};
</script>`}));
   page.on('console',m=>{if(m.type()==='error')console.log('browser error',m.text());});page.on('pageerror',e=>console.log('page error',e.message));
   await page.addInitScript(()=>{const Original=window.RTCPeerConnection;(window as any).__pcs=[];window.RTCPeerConnection=class extends Original{constructor(config?:RTCConfiguration){super(config);(window as any).__pcs.push(this);}};});
   await page.goto('/sfu-harness');await expect(page.locator('#voice-speaker')).toBeEnabled();
  }
  await pages[1].locator('#voice-speaker').click();
  await pages[0].locator('#voice-mic').click();
  await expect.poll(()=>pages[1].evaluate(()=>((window as any).activity as any[]).filter(v=>v.level>0).length),{timeout:45000,message:errors}).toBeGreaterThan(0);
  expect(await pages[0].evaluate(()=>(window as any).sent.includes('voice-audio'))).toBe(false);
  if(peerCount>2){
   for(let i=1;i<peerCount;i++)await pages[i].locator('#voice-mic').click();
   await expect.poll(()=>pages.at(-1).evaluate(()=>new Set((window as any).activity.filter((v:any)=>v.level>0).map((v:any)=>v.id)).size),{timeout:45000}).toBe(peerCount-1);
   await pages.at(-1).waitForTimeout(30000);
   const quality=await Promise.all(pages.map(page=>page.evaluate(async()=>await (window as any).voice.stats())));
   expect(quality.every(q=>q.voicePacketsReceived>0&&q.publishState==='connected'&&q.subscribeState==='connected')).toBe(true);
   console.log('SFU fanout',JSON.stringify({peers:peerCount,seconds:30,maxJitterMs:Math.max(...quality.map(q=>q.voiceJitterMs)),lostPackets:quality.reduce((n,q)=>n+q.voicePacketsLost,0),receivedPackets:quality.reduce((n,q)=>n+q.voicePacketsReceived,0)}));
   return;
  }

  await pages[1].evaluate(()=>(window as any).ws.send(JSON.stringify({type:'state',x:90,z:52})));
  await expect.poll(()=>pages[1].evaluate(()=>{const e=(window as any).events.filter((m:any)=>m.type==='voice-peers');return e.at(-1)?.peers.length;})).toBe(0);
  // Do not trust local muting: inbound RTP packet count must stop increasing after revocation.
  await pages[1].waitForTimeout(2500);
  const before=await pages[1].evaluate(async()=>await (window as any).voice.stats());
  await pages[1].waitForTimeout(1500);
  const after=await pages[1].evaluate(async()=>await (window as any).voice.stats());
  expect(after.voicePacketsReceived-before.voicePacketsReceived).toBeLessThan(5);
  await pages[1].evaluate(()=>{(window as any).activity=[];(window as any).ws.send(JSON.stringify({type:'state',x:-18,z:52}));});
  await expect.poll(()=>pages[1].evaluate(()=>(window as any).activity.filter((v:any)=>v.level>0).length),{timeout:20000}).toBeGreaterThan(0);
  // Simulate a failed receiver transport without touching the game WebSocket.
  await pages[1].evaluate(()=>{(window as any).activity=[];const pc=(window as any).__pcs.at(-1);Object.defineProperty(pc,'connectionState',{value:'failed',configurable:true});pc.dispatchEvent(new Event('connectionstatechange'));});
  await expect.poll(()=>pages[1].evaluate(()=>(window as any).activity.filter((v:any)=>v.level>0).length),{timeout:20000}).toBeGreaterThan(0);
  expect(await pages[1].evaluate(()=>(window as any).ws.readyState)).toBe(1);
  await pages[0].evaluate(()=>{const pc=(window as any).__pcs.find((p:RTCPeerConnection)=>p.connectionState==='connected'&&p.getSenders().some(s=>s.track));Object.defineProperty(pc,'connectionState',{value:'failed',configurable:true});pc.dispatchEvent(new Event('connectionstatechange'));});
  await expect.poll(()=>pages[0].evaluate(async()=>(await (window as any).voice.stats()).publishState),{timeout:20000}).toBe('connected');
  await pages[1].evaluate(()=>(window as any).activity=[]);
  await expect.poll(()=>pages[1].evaluate(()=>(window as any).activity.filter((v:any)=>v.level>0).length),{timeout:20000}).toBeGreaterThan(0);

  await pages[0].locator('#voice-mic').click();
  await expect(pages[0].locator('#voice-mic')).toHaveAttribute('aria-pressed','false');
  await pages[1].evaluate(()=>(window as any).activity=[]);
  await pages[0].locator('#voice-mic').click();
  await expect.poll(()=>pages[1].evaluate(()=>(window as any).activity.filter((v:any)=>v.level>0).length),{timeout:20000}).toBeGreaterThan(0);
 }catch(error){for(const page of pages)console.log('SFU DIAGNOSTIC',await page.evaluate(async()=>({status:document.querySelector('#voice-status')?.textContent,stats:await (window as any).voice.stats(),activity:(window as any).activity.slice(-3),events:(window as any).events.filter((m:any)=>m.type.startsWith('voice')).slice(-12).map((m:any)=>({type:m.type,error:m.error,peers:m.peers,resultKeys:Object.keys(m.result||{}),tracks:m.result?.tracks}))})));console.log('server',errors);throw error;}finally{await browser.close();server.kill();rmSync(audioDir,{recursive:true,force:true});}
});
