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
 expect(result.courtSeats).toEqual([]);expect(result.counts).toEqual([4,9,9,4]);expect(result.blocked).toEqual([]);expect(result.arrivals).toEqual([]);
});

test('the Blender prop set replaces the procedural props and leaves the animated sea alone',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createWorld}=await import('/src/world.ts');const {createBeach}=await import('/src/beach.ts');
  const stub={add(){}} as any;const world=createWorld(stub);const beach=createBeach(stub,world);
  const before=JSON.stringify({solids:world.solids,chairs:world.chairs,map:world.mapBuildings});
  const group=(beach.iceCream as any).parent as any;
  const props=group.getObjectByName('beach-props');
  const fallback=props.children.length;
  for(let i=0;i<200&&!props.getObjectByName('beach');i++)await new Promise(done=>setTimeout(done,50));
  const sea=group.children.find((child:any)=>child.isMesh&&child.geometry?.attributes?.position?.count===6305);
  beach.update(0);const rest=sea.geometry.attributes.position.getY(3000);
  beach.update(9);const moved=sea.geometry.attributes.position.getY(3000);
  return {unchanged:before===JSON.stringify({solids:world.solids,chairs:world.chairs,map:world.mapBuildings}),
   fallback,foam:group.children.filter((child:any)=>child.isMesh&&child.geometry?.attributes?.position?.count===58).length,imported:props.children.filter((child:any)=>child.getObjectByName('beach')).length,
   signs:props.children.filter((child:any)=>child.material?.isMeshBasicMaterial).length,waveMoved:rest!==moved};
 });
 expect(result.imported).toBe(1);            // the GLB arrived and took over
 expect(result.signs).toBe(4);               // PANTAI SENJA, KELAPA SEGAR and both WEREWOLF boards stay the game's
 expect(result.fallback).toBeGreaterThan(4); // and the procedural batches it replaced are gone
 expect(result.unchanged).toBe(true);           // colliders, chairs and map footprints untouched
 expect(result.foam).toBe(8);expect(result.waveMoved).toBe(true); // the animated sea and its crests are outside the swap
});
