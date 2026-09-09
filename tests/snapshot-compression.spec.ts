import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import zlib from 'node:zlib';
import city from '../shared/city.json' with {type:'json'};

const PORT='8131';

// Railway's edge strips permessage-deflate, so the snapshot is compressed by the application
// and sent as a binary frame. These check it really happens on the wire, both ways.
function start(){
 return spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
}
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(`http://127.0.0.1:${PORT}/health`)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('server never came up');}
function join(name:string,deflate:boolean,onFrame:(data:Buffer,isBinary:boolean)=>void){
 return new Promise<WebSocket>((resolve,reject)=>{
  const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  ws.on('error',reject);
  ws.on('open',()=>ws.send(JSON.stringify({type:'join',guest:true,name,deflate})));
  ws.on('message',(data:Buffer,isBinary:boolean)=>{onFrame(data,isBinary);if(!isBinary&&JSON.parse(String(data)).type==='welcome')resolve(ws);});
 });
}

test('a snapshot reaches a capable client compressed, and still inflates to the same city',async()=>{
 const server=start();const open:WebSocket[]=[];
 try{
  await ready();
  const packed:Buffer[]=[];
  // Enough people that the snapshot clears the size threshold worth compressing.
  for(let i=0;i<6;i++)open.push(await join('Packer'+i,true,(data,isBinary)=>{if(isBinary)packed.push(Buffer.from(data));}));
  open[0].send(JSON.stringify({type:'state',x:5,z:7,yaw:1,speed:2,riding:false}));
  // Fleet updates are broadcast too and are also compressed, so pick out the room snapshot.
  // Each join broadcasts one, so wait for the snapshot that has the whole city in it.
  const snapshots=()=>packed.map(b=>({b,text:zlib.inflateSync(b).toString()})).filter(f=>JSON.parse(f.text).type==='players');
  await expect.poll(()=>Math.max(0,...snapshots().map(f=>JSON.parse(f.text).players.length)),{timeout:10000}).toBe(6);
  const {b,text}=snapshots().find(f=>JSON.parse(f.text).players.length===6)!;
  const message=JSON.parse(text);
  expect(message.players.length).toBe(6);
  // The whole point: the bytes on the wire are far smaller than the JSON they carry.
  expect(b.length).toBeLessThan(text.length/2);
  console.log(`snapshot on the wire: ${b.length} bytes for ${text.length} bytes of JSON`);
 } finally { open.forEach(ws=>ws.close()); server.kill(); }
});

test('a client that cannot inflate still gets plain JSON',async()=>{
 const server=start();const open:WebSocket[]=[];
 try{
  await ready();
  let binaryFrames=0,textFrames=0;
  for(let i=0;i<6;i++)open.push(await join('Plain'+i,false,(_d,isBinary)=>{if(isBinary)binaryFrames++;else textFrames++;}));
  open[0].send(JSON.stringify({type:'state',x:5,z:7,yaw:1,speed:2,riding:false}));
  await new Promise(r=>setTimeout(r,1500));
  expect(textFrames).toBeGreaterThan(0);
  expect(binaryFrames).toBe(0);
 } finally { open.forEach(ws=>ws.close()); server.kill(); }
});

// The server half is proven above; this is the browser actually inflating what it is sent.
const AUTH_STUB=`export const session={access_token:'test',user:{id:'a',user_metadata:{display_name:'Driver'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Driver';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`;

test('the browser inflates a compressed snapshot and shows the city it describes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:AUTH_STUB}));
 let askedForDeflate:unknown=null;
 const person=(id:string,name:string,x:number)=>({id,name,x,z:0,yaw:0,riding:false,vehicle:'bike',speed:0,jumpHeight:0,seated:false,mic:false,speaker:false,appearance:{gender:'male',hairstyle:'short',hair:'#202c2b',skin:'#b98157',shirt:'#ef734c',trousers:'#c7be9c'},accessories:[],color:'#dafa8e'});
 await page.routeWebSocket('**/ws',ws=>{
  ws.onMessage((raw:any)=>{
   const m=JSON.parse(String(raw));
   if(m.type!=='join')return;
   askedForDeflate=m.deflate;
   ws.send(JSON.stringify({type:'welcome',id:'a',players:[person('a','Driver',0)]}));
   // Sent only as a compressed binary frame: if the client cannot inflate, it sees nobody.
   ws.send(zlib.deflateSync(Buffer.from(JSON.stringify({type:'players',players:[person('a','Driver',0),person('b','Kawan',4)]}))));
  });
 });
 await page.goto('/');
 await expect(page.locator('#player-count')).toHaveText(`2 / ${city.maxPlayers}`);
 expect(askedForDeflate).toBe(true);
 expect(errors).toEqual([]);
});
