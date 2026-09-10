import {test,expect} from '@playwright/test';

test('each lamp keeps its own state, and only the one you touch changes',async({page})=>{
 await page.route('**/lamp-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/lamp-harness');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createStreetLights}=await import('/src/world.ts');
  const scene=new (THREE as any).Scene();
  const lights=createStreetLights(scene);
  const read=()=>lights.lamps.map((_:any,i:number)=>lights.lit(i));

  const day=read();
  lights.setNight(true); const night=read();
  // One lamp switched off in the dark stays off while its neighbours stay lit.
  lights.setLamp(3,false);
  const oneOff=read();
  // And one switched on in daylight stays on.
  lights.setNight(false);
  lights.setLamp(9,true);
  const oneOn=read();
  // A join snapshot replaces whatever was held locally.
  lights.setLamps({5:true});
  const synced=read();
  // Handing a lamp back to the clock is what null means.
  lights.setNight(true); lights.setLamp(5,null);
  const released=read();

  const meshes:any[]=[]; lights.group.traverse((o:any)=>{if(o.isInstancedMesh)meshes.push(o);});
  return {
   count:lights.lamps.length,
   dayLit:day.filter(Boolean).length, nightLit:night.filter(Boolean).length,
   oneOffLit:oneOff.filter(Boolean).length, oneOffIsThree:oneOff[3]===false,
   oneOnLit:oneOn.filter(Boolean).length, oneOnIsNine:oneOn[9]===true,
   syncedLit:synced.filter(Boolean).length, syncedIsFive:synced[5]===true,
   releasedFive:released[5], lights:meshes.filter(m=>m.isLight).length,
   meshCount:meshes.length,
  };
 });

 expect(result.count).toBeGreaterThan(40);
 expect(result.dayLit).toBe(0);
 expect(result.nightLit).toBe(result.count);
 // Exactly one lamp changed, not the street.
 expect(result.oneOffLit).toBe(result.count-1);
 expect(result.oneOffIsThree).toBe(true);
 expect(result.oneOnLit).toBe(1);
 expect(result.oneOnIsNine).toBe(true);
 expect(result.syncedLit).toBe(1);
 expect(result.syncedIsFive).toBe(true);
 // Released back to the clock, and the clock says night.
 expect(result.releasedFive).toBe(true);
 // Eighty lamps taught us what happens when scenery brings its own lights.
 expect(result.lights).toBe(0);
 expect(result.meshCount).toBe(5);
});

test('walking up to a lamp offers the switch, and it is not in the HUD',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Lamplighter');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();
 // The city-wide switch is gone: a lamp is switched where it stands.
 await expect(page.locator('#lamp-switch')).toHaveCount(0);

 const held=()=>page.evaluate(()=>(window as any).__lepak);
 const state=await held();
 expect(state.lamps.length).toBeGreaterThan(40);

 // Walk out to the nearest lamp rather than guessing where one stands.
 const near=state.lamps.map((lamp:any)=>({...lamp,away:Math.hypot(lamp.x-state.position.x,lamp.z-state.position.z)}))
   .sort((a:any,b:any)=>a.away-b.away)[0];
 for(let step=0;step<80;step++){
  const now=await held();
  const dx=near.x-now.position.x, dz=near.z-now.position.z;
  if(Math.hypot(dx,dz)<2.6)break;
  await page.keyboard.down(dx>0?'d':'a');
  await page.waitForTimeout(120);
  await page.keyboard.up(dx>0?'d':'a');
  await page.keyboard.down(dz>0?'s':'w');
  await page.waitForTimeout(120);
  await page.keyboard.up(dz>0?'s':'w');
 }

 const prompt=page.locator('#interaction-text');
 await expect(prompt).toHaveText(/Turn (on|off)/,{timeout:15000});
 const before=await prompt.textContent();
 await page.locator('#interaction').click();
 // Offline the flip is local, online the server answers; either way the lamp changes.
 await expect(prompt).not.toHaveText(before!,{timeout:10000});
});
