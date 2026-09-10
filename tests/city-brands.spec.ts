import {test,expect} from '@playwright/test';
import places from '../shared/places.json' with {type:'json'};

test('KFC, McDonald\'s, Shell and the church agree with the map and keep drive-through lanes open',async({page})=>{
 expect(places).toEqual(expect.arrayContaining([
  expect.objectContaining({name:'KFC Drive-Thru',x:105,z:60}),
  expect.objectContaining({name:"McDonald's Drive-Thru",x:129,z:60}),
  expect.objectContaining({name:'Shell · Select',x:33,z:103}),
  expect.objectContaining({name:'Gereja Harapan',x:117,z:-37,kind:'ibadah'}),
 ]));
 await page.route('**/brands-harness',r=>r.fulfill({contentType:'text/html',body:'<div></div>'}));
 await page.goto('/brands-harness');
 const state=await page.evaluate(async()=>{
  const {createWorld}=await import('/src/world.ts');
  const world=createWorld({add(){}} as any);
  const blocked=(x:number,z:number)=>world.solids.some(s=>Math.abs(x-s.x)<s.hx&&Math.abs(z-s.z)<s.hz);
  return {names:world.group.children.map(o=>o.name),kfcLane:blocked(113,60),mcdLane:blocked(121,60),mosques:world.group.getObjectsByProperty('name','mosque').length,churches:world.group.getObjectsByProperty('name','church').length};
 });
 expect(state.names).toEqual(expect.arrayContaining(['drive-through-kfc','drive-through-mcdonald-s','shell-station']));
 expect(state).toMatchObject({kfcLane:false,mcdLane:false,mosques:1,churches:1});
});
