import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('Blender station retains embedded brand and concrete textures under deployed CSP',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Couldn't load texture|PETRONAS.*fallback/.test(m.text()))errors.push(m.text());});
  const policy=readFileSync('public/_headers','utf8').match(/Content-Security-Policy: (.*)/)![1];
  await page.route('**/petronas-preview.html',async route=>{const r=await route.fetch();await route.fulfill({response:r,headers:{...r.headers(),'content-security-policy':policy}});});
  await page.goto('/petronas-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__petronasPreview?.state().state),{timeout:45000}).toBe('ready');
  const state=await page.evaluate(()=>(window as any).__petronasPreview.state());
  expect(state.logoLoaded).toBe(true);expect(state.textures).toBeGreaterThanOrEqual(4);expect(state.batches).toBeLessThan(40);expect(state.triangles).toBeLessThan(250000);
  // Vite injects CSS during development. Capture the normal local preview after the
  // independent deployed-policy texture check, without blocking that dev-only styling.
  await page.unroute('**/petronas-preview.html');await page.reload();
  await expect.poll(()=>page.evaluate(()=>(window as any).__petronasPreview?.state().state),{timeout:45000}).toBe('ready');
  for(const view of ['hero','pump','shop']){
    await page.evaluate(v=>(window as any).__petronasPreview.view(v),view);await page.waitForTimeout(500);await page.screenshot({path:info.outputPath(`petronas-${view}.png`)});
  }
  await page.evaluate(()=>{(window as any).__petronasPreview.view('hero');(window as any).__petronasPreview.setNight(true);});await page.screenshot({path:info.outputPath('petronas-night.png')});
  expect(errors).toEqual([]);console.log('PETRONAS budget',state);
});

test('city replacement preserves pump islands, shop collision, busker frontage and arrival',async({page})=>{
  await page.goto('/petronas-preview.html');
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');const {createWorld}=await import('/src/world.ts');const {moveWithCollisions,overlaps}=await import('/src/physics.ts');
    // Collisions come from the procedural station, so they are checked before the model is even requested.
    const world=createWorld(new THREE.Scene());const idle=world.petronas.status.state;
    const checks=[[-42,103,5.5,2.25],[-31,103,5.5,2.25],[-20,103,5.5,2.25],[-31,130,36,14],[-8,88,3.8,1.1]].map(([x,z,w,d])=>world.solids.some(s=>s.x===x&&s.z===z&&s.hx===w/2&&s.hz===d/2));
    await world.petronas.load();
    const pos={x:-36.5,z:94};moveWithCollisions(pos,0,24,.46,world.solids);
    return {idle,status:world.petronas.status,fallback:world.petronas.fallback.visible,checks,driveZ:pos.z,arrivalBlocked:world.solids.some(s=>overlaps({x:-31,z:112},.46,s))};
  });
  expect(result.idle).toBe('idle');expect(result.status.state).toBe('ready');expect(result.fallback).toBe(false);expect(result.checks.every(Boolean)).toBe(true);expect(result.driveZ).toBeCloseTo(118);expect(result.arrivalBlocked).toBe(false);
});

test('failed station download retains the existing complete forecourt',async({page})=>{
  await page.route('**/LM_ENV_Petronas.glb*',r=>r.abort());await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakPetronas?.state),{timeout:30000}).toBe('fallback');
  expect(await page.evaluate(()=>(window as any).__lepakPetronas.fallbackVisible)).toBe(true);
});

test('actual city loads detailed station on mobile high without texture errors',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('lepak-graphics','high');sessionStorage.setItem('lepak-high-session','1');});
  await page.goto('/');await expect.poll(()=>page.evaluate(()=>(window as any).__lepakPetronas?.state),{timeout:45000}).toBe('ready');
  expect(await page.evaluate(()=>(window as any).__lepakPetronas.logoLoaded)).toBe(true);expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('petronas-city-mobile.png')});
});

test('avatar walks through the detailed station drive aisle in the actual city',async({page},info)=>{
  await page.route('**/src/auth.ts',r=>r.fulfill({contentType:'application/javascript',body:`
    export const session={access_token:'local-test',user:{id:'petronas-walker',user_metadata:{display_name:'Petronas'}}};
    export function beginLogout(){}export function cancelLogout(){}
    export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Petronas';
    export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}` }));
  await page.routeWebSocket('**/ws',ws=>ws.onMessage(raw=>{
    if(JSON.parse(String(raw)).type==='join')ws.send(JSON.stringify({type:'welcome',id:'petronas-walker',players:[{id:'petronas-walker',name:'Petronas',x:-36.5,z:94,yaw:0,riding:false,seated:false,speed:0}]}));
  }));
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakPetronas?.state),{timeout:45000}).toBe('ready');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.position.x)).toBe(-36.5);
  await page.mouse.move(300,360);await page.mouse.down();await page.mouse.move(928,360,{steps:16});await page.mouse.up();await page.waitForTimeout(900);
  await page.screenshot({path:info.outputPath('petronas-in-game-forecourt.png')});
  await page.mouse.move(928,360);await page.mouse.down();await page.mouse.move(300,360,{steps:16});await page.mouse.up();
  await page.keyboard.down('KeyS');
  try{await page.waitForFunction(()=>{
    if((window as any).__lepak.position.z>117){window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyS'}));return true;}return false;
  },undefined,{timeout:20000,polling:'raf'});}finally{await page.keyboard.up('KeyS');}
  expect(await page.evaluate(()=>(window as any).__lepak.position.x)).toBeCloseTo(-36.5);
  await page.screenshot({path:info.outputPath('petronas-in-game-shop-arrival.png')});
});
