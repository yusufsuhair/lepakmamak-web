import {test,expect,type Page} from '@playwright/test';
import {createPark} from '../server/legoland.mjs';
import {teleportPlayer} from '../server/teleport.mjs';
import {parkAttractions,parkExit,rideDuration} from '../shared/legoland.mjs';
import destinations from '../shared/teleports.json' with {type:'json'};

const AUTH=`export const session={access_token:'test',user:{id:'a',user_metadata:{display_name:'ParkTester'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'ParkTester';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`;
const at=(page:Page)=>page.evaluate(()=>{const p=(window as any).__lepak.position;return{x:p.x,z:p.z};});

// A stand-in city running the real park and teleport rules, so the client is held to what the server does.
async function city(page:Page,start:{x:number;z:number}){
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:AUTH}));
 const player:any={id:'a',name:'ParkTester',...start,yaw:0,riding:false},players=new Map([['a',player]]),sent:any[]=[];let socket:any;
 const push=()=>socket.send(JSON.stringify({type:'players',players:[player]}));
 await page.routeWebSocket('**/ws',ws=>{socket=ws;const park=createPark((_w:any,m:any)=>ws.send(JSON.stringify(m)));
  ws.onMessage(raw=>{const m=JSON.parse(String(raw));sent.push(m);if(park.tick(players))push();
   if(m.type==='join')ws.send(JSON.stringify({type:'welcome',id:'a',players:[player]}));
   else if(m.type==='ping')ws.send(JSON.stringify({type:'pong',t:m.t}));
   else if(m.type==='teleport'){const d=teleportPlayer(player,m);ws.send(JSON.stringify(d?{type:'teleported',id:d.id}:{type:'teleport-denied'}));push();}
   else if(park.handle(players,player,m))push();});
 });
 await page.goto('/');await expect(page.locator('#legoland-panel')).toBeVisible();
 return{player,sent,push};
}

test('server lets an Express rider off only at an attraction beside the train',()=>{
 let now=10000;const park=createPark(()=>{},()=>now),express=parkAttractions[0],tower=parkAttractions.find(a=>a.kind==='tower')!;
 const board=(a:any)=>{const p:any={id:String(Math.random()),...parkExit(a)};const players=new Map([[p.id,p]]);park.handle(players,p,{type:'park-enter',id:a.id});expect(p.parkRide.id).toBe(a.id);return{p,players};};
 // At 62.5% of the lap the train runs past DUPLO Express (#14), three steps from its exit.
 const ride=()=>{now=10000;const r=board(express);now+=rideDuration(express)*1000*.625;park.tick(r.players);return r;};
 let r=ride();park.handle(r.players,r.p,{type:'park-leave',stop:14});expect(r.p).toMatchObject({...parkExit(parkAttractions[14]),parkRide:null});
 r=ride();park.handle(r.players,r.p,{type:'park-leave',stop:44});expect(r.p).toMatchObject({...parkExit(express),parkRide:null});
 r=ride();park.handle(r.players,r.p,{type:'park-leave',stop:'constructor'});expect(r.p).toMatchObject({...parkExit(express),parkRide:null});
 r=ride();park.handle(r.players,r.p,{type:'park-leave'});expect(r.p).toMatchObject({...parkExit(express),parkRide:null});
 now=10000;const t=board(tower);park.handle(t.players,t.p,{type:'park-leave',stop:12});expect(t.p).toMatchObject({...parkExit(tower),parkRide:null});
});

test('LEGOLAND Express drops its rider at the attraction beside the train',async({page})=>{
 const {player,sent,push}=await city(page,parkExit(parkAttractions[0]));
 await page.getByRole('button',{name:'Main tarikan',exact:true}).click();
 await expect(page.locator('.park-leave')).toBeVisible();await expect(page.getByRole('button',{name:'Return to the City'})).toBeHidden();
 player.parkRide.startedAt-=rideDuration(parkAttractions[0])*1000*.6;push();
 await expect(page.locator('.park-leave')).toContainText('Turun di ');await page.screenshot({path:'test-results-legoland/express-dropoff.png'});await page.locator('.park-leave').click();
 const stop=await expect.poll(()=>sent.find(m=>m.type==='park-leave')?.stop).toBeGreaterThan(0).then(()=>parkAttractions[sent.find(m=>m.type==='park-leave').stop]);
 const exit=parkExit(stop);expect(player).toMatchObject({x:exit.x,z:exit.z,parkRide:null});
 await expect.poll(()=>at(page)).toEqual({x:exit.x,z:exit.z});
});

test('Return to the City takes a walker in the park back to Mamak Maju',async({page})=>{
 const {sent}=await city(page,{x:-215,z:0});const mamak=destinations.find(d=>d.id==='1')!;
 await expect(page.getByRole('button',{name:'Main tarikan',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Return to the City'}).click();
 expect(sent.filter(m=>m.type==='teleport')).toEqual([{type:'teleport',id:'1'}]);
 await expect.poll(()=>at(page)).toEqual({x:mamak.x,z:mamak.z});await expect(page.locator('#legoland-panel')).toBeHidden();
});

test('played attractions carry a Played mark in the panel and on the map, from the passport store',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('lepak-legoland-pass-v1','[12]'));
 await city(page,parkExit(parkAttractions[1]));const played=page.locator('#legoland-panel .park-played');
 await expect(page.locator('#legoland-panel h2')).toHaveText(parkAttractions[1].name);await expect(played).toBeHidden();
 await page.getByRole('button',{name:'Main tarikan',exact:true}).click();
 for(let i=0;i<8;i++)await page.getByRole('button',{name:'Letak blok'}).click();
 await expect(played).toBeVisible();await expect(played).toHaveText('✓ Played');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lepak-legoland-pass-v1')!))).toEqual([12,1]);
 await page.getByRole('button',{name:'Keluar tarikan'}).click();
 await page.keyboard.press('m');await expect(page.locator('#expanded-map')).toHaveAttribute('data-played','1 12');await expect(page.locator('#map-place-info')).toContainText('✓ Played 2 / 47');
 // The park zooms further than the city so a phone can separate its names.
 const zoomIn=page.getByRole('button',{name:'Zoom in'});while(await zoomIn.isEnabled())await zoomIn.click();
 await expect(page.getByRole('button',{name:'Reset map zoom'})).toHaveText('400%');
});

test.describe('touch',()=>{
 test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 test('Kutip sits on the right, clear of the joystick',async({page})=>{
  await city(page,parkExit(parkAttractions[11]));
  await page.getByRole('button',{name:'Main tarikan',exact:true}).click();
  const kutip=(await page.getByRole('button',{name:'Kutip'}).boundingBox())!,stick=(await page.locator('#move-stick').boundingBox())!;
  expect(kutip.x).toBeGreaterThan(stick.x+stick.width);expect(kutip.x+kutip.width/2).toBeGreaterThan(390/2);
 });
});
