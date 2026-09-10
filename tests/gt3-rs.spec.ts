import {test,expect} from '@playwright/test';

test('Daddy Fizal GT3 RS: four-angle render, exact labels and rotating wheels',async({page},testInfo)=>{
  await page.route('**/gt3-preview',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
  await page.goto('/gt3-preview');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
    const {createDriveableCar,carStyles}=await import('/src/world.ts');
    const car=createDriveableCar('gt3-rs');
    const scene=new THREE.Scene();scene.background=new THREE.Color('#bac4cb');scene.add(car.group);
    const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=env.texture;
    scene.add(new THREE.HemisphereLight('#f0f6ff','#565654',2));const sun=new THREE.DirectionalLight('#fff8ef',3);sun.position.set(-4,8,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#8b9395',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=.005;floor.receiveShadow=true;scene.add(floor);
    const camera=new THREE.PerspectiveCamera(35,1280/800,.1,100);document.body.append(renderer.domElement);
    const tag=car.group.getObjectByName('owner-label');
    const texts:string[]=[];car.group.traverse(o=>{if(o.userData.text)texts.push(o.userData.text);});
    const driverVisible=car.driver.visible;
    // Inspect actual baked wing vertices after batching, not just a model flag.
    let rearAeroTop=0;const point=new THREE.Vector3();car.group.updateMatrixWorld(true);
    car.group.traverse(o=>{if(o.isMesh && !o.isInstancedMesh){
      const positions=o.geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);if(point.z < -1.95)rearAeroTop=Math.max(rearAeroTop,point.y);}
    }});
    const wingLetteringY=car.group.children.find(o=>o.userData.text==='P O R S C H E'&&o.position.y>1)?.position.y;
    car.group.position.set(3,0,4);car.group.rotation.y=.7;car.group.updateMatrixWorld(true);
    const tagPosition=tag.getWorldPosition(new THREE.Vector3()).toArray();
    car.group.position.set(0,0,0);car.group.rotation.y=0;
    car.wheels.forEach(w=>w.rotation.x=.8);
    (window as any).renderGt3=(position:number[])=>{camera.position.set(...position);camera.lookAt(0,1.05,0);renderer.render(scene,camera);};
    (window as any).renderGt3([5,2.9,7]);
    return {wheels:car.wheels.length,driverVisible,supported:carStyles.includes('gt3-rs'),texts,tagPosition,rearAeroTop,wingLetteringY,rotations:car.wheels.map(w=>w.rotation.x),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  });
  expect(result.wheels).toBe(4);expect(result.driverVisible).toBe(false);expect(result.supported).toBe(true);
  expect(result.texts.filter(t=>t==='SL45')).toHaveLength(2);expect(result.texts).toContain('Daddy Fizal');expect(result.texts).toContain('GT3 RS');
  expect(result.tagPosition).toEqual([3,2.42,4]);expect(result.rotations).toEqual([.8,.8,.8,.8]);expect(result.calls).toBeLessThan(100);
  expect(result.rearAeroTop).toBeGreaterThan(1.40);expect(result.rearAeroTop).toBeLessThan(1.51);
  expect(result.wingLetteringY).toBeCloseTo(1.358,3);
  for(const [name,position] of Object.entries({front:[5,2.9,7],rear:[-5,2.6,-7],side:[8,1.9,0],nose:[0,1.5,8]})){
    await page.evaluate(p=>(window as any).renderGt3(p),position);
    await page.screenshot({path:testInfo.outputPath(`gt3-rs-${name}.png`)});
  }
  expect(errors).toEqual([]);
  console.log('GT3 rendering budget',result.calls,'draw calls;',result.triangles,'triangles');
});

test('parked GT3 RS supports authoritative claim, drive, exclusion and release',async()=>{
  const {createFleet}=await import('../server/fleet.mjs');
  const packets:any[]=[];const fleet=createFleet((_ws:any,m:any)=>packets.push(m),(_p:any,m:any)=>packets.push(m));
  const driver:any={id:'daddy-fizal',ws:{},x:-122,z:142,riding:false,passengerOf:null,chairId:null,jumpHeight:0};
  const friend:any={...driver,id:'friend',ws:{}};const players=new Map([[driver.id,driver],[friend.id,friend]]);
  fleet.sync(players,driver.ws);
  const parked=packets.at(-1).cars.find((c:any)=>c.id==='parked-gt3-rs');expect(parked).toMatchObject({x:-122,z:142,owner:null,npc:false});
  fleet.handle(players,driver,{type:'car-claim',id:'parked-gt3-rs'});
  expect(driver).toMatchObject({carStyle:'gt3-rs',riding:true,vehicle:'car'});
  expect(packets.find(p=>p.type==='car-claimed').car.style).toBe('gt3-rs');
  fleet.handle(players,friend,{type:'car-claim',id:'parked-gt3-rs'});expect(packets.at(-1).code).toBe('CAR_CLAIM_DENIED');
  driver.x=-118;driver.z=140;driver.yaw=1.2;fleet.updatePlayer(players,driver);fleet.sync(players,driver.ws);
  expect(packets.at(-1).cars.find((c:any)=>c.id==='parked-gt3-rs')).toMatchObject({x:-118,z:140,yaw:1.2,owner:driver.id});
  fleet.release(players,driver);fleet.sync(players,driver.ws);
  expect(packets.at(-1).cars.find((c:any)=>c.id==='parked-gt3-rs')).toMatchObject({x:-118,z:140,owner:null,npc:false});
  friend.x=-118;friend.z=140;fleet.handle(players,friend,{type:'car-claim',id:'parked-gt3-rs'});expect(friend.carStyle).toBe('gt3-rs');
});

test('Rembayung player enters Daddy Fizal car, drives and gets out',async({page},testInfo)=>{
  const {createFleet}=await import('../server/fleet.mjs');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let claimedStyle:string|undefined;
  await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export const session={access_token:'test',user:{id:'gt3-driver',user_metadata:{display_name:'Driver'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Driver';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`}));
  await page.routeWebSocket('**/ws',ws=>{
    const p:any={id:'gt3-driver',ws:{},name:'Driver',x:-120,z:142,yaw:0,riding:false,speed:0};const players=new Map([[p.id,p]]);
    const send=(_w:any,m:any)=>{if(m.type==='car-claimed')claimedStyle=m.car.style;ws.send(JSON.stringify(m));};
    const fleet=createFleet(send,send);
    ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join'){ws.send(JSON.stringify({type:'welcome',id:p.id,players:[p]}));fleet.sync(players);}else if(m.type==='state'){Object.assign(p,m);fleet.updatePlayer(players,p);fleet.sync(players);}else fleet.handle(players,p,m);});
  });
  await page.goto('/');await expect(page.locator('#interaction')).toHaveText('Enter');
  await page.screenshot({path:testInfo.outputPath('gt3-rs-rembayung.png')});
  await page.locator('#interaction').click();
  await expect.poll(()=>claimedStyle).toBe('gt3-rs');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.riding)).toBe(true);
  await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.speed)).toBeGreaterThan(1);await page.keyboard.up('KeyW');
  await page.keyboard.down('Space');await expect(page.locator('#interaction')).toHaveText('Get out');await page.keyboard.up('Space');await page.locator('#interaction').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.riding)).toBe(false);
  expect(errors).toEqual([]);
});
