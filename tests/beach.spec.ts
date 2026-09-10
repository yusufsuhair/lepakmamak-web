import {test,expect} from '@playwright/test';
import pickleball from '../shared/pickleball.json' with {type:'json'};
import basketball from '../shared/basketball.json' with {type:'json'};
test('beach seats and arrivals are reachable and share table registration',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async({pickleball,basketball})=>{
  const {createWorld}=await import('/src/world.ts');const {overlaps}=await import('/src/physics.ts');
  const tables=(await import('/shared/tables.json')).default.filter(t=>t.id.startsWith('pantai-'));
  const world=createWorld({add(){}} as any);const {createBeach}=await import('/src/beach.ts');const beach=createBeach({add(){}} as any,world);beach.update(10);const chairs=(await import('/shared/chairs.json')).default.filter(c=>c.tableId.startsWith('pantai-'));
  const courts=[{x:pickleball.x,z:pickleball.z,hx:pickleball.apronWidth,hz:pickleball.apronLength},{x:basketball.x,z:basketball.z,hx:basketball.halfWidth+1,hz:basketball.halfLength+1}];return {courtSeats:chairs.filter(c=>courts.some(s=>overlaps(c,.5,s))).map(c=>c.id),counts:tables.map(t=>chairs.filter(c=>c.tableId===t.id).length),blocked:chairs.filter(c=>world.solids.some(s=>overlaps(c,.35,s))).map(c=>c.id),arrivals:tables.filter(t=>world.solids.some(s=>overlaps({x:t.arrivalX,z:t.arrivalZ},.48,s))).map(t=>t.id)};
 },{pickleball,basketball});
 expect(result.courtSeats).toEqual([]);expect(result.counts).toEqual([3,9,9,3]);expect(result.blocked).toEqual([]);expect(result.arrivals).toEqual([]);
});
