import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const chairs=JSON.parse(readFileSync('shared/chairs.json','utf8')) as {id:string;x:number;z:number;tableId:string}[];
const places=JSON.parse(readFileSync('shared/places.json','utf8')) as {name:string;x:number;z:number}[];

test('ZUS Coffee stands where the nearer 99 Speedmart did, with its own seating',async({page})=>{
 // The map directory and the world have to agree, or the pin sends you to the wrong shop.
 expect(places.find(p=>p.x===27&&p.z===58)?.name).toBe('ZUS Coffee');
 expect(places.filter(p=>p.name.includes('Speedmart')).map(p=>p.name)).toEqual(['99 Speedmart Timur']);

 // Seats are drawn from chairs.json, so the stool you can see is the one the server sits
 // you in. Twelve of them, none claimed by a game table.
 const seats=chairs.filter(c=>c.id.startsWith('zus-chair-'));
 expect(seats).toHaveLength(12);
 for(const seat of seats){
  expect(seat.tableId).toBe('');
  expect(Math.hypot(seat.x-27,seat.z-65.6)).toBeLessThan(8);
 }
 // No two chairs in the whole city share an id or a spot.
 expect(new Set(chairs.map(c=>c.id)).size).toBe(chairs.length);
 expect(new Set(chairs.map(c=>`${c.x.toFixed(2)},${c.z.toFixed(2)}`)).size).toBe(chairs.length);

 await page.route('**/zus-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/zus-harness');
 const built=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createWorld}=await import('/src/world.ts');
  const world=createWorld(new (THREE as any).Scene());
  // Every stool needs somewhere to sit and every table something to block you walking through.
  const blocked=[[21.5,65.4],[27,65.8],[32.5,65.4]].every(([x,z]:any)=>
   world.solids.some((s:any)=>Math.abs(s.x-x)<.01&&Math.abs(s.z-z)<.01));
  const arrivalClear=!world.solids.some((s:any)=>Math.abs(27-s.x)<s.hx+.7&&Math.abs(68-s.z)<s.hz+.7);
  return {blocked,arrivalClear,chairs:world.chairs.filter((c:any)=>c.id.startsWith('zus-chair-')).length};
 });
 expect(built.blocked).toBe(true);
 expect(built.chairs).toBe(12);
});
