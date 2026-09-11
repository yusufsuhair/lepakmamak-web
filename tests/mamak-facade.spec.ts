import {test,expect} from '@playwright/test';

test('additive facade stays overhead, toggles day/night and keeps original site',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error'&&/WebGL|THREE|shader/i.test(message.text()))errors.push(message.text());});
  await page.goto('/mamak-facade-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__mamakFacadePreview.state().state)).toBe('ready');
  const geometry=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const api=(window as any).__mamakFacadePreview;
    const asset=api.facade();asset.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(asset);
    return {min:box.min.toArray(),max:box.max.toArray(),lights:asset.children.filter((x:any)=>x.isLight).length,
      siteVisible:api.site().visible,position:asset.position.toArray()};
  });
  expect(geometry.min[1]).toBeGreaterThan(3.5);expect(geometry.lights).toBe(0);
  expect(geometry.siteVisible).toBe(true);expect(geometry.position).toEqual([-29,3.555,30]);
  await expect.poll(()=>page.evaluate(()=>(window as any).__mamakFacadePreview.state())).toMatchObject({draws:5,lampCount:4,night:false,intensity:.04});
  for(const mobile of [false,true]){
    await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});
    for(const night of [false,true]){
      await page.evaluate(n=>(window as any).__mamakFacadePreview.setNight(n),night);
      await page.waitForTimeout(250);
      await page.screenshot({path:info.outputPath(`${mobile?'mobile':'desktop'}-${night?'night':'day'}.png`)});
    }
  }
  const intensity=await page.evaluate(()=>{
    const api=(window as any).__mamakFacadePreview,values:number[]=[];
    api.facade().traverse((o:any)=>{if(o.isMesh&&o.name==='LM_ENV_MamakFacade_Lamps')values.push(o.material.emissiveIntensity);});
    api.setBefore(true);return {values,site:api.site().visible,facade:api.facade().visible};
  });
  expect(intensity).toEqual({values:[2],site:true,facade:false});
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(()=>{const api=(window as any).__mamakFacadePreview;api.setNight(false);api.view('detail');});
  await page.screenshot({path:info.outputPath('before-detail.png')});
  await page.evaluate(()=>(window as any).__mamakFacadePreview.setBefore(false));
  await page.waitForTimeout(250);
  await page.screenshot({path:info.outputPath('after-detail.png')});
  expect(errors).toEqual([]);
});

test('game applies night state even when optional facade finishes loading later',async({page})=>{
  const time=Date.parse('2026-09-11T15:00:00Z');
  await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'sunny',observedAt:time,serverTime:time,source:'fixture'}}));
  let release:()=>void=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/LM_ENV_MamakFacade.glb*',async r=>{await gate;await r.continue();});
  try{
    await page.goto('/');
    await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakLighting.night)).toBe(true);
    await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakFacade.state)).toBe('loading');
  }finally{release();}
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakFacade)).toMatchObject({state:'ready',night:true,intensity:2,lampCount:4,washIntensity:2});
  expect(await page.evaluate(()=>(window as any).__lepak.mamakMaju)).toEqual({state:'ready',fallbackVisible:false});
});

test('optional facade download failure never removes accepted furniture',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/LM_ENV_MamakFacade.glb*',r=>r.abort());await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakFacade.state)).toBe('unavailable');
  expect(await page.evaluate(()=>(window as any).__lepak.mamakMaju)).toEqual({state:'ready',fallbackVisible:false});
  expect(errors).toEqual([]);
});

test('complete Mamak failure leaves procedural fallback without incompatible facade',async({page})=>{
  let requested=false;
  await page.route('**/LM_ENV_MamakFacade.glb*',r=>{requested=true;return r.abort();});
  await page.route('**/LM_ENV_MamakMaju*.glb*',r=>r.abort());await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.mamakMaju)).toEqual({state:'fallback',fallbackVisible:true});
  expect(await page.evaluate(()=>(window as any).__lepakMamakFacade.state)).toBe('idle');
  expect(requested).toBe(false);
});

test('actual game retains facade and sit/stand on Low and High',async({page},info)=>{
  await page.routeWebSocket('**/ws',socket=>socket.close());
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakFacade.state)).toBe('ready');
  await page.getByRole('button',{name:"Jom, let's go"}).click();
  await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Facade QA');
  await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await page.keyboard.down('KeyA');
  try{await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.position.x)).toBeLessThan(-26);}
  finally{await page.keyboard.up('KeyA');}
  await page.locator('#interaction').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.seated)).toBe(true);
  for(const quality of ['low','high']){
    await page.locator('#menu').click();await page.selectOption('#graphics-quality',quality);await page.keyboard.press('Escape');
    await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.graphicsQuality)).toBe(quality);
    expect(await page.evaluate(()=>(window as any).__lepakMamakFacade.state)).toBe('ready');
    await page.screenshot({path:info.outputPath(`game-seated-${quality}.png`)});
  }
  await page.locator('#interaction').click();await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.seated)).toBe(false);
  expect(errors).toEqual([]);
});
