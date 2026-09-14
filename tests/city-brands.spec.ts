import {test,expect} from '@playwright/test';
import places from '../shared/places.json' with {type:'json'};
import {readFileSync} from 'node:fs';

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

test('photographic Shell, drive-throughs and shoplots swap in under the deployed CSP, keep colliders and signs, and light at night',async({page})=>{
 const policy=readFileSync('public/_headers','utf8').match(/Content-Security-Policy: (.*)/)![1];
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Couldn't load texture|keeping procedural|GLB unavailable/.test(m.text()))errors.push(m.text());});
 await page.route('**/brands-csp-harness',r=>r.fulfill({contentType:'text/html',headers:{'content-security-policy':policy},body:'<div></div>'}));
 await page.goto('/brands-csp-harness');
 const state=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createWorld,streamAllNow}=await import('/src/world.ts');
  const {loadMamakShops}=await import('/src/mamak-shops.ts');
  // The world's own brands module instance (Vite adds ?t= after an edit), so night reaches the materials it lit.
  const {setBrandsNight}=await import(/* @vite-ignore */ ((await (await fetch('/src/world.ts')).text()).match(/from\s*["'](\/src\/brands\.ts[^"']*)["']/)||[])[1]||'/src/brands.ts');
  const shops=(await import('/shared/mamak-shops.json')).default;
  const world=createWorld(new THREE.Scene() as any);const scene=world.group.parent as any;
  const snapshot=()=>JSON.stringify({solids:world.solids,map:world.mapBuildings});const before=snapshot();
  const loaded=loadMamakShops(scene,world.shopFallbacks);streamAllNow();
  const shell=world.group.getObjectByName('shell-station')!,kfc=world.group.getObjectByName('drive-through-kfc')!,mcd=world.group.getObjectByName('drive-through-mcdonald-s')!;
  for(let i=0;i<240&&!(shell.getObjectByName('shell')&&kfc.getObjectByName('kfc')&&mcd.getObjectByName('mcd'));i++)await new Promise(r=>setTimeout(r,250));
  await loaded.settled;
  const materials=(root:any)=>{const m=new Map<string,any>();root.traverse((o:any)=>{if(o.isMesh)m.set(o.material.name,o.material);});return m;};
  const outlets:any[]=[shell,kfc,mcd,...shops.map((s:any)=>scene.getObjectByName(s.asset))];
  const summary=()=>outlets.map(root=>{const m=materials(root),wash=m.get('Night wash'),led=m.get('Night glow LED'),glass=m.get('Shopfront glass')??m.get('Upper floor glass'),panel=m.get('Painted panel');
   return {name:root.name,textured:!!panel?.map?.image&&!!panel?.normalMap?.image,glassReflects:!!glass?.envMap,probe:glass?.envMap?.uuid,washVisible:wash?.visible,sign:led?.emissiveIntensity??0};});
  const day=summary();setBrandsNight(true);const night=summary();setBrandsNight(false);
  const canvas=shell.children.filter((o:any)=>o.isMesh&&o.material.isMeshBasicMaterial);
  return {unchanged:before===snapshot(),day,night,
   shellCanvasSigns:canvas.length,shellSignsFaceStreet:canvas.every((o:any)=>Math.abs(o.rotation.y-Math.PI)<1e-6),
   shellChildren:shell.children.length,kfcChildren:kfc.children.length,mcdChildren:mcd.children.length,
   fallbacksHidden:shops.every((s:any)=>world.shopFallbacks.get(s.asset)!.visible===false),
   lanesClear:!world.solids.some(s=>[113,121].some(x=>Math.abs(x-s.x)<s.hx&&Math.abs(60-s.z)<s.hz))};
 });
 expect(state.unchanged).toBe(true);
 expect(state).toMatchObject({shellCanvasSigns:4,shellSignsFaceStreet:true,shellChildren:5,kfcChildren:1,mcdChildren:1,fallbacksHidden:true,lanesClear:true});
 expect(state.day).toHaveLength(10);
 for(const [index,outlet] of state.day.entries()){
  expect(outlet,outlet.name).toMatchObject({textured:true,glassReflects:true,washVisible:false});
  expect(state.night[index].probe,outlet.name).not.toBe(outlet.probe);   // the street probe repaints for the night sky
  expect(state.night[index].washVisible,outlet.name).toBe(true);
  expect(state.night[index].sign,outlet.name).toBeGreaterThan(outlet.sign);
 }
 expect(errors).toEqual([]);
});
