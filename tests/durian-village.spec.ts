import {test,expect} from '@playwright/test';
import {enterAt} from './city';

for(const touch of [false,true])test(`Tegur puts the resident's line over their head (${touch?'tap':'click'})`,async({browser})=>{
 const context=await browser.newContext(touch?{viewport:{width:390,height:844},hasTouch:true,isMobile:true}:{});const page=await context.newPage();
 // Uncle Muthu idles in place at village (20,6), world (142,-126). Stand in front of him but clear
 // of the warung tables: behind one, the camera is pulled in and his head leaves the frame.
 await enterAt(page,140,-124.5);
 const talk=page.getByRole('button',{name:'Tegur Uncle Muthu'});
 await (touch?talk.tap():talk.click());
 // Residents are parented to the village group; a bubble projected from their local position
 // landed near the world origin, off camera, so it was created but never shown.
 const bubble=page.locator('.speech-bubble',{hasText:'Selamat datang! Duduklah'});
 await expect(bubble).toBeVisible();
 const b=(await bubble.boundingBox())!,t=(await talk.boundingBox())!;
 expect(b.y+b.height).toBeLessThan(t.y);
 await context.close();
});

test('village residents move safely, dialogue follows them and badminton clears the net',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  // Exercise the actual Three.js module in a browser (canvas nameplates included).
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createDurianVillage,createVillageResidents,villageOrigin}=await import('/src/durian-village.ts');
  const world={group:new THREE.Group(),solids:[],mapBuildings:[]};
  createDurianVillage(world);
  const village=createVillageResidents(new THREE.Scene());
  village.update(0);
  const initial=village.people.map(p=>p.rig.group.position.clone());
  const ahTongIndex=village.people.findIndex(p=>p.resident.name==='Ah Tong');
  const collisions:string[]=[];
  let dialogueMisses=0,netHeight=0;
  for(let step=0;step<640;step++){
   village.update(step*.1);
   for(const p of village.people){
    const x=p.rig.group.position.x+villageOrigin.x,z=p.rig.group.position.z+villageOrigin.z;
    if(world.solids.some(s=>Math.abs(x-s.x)<s.hx+.2&&Math.abs(z-s.z)<s.hz+.2))collisions.push(p.resident.name);
    if(village.nearby(x,z)?.name!==p.resident.name)dialogueMisses++;
   }
  }
  village.update(.825);netHeight=village.shuttle.position.y;
  village.update(5);
  return {count:village.people.length,collisions,dialogueMisses,netHeight,
   moving:village.people.filter((p,i)=>p.rig.group.position.distanceTo(initial[i])>.1).length,
   ahTongTravel:village.people[ahTongIndex].rig.group.position.distanceTo(initial[ahTongIndex]),
   far:village.nearby(0,0)?.name??null};
 });
 expect(result.count).toBe(21);
 expect(result.collisions).toEqual([]);
 expect(result.dialogueMisses).toBe(0);
 expect(result.netHeight).toBeGreaterThan(1.8);
 expect(result.moving).toBeGreaterThan(10);
 expect(result.ahTongTravel).toBeGreaterThan(.1);
 expect(result.far).toBeNull();
});

test('village scene renders with the rally and nameplates',async({page},testInfo)=>{
 await page.route('**/village-preview',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
 await page.goto('/village-preview');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createDurianVillage,createVillageResidents,villageOrigin}=await import('/src/durian-village.ts');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b4d9e3');
  const world={group:new THREE.Group(),solids:[],mapBuildings:[]};scene.add(world.group);createDurianVillage(world);
  const village=createVillageResidents(scene);village.update(.825);
  scene.add(new THREE.HemisphereLight('#fff9e5','#637647',2));
  const sun=new THREE.DirectionalLight('#fff4d7',2);sun.position.set(30,60,20);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(45,1280/800,.1,300);
  camera.position.set(villageOrigin.x+30,30,villageOrigin.z+48);camera.lookAt(villageOrigin.x,1,villageOrigin.z);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,800);
  document.body.append(renderer.domElement);renderer.render(scene,camera);
 });
 await expect(page.locator('canvas')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('village.png')});
});

test('group play, bicycles and household chores animate and reset deterministically',async({page})=>{
 await page.route('**/village-preview',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('/village-preview');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createVillageResidents,createDurianVillage,villageOrigin}=await import('/src/durian-village.ts');
  const {groupRoute}=await import('/src/village-activities.ts');
  const scene=new THREE.Scene(),village=createVillageResidents(scene);
  const world={group:new THREE.Group(),solids:[],mapBuildings:[]};createDurianVillage(world);
  const snapshot=()=>{
   scene.updateMatrixWorld(true);
   const nodes:number[][]=[];scene.traverse(node=>nodes.push([...node.position.toArray(),...node.quaternion.toArray(),Number(node.visible)]));return JSON.stringify(nodes);
  };
  village.update(0);const start=snapshot();
  const opah=village.people.find(p=>p.resident.name==='Opah');
  const tok=village.people.find(p=>p.resident.name==='Tok Dalang');
  const ros=village.people.find(p=>p.resident.name==='Kak Ros');
  const before={opah:opah.rig.rightArm.rotation.x,tok:tok.rig.rightArm.rotation.x,ros:ros.rig.rightArm.rotation.z,chicken:village.chores.chickens[0].neck.rotation.x};
  village.update(1.5);
  const changed={opah:opah.rig.rightArm.rotation.x!==before.opah,tok:tok.rig.rightArm.rotation.x!==before.tok,ros:ros.rig.rightArm.rotation.z!==before.ros,chicken:village.chores.chickens[0].neck.rotation.x!==before.chicken};
  const grainVisible=village.chores.grains.some(g=>g.visible);
  const heldBefore=village.chores.held.visible;
  village.update(6);const hungAfter=village.chores.laundry[2].visible&&!village.chores.held.visible;
  let bicycleCollisions=0,flockCollisions=0,groupBreaks=0;
  for(let i=0;i<640;i++){
   village.update(i*.1);scene.updateMatrixWorld(true);
   const upin=village.people.find(p=>p.resident.name==='Upin').rig.group.position;
   const ipin=village.people.find(p=>p.resident.name==='Ipin').rig.group.position;
   if(upin.distanceTo(ipin)>1.5)groupBreaks++;
   for(const p of village.people.filter(p=>p.cycle)){
    const bounds=new THREE.Box3().setFromObject(p.cycle.bike);
    if(world.solids.some(s=>bounds.min.x<s.x+s.hx&&bounds.max.x>s.x-s.hx&&bounds.min.z<s.z+s.hz&&bounds.max.z>s.z-s.hz))bicycleCollisions++;
   }
   for(const c of village.chores.chickens){
    const x=c.group.position.x+villageOrigin.x,z=c.group.position.z+villageOrigin.z;
    if(world.solids.some(s=>Math.abs(x-s.x)<s.hx+.35&&Math.abs(z-s.z)<s.hz+.35))flockCollisions++;
   }
  }
  village.update(0);const reset=start===snapshot();
  return{changed,grainVisible,heldBefore,hungAfter,reset,bicycleCollisions,flockCollisions,groupBreaks,
   badminton:village.people.filter(p=>p.activity==='badminton').map(p=>p.resident.name),
   cyclists:village.people.filter(p=>p.cycle).map(p=>p.resident.name),
   walkers:village.people.filter(p=>p.activity==='walk').map(p=>p.resident.name),
   chickens:village.chores.chickens.length,
   changesPace:!groupRoute('Upin',2).running&&groupRoute('Upin',8).running,
   continuous:Math.hypot(groupRoute('Upin',16).x-groupRoute('Upin',15.999).x,groupRoute('Upin',16).z-groupRoute('Upin',15.999).z)<.01};
 });
 expect(result.badminton).toEqual(['Jarjit','Ijat']);
 expect(result.cyclists).toEqual(['Mail','Rajoo']);
 expect(result.walkers).toEqual(['Mei Mei','Susanti','Devi']);
 expect(result.chickens).toBe(6);
 expect(Object.values(result.changed).every(Boolean)).toBe(true);
 expect(result.grainVisible&&result.heldBefore&&result.hungAfter).toBe(true);
 expect(result.changesPace&&result.continuous&&result.reset).toBe(true);
 expect(result.bicycleCollisions+result.flockCollisions+result.groupBreaks).toBe(0);
});

test('village greeting uses a local speech bubble instead of a modal or city chat',async({page})=>{
 const source=await (await page.request.get('/src/main.ts')).text();
 expect(source).toContain('showSpeechBubble(`village:${villageNearby.name}`');
 expect(source).toMatch(/villageNpc\s*=\s*id\.startsWith\(["']village:/);
 expect(source).not.toContain('villageDialog.showModal()');
 expect(source).not.toContain('villageDialog.open');
 const style=await (await page.request.get('/src/style.css')).text();
 expect(style).not.toContain('.village-dialog');
});

// LM_ENV_Kampung.glb (scripts/blender/build_kampung.py) swaps in over the boxes: the canvas signs,
// every collider and map footprint stay the game's, nothing new stands between a sign and the yard,
// and the windows, serambi bulbs and their pools only light after dark.
test('the Blender kampung keeps its signs readable and its colliders, and lights up only at night',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const source=await (await fetch('/src/durian-village.ts')).text();
  const three=(source.match(/from\s*["'](\/node_modules\/\.vite\/deps\/three\.js[^"']*)["']/)||[])[1];
  const night=(source.match(/from\s*["'](\/src\/district-night\.ts[^"']*)["']/)||[])[1]||'/src/district-night.ts';
  const THREE:any=await import(/* @vite-ignore */ three);
  const {setDistrictNight}=await import(/* @vite-ignore */ night);
  const {createDurianVillage}=await import('/src/durian-village.ts');
  const worldUrl=(source.match(/from\s*["'](\/src\/world\.ts[^"']*)["']/)||[])[1]||'/src/world.ts';
  const {streamAllNow}=await import(/* @vite-ignore */ worldUrl);
  const world={group:new THREE.Group(),solids:[] as any[],mapBuildings:[] as any[]};
  createDurianVillage(world as any);
  const snapshot=()=>JSON.stringify({solids:world.solids,map:world.mapBuildings});
  const before=snapshot();
  streamAllNow();   // the GLB streams in once a player is near; start it now
  const village:any=world.group.getObjectByName('kampung');
  const loaded=()=>village.children.find((c:any)=>c.children?.some((k:any)=>k.name==='kampung'));
  for(let i=0;i<600&&!loaded();i++)await new Promise(done=>setTimeout(done,100));
  const meshes:any[]=[];loaded()?.traverse((o:any)=>{if(o.isMesh)meshes.push(o);});
  const signs=village.children.filter((c:any)=>c.isMesh&&c.material.isMeshBasicMaterial);
  world.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();const blocked:string[]=[];
  for(const sign of signs){
   const bounds=new THREE.Box3().setFromObject(sign),centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
   for(const along of [-.3,0,.3]){   // the middle and either side of every sign, seen from 5 m out in the yard
    const target=centre.clone().add(new THREE.Vector3(size.x*along,0,0));
    const eye=target.clone().add(new THREE.Vector3(0,0,5));eye.y=Math.max(1.7,target.y-1.5);
    ray.set(eye,target.clone().sub(eye).normalize());
    const hit=ray.intersectObjects([village],true).find((h:any)=>!h.object.isSprite);
    if(hit?.object!==sign)blocked.push(`${hit?.object.material?.name} before sign at ${centre.x.toFixed(1)},${centre.y.toFixed(1)}`);
   }
  }
  const washes=meshes.filter(m=>m.material.name.startsWith('Night wash')),glows=meshes.filter(m=>m.material.name.startsWith('Night glow'));
  const state=()=>({washes:washes.every(m=>m.visible),dark:glows.every(m=>m.material.emissiveIntensity===0)});
  setDistrictNight(false);const day=state();setDistrictNight(true);const lit=state();setDistrictNight(false);
  return {loaded:!!loaded(),signs:signs.length,fallbackGone:village.children.length===signs.length+1,blocked,unchanged:snapshot()===before,
   textured:meshes.filter(m=>m.material.map&&m.material.normalMap).length,leaves:meshes.some(m=>m.material.alphaTest>0),
   washes:washes.length,glows:glows.length,day,lit};
 });
 expect(result.loaded).toBe(true);
 expect(result.signs).toBe(7);                  // five house labels, the village name and the badminton board
 expect(result.fallbackGone).toBe(true);
 expect(result.blocked).toEqual([]);
 expect(result.unchanged).toBe(true);           // house, gate, swing, table, bench, tree and court colliders
 expect(result.textured).toBeGreaterThan(8);
 expect(result.leaves).toBe(true);
 expect(result.washes).toBeGreaterThan(0);expect(result.glows).toBeGreaterThan(0);
 expect(result.day).toEqual({washes:false,dark:true});
 expect(result.lit).toEqual({washes:true,dark:false});
 expect(errors).toEqual([]);
});
