import {test,expect} from '@playwright/test';
import fleetSeeds from '../shared/fleet.json' with {type:'json'};
import {createFleet} from '../server/fleet.mjs';

test('every Lamborghini belongs to moving NPC traffic',()=>{
 const lambos=fleetSeeds.filter(car=>car.style==='lamborghini');
 expect(lambos.length).toBeGreaterThan(0);
 for(const car of lambos){expect(car.npc).toBe(true);expect(car.speed).toBeGreaterThan(0);expect(['x','z']).toContain(car.axis);}
});

test('the show car is built as a Lamborghini, wing and all',async({page})=>{
 await page.route('**/lambo-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/lambo-harness');
 const built=await page.evaluate(async()=>{
  const {createDriveableCar}=await import('/src/world.ts');
  // box() scales a shared unit cube, so the part sizes live on scale, not on the geometry.
  const parts=(style:any)=>{const car=createDriveableCar(style);const widths:number[]=[];car.group.traverse((o:any)=>{if(o.isMesh)widths.push(Number(o.scale.x.toFixed(3)));});return {model:car.group.userData.model,widths,wheels:car.wheels.length};};
  return {lambo:parts('lamborghini'),ferrari:parts('ferrari')};
 });
 expect(built.lambo.model).toBe('lamborghini');
 expect(built.lambo.wheels).toBeGreaterThan(3);
 // The rear wing and the pair of side intakes are what separate it from the other supercar.
 expect(built.lambo.widths.filter(w=>w===1.72)).toHaveLength(1);
 expect(built.lambo.widths.filter(w=>w===.34)).toHaveLength(2);
 expect(built.ferrari.widths).not.toContain(1.72);
});

// The exhaust carries, so it fades in as you walk over and stays well under the ice-cream
// song, which is the loudest thing in the city and was the complaint about this one.
test('the moving exhaust is quieter than the ice cream',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Revhead');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 const lambo=()=>page.evaluate(()=>(window as any).__lepak.lambo);
 await expect.poll(async()=>(await lambo()).playing).toBe(true);
 // Reduced, as asked: the ice-cream song peaks at 1.2 through the same city bus.
 const {peak,reach}=await lambo();
 expect(peak).toBeLessThan(1.2/3);
 expect(reach).toBe(16);
 expect((await lambo()).cars.every((car:any)=>car.npc&&car.speed>0)).toBe(true);
});

test('the server refuses to hand over a Lamborghini, however the claim arrives',()=>{
 const sent:any[]=[];
 const fleet=createFleet((_ws:unknown,message:unknown)=>sent.push(message),()=>{});
 const players=new Map();
 const player={id:'p1',ws:{},x:-86,z:74,riding:false,passengerOf:null,chairId:null,jumpHeight:0};
 players.set('p1',player);
 fleet.sync(players);
 // Standing right on it, with nothing else to refuse for: only the style stops this.
 fleet.handle(players,player,{type:'car-claim',id:'traffic-7'});
 expect(player.riding).toBeFalsy();
 expect(sent.at(-1).message).toContain('Tak bole');
 expect(sent.some(m=>m.type==='car-claimed')).toBe(false);
});
