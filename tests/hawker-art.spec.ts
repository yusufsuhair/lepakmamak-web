import {test,expect} from '@playwright/test';
import stalls from '../shared/stalls.json' with {type:'json'};

// The photographic gerai and busking pitch (scripts/blender/build_stalls.py, build_busking.py) swap in
// for the procedural fallbacks without moving anything gameplay depends on, and light up after dark.
test('the gerai and busking GLBs replace their fallbacks, keep every anchor and light up only at night',async({page})=>{
 test.setTimeout(400000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 // A bare page: the game itself would stream the whole city alongside.
 await page.route('**/hawker-harness',r=>r.fulfill({contentType:'text/html',body:'<canvas></canvas>'}));
 await page.goto('/hawker-harness');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js' as string);
  // The module instances busking.ts itself imports (Vite may add ?t= after an edit), so the night hook
  // and streamAllNow are the ones the loaders registered with.
  const busking=await (await fetch('/src/busking.ts')).text(),stallsSource=await (await fetch('/src/stalls.ts')).text();
  const S=await import(/* @vite-ignore */ (busking.match(/from\s*["'](\/src\/stalls\.ts[^"']*)["']/)||[])[1]||'/src/stalls.ts');
  const W=await import(/* @vite-ignore */ (stallsSource.match(/from\s*["'](\/src\/world\.ts[^"']*)["']/)||[])[1]||'/src/world.ts');
  const B=await import('/src/busking.ts' as string);
  const scene=new THREE.Scene(),solids:any[]=[];
  S.createStallWorld(scene,solids);
  const stallSolids=JSON.stringify(solids);
  const crowd=B.createBuskers(scene,solids),rembayung=B.createBuskers(scene,solids,B.rembayungBuskingSpot);
  const allSolids=JSON.stringify(solids);
  const sellers=scene.children.filter((o:any)=>o.name!=='stalls'&&o.children.length&&Math.abs(o.position.y-.12)<1e-6).map((o:any)=>[o.position.x,o.position.z]);
  W.streamAllNow();
  // GLTFLoader sanitises node names, so the GLB's meshes are found by their material names.
  const meshes=(root:any,prefix:string)=>{const found:any[]=[];root.traverse((o:any)=>{if(o.isMesh&&!o.material.isMeshBasicMaterial&&!o.material.isShaderMaterial&&(o.material.name.startsWith(prefix)||o.material.name.startsWith('Night')))found.push(o);});return found;};
  const group=scene.getObjectByName('stalls');const stages=scene.children.filter((o:any)=>o.children.some((c:any)=>c.name==='busking'));
  for(let i=0;i<1800&&!(meshes(group,'Stall ').length&&stages.every((g:any)=>meshes(g,'Busk ').length));i++)await new Promise(done=>setTimeout(done,100));
  const stallMeshes=meshes(group,'Stall '),stageMeshes=stages.map((g:any)=>meshes(g,'Busk '));
  const all=[...stallMeshes,...stageMeshes.flat()];
  const named=(name:string)=>all.filter(m=>m.material.name===name);
  // Low graphics quality turns shadows off; the effects and lamps must still draw without errors.
  const renderer=new THREE.WebGLRenderer({canvas:document.createElement('canvas')});renderer.setSize(320,200);
  const camera=new THREE.PerspectiveCamera(50,1.6,.1,300);camera.position.set(-22,3,72);camera.lookAt(-24,1.5,65);
  scene.add(new THREE.HemisphereLight());
  const frame=(shadows:boolean,night:boolean)=>{renderer.shadowMap.enabled=shadows;S.setHawkerNight(night);renderer.render(scene,camera);return renderer.info.render.calls;};
  const drawsLow=frame(false,true),drawsHigh=frame(true,false);
  const washes=[...named('Night wash'),...named('Night beam')];
  const state=()=>({washes:washes.every(m=>m.visible),tubes:named('Night tube')[0].material.emissiveIntensity,fairy:named('Night fairy')[0].material.emissiveIntensity,par:named('Night par')[0].material.emissiveIntensity});
  S.setHawkerNight(false);const day=state();S.setHawkerNight(true);const night=state();S.setHawkerNight(false);
  return {
   stallSolids:JSON.parse(stallSolids),sellers,solidsUnchanged:allSolids===JSON.stringify(solids),solidCount:solids.length,
   signs:group.children.filter((c:any)=>c.isMesh&&c.material.isMeshBasicMaterial).length,stallChildren:group.children.length,
   stageSigns:stages.map((g:any)=>g.children.find((c:any)=>c.name==='busking').children.filter((c:any)=>c.isMesh&&c.material.isMeshBasicMaterial).length),
   stageChildren:stages.map((g:any)=>g.children.find((c:any)=>c.name==='busking').children.length),
   performers:stages.map((g:any)=>g.children.filter((c:any)=>c.name!=='busking').length),audience:crowd.audienceCount+rembayung.audienceCount,
   stallDraws:stallMeshes.length,stageDraws:stageMeshes.map((m:any[])=>m.length),
   textured:new Set(all.filter(m=>m.material.map&&m.material.normalMap).map(m=>m.material.name)).size,
   vertexColours:all.filter(m=>m.geometry.getAttribute('color')).length===all.length,
   effects:['stall-wok-flame','stall-smoke'].map(name=>!!group.getObjectByName(name)),
   additive:washes.every(m=>m.material.blending===THREE.AdditiveBlending&&!m.castShadow),washCount:washes.length,
   drawsLow,drawsHigh,day,night,
  };
 });
 // Colliders: one counter and one vendor per stall, exactly where they always were.
 expect(result.stallSolids).toEqual(stalls.flatMap(s=>[{x:s.x,z:s.z,hx:2,hz:.8},{x:s.x,z:s.z-1.4,hx:.4,hz:.4}]));
 expect(result.sellers).toEqual(stalls.map(s=>[s.x,s.z-1.4]));
 expect(result.solidsUnchanged).toBe(true);
 // The fallbacks are gone: the canvas boards and the GLB are all that remain.
 expect(result.signs).toBe(2);expect(result.stallChildren).toBe(3);
 expect(result.stageSigns).toEqual([1,1]);expect(result.stageChildren).toEqual([2,2]);
 expect(result.performers.every((n:number)=>n>=6)).toBe(true);expect(result.audience).toBe(22);
 // Shared, textured, vertex-painted materials keep the sets to a handful of draws each.
 expect(result.stallDraws).toBeLessThanOrEqual(18);expect(result.stageDraws.every((n:number)=>n<=14)).toBe(true);
 expect(result.textured).toBeGreaterThanOrEqual(12);expect(result.vertexColours).toBe(true);
 expect(result.effects).toEqual([true,true]);
 expect(result.additive).toBe(true);expect(result.washCount).toBe(1+2*2);   // merged by material: one pool mesh for both stalls, a pool and a beam per pitch
 expect(result.drawsLow).toBeGreaterThan(0);expect(result.drawsHigh).toBeGreaterThan(0);
 expect(result.day).toEqual({washes:false,tubes:.6,fairy:.15,par:0});
 expect(result.night).toEqual({washes:true,tubes:2.4,fairy:2.8,par:3.2});
 expect(errors).toEqual([]);
});
