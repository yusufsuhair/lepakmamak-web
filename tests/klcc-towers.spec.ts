import {test,expect} from '@playwright/test';

// The Blender Twin Towers (scripts/blender/build_klcc.py) are only scenery: the KLCC lifts, their
// rooftop stop at KLCC_LIFT_TOP and the podium collision boxes are the game's. This keeps the mesh
// out of the shafts and the rooftop platform, inside the podium boxes below head height, within
// its budget, and checks the night switch reaches the loaded materials.
test('KLCC towers keep the lifts clear, stay on the podium footprint and light up at night',async({page})=>{
 await page.route('**/klcc-check',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('/klcc-check');
 const result=await page.evaluate(async()=>{
  // Import three and klcc.ts through the same URLs world.ts uses, so the module state is shared.
  const source=await (await fetch('/src/world.ts')).text();
  const THREE:any=await import(source.match(/from\s+"(\/node_modules\/\.vite\/deps\/three\.js[^"]*)"/)?.[1]||'/node_modules/.vite/deps/three.js');
  const W:any=await import('/src/world.ts');
  const K:any=await import(source.match(/from\s+"(\/src\/klcc\.ts[^"]*)"/)?.[1]||'/src/klcc.ts');
  const scene=new THREE.Scene();const world=W.createWorld(scene);
  for(let i=0;i<400&&K.klccStatus.state==='loading';i++)await new Promise(r=>setTimeout(r,150));
  const klcc=scene.getObjectByName('klcc');klcc.updateMatrixWorld(true);
  const meshes:any[]=[];klcc.traverse((o:any)=>{if(o.isMesh)meshes.push(o);});
  const top=W.KLCC_LIFT_TOP,v=new THREE.Vector3();
  let triangles=0,inShaft=0,onPlatform=0,outsidePodium=0,rayHits=0;
  const podiums=world.solids.filter((s:any)=>Math.abs(s.z+122)<.01&&s.hx===10.5);
  for(const mesh of meshes){
   const p=mesh.geometry.getAttribute('position');triangles+=(mesh.geometry.index?.count??p.count)/3;
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
    for(const lift of world.klccLifts){
     if(Math.abs(v.x-lift.x)<1.75&&Math.abs(v.z-lift.z)<1.75&&v.y<top+2.8)inShaft++;
     if(Math.abs(v.x-lift.x)<3.7&&Math.abs(v.z-lift.z)<3.7&&v.y>top-.3&&v.y<top+2.8)onPlatform++;
    }
    if(v.y<2.2&&!podiums.some((s:any)=>Math.abs(v.x-s.x)<=s.hx+.12&&Math.abs(v.z-s.z)<=s.hz+.12))outsidePodium++;
   }
  }
  // Rays straight through each shaft, both ways, from the ground to above the rooftop rails.
  const ray=new THREE.Raycaster();
  for(const lift of world.klccLifts)for(let y=.5;y<top+2.8;y+=1.5)for(const [dx,dz] of [[1,0],[0,1]]){
   ray.set(new THREE.Vector3(lift.x-dx*1.75,y,lift.z-dz*1.75),new THREE.Vector3(dx,0,dz));ray.far=3.5;
   rayHits+=ray.intersectObjects(meshes,false).length;
  }
  const steel=meshes.map(m=>m.material).find((m:any)=>m.name==='KLCC stainless');
  K.setKlccNight(true);const night={glow:steel.emissive.getHex(),intensity:steel.emissiveIntensity};
  K.setKlccNight(false);const day={glow:steel.emissive.getHex()};
  // The glass reflects the shared sky probe (weather.ts, as klcc.ts imports it) and follows a sky change.
  const Wx:any=await import((await (await fetch(source.match(/from\s+"(\/src\/klcc\.ts[^"]*)"/)?.[1]||'/src/klcc.ts')).text()).match(/from\s+"(\/src\/weather\.ts[^"]*)"/)?.[1]||'/src/weather.ts');
  let probe:any=null;Wx.onSkyProbe((t:any)=>{probe=t;});
  const glass=meshes.map(m=>m.material).filter((m:any)=>m.name!=='KLCC podium granite');
  const noonProbe=glass.every((m:any)=>m.envMap===probe);const first=probe;
  document.body.innerHTML='<label><input id="rain-toggle" type="checkbox"></label><p id="weather-label"></p>';
  scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,1,100);
  Wx.setupWeather(scene,new THREE.DirectionalLight(),new THREE.HemisphereLight(),'',()=>{},()=>true).preview({condition:'rain',time:'20:30'});
  const followed=probe!==first&&glass.every((m:any)=>m.envMap===probe);
  return {state:K.klccStatus.state,top,lifts:world.klccLifts.map((l:any)=>[l.x,l.z,l.topY]),podiums:podiums.length,
   materials:meshes.map(m=>m.material.name).sort(),triangles,inShaft,onPlatform,outsidePodium,rayHits,night,day,noonProbe,followed};
 });
 expect(result.state).toBe('ready');
 expect(result.top).toBe(76.5);
 expect(result.lifts).toEqual([[-22,-107.8,76.5],[22,-107.8,76.5]]);
 expect(result.podiums).toBe(2);
 expect(result.materials).toEqual(['KLCC curtain wall','KLCC pinnacle steel','KLCC podium granite','KLCC stainless']);
 expect(result.triangles).toBeLessThan(60000);
 expect({inShaft:result.inShaft,onPlatform:result.onPlatform,rayHits:result.rayHits,outsidePodium:result.outsidePodium}).toEqual({inShaft:0,onPlatform:0,rayHits:0,outsidePodium:0});
 expect(result.night.glow).not.toBe(0);expect(result.night.intensity).toBeGreaterThan(0);
 expect(result.day.glow).toBe(0);
 expect({noonProbe:result.noonProbe,followed:result.followed}).toEqual({noonProbe:true,followed:true});
});
