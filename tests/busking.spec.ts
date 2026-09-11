import {test,expect} from '@playwright/test';
test('main busker is in front of PETRONAS, away from Mamak Maju',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const [{buskingSpot},places]=await Promise.all([import('/src/busking.ts'),fetch('/shared/places.json').then(response=>response.json())]);
  const petronas=places.find((place:{name:string})=>place.name==='PETRONAS · Kedai Mesra');
  const mamak=places.find((place:{name:string})=>place.name==='Mamak Maju');
  const distance=(place:{x:number;z:number})=>Math.hypot(buskingSpot.x-place.x,buskingSpot.z-place.z);
  return {petronas:distance(petronas),mamak:distance(mamak)};
 });
 expect(result.petronas).toBeLessThan(32);
 expect(result.mamak).toBeGreaterThan(25);
});
test('busking fades smoothly to silence outside its area',async({page})=>{await page.goto('/');const values=await page.evaluate(async()=>{const {buskingVolume}=await import('/src/busking.ts');return Array.from({length:101},(_,i)=>buskingVolume(i));});expect(values[0]).toBe(.55);expect(values[3]).toBe(.55);expect(values[22]).toBe(0);expect(values[100]).toBe(0);for(let d=4;d<=22;d++)expect(values[d]).toBeLessThan(values[d-1]);});
test('busking loop loads only when the player is nearby and obeys City sounds',async({page})=>{
 await page.routeWebSocket('**/ws',ws=>ws.onMessage(raw=>{if(JSON.parse(String(raw)).type==='join')ws.send(JSON.stringify({type:'welcome',id:'busking-player',players:[{id:'busking-player',name:'Tester',color:'#72c8ba',x:-31,z:86,yaw:Math.PI,riding:false,speed:0,guest:true}]}));}));
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();const state=()=>page.evaluate(()=>(window as any).__lepak.busking);
 await expect.poll(async()=>(await state()).playing).toBe(true);await expect.poll(async()=>(await state()).gain).toBeGreaterThan(.5);
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('City sounds',{exact:true}).uncheck();expect((await state()).playing).toBe(false);expect((await state()).gain).toBe(0);await page.getByLabel('City sounds',{exact:true}).check();await expect.poll(async()=>(await state()).playing).toBe(true);
});
test('busking crowd includes seated fans, a camera holder and animated wavers',async({page})=>{await page.goto('/');const result=await page.evaluate(async()=>{const THREE=await import('/node_modules/three/build/three.module.js');const {createBuskers}=await import('/src/busking.ts');const scene=new THREE.Scene(),solids:any[]=[];const crowd=createBuskers(scene,solids);const before=crowd.wavers.map((person:any)=>person.rightArm.rotation.z);crowd.update(1.3,false);const after=crowd.wavers.map((person:any)=>person.rightArm.rotation.z);return{audienceCount:crowd.audienceCount,wavers:crowd.wavers.length,cameraParts:crowd.cameraFan.group.children.length,moved:after.some((value:number,i:number)=>value!==before[i]),crowdSolids:solids.length};});expect(result).toMatchObject({audienceCount:11,wavers:3,moved:true});expect(result.cameraParts).toBeGreaterThan(6);expect(result.crowdSolids).toBeGreaterThanOrEqual(15);});
