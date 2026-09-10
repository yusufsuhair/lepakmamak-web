import {test,expect} from '@playwright/test';

test('Frozen Berry Taycan renders with four wheels and a hidden driver',async({page},testInfo)=>{
 await page.route('**/car-preview',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
 await page.goto('/car-preview');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createDriveableCar,carStyles}=await import('/src/world.ts');
  const car=createDriveableCar('taycan');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#d8d0cb');scene.add(car.group);
  scene.add(new THREE.HemisphereLight('#fff8f3','#4b4344',2.3));const sun=new THREE.DirectionalLight('#fff5ef',3);sun.position.set(-4,8,5);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(38,1280/800,.1,100);camera.position.set(5,3.8,7);camera.lookAt(0,.8,0);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;
  document.body.append(renderer.domElement);renderer.render(scene,camera);
  const bounds=new THREE.Box3().setFromObject(car.group).getSize(new THREE.Vector3());
  const plates:string[]=[];car.group.traverse(o=>{if(o.userData.text)plates.push(o.userData.text);});
  const owner=car.group.getObjectByName('owner-label');
  const plateMeshes:any[]=[];car.group.traverse(o=>{if(o.userData.text==='VRG9405')plateMeshes.push(o.userData);});
  return{wheels:car.wheels.length,driver:car.driver.visible,model:car.group.userData.model,owner:car.group.userData.ownerLabel,ownerText:owner?.userData.text,ownerPosition:owner?.position.toArray(),plate:car.group.userData.plate,plates,plateMeshes,supported:carStyles.includes('taycan'),bounds:bounds.toArray()};
 });
 expect(result.wheels).toBe(4);expect(result.driver).toBe(false);expect(result.model).toBe('taycan');expect(result.owner).toBe('Yusuf Suhair');expect(result.ownerText).toBe('Yusuf Suhair');expect(result.ownerPosition).toEqual([0,2.08,0]);expect(result.plate).toBe('VRG9405');expect(result.plates.filter(text=>text==='VRG9405')).toHaveLength(2);expect(result.plateMeshes).toEqual([{text:'VRG9405',plateBackground:'#090b0e',plateForeground:'#ffffff'},{text:'VRG9405',plateBackground:'#090b0e',plateForeground:'#ffffff'}]);expect(result.supported).toBe(true);
 expect(result.bounds[2]).toBeGreaterThan(4);expect(result.bounds[0]).toBeLessThan(2.4);
 await page.screenshot({path:testInfo.outputPath('taycan-frozen-berry.png')});
});

test('parked Taycan can be claimed and released through the authoritative fleet',async()=>{
 const {createFleet}=await import('../server/fleet.mjs');
 const packets:any[]=[];const fleet=createFleet((_ws:any,message:any)=>packets.push(message),(_players:any,message:any)=>packets.push(message));
 const player={id:'test-driver',ws:{},x:-122,z:134,riding:false,passengerOf:null,chairId:null,jumpHeight:0};
 const players=new Map([[player.id,player]]);
 expect(fleet.handle(players,player,{type:'car-claim',id:'parked-taycan'})).toBe(true);
 expect(packets.find(p=>p.type==='car-claimed')?.car.style).toBe('taycan');
 expect(player.riding).toBe(true);
 fleet.release(players,player);fleet.sync(players,player.ws);
 expect(packets.at(-1).cars.find((c:any)=>c.id==='parked-taycan').owner).toBeNull();
});
