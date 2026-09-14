import {test,expect} from '@playwright/test';

// The Blender skyline (scripts/blender/build_skyline.py, loaded by src/skyline.ts) is only skin: the
// tower origins, collision boxes and map footprints stay the game's. This loads all seven towers and
// checks each replaced its procedural stand-in at the same origin, kept its canvas name signs, faces
// outward (rays from outside land on front faces), stays within budget, and lights up at night.
test('skyline towers swap in on unchanged footprints, face outward and light up at night',async({page})=>{
 await page.route('**/skyline-check',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('/skyline-check');
 const result=await page.evaluate(async()=>{
  // Import three and skyline.ts through the URLs world.ts uses, so the module state is shared.
  const source=await (await fetch('/src/world.ts')).text();
  const THREE:any=await import(source.match(/from\s+"(\/node_modules\/\.vite\/deps\/three\.js[^"]*)"/)?.[1]||'/node_modules/.vite/deps/three.js');
  const W:any=await import('/src/world.ts');
  const S:any=await import(source.match(/from\s+"(\/src\/skyline\.ts[^"]*)"/)?.[1]||'/src/skyline.ts');
  const scene=new THREE.Scene();const world=W.createWorld(scene);
  for(let i=0;i<400&&S.SKYLINE_ASSETS.some((a:string)=>S.skylineStatus.towers[a]==='loading');i++)await new Promise(r=>setTimeout(r,150));
  const ray=new THREE.Raycaster(),normal=new THREE.Vector3(),materials=new Map<string,any>(),aluminium=new Set(),textures=new Set<any>();
  const towers=S.SKYLINE_ASSETS.map((asset:string)=>{
   const holder=scene.getObjectByName(asset);holder.updateMatrixWorld(true);
   const meshes:any[]=[],signs:any[]=[],beacons:any[]=[];
   holder.traverse((o:any)=>{if(o.isSprite)beacons.push(o);else if(o.isMesh)(o.material.isMeshBasicMaterial?signs:meshes).push(o);});
   let triangles=0;for(const m of meshes){triangles+=(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3;materials.set(m.material.name,m.material);if(m.material.name==='Skyline aluminium')aluminium.add(m.material.map);for(const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])if(m.material[k])textures.add(m.material[k]);}
   const top=new THREE.Box3();for(const m of meshes)top.expandByObject(m);
   // Rays in from 80 m at every 22.5 degrees and every 6 m of height: the first hit must be a front face.
   // Double-sided while casting, or the raycaster would skip an inside-out face instead of reporting it.
   const sides=meshes.map(m=>m.material.side);for(const m of meshes)m.material.side=THREE.DoubleSide;
   let hits=0,backFaces=0;const p=holder.position;
   for(let y=1;y<top.max.y;y+=6)for(let k=0;k<16;k++){
    const a=k*Math.PI/8,origin=new THREE.Vector3(p.x+Math.cos(a)*80,y,p.z+Math.sin(a)*80),dir=new THREE.Vector3(-Math.cos(a),0,-Math.sin(a));
    ray.set(origin,dir);ray.far=80;const hit=ray.intersectObjects(meshes,false)[0];
    if(!hit)continue;hits++;normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if(normal.dot(dir)>0)backFaces++;
   }
   meshes.forEach((m,i)=>m.material.side=sides[i]);
   return {asset,position:holder.position.toArray(),state:S.skylineStatus.towers[asset],signs:signs.length,draws:meshes.length,triangles,
    height:Math.round(top.max.y),hits,backFaces,beacons:beacons.length};
  });
  const near=(x:number,z:number)=>[[105,-95],[129,-95],[-104,-145],[-127,-37],[-106,-37],[-127,37],[-106,37]].some(([a,b])=>a===x&&b===z);
  const solids=world.solids.filter((s:any)=>near(s.x,s.z)).map((s:any)=>[s.x,s.z,s.hx,s.hz]);
  const footprints=world.mapBuildings.filter((b:any)=>near(b.x,b.z)).map((b:any)=>[b.x,b.z,b.w,b.d,b.color]);
  const spire=materials.get('Merdeka 118 spire'),beacons:any[]=[];scene.traverse((o:any)=>{if(o.isSprite&&o.name==='aviation glow')beacons.push(o);});
  S.setSkylineNight(true);const night={spire:spire.emissive.getHex(),beacons:beacons.filter(b=>b.visible).length};
  S.setSkylineNight(false);const day={spire:spire.emissive.getHex(),beacons:beacons.filter(b=>b.visible).length};
  return {towers,solids,footprints,materials:[...materials.keys()].sort(),night,day,aluminiumTextures:aluminium.size,
   textureMB:[...textures].reduce((n:number,t:any)=>n+t.image.width*t.image.height*4*4/3,0)/1048576};
 });
 const byAsset=Object.fromEntries(result.towers.map((t:any)=>[t.asset,t]));
 expect(result.towers.map((t:any)=>[t.asset,t.position,t.state])).toEqual([
  ['LM_ENV_TRX',[105,0,-95],'ready'],['LM_ENV_Merdeka118',[129,0,-95],'ready'],['LM_ENV_KLTower',[-104,0,-145],'ready'],
  ['LM_ENV_TowerUOB',[-127,0,-37],'ready'],['LM_ENV_TowerHSBC',[-106,0,-37],'ready'],['LM_ENV_TowerDAP',[-127,0,37],'ready'],['LM_ENV_TowerMahkota',[-106,0,37],'ready']]);
 // Colliders and map footprints exactly as before the reskin.
 expect(result.solids).toEqual([[-127,-37,8,8.5],[-106,-37,8,8.5],[-127,37,8,8.5],[-106,37,8.5,8.5],[105,-95,9,9],[129,-95,8.5,8.5]]);
 expect(result.footprints).toEqual([[-127,-37,16,17,'#b52e35'],[-106,-37,16,17,'#d33b3e'],[-127,37,16,17,'#c62e34'],[-106,37,17,17,'#a5813e'],[105,-95,18,18,'#688c8e'],[129,-95,17,17,'#7f9697']]);
 for(const t of result.towers){
  expect(t.signs,t.asset).toBe(t.asset==='LM_ENV_KLTower'?0:t.asset==='LM_ENV_TowerDAP'?2:1);
  expect(t.draws,t.asset).toBeLessThanOrEqual(4);
  expect(t.hits,t.asset).toBeGreaterThan(40);
  expect(t.backFaces,t.asset).toBe(0);
 }
 expect(result.towers.reduce((n:number,t:any)=>n+t.triangles,0)).toBeLessThan(16000);
 // Merdeka 118 stands clear above the Twin Towers (103.5), its spire topping out at 142.
 expect(byAsset.LM_ENV_Merdeka118.height).toBe(142);
 expect([byAsset.LM_ENV_TRX.beacons,byAsset.LM_ENV_Merdeka118.beacons,byAsset.LM_ENV_KLTower.beacons]).toEqual([2,2,3]);
 expect(result.materials).toEqual(expect.arrayContaining(['TRX curtain wall','TRX crown','Merdeka 118 curtain wall','Merdeka 118 facet frame','KL Tower pod','KL Tower deck glass','KL Tower concrete','UOB curtain wall','HSBC granite wall','Pusat Komuniti wall','Hotel Mahkota wall']));
 expect(result.night.spire).not.toBe(0);expect(result.night.beacons).toBe(7);
 expect(result.day).toEqual({spire:0,beacons:0});
 // Six towers carry the aluminium; the GPU gets one copy of its texture.
 expect(result.aluminiumTextures).toBe(1);
 // RGBA with mipmaps: the whole pack stays near what the KLCC set alone uploads.
 expect(result.textureMB).toBeLessThan(24);
});
