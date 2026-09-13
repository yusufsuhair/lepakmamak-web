import {test,expect} from '@playwright/test';

test('the Blender masjid replaces the fallback, keeps the name sign and lights up only at night',async({page})=>{
 await page.clock.install({time:'2026-09-12T05:00:00Z'});   // 13:00 MYT, so the running game says day
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createWorld,streamAllNow}=await import('/src/world.ts');
  // The world's own masjid module instance (Vite may add ?t= after an edit), so the hook is the one it registered with.
  const url=((await (await fetch('/src/world.ts')).text()).match(/from\s*["'](\/src\/masjid\.ts[^"']*)["']/)||[])[1]||'/src/masjid.ts';
  const {setMasjidNight}=await import(/* @vite-ignore */ url);
  const add=(o:any)=>o;const world=createWorld({add} as any);
  const before=JSON.stringify({solids:world.solids.filter((s:any)=>s.id?.startsWith('masjid-')),map:world.mapBuildings.filter((b:any)=>b.color==='#438d7b')});
  streamAllNow();
  const mosque:any=world.group.getObjectByName('mosque');
  for(let i=0;i<300&&!mosque.getObjectByName('masjid');i++)await new Promise(done=>setTimeout(done,100));
  const meshes:any[]=[];mosque.getObjectByName('masjid')?.traverse((o:any)=>{if(o.isMesh)meshes.push(o);});
  const washes=meshes.filter(m=>m.material.name.startsWith('Night wash')),glows=meshes.filter(m=>m.material.name==='Night glow jali'||m.material.name==='Night LED green');
  const state=()=>({washes:washes.every(m=>m.visible),dark:glows.every(m=>m.material.emissiveIntensity===0)});
  setMasjidNight(false);const day=state();setMasjidNight(true);const night=state();setMasjidNight(false);
  return {unchanged:before===JSON.stringify({solids:world.solids.filter((s:any)=>s.id?.startsWith('masjid-')),map:world.mapBuildings.filter((b:any)=>b.color==='#438d7b')}),
   signs:mosque.children.filter((c:any)=>c.isMesh&&c.material.isMeshBasicMaterial).length,fallbackGone:mosque.children.length===2,
   textured:meshes.filter(m=>m.material.map&&m.material.normalMap).length,washes:washes.length,glows:glows.length,
   additive:washes.every(m=>m.material.blending===2&&!m.castShadow),day,night};
 });
 expect(result.signs).toBe(1);                 // MASJID KAMPUNG MAJU stays the game's canvas
 expect(result.fallbackGone).toBe(true);       // the sign and the GLB are all that remain
 expect(result.textured).toBeGreaterThan(10);  // PBR sets survived loading
 expect(result.unchanged).toBe(true);          // colliders and the map footprint are untouched
 expect(result.washes).toBe(2);expect(result.glows).toBe(2);expect(result.additive).toBe(true);
 expect(result.day).toEqual({washes:false,dark:true});
 expect(result.night).toEqual({washes:true,dark:false});
});
