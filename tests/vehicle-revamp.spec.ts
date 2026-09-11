import {test, expect} from '@playwright/test';
import fleet from '../shared/fleet.json' with {type:'json'};
import {createFleet} from '../server/fleet.mjs';

const styles=['axia','myvi','emas','avanza','vellfire','suv','sport','ferrari','lamborghini','model-y','cybertruck','police','f1'];

test('all 13 Blender vehicles render on desktop and mobile with animated wheels',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/vehicles-preview.html');
  for(const style of styles){
    await page.selectOption('#model',style);
    await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio?.state)).toBe('ready');
    // Asset readiness precedes the next rendered frame; avoid reading fallback counters.
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    const stats=await page.evaluate(()=>(window as any).__vehicleStudio);
    expect(stats.style).toBe(style);expect(stats.wheels).toBe(4);
    // Renderer counters include the directional shadow pass as well as the visible pass.
    // pack-validate independently enforces <45k geometry triangles for every GLB.
    expect(stats.triangles).toBeLessThan(90000);expect(stats.calls).toBeLessThan(64);
    expect(stats.bounds[0]).toBeLessThanOrEqual(stats.footprint.hx*2+.05);
    expect(stats.bounds[2]).toBeLessThanOrEqual(stats.footprint.hz*2+.05);
    await page.screenshot({path:info.outputPath(`${style}-desktop.png`)});
  }
  await page.selectOption('#model','myvi');
  await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio?.state)).toBe('ready');
  const original=await page.evaluate(()=>(window as any).__vehicleStudio.rotations);
  await page.click('#spin');
  await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio.rotations[0])).not.toBe(original[0]);
  await page.click('#spin');await page.click('#lighting');
  await page.screenshot({path:info.outputPath('myvi-night.png')});
  await page.setViewportSize({width:390,height:844});
  for(const style of ['axia','emas','lamborghini','cybertruck']){
    await page.selectOption('#model',style);
    await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio?.state)).toBe('ready');
    await page.screenshot({path:info.outputPath(`${style}-mobile-night.png`)});
  }
  expect(errors).toEqual([]);
});

test('atomic shell swap preserves transform, driver, wheel array and shared resources',async({page})=>{
  await page.goto('/vehicles-preview.html');
  const result=await page.evaluate(async()=>{
    const {createDriveableCar,vehicleSolid}=await import('/src/world.ts');
    const a=createDriveableCar('emas'),b=createDriveableCar('emas');
    const wheels=a.wheels,driver=a.driver;
    const resources=(car:any)=>{const set=new Set<any>();car.group.traverse((o:any)=>{if(o.isMesh){set.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])set.add(m);}});return set;};
    const inA=resources(a),inB=resources(b);let sharedDisposed=0;
    for(const resource of inA)if(inB.has(resource))resource.addEventListener('dispose',()=>sharedDisposed++);
    a.group.position.set(12,0,-8);a.group.rotation.y=1.1;driver.visible=true;
    a.wheels.forEach(w=>w.rotation.x=.65);
    const before=vehicleSolid(a.group);
    const loaded=await Promise.all([a.ready,b.ready]);
    const THREE=await import('/node_modules/three/build/three.module.js');
    const centers=a.wheels.map(w=>w.getWorldPosition(new THREE.Vector3()).toArray());
    a.wheels.forEach(w=>w.rotation.x+=.6);
    a.group.updateMatrixWorld(true);
    return {loaded,sharedDisposed,position:a.group.position.toArray(),yaw:a.group.rotation.y,driver:a.driver===driver&&driver.visible,
      sameArray:a.wheels===wheels,count:wheels.length,rotations:wheels.map(w=>w.rotation.x),
      centers,afterCenters:a.wheels.map(w=>w.getWorldPosition(new THREE.Vector3()).toArray()),
      footprintUnchanged:JSON.stringify(before)===JSON.stringify(vehicleSolid(a.group)),
      independent:a.wheels[0]!==b.wheels[0],otherRotation:b.wheels[0].rotation.x};
  });
  expect(result.loaded).toEqual([true,true]);expect(result.sharedDisposed).toBe(0);expect(result.position).toEqual([12,0,-8]);expect(result.yaw).toBe(1.1);
  expect(result.driver).toBe(true);expect(result.sameArray).toBe(true);expect(result.count).toBe(4);
  for(const rotation of result.rotations)expect(rotation).toBeCloseTo(1.25);
  expect(result.afterCenters).toEqual(result.centers);expect(result.footprintUnchanged).toBe(true);
  expect(result.independent).toBe(true);expect(result.otherRotation).toBe(0);
});

test('failed asset leaves a complete driveable car and owner Porsches never fetch an asset',async({page})=>{
  const requests:string[]=[];
  await page.route('**/assets/models/vehicles/**',route=>{requests.push(route.request().url());return route.abort();});
  await page.route('**/vehicle-test',route=>route.fulfill({contentType:'text/html',body:'<div></div>'}));
  await page.goto('/vehicle-test');
  const result=await page.evaluate(async()=>{
    const {createDriveableCar}=await import('/src/world.ts');
    const m=createDriveableCar('emas'),t=createDriveableCar('taycan'),g=createDriveableCar('gt3-rs');
    const loaded=await Promise.all([m.ready,t.ready,g.ready]);
    return {loaded,state:m.group.userData.assetState,style:m.group.userData.model,wheels:m.wheels.length,children:m.group.children.length,
      taycan:t.group.userData,gt3:g.group.userData};
  });
  expect(result.loaded).toEqual([false,false,false]);expect(result.state).toBe('fallback');expect(result.style).toBe('emas');
  expect(result.wheels).toBe(4);expect(result.children).toBeGreaterThan(10);
  expect(result.taycan.ownerLabel).toBe('Yusuf Suhair');expect(result.taycan.plate).toBe('VRG9405');
  expect(result.gt3.ownerLabel).toBe('Daddy Fizal');expect(result.gt3.plate).toBe('SL45');
  expect(requests).toHaveLength(1);expect(requests[0]).toContain('/emas.glb');
});

test('e.MAS joins authoritative fleet and can be claimed and released',()=>{
  const seed=fleet.find(c=>c.id==='parked-emas')!;
  expect(seed.style).toBe('emas');expect(seed.npc).toBe(false);
  const packets:any[]=[];const f=createFleet((_ws:any,p:any)=>packets.push(p),()=>{});
  const driver:any={id:'emas-driver',ws:{},x:seed.x,z:seed.z,riding:false};const players=new Map([[driver.id,driver]]);
  f.handle(players,driver,{type:'car-claim',id:seed.id});
  expect(driver.carStyle).toBe('emas');expect(driver.riding).toBe(true);
  expect(packets.find(p=>p.type==='car-claimed')?.car.style).toBe('emas');
  f.release(players,driver);expect(driver.fleetId).toBeNull();
  f.sync(players,driver.ws);expect(packets.at(-1).cars.find((c:any)=>c.id===seed.id).owner).toBeNull();
});

test('distance LOD reduces work and steering, brake and reverse remain independent',async({page})=>{
  await page.goto('/vehicles-preview.html?model=myvi');
  await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio?.presentation?.levels)).toBe(3);
  const near=await page.evaluate(()=>(window as any).__vehicleStudio.triangles);
  await page.click('#steer');
  await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio.presentation.steering)).toBeGreaterThan(.35);
  await page.click('#brake');
  await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio.presentation.brake)).toBe(3.2);
  await page.click('#reverse');
  await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio.presentation.reverse)).toBe(2);
  await page.evaluate(()=>(window as any).__vehicleStudio.setDistance(30));
  await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio.presentation.lod)).toBe(1);
  const mid=await page.evaluate(()=>(window as any).__vehicleStudio.triangles);
  expect(mid).toBeLessThan(near*.7);
  await page.evaluate(()=>(window as any).__vehicleStudio.setDistance(60));
  await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio.presentation.lod)).toBe(2);
  expect(await page.evaluate(()=>(window as any).__vehicleStudio.triangles)).toBeLessThan(mid*.75);
  // Moving back to the near level preserves all controls and wheel count.
  await page.evaluate(()=>(window as any).__vehicleStudio.setDistance(8));
  await expect.poll(()=>page.evaluate(()=>(window as any).__vehicleStudio.presentation.lod)).toBe(0);
  expect(await page.evaluate(()=>(window as any).__vehicleStudio.wheels)).toBe(4);
});

test('one vehicle braking does not illuminate another instance',async({page})=>{
  await page.goto('/vehicles-preview.html');
  const result=await page.evaluate(async()=>{
    const {createDriveableCar}=await import('/src/world.ts');
    const {updateVehiclePresentation,vehiclePresentationState}=await import('/src/vehicle-presentation.ts');
    const THREE=await import('/node_modules/three/build/three.module.js');
    const a=createDriveableCar('axia'),b=createDriveableCar('axia');await Promise.all([a.ready,b.ready]);
    const scene=new THREE.Scene();scene.add(a.group,b.group);b.group.position.x=4;
    const camera=new THREE.PerspectiveCamera();camera.position.set(0,3,8);
    updateVehiclePresentation(scene,camera,.016,false,{group:a.group,controls:{speed:-2,steering:1,braking:true}},1);
    return {a:vehiclePresentationState(a.group),b:vehiclePresentationState(b.group)};
  });
  expect(result.a?.brake).toBe(3.2);expect(result.b?.brake).toBe(.12);
  expect(result.a?.reverse).toBe(2);expect(result.b?.reverse).toBe(0);
});

test('drivers fit inside the new hatchback and low sports-car roofs',async({page})=>{
  await page.goto('/vehicles-preview.html');
  const result=await page.evaluate(async()=>{
    const {createDriveableCar}=await import('/src/world.ts');
    const THREE=await import('/node_modules/three/build/three.module.js');
    const result=[];
    for (const [style,height] of [['myvi',1.515],['lamborghini',1.136],['cybertruck',1.79]]) {
      const car=createDriveableCar(style);await car.ready;car.driver.visible=true;
      car.group.position.y=.12;car.group.updateMatrixWorld(true);
      result.push({style,height,top:new THREE.Box3().setFromObject(car.driver).max.y,scale:car.group.userData.driverScale});
    }
    return result;
  });
  for (const car of result) {expect(car.top).toBeLessThan(car.height);expect(car.scale).toBeGreaterThan(.3);}
});
