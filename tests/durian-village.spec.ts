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
  let collisions=0,dialogueMisses=0,netHeight=0;
  for(let step=0;step<240;step++){
   village.update(step*.1);
   for(const p of village.people){
    const x=p.rig.group.position.x+villageOrigin.x,z=p.rig.group.position.z+villageOrigin.z;
    if(world.solids.some(s=>Math.abs(x-s.x)<s.hx+.2&&Math.abs(z-s.z)<s.hz+.2))collisions++;
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
 expect(result.collisions).toBe(0);
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
