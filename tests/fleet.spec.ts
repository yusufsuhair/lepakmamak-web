import {test,expect} from '@playwright/test';
import {createFleet} from '../server/fleet.mjs';
import seeds from '../shared/fleet.json' with {type:'json'};

function fixture(){
 const messages:any[]=[];const fleet=createFleet((_ws:any,m:any)=>messages.push(structuredClone(m)),(_players:any,m:any)=>messages.push(structuredClone(m)));
 const p:any={id:'a',ws:{},x:-4,z:-142,riding:false};const q:any={id:'b',ws:{},x:-4,z:-142,riding:false};const players=new Map([['a',p],['b',q]]);
 return{fleet,messages,p,q,players};
}
test('moving car can be claimed once, ejects NPC and keeps its model',()=>{
 const {fleet,messages,p,q,players}=fixture();fleet.handle(players,p,{type:'car-claim',id:'traffic-0'});
 expect(p.riding).toBe(true);expect(p.carStyle).toBe('axia');expect(messages.filter(m=>m.type==='car-angry')).toHaveLength(1);
 fleet.handle(players,q,{type:'car-claim',id:'traffic-0'});expect(q.riding).toBe(false);expect(messages.at(-1).type).toBe('notice');
});
test('distant, seated, airborne, passenger and dancing players cannot claim',()=>{
 for(const patch of [{x:99},{chairId:'chair-1'},{jumpHeight:1},{passengerOf:'b'},{danceUntil:20000}]){
  const {fleet,p,players}=fixture();Object.assign(p,patch);fleet.handle(players,p,{type:'car-claim',id:'traffic-0'},10000);expect(p.riding).toBe(false);
 }
});
test('moving car tolerates short network delay but rejects out-of-range claims visibly',()=>{
 const {fleet,messages,p,players}=fixture();p.z=-136;
 fleet.handle(players,p,{type:'car-claim',id:'traffic-0'});expect(p.riding).toBe(true);
 const other=fixture();other.p.z=-134;other.fleet.handle(other.players,other.p,{type:'car-claim',id:'traffic-0'});expect(other.p.riding).toBe(false);expect(other.messages.at(-1).code).toBe('CAR_CLAIM_DENIED');expect(messages.some(m=>m.type==='car-claimed')).toBe(true);
});
test('dismount preserves car position, another player can enter without ejecting a second NPC',()=>{
 const {fleet,messages,p,q,players}=fixture();fleet.handle(players,p,{type:'car-claim',id:'traffic-0'});
 p.x=15;p.z=30;p.yaw=.7;p.vehicle='car';fleet.updatePlayer(players,p);p.riding=false;fleet.updatePlayer(players,p);
 q.x=15;q.z=30;fleet.handle(players,q,{type:'car-claim',id:'traffic-0'});expect(q.riding).toBe(true);expect(q.yaw).toBe(.7);expect(messages.filter(m=>m.type==='car-angry')).toHaveLength(1);
});
test('parked cars are claimable and disconnect releases ownership; rooms are isolated',()=>{
 const {fleet,messages,p,players}=fixture();p.x=-146;p.z=134;fleet.handle(players,p,{type:'car-claim',id:'parked-0'});expect(p.riding).toBe(true);expect(messages.some(m=>m.type==='car-angry')).toBe(false);
 fleet.release(players,p);fleet.sync(players);expect(messages.at(-1).cars.find((c:any)=>c.id==='parked-0').owner).toBeNull();
 fleet.handle(new Map([['a',{...p,riding:false}]]),{...p,riding:false},{type:'car-claim',id:'parked-0'});expect(messages.at(-1).cars.find((c:any)=>c.id==='parked-0').owner).toBe('a');
});
test('traffic advances on server but claimed car stops autonomous movement',()=>{
 const {fleet,messages,p,players}=fixture();players.delete('b');p.x=90;p.z=90;fleet.sync(players);const before=messages.at(-1).cars[0];fleet.tick(players,.1);const after=messages.at(-1).cars[0];expect(after.z).not.toBe(before.z);
 p.x=after.x;p.z=after.z;fleet.handle(players,p,{type:'car-claim',id:after.id});fleet.tick(players,1);expect(messages.at(-1).cars[0].z).toBe(after.z);
});

test('a Cilok-ed traffic car waits for a friend, then rejoins its lane instead of blocking the road for good',()=>{
 const seed:any=seeds.find((c:any)=>c.id==='traffic-0');
 const {fleet,messages,p,players}=fixture();players.delete('b');
 const car=()=>messages.at(-1).cars.find((c:any)=>c.id==='traffic-0');
 fleet.handle(players,p,{type:'car-claim',id:'traffic-0'});
 // Driven well clear of its lane and abandoned there.
 p.x=40;p.z=30;p.yaw=.7;p.vehicle='car';fleet.updatePlayer(players,p);p.riding=false;fleet.updatePlayer(players,p);
 const start=Date.now();p.x=-99;p.z=-99;
 fleet.tick(players,.1,start);
 // Still exactly where it was parked, so somebody can take it over.
 expect(car().npc).toBe(false);expect(car().x).toBe(40);expect(car().yaw).toBe(.7);
 fleet.tick(players,.1,start+90001);
 // Back in its own lane and facing, driving again rather than parked in the road forever.
 // Wire positions are rounded on the way out, so this asks that it faces back down its lane,
 // not that the float survived the trip intact.
 expect(car().npc).toBe(true);expect(car().x).toBe(seed.x);expect(car().yaw).toBeCloseTo(Math.PI,2);
});
test('a parked car stays parked and is never turned into traffic',()=>{
 const {fleet,messages,p,players}=fixture();players.delete('b');
 p.x=-146;p.z=134;fleet.handle(players,p,{type:'car-claim',id:'parked-0'});
 fleet.release(players,p);
 const start=Date.now();fleet.tick(players,.1,start+90001*10);
 expect(messages.at(-1).cars.find((c:any)=>c.id==='parked-0').npc).toBe(false);
});

test('Cilok button takes control, drives, and exits in the browser',async({page})=>{
 let advanceTraffic:()=>void=()=>{};
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export const session={access_token:'test',user:{id:'a',user_metadata:{display_name:'Driver'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Driver';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`}));
 await page.routeWebSocket('**/ws',ws=>{
  const p:any={id:'a',ws:{},name:'Driver',x:-7,z:-142,yaw:0,riding:false,speed:0};const players=new Map([['a',p]]);
  const fleet=createFleet((_w:any,m:any)=>ws.send(JSON.stringify(m)),(_p:any,m:any)=>ws.send(JSON.stringify(m)));
  advanceTraffic=()=>{const x=p.x,z=p.z;p.x=99;p.z=99;for(let i=0;i<10;i++)fleet.tick(players,.1);p.x=x;p.z=z;};
  ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join'){ws.send(JSON.stringify({type:'welcome',id:'a',players:[p]}));fleet.sync(players);}else if(m.type==='state'){Object.assign(p,m);fleet.updatePlayer(players,p);fleet.sync(players);}else fleet.handle(players,p,m);});
 });
 await page.goto('/');await expect(page.locator('#interaction')).toHaveText('Cilok');
 const button=page.locator('#interaction'),bounds=await button.boundingBox();await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2);await page.mouse.down();const pressed=await button.boundingBox();advanceTraffic();await page.waitForTimeout(180);expect((await button.boundingBox())!.x).toBe(pressed!.x);await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.vehicle)).toBe('car');
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.riding)).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.angry)).not.toEqual([]);
 expect((await page.evaluate(()=>(window as any).__lepak.angry))[0]).toMatch(/kereta aku|Turun sekarang/i);
 await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.speed)).toBeGreaterThan(1);await page.keyboard.up('KeyW');
 await page.keyboard.down('Space');await expect(page.locator('#interaction')).toHaveText('Get out');await page.keyboard.up('Space');await page.locator('#interaction').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.riding)).toBe(false);
 expect(errors).toEqual([]);
});

test('positions are trimmed on the wire without the server rounding its own arithmetic',()=>{
 const {fleet,messages,p,players}=fixture();players.delete('b');p.x=90;p.z=90;
 fleet.sync(players);
 const before=messages.at(-1).cars[0];
 // A step of 7cm per tick, well under the 1cm the wire keeps. Round car.z itself instead of
 // the copy and every one of these ticks lands back on the same number: the car stops dead.
 for(let i=0;i<20;i++)fleet.tick(players,.0007);
 expect(messages.at(-1).cars[0].z).not.toBe(before.z);
 // And what does go out is trimmed, every car, every field.
 for(const car of messages.at(-1).cars){
  expect(car.x).toBe(Math.round(car.x*100)/100);
  expect(car.z).toBe(Math.round(car.z*100)/100);
  expect(car.yaw).toBe(Math.round(car.yaw*1000)/1000);
 }
});
