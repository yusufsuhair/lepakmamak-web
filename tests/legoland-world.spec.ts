import {test,expect} from '@playwright/test';
import {createPark} from '../server/legoland.mjs';
import {parkAttractions,parkExit,rideDuration} from '../shared/legoland.mjs';
import {insideWorld} from '../shared/world-bounds.mjs';
import {moveWithCollisions} from '../src/physics';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

test('two real city sockets share park movement, rides and chat',async()=>{
 const port=8277,server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 const sockets:WebSocket[]=[];const attraction=parkAttractions.find(a=>a.kind==='tower')!;
 const connect=(name:string)=>new Promise<any>((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);sockets.push(ws);const client:any={ws,players:[],messages:[]};ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'park-test',guest:true,name,resume:{...parkExit(attraction),yaw:0}})));ws.on('message',raw=>{const m=JSON.parse(String(raw));client.messages.push(m);if(m.players)client.players=m.players;if(m.type==='welcome'){client.id=m.id;resolve(client);}});});
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${port}/health`)).ok;}catch{return false;}}).toBe(true);
  const a=await connect('ParkRider'),b=await connect('ParkObserver');a.ws.send(JSON.stringify({type:'park-enter',id:attraction.id}));
  await expect.poll(()=>b.players.find((p:any)=>p.id===a.id)?.parkRide?.id).toBe(attraction.id);
  await expect.poll(()=>b.players.find((p:any)=>p.id===a.id)?.y).toBeGreaterThan(3);
  a.ws.send(JSON.stringify({type:'state',x:0,z:0,y:0,riding:false}));
  await expect.poll(()=>b.players.find((p:any)=>p.id===a.id)?.x).toBe(parkExit(attraction).x-13);
  a.ws.send(JSON.stringify({type:'chat',text:'Hello from LEGOLAND'}));await expect.poll(()=>b.messages.some((m:any)=>m.type==='chat'&&m.text==='Hello from LEGOLAND'&&m.area==='LEGOLAND')).toBe(true);
  a.ws.send(JSON.stringify({type:'park-leave'}));await expect.poll(()=>b.players.find((p:any)=>p.id===a.id)?.parkRide).toBeNull();expect(b.players.find((p:any)=>p.id===a.id).y).toBe(0);
  a.ws.send(JSON.stringify({type:'teleport',id:'legoland'}));await expect.poll(()=>b.players.find((p:any)=>p.id===a.id)?.x).toBe(-198);
 }finally{for(const ws of sockets)ws.close();server.kill();}
});

test('city connects continuously to park; outer boundaries remain closed',()=>{
 const p={x:-140,z:0};moveWithCollisions(p,-90,0,.5,[]);expect(p.x).toBeCloseTo(-230);
 moveWithCollisions(p,90,0,.5,[]);expect(p.x).toBeCloseTo(-140);
 for(const start of [{x:-170,z:0},{x:-152,z:30},{x:-400,z:-289}]){moveWithCollisions(start,-5,40,.5,[]);expect(insideWorld(start.x,start.z,.5)).toBe(true);}
 for(const a of parkAttractions){const p=parkExit(a);expect(insideWorld(p.x,p.z,1)).toBe(true);}
});
test('physical entrance and all ride exits clear city and park collision geometry',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createWorld}=await import('/src/world.ts');const {createLegoland}=await import('/src/legoland.ts');const {moveWithCollisions,overlaps}=await import('/src/physics.ts');const {parkAttractions,parkExit}=await import('/shared/legoland.mjs');
  const scene={add(){}} as any,world=createWorld(scene);createLegoland(scene,world,{send(){},online:()=>false,canEnter:()=>false,clearInput(){},notice(){}});
  const position={x:-140,z:0};moveWithCollisions(position,-75,0,.5,world.solids);
  return{x:position.x,blocked:parkAttractions.filter(a=>world.solids.some(s=>overlaps(parkExit(a),.5,s))).map(a=>a.name)};
 });expect(result.x).toBeCloseTo(-215);expect(result.blocked).toEqual([]);
});
test('server owns rides, rejects distant boarding and occupancy, completes at ground level',()=>{
 let now=10000;const messages:any[]=[];const park=createPark((_ws:any,m:any)=>messages.push(m),()=>now);
 const a=parkAttractions.find(a=>a.kind==='tower')!;const rider:any={id:'a',x:0,z:0};const peer:any={id:'b',...parkExit(a)};const players=new Map([['a',rider],['b',peer]]);
 park.handle(players,rider,{type:'park-enter',id:a.id});expect(rider.parkRide).toBeUndefined();
 Object.assign(rider,parkExit(a));park.handle(players,rider,{type:'park-enter',id:a.id});expect(rider.parkRide.id).toBe(a.id);
 park.handle(players,peer,{type:'park-enter',id:a.id});expect(peer.parkRide).toBeUndefined();
 now+=rideDuration(a)*500;park.tick(players);expect(rider.y).toBeGreaterThan(20);expect(park.locked(rider)).toBe(true);
 now+=rideDuration(a)*500;park.tick(players);expect(rider).toMatchObject({...parkExit(a),parkRide:null});expect(messages.at(-1).type).toBe('park-complete');
});
for(const width of [1280,390])test(`park is inside city canvas, ride and exit retain page and socket (${width}px)`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:800});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let joins=0;const attraction=parkAttractions.find(a=>a.kind==='tower')!;
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export const session={access_token:'test',user:{id:'a',user_metadata:{display_name:'ParkTester'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'ParkTester';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`}));
 await page.routeWebSocket('**/ws',ws=>{
  const p:any={id:'a',name:'ParkTester',...parkExit(attraction),yaw:0,riding:false};const players=new Map([['a',p]]);const park=createPark((_w:any,m:any)=>ws.send(JSON.stringify(m)));
  ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join'){joins++;ws.send(JSON.stringify({type:'welcome',id:'a',players:[p]}));}else if(park.handle(players,p,m)){ws.send(JSON.stringify({type:'players',players:[p]}));}});
 });
 await page.goto('/');await expect(page.locator('#legoland-panel')).toBeVisible();await expect(page.locator('#legoland-panel h2')).toHaveText(attraction.name);
 await page.getByRole('button',{name:'Main tarikan',exact:true}).click();await expect(page.getByRole('button',{name:'Keluar tarikan',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.bridge.deckY)).toBeGreaterThan(2.5);
 await page.getByRole('button',{name:'Keluar tarikan',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.bridge.deckY)).toBe(0);
 expect(new URL(page.url()).pathname).toBe('/');expect(joins).toBe(1);await expect(page.locator('canvas#world')).toHaveCount(1);expect(errors).toEqual([]);
 await page.screenshot({path:`test-results-legoland/in-world-${width}.png`});
});
