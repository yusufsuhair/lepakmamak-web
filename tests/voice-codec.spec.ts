import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {readFileSync} from 'node:fs';

const PORT='8151';

// The server cannot transcode, so a room speaks Opus only while every player can decode it.
function start(){return spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});}
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(`http://127.0.0.1:${PORT}/health`)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('no server');}
type Client={ws:WebSocket;seen:any[]};
function join(name:string,opus:boolean):Promise<Client>{
 return new Promise((resolve,reject)=>{
  const seen:any[]=[];const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  ws.on('error',reject);
  ws.on('open',()=>ws.send(JSON.stringify({type:'join',guest:true,name,opus})));
  // Surface a refusal instead of hanging until the test times out.
  ws.on('message',(d:Buffer,isBinary:boolean)=>{if(isBinary)return;const m=JSON.parse(String(d));seen.push(m);if(m.type==='welcome')resolve({ws,seen});if(m.type==='error')reject(new Error(`join refused: ${m.code||m.message}`));});
 });
}
const lastCodec=(c:Client)=>[...c.seen].reverse().find(m=>m.type==='voice-codec')?.codec;

test('a room speaks Opus only while everyone can decode it',async()=>{
 const server=start();const open:Client[]=[];
 try{
  await ready();
  const a=await join('Ali',true);open.push(a);
  const b=await join('Bakar',true);open.push(b);
  await expect.poll(()=>lastCodec(a),{timeout:5000}).toBe('opus');
  // One player without Opus costs the whole room the saving.
  const old=await join('Lama',false);open.push(old);
  await expect.poll(()=>lastCodec(a),{timeout:5000}).toBe('pcm');
  await expect.poll(()=>lastCodec(old),{timeout:5000}).toBe('pcm');
  // ...and giving it back when they leave.
  old.ws.close();
  await expect.poll(()=>lastCodec(a),{timeout:5000}).toBe('opus');
 } finally { open.forEach(c=>c.ws.close()); server.kill(); }
});

test('an Opus frame reaches a nearby listener tagged as Opus, and PCM still works',async()=>{
 const server=start();const open:Client[]=[];
 try{
  await ready();
  const speaker=await join('Speaker',true);open.push(speaker);
  const listener=await join('Listener',true);open.push(listener);
  speaker.ws.send(JSON.stringify({type:'voice-state',mic:true,speaker:false}));
  listener.ws.send(JSON.stringify({type:'voice-state',mic:false,speaker:true}));
  await new Promise(r=>setTimeout(r,200));
  const opusPayload=Buffer.alloc(119,7).toString('base64');
  speaker.ws.send(JSON.stringify({type:'voice-audio',codec:'opus',audio:opusPayload}));
  await expect.poll(()=>listener.seen.filter(m=>m.type==='voice-audio').length,{timeout:5000}).toBeGreaterThan(0);
  const heard=listener.seen.find(m=>m.type==='voice-audio');
  expect(heard.codec).toBe('opus');
  expect(heard.audio).toBe(opusPayload);
  // The old raw path is still accepted, so a fallback speaker is never silent.
  const pcm=Buffer.alloc(1280,3).toString('base64');
  expect(pcm.length).toBe(1708);
  speaker.ws.send(JSON.stringify({type:'voice-audio',audio:pcm}));
  await expect.poll(()=>listener.seen.filter(m=>m.type==='voice-audio'&&m.codec==='pcm').length,{timeout:5000}).toBeGreaterThan(0);
 } finally { open.forEach(c=>c.ws.close()); server.kill(); }
});

test('a malformed or oversized Opus frame is refused', async()=>{
 const server=start();const open:Client[]=[];
 try{
  await ready();
  const speaker=await join('Speaker',true);open.push(speaker);
  const listener=await join('Listener',true);open.push(listener);
  speaker.ws.send(JSON.stringify({type:'voice-state',mic:true,speaker:false}));
  listener.ws.send(JSON.stringify({type:'voice-state',mic:false,speaker:true}));
  await new Promise(r=>setTimeout(r,200));
  speaker.ws.send(JSON.stringify({type:'voice-audio',codec:'opus',audio:'not base64!!'}));
  speaker.ws.send(JSON.stringify({type:'voice-audio',codec:'opus',audio:Buffer.alloc(600,1).toString('base64')}));
  await new Promise(r=>setTimeout(r,600));
  expect(listener.seen.filter(m=>m.type==='voice-audio')).toHaveLength(0);
 } finally { open.forEach(c=>c.ws.close()); server.kill(); }
});

// The browser half: the client must ask for Opus, and the exact config the source uses has to
// produce one decodable frame per 40 ms of audio.
const AUTH_STUB=`export const session={access_token:'test',user:{id:'a',user_metadata:{display_name:'Driver'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Driver';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`;

test('the client asks for Opus and survives a codec switch',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:AUTH_STUB}));
 let join:any=null;
 await page.routeWebSocket('**/ws',ws=>{
  ws.onMessage((raw:any)=>{
   const m=JSON.parse(String(raw));
   if(m.type!=='join')return;
   join=m;
   ws.send(JSON.stringify({type:'welcome',id:'a',players:[{id:'a',name:'Driver',x:0,z:0,yaw:0,riding:false,vehicle:'bike',speed:0,jumpHeight:0,seated:false,mic:false,speaker:false,appearance:{gender:'male',hairstyle:'short',hair:'#202c2b',skin:'#b98157',shirt:'#ef734c',trousers:'#c7be9c'},accessories:[],color:'#dafa8e'}]}));
   ws.send(JSON.stringify({type:'voice-codec',codec:'opus'}));
   // A frame for a speaker that is muted must be ignored quietly, not throw.
   ws.send(JSON.stringify({type:'voice-audio',id:'b',name:'Kawan',codec:'opus',audio:Buffer.alloc(119,7).toString('base64'),volume:1}));
   ws.send(JSON.stringify({type:'voice-codec',codec:'pcm'}));
  });
 });
 await page.goto('/');
 await expect.poll(()=>join?.type,{timeout:10000}).toBe('join');
 expect(join.opus).toBe(true);
 await page.waitForTimeout(500);
 expect(errors).toEqual([]);
});

test('the encoder config in the source gives one decodable frame per 40ms',async({page})=>{
 await page.goto('/');
 // Read the literal out of the source rather than importing the module, which drags in the
 // DOM. The test therefore cannot drift from the config the client actually ships.
 const source=readFileSync('src/voice.ts','utf8');
 const literal=source.match(/export const OPUS = (\{.*?\});/)![1];
 const result=await page.evaluate(async(text)=>{
  const config=(0,eval)('('+text+')');
  const sizes:number[]=[];const chunks:any[]=[];
  const enc=new (globalThis as any).AudioEncoder({output:(c:any)=>{const b=new Uint8Array(c.byteLength);c.copyTo(b);sizes.push(b.byteLength);chunks.push({b,ts:c.timestamp});},error:()=>{}});
  enc.configure(config);
  for(let f=0;f<10;f++){
   const data=new Float32Array(640);
   for(let i=0;i<640;i++)data[i]=Math.sin((f*640+i)/8)*0.3;
   enc.encode(new (globalThis as any).AudioData({format:'f32',sampleRate:16000,numberOfFrames:640,numberOfChannels:1,timestamp:f*40000,data}));
  }
  await enc.flush();
  const decoded:number[]=[];
  const dec=new (globalThis as any).AudioDecoder({output:(a:any)=>{decoded.push(a.numberOfFrames);a.close();},error:()=>{}});
  dec.configure({codec:'opus',sampleRate:16000,numberOfChannels:1});
  for(const c of chunks)dec.decode(new (globalThis as any).EncodedAudioChunk({type:'key',timestamp:c.ts,data:c.b}));
  await dec.flush();
  return {sizes,decoded};
 },literal);
 // One chunk per input frame, and far smaller than the 1280 raw bytes it replaces.
 expect(result.sizes.length).toBeGreaterThanOrEqual(10);
 expect(Math.max(...result.sizes)).toBeLessThan(200);
 expect(result.decoded.length).toBeGreaterThanOrEqual(10);
 expect(result.decoded.every(n=>n>0)).toBe(true);
});
