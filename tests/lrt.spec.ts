import {test,expect} from '@playwright/test';
import {stations,trainState,trackPoint,trackLength,cycleSeconds,passengerPoint} from '../shared/lrt.mjs';
import {createLrt} from '../server/lrt.mjs';

test('continuous loop, two trains, all stations and doors',()=>{
 expect(trackPoint(0).x).toBeCloseTo(trackPoint(trackLength).x);expect(trackPoint(0).z).toBeCloseTo(trackPoint(trackLength).z);
 const seen=new Set();for(let t=0;t<cycleSeconds;t+=.1){const s=trainState(0,t*1000);if(s.station>=0)seen.add(s.station);if(s.doors)expect(s.speed).toBe(0);const p=trackPoint(s.distance);expect(Number.isFinite(p.x+p.z+p.yaw)).toBe(true);}
 expect(seen.size).toBe(8);expect(trainState(0,2000).distance).not.toBe(trainState(1,2000).distance);
 for(let seat=0;seat<24;seat++){const p=passengerPoint(0,seat,2000);expect(p.y).toBeGreaterThan(11);}
});
test('server validates boarding, assigns different seats and prohibits mid-journey exit',()=>{
 const messages:any[]=[];const lrt=createLrt((_w:any,m:any)=>messages.push(m));const a:any={id:'a',x:stations[0].x,z:stations[0].z},b:any={...a,id:'b'};const players=new Map([['a',a],['b',b]]);
 lrt.handle(players,a,{type:'lrt-board',station:stations[0].id,train:0},2000);lrt.handle(players,b,{type:'lrt-board',station:stations[0].id,train:0},2000);
 expect(a.lrtId).toBe(0);expect(a.lrtSeat).not.toBe(b.lrtSeat);const before=a.x;lrt.sync(players,15000);expect(a.x).not.toBe(before);
 lrt.handle(players,a,{type:'lrt-exit'},15000);expect(a.lrtId).toBe(0);
 lrt.handle(players,a,{type:'lrt-exit'},2000);expect(a.lrtId).toBeNull();expect(a.x).toBe(stations[0].x);
 const far:any={id:'far',x:130,z:130};lrt.handle(players,far,{type:'lrt-board',station:stations[0].id,train:0},2000);expect(far.lrtId).toBeUndefined();
});
test('station entrances clear existing buildings and stations are searchable on map',async({page})=>{
 await page.goto('/');const blocked=await page.evaluate(async()=>{const {createWorld}=await import('/src/world.ts');const {stations}=await import('/shared/lrt.mjs');const w=createWorld({add(){}} as any);const {createLrt}=await import('/src/lrt.ts');createLrt({add(){}} as any,w.solids);return stations.filter(s=>w.solids.some(o=>Math.abs(s.x-o.x)<o.hx+.7&&Math.abs(s.z-o.z)<o.hz+.7));});expect(blocked).toEqual([]);
 await page.evaluate(()=>document.querySelector<HTMLDialogElement>('#city-map')!.showModal());await page.getByRole('searchbox',{name:'Search shops and places'}).fill('LRT');await expect(page.locator('#city-directory section:not([hidden]) button:not([hidden])')).toHaveCount(8);
});
for(const viewport of [{width:1280,height:800},{width:390,height:844}])test(`board, travel and exit at next station (${viewport.width}px)`,async({page})=>{
 await page.setViewportSize(viewport);let mockTime=2000;let sendClock:(n:number)=>void=()=>{};
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export const session={access_token:'test',user:{id:'a',user_metadata:{display_name:'Passenger'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Passenger';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`}));
 await page.routeWebSocket('**/ws',ws=>{
  sendClock=n=>{mockTime=n;ws.send(JSON.stringify({type:'lrt-clock',serverTime:n}));};
  const p:any={id:'a',name:'Passenger',x:stations[0].x,z:stations[0].z,yaw:0,riding:false};const players=new Map([['a',p]]);const lrt=createLrt((_w:any,m:any)=>ws.send(JSON.stringify(m)));
  ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join'){ws.send(JSON.stringify({type:'welcome',id:'a',players:[p]}));sendClock(2000);}else lrt.handle(players,p,m,mockTime);});
 });
 await page.goto('/');await expect(page.locator('#interaction')).toHaveText('Naik LRT');await page.locator('#interaction').dispatchEvent('click');await expect(page.locator('.lrt-panel')).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.lrtId)).toBe(0);
 await expect(page.locator('body')).toHaveClass(/on-lrt/);await page.waitForTimeout(1000);await page.screenshot({path:`/tmp/lepak-lrt-${viewport.width}.png`});
 const button=page.getByRole('button',{name:'Turun di stesen',exact:true});const bounds=await button.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width);
 sendClock(15000);await expect(button).toBeDisabled();await expect(page.locator('.lrt-panel strong')).toHaveText('Seterusnya · Ampang Park');
 sendClock(25000);await expect(button).toBeEnabled();await button.click();await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.lrtId)).toBeNull();expect(await page.evaluate(()=>(window as any).__lepak.position.x)).toBe(stations[1].x);expect(errors).toEqual([]);
});
