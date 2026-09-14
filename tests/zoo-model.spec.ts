import {test,expect} from '@playwright/test';

// LM_ENV_Zoo.glb (scripts/blender/build_zoo_negara.py) swaps in over the procedural park. The game
// keeps its four canvas signs, its gateway colliders and the park footprint; the GLB brings the
// habitats, the textured animals and the path lamps, which only light after dark.
test('the Blender zoo replaces the fallback, keeps its signs in view and lights its paths only at night',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.install({time:'2026-09-12T05:00:00Z'});
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const source=await (await fetch('/src/world.ts')).text();
  const three=(source.match(/from\s*["'](\/node_modules\/\.vite\/deps\/three\.js[^"']*)["']/)||[])[1];
  const night=(source.match(/from\s*["'](\/src\/district-night\.ts[^"']*)["']/)||[])[1]||'/src/district-night.ts';
  const THREE:any=await import(/* @vite-ignore */ three);
  const {setDistrictNight}=await import(/* @vite-ignore */ night);
  const {createWorld,streamAllNow}=await import('/src/world.ts');
  const world=createWorld({add:(o:any)=>o} as any);
  const snapshot=()=>JSON.stringify({solids:world.solids,map:world.mapBuildings});
  const before=snapshot();
  streamAllNow();
  const zoo:any=world.group.getObjectByName('zoo');
  const loaded=()=>zoo.children.find((c:any)=>c.children?.some((k:any)=>k.name==='zoo'));
  for(let i=0;i<600&&!loaded();i++)await new Promise(done=>setTimeout(done,100));
  const meshes:any[]=[];loaded()?.traverse((o:any)=>{if(o.isMesh)meshes.push(o);});
  const names=new Set(meshes.map(m=>m.material.name));
  const signs=zoo.children.filter((c:any)=>c.isMesh&&c.material.isMeshBasicMaterial);
  // every canvas sign is the first thing a ray from the visitor's side meets
  world.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();const blocked:string[]=[];
  for(const sign of signs){
   // the fallback batcher bakes sign transforms into their geometry, so read the plane from its bounds
   const bounds=new THREE.Box3().setFromObject(sign),centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
   const normal=size.x<size.z?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1);
   const eye=centre.clone().addScaledVector(normal,5);eye.y=Math.max(1.7,centre.y-1.5);
   ray.set(eye,centre.clone().sub(eye).normalize());
   const hit=ray.intersectObjects([zoo],true).find((h:any)=>!h.object.isSprite);
   if(hit?.object!==sign)blocked.push(`${hit?.object.material?.name} before sign at ${centre.x.toFixed(1)},${centre.z.toFixed(1)}`);
  }
  const washes=meshes.filter(m=>m.material.name.startsWith('Night wash')),glows=meshes.filter(m=>m.material.name.startsWith('Night glow'));
  const state=()=>({washes:washes.every(m=>m.visible),dark:glows.every(m=>m.material.emissiveIntensity===0)});
  setDistrictNight(false);const day=state();setDistrictNight(true);const lit=state();setDistrictNight(false);
  return {unchanged:snapshot()===before,loaded:!!loaded(),signs:signs.length,fallbackGone:zoo.children.length===signs.length+1,blocked,
   animals:['Elephant hide','Giraffe coat','Zebra coat','Lion fur','Flamingo plumage'].filter(n=>!names.has(n)),
   textured:meshes.filter(m=>m.material.map&&m.material.normalMap).length,
   gatewaySolids:world.solids.filter((s:any)=>Math.abs(s.x+95.5)<.01&&Math.abs(Math.abs(s.z+112)-8)<.01&&s.hx===1.6&&s.hz===1.6).length,
   washes:washes.length,glows:glows.length,day,lit};
 });
 expect(result.loaded).toBe(true);
 expect(result.signs).toBe(4);                    // ZOO NEGARA MINI LEPAK, GAJAH, SAVANA, KOLAM FLAMINGO stay the game's
 expect(result.fallbackGone).toBe(true);          // the signs and the GLB are all that remain
 expect(result.blocked).toEqual([]);              // no frame, roof or plant sits between a sign and its readers
 expect(result.animals).toEqual([]);              // every animal arrived in its coat
 expect(result.textured).toBeGreaterThan(10);     // PBR sets survived loading
 expect(result.unchanged).toBe(true);             // colliders and the park footprint are untouched
 expect(result.gatewaySolids).toBe(2);
 expect(result.washes).toBeGreaterThan(0);expect(result.glows).toBeGreaterThan(0);
 expect(result.day).toEqual({washes:false,dark:true});
 expect(result.lit).toEqual({washes:true,dark:false});
 expect(errors).toEqual([]);
});
