import {test,expect} from '@playwright/test';

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
   far:village.nearby(0,0)?.name??null};
 });
 expect(result.count).toBe(21);
 expect(result.collisions).toEqual([]);
 expect(result.dialogueMisses).toBe(0);
 expect(result.netHeight).toBeGreaterThan(1.8);
 expect(result.moving).toBeGreaterThan(10);
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
