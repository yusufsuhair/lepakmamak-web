import {test,expect} from '@playwright/test';

// Gereja Harapan, Kuil Seri Harmoni and Tokong Harmoni (scripts/blender/build_worship.py) replace their
// procedural fallbacks without moving a collider, a map footprint or a canvas name sign, stay inside a
// draw budget, and light up only at night (src/worship.ts). The masjid keeps its own build and lighting.
test('the Blender church and temples replace the fallbacks, keep colliders and signs, and light up at night',async({page})=>{
 await page.clock.install({time:'2026-09-12T05:00:00Z'});   // 13:00 MYT
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createWorld,streamAllNow}=await import('/src/world.ts');
  // The world's own worship module instance (Vite may add ?t= after an edit), so the hook is the one it registered with.
  const src=await (await fetch('/src/world.ts')).text();
  const url=(src.match(/from\s*["'](\/src\/worship\.ts[^"']*)["']/)||[])[1]||'/src/worship.ts';
  const {setWorshipNight}=await import(/* @vite-ignore */ url);
  const world=createWorld({add:(o:any)=>o} as any);
  const sites=[['church',117,-37,'church'],['hindu',105,37,'hindutemple'],['chinese',129,37,'chinesetemple']] as const;
  const footprint=()=>JSON.stringify({
   solids:world.solids.filter((s:any)=>sites.some(([,x,z])=>s.x===x&&s.z===z)),
   map:world.mapBuildings.filter((b:any)=>sites.some(([,x,z])=>b.x===x&&b.z===z)),
  });
  const groups=sites.map(([name])=>world.group.getObjectByName(name) as any);
  const signOf=(g:any)=>g.children.filter((c:any)=>c.isMesh&&c.material.isMeshBasicMaterial).map((c:any)=>({x:c.position.x,y:c.position.y,z:c.position.z,...c.geometry.parameters}));
  const before={footprint:footprint(),signs:JSON.stringify(groups.map(signOf)),positions:JSON.stringify(groups.map(g=>g.position.toArray()))};
  streamAllNow();
  for(let i=0;i<300&&!sites.every(([,, ,root],k)=>groups[k].getObjectByName(root));i++)await new Promise(done=>setTimeout(done,100));
  const mosque:any=world.group.getObjectByName('mosque');
  for(let i=0;i<300&&!mosque.getObjectByName('masjid');i++)await new Promise(done=>setTimeout(done,100));
  const models=sites.map(([,, ,root],k)=>groups[k].getObjectByName(root));
  const meshes=(o:any)=>{const list:any[]=[];o?.traverse((c:any)=>{if(c.isMesh)list.push(c);});return list;};
  const all=models.flatMap(meshes);
  const byName=(prefix:string)=>all.filter(m=>m.material.name.startsWith(prefix));
  const washes=byName('Night wash'),glass=byName('Night glow stained glass'),lanterns=byName('Night lantern red'),floods=byName('Night flood gopuram');
  const state=()=>({washes:washes.every(m=>m.visible),glass:glass.every(m=>m.material.emissiveIntensity>0),lanterns:lanterns.every(m=>m.material.emissiveIntensity>0),flood:floods.every(m=>m.material.emissiveIntensity>0)});
  setWorshipNight(false);const day=state();setWorshipNight(true);const night=state();setWorshipNight(false);
  let smoke=0;models[2]?.traverse((o:any)=>{if(o.isPoints&&o.name==='LM_Worship_JossSmoke')smoke++;});
  let mosqueSmoke=0;mosque.traverse((o:any)=>{if(o.name==='LM_Worship_JossSmoke'||o.material?.name?.startsWith('Night flood'))mosqueSmoke++;});
  return {
   loaded:models.map(Boolean),
   unchanged:before.footprint===footprint()&&before.signs===JSON.stringify(groups.map(signOf))&&before.positions===JSON.stringify(groups.map(g=>g.position.toArray())),
   footprint:JSON.parse(before.footprint),
   signs:groups.map(g=>signOf(g).length),fallbackGone:groups.map(g=>g.children.length),
   draws:models.map(m=>meshes(m).length),triangles:models.map(m=>Math.round(meshes(m).reduce((t,c)=>t+(c.geometry.index?c.geometry.index.count:c.geometry.attributes.position.count)/3,0))),
   textured:all.filter(m=>m.material.map&&m.material.normalMap).length,
   washes:washes.length,glass:glass.length,lanterns:lanterns.length,floods:floods.length,
   additive:washes.every(m=>m.material.blending===2&&!m.castShadow),day,night,smoke,
   mosque:!!mosque.getObjectByName('masjid'),mosqueSmoke,
  };
 });
 expect(result.loaded).toEqual([true,true,true]);
 expect(result.unchanged).toBe(true);                        // colliders, map footprints, sign wording/placement untouched
 expect(result.footprint.solids).toEqual([{x:117,z:-37,hx:9,hz:8},{x:105,z:37,hx:9,hz:8},{x:129,z:37,hx:9,hz:8}]);
 expect(result.signs).toEqual([1,1,1]);                      // GEREJA HARAPAN, KUIL SERI HARMONI, TOKONG HARMONI stay canvas
 expect(result.fallbackGone).toEqual([2,2,2]);               // the sign and the GLB are all that remain
 for(const draws of result.draws)expect(draws).toBeLessThanOrEqual(28);
 for(const tris of result.triangles)expect(tris).toBeLessThanOrEqual(20000);
 expect(result.textured).toBeGreaterThan(30);                // PBR sets survived loading
 expect(result.washes).toBe(3);expect(result.glass).toBe(1);expect(result.lanterns).toBe(1);expect(result.floods).toBe(1);
 expect(result.additive).toBe(true);
 expect(result.day).toEqual({washes:false,glass:false,lanterns:false,flood:false});
 expect(result.night).toEqual({washes:true,glass:true,lanterns:true,flood:true});
 expect(result.smoke).toBe(1);
 expect(result.mosque).toBe(true);expect(result.mosqueSmoke).toBe(0);   // the masjid keeps its own lighting
});
