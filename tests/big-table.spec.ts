import {test,expect} from '@playwright/test';
import tables from '../shared/tables.json' with {type:'json'};
import chairs from '../shared/chairs.json' with {type:'json'};
import {LOBBY_RULES} from '../server/table-lobby.mjs';

const BIG='meja-9';

test('Mamak Maju has a table big enough for a full Werewolf village',()=>{
 const table=tables.find(t=>t.id===BIG);
 expect(table).toBeTruthy();
 const seats=chairs.filter(c=>c.tableId===BIG);
 expect(seats).toHaveLength(LOBBY_RULES.werewolf.max);
 // It has to seat the biggest game the city offers, not just the smallest.
 expect(seats.length).toBeGreaterThanOrEqual(LOBBY_RULES.werewolf.min);
});

test('its chairs ring the table without landing on each other',()=>{
 const table=tables.find(t=>t.id===BIG)!;
 const seats=chairs.filter(c=>c.tableId===BIG);
 for(const seat of seats){
  const reach=Math.hypot(seat.x-table.x,seat.z-table.z);
  expect(reach).toBeGreaterThan(2);
  expect(reach).toBeLessThan(4);
 }
 for(let i=0;i<seats.length;i++) for(let j=i+1;j<seats.length;j++){
  expect(Math.hypot(seats[i].x-seats[j].x,seats[i].z-seats[j].z)).toBeGreaterThan(.8);
 }
});

test('all nine seats face into the table',()=>{
 const table=tables.find(t=>t.id===BIG)!;
 for(const seat of chairs.filter(c=>c.tableId===BIG)){
  const dx=table.x-seat.x,dz=table.z-seat.z;
  const distance=Math.hypot(dx,dz);
  const facing={x:Math.sin(seat.yaw),z:Math.cos(seat.yaw)};
  expect((facing.x*dx+facing.z*dz)/distance,seat.id).toBeGreaterThan(.98);
 }
});

test('every chair in the city still has its own id and its own spot',()=>{
 expect(new Set(chairs.map(c=>c.id)).size).toBe(chairs.length);
 for(let i=0;i<chairs.length;i++) for(let j=i+1;j<chairs.length;j++){
  expect(Math.hypot(chairs[i].x-chairs[j].x,chairs[i].z-chairs[j].z)).toBeGreaterThan(.5);
 }
});

test('the big table stands clear of the tables already there',()=>{
 const table=tables.find(t=>t.id===BIG)!;
 for(const other of tables){
  if(other.id===BIG) continue;
  expect(Math.hypot(other.x-table.x,other.z-table.z)).toBeGreaterThan(6);
 }
});

test('the world actually builds it, chairs and all',async({page})=>{
 await page.route('**/big-table-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/big-table-harness');
 const built=await page.evaluate(async([x,z])=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createWorld}=await import('/src/world.ts');
  const {overlaps}=await import('/src/physics.ts');
  const world=createWorld(new THREE.Scene());
  return {
   // Something solid where the table stands, so you cannot walk through it.
   blocked:world.solids.some((s:any)=>overlaps({x,z},.3,s)),
   chairs:world.chairs.filter((c:any)=>String(c.id).startsWith('meja-9-')).length,
  };
 },[tables.find(t=>t.id===BIG)!.x,tables.find(t=>t.id===BIG)!.z]);
 expect(built.blocked).toBe(true);
 expect(built.chairs).toBe(9);
});
