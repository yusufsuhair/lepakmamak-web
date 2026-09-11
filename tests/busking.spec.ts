import {test,expect,type Page} from '@playwright/test';
// Enters as a guest at (x,z). The returned function moves the player: a later welcome restores
// a spot the same way a reconnect does, so tests can arrive and leave without walking. The fake
// city answers the heartbeat; otherwise the client drops it as stale after ~13 s, which mutes
// ambience and would pass for a "pause".
async function enterAt(page:Page,x:number,z:number){
 let city:any,spot=[x,z];const welcome=([x,z]:number[])=>JSON.stringify({type:'welcome',id:'loop-player',players:[{id:'loop-player',name:'Tester',color:'#72c8ba',x,z,yaw:Math.PI,riding:false,speed:0,guest:true}]});
 await page.routeWebSocket('**/ws',ws=>{city=ws;ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join')ws.send(welcome(spot));if(m.type==='ping')ws.send(JSON.stringify({type:'pong',t:m.t}));});});
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.position.z)).toBe(z);
 return (x:number,z:number)=>{spot=[x,z];city.send(welcome(spot));};
}
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
test('area loops download nothing until reached and pause again once left',async({page})=>{
 const loops:string[]=[];page.on('request',r=>{if(/(busking|arrahman)\.mp3/.test(r.url()))loops.push(r.url());});
 const moveTo=await enterAt(page,-18,52);const state=()=>page.evaluate(()=>(window as any).__lepak.busking);
 await page.waitForTimeout(2000);expect(loops).toEqual([]);expect((await state()).playing).toBe(false);
 moveTo(-31,86);await expect.poll(async()=>(await state()).playing).toBe(true);expect(loops.some(url=>url.includes('busking'))).toBe(true);
 moveTo(-18,52);await expect.poll(async()=>(await state()).playing).toBe(false);
});
test('a failed loop download rests, then retries, while the city keeps running',async({page})=>{
 let attempts=0;await page.route('**/busking.mp3*',route=>{attempts++;return route.abort();});
 await enterAt(page,-31,86);await page.waitForTimeout(4000);
 const first=attempts;expect(first).toBeGreaterThan(0);expect(first).toBeLessThanOrEqual(2);
 expect(await page.evaluate(()=>(window as any).__lepak.busking.playing)).toBe(false);await expect(page.locator('#hud')).toBeVisible();
 await expect.poll(()=>attempts,{timeout:20000}).toBeGreaterThan(first);
});
test('with background music off its track is never downloaded until switched on',async({page})=>{
 const tracks:string[]=[];page.on('request',r=>{if(r.url().includes('background-short'))tracks.push(r.url());});
 await page.addInitScript(()=>localStorage.setItem('lepakmamak-music','off'));
 await enterAt(page,-18,52);await page.waitForTimeout(2000);expect(tracks).toEqual([]);
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('Background music',{exact:true}).check();
 await expect.poll(()=>tracks.length).toBeGreaterThan(0);
});
