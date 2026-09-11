import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {enterAt} from './city';

test('deployed CSP permits the model decoder without enabling JavaScript eval',async({page})=>{
  const policy=readFileSync('public/_headers','utf8').match(/Content-Security-Policy: (.*)/)![1];
  expect(policy).toContain("'wasm-unsafe-eval'");
  expect(policy).toMatch(/connect-src[^;]*blob:/);
  expect(policy).not.toContain("'unsafe-eval'");
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/rembayung-preview.html',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,headers:{...response.headers(),'content-security-policy':policy}});
  });
  await page.goto('/rembayung-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__rembayungPreview?.state().state),{timeout:45000}).toBe('ready');
  expect(await page.evaluate(()=>(window as any).__rembayungPreview.state().fallbackVisible)).toBe(false);
  expect(errors).toEqual([]);
});

test('compressed Blender asset renders outside and inside within its draw budget',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/rembayung-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__rembayungPreview?.state().state),{timeout:45000}).toBe('ready');
  const state=await page.evaluate(()=>(window as any).__rembayungPreview.state());
  expect(state.fallbackVisible).toBe(false);expect(state.batches).toBeLessThanOrEqual(45);expect(state.triangles).toBeLessThan(350000);
  const response=await page.request.get('/assets/models/environment/LM_ENV_Rembayung.glb');
  const bytes=await response.body();expect(bytes.length).toBeLessThan(6_000_000);
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  expect(doc.extensionsRequired).toContain('EXT_meshopt_compression');
  expect(doc.extensionsUsed).not.toContain('KHR_materials_transmission');
  for(const view of ['outside','inside','upstairs']){
    await page.evaluate(v=>(window as any).__rembayungPreview.view(v),view);
    await page.waitForTimeout(700);
    await page.screenshot({path:info.outputPath(`rembayung-${view}.png`)});
  }
  expect(errors).toEqual([]);console.log('Rembayung web budget',JSON.stringify(state));
});

test('city placement, entrance, aisle and stairs form an unobstructed route',async({page})=>{
  await page.goto('/rembayung-preview.html');
  const report=await page.evaluate(async()=>{
    const {createWorld}=await import('/src/world.ts');
    const {rembayungPoint,rembayungGroundHeight}=await import('/src/rembayung-layout.ts');
    const {overlaps,moveWithCollisions}=await import('/src/physics.ts');
    // Walked before the model is even requested: every collision is the layout's, not the GLB's.
    const world=createWorld({add(){}} as any);const idle=world.rembayung.status.state;
    const pos=rembayungPoint(0,-3),legs:any[]=[];
    for(const [x,d] of [[0,3.2],[3.8,3.2],[3.8,26.8],[7.85,26.8],[7.85,28.35],[-2.65,28.35],[-2.65,30.1]]){
      const target=rembayungPoint(x,d);moveWithCollisions(pos,target.x-pos.x,target.z-pos.z,.46,world.solids);
      legs.push({target,actual:{...pos},height:rembayungGroundHeight(pos),error:Math.hypot(pos.x-target.x,pos.z-target.z)});
    }
    const wall=rembayungPoint(5,-2),target=rembayungPoint(5,2);moveWithCollisions(wall,target.x-wall.x,target.z-wall.z,.46,world.solids);
    const clear=[[-116,119],[-109,130],[-122,134],[-122,142],[-136,78]].map(([x,z])=>!world.solids.some(s=>s.id?.startsWith('rembayung-')&&overlaps({x,z},1,s)));
    return {idle,legs,wallZ:wall.z,clear,oldBlock:world.solids.some(s=>s.x===-121&&s.z===101&&s.hx===15&&s.hz===11)};
  });
  expect(report.idle).toBe('idle');
  for(const leg of report.legs)expect(leg.error,JSON.stringify(leg)).toBeLessThan(.03);
  expect(report.legs.at(-1).height).toBeCloseTo(4.06,2);
  expect(report.wallZ).toBeGreaterThan(125);expect(report.clear.every(Boolean)).toBe(true);expect(report.oldBlock).toBe(false);
});

test('failed asset keeps a visible, walkable fallback',async({page})=>{
  await page.route('**/LM_ENV_Rembayung.glb*',route=>route.abort());
  await page.goto('/rembayung-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__rembayungPreview?.state().state)).toBe('fallback');
  await page.getByRole('button',{name:'Jalan',exact:true}).click();
  await page.keyboard.down('KeyW');
  await expect.poll(()=>page.evaluate(()=>(window as any).__rembayungPreview.state().position.z),{timeout:10000}).toBeLessThan(123);
  await page.keyboard.up('KeyW');
  expect(await page.evaluate(()=>(window as any).__rembayungPreview.state().fallbackVisible)).toBe(true);
});

test('the city requests the detailed model only on approach and keeps the fallback meanwhile',async({page})=>{
  const requests:string[]=[];page.on('request',r=>{if(r.url().includes('LM_ENV_Rembayung'))requests.push(r.url());});
  const moveTo=await enterAt(page,-18,52);const state=()=>page.evaluate(()=>(window as any).__lepakRembayung);
  await page.waitForTimeout(3000);expect(requests).toEqual([]);expect(await state()).toMatchObject({state:'idle',fallbackVisible:true});
  moveTo(-116,119);await expect.poll(async()=>(await state()).state,{timeout:45000}).toBe('ready');
  expect(requests).toHaveLength(1);expect((await state()).fallbackVisible).toBe(false);
});

test('mobile preview loads and its touch movement enters the building',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/rembayung-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__rembayungPreview?.state().state),{timeout:45000}).toBe('ready');
  await page.getByRole('button',{name:'Jalan',exact:true}).click();
  const forward=page.getByRole('button',{name:'Maju',exact:true});
  const bounds=(await forward.boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
  await expect.poll(()=>page.evaluate(()=>(window as any).__rembayungPreview.state().position.z),{timeout:10000}).toBeLessThan(123);
  await page.mouse.up();
  await page.screenshot({path:info.outputPath('rembayung-mobile-entry.png')});
});

test('actual game loads Rembayung and the avatar walks from the entrance to the mezzanine',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/src/auth.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
    export const session={access_token:'local-test',user:{id:'rembayung-walker',user_metadata:{display_name:'Rembayung'}}};
    export function beginLogout(){}export function cancelLogout(){}
    export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Rembayung';
    export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}` }));
  await page.routeWebSocket('**/ws',ws=>{
    ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join')ws.send(JSON.stringify({type:'welcome',id:'rembayung-walker',players:[{id:'rembayung-walker',name:'Rembayung',x:-136,z:128,yaw:Math.PI,riding:false,seated:false,speed:0}]}));});
  });
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakRembayung?.state),{timeout:45000}).toBe('ready');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.position.x)).toBe(-136);
  await page.screenshot({path:info.outputPath('rembayung-in-game-exterior.png')});
  const walk=async(key:string,axis:'x'|'z',target:number,direction:'less'|'greater')=>{
    await page.keyboard.down(key);
    // Release on the browser's animation frame: remote polling can overshoot a narrow
    // stair turn under the full city's rendering load. This changes input, never position.
    try{await page.waitForFunction(({key,axis,target,direction})=>{
      const p=(window as any).__lepak.position[axis];
      if(direction==='less'?p<target:p>target){window.dispatchEvent(new KeyboardEvent('keyup',{code:key}));return true;}
      return false;
    },{key,axis,target,direction},{timeout:18000,polling:'raf'});}
    finally{await page.keyboard.up(key);console.log('Rembayung waypoint',key,target,await page.evaluate(()=>(window as any).__lepak.position));}
  };
  await walk('KeyW','z',121.8,'less');
  await walk('KeyD','x',-132.15,'greater');
  await walk('KeyW','z',98.18,'less');
  await walk('KeyD','x',-128.15,'greater');
  await walk('KeyW','z',96.65,'less');
  await walk('KeyA','x',-138.64,'less');
  await walk('KeyW','z',94.9,'less');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.bridge.deckY)).toBeCloseTo(4.06,1);
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.cameraActualDistance)).toBeGreaterThan(7);
  // Turn back towards the dining hall using the game's actual drag-to-orbit gesture.
  await page.mouse.move(300,360);await page.mouse.down();await page.mouse.move(928,360,{steps:16});await page.mouse.up();
  await page.waitForTimeout(900);
  await page.screenshot({path:info.outputPath('rembayung-in-game-mezzanine.png')});
  expect(errors).toEqual([]);
});
