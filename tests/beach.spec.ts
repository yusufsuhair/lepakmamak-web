import {test,expect} from '@playwright/test';
test('beach seats and arrivals are reachable and share table registration',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createWorld}=await import('/src/world.ts');const {overlaps}=await import('/src/physics.ts');
  const tables=(await import('/shared/tables.json')).default.filter(t=>t.id.startsWith('pantai-'));
  const world=createWorld({add(){}} as any);const chairs=(await import('/shared/chairs.json')).default.filter(c=>c.tableId.startsWith('pantai-'));
  return {counts:tables.map(t=>chairs.filter(c=>c.tableId===t.id).length),blocked:chairs.filter(c=>world.solids.some(s=>overlaps(c,.35,s))).map(c=>c.id),arrivals:tables.filter(t=>world.solids.some(s=>overlaps({x:t.arrivalX,z:t.arrivalZ},.48,s))).map(t=>t.id)};
 });
 expect(result.counts).toEqual([3,4,9,3]);expect(result.blocked).toEqual([]);expect(result.arrivals).toEqual([]);
});
