import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('dining detail decodes every PBR image under deployed CSP and supports before/after',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const policy=readFileSync('public/_headers','utf8').match(/Content-Security-Policy: (.*)/)![1];
  await page.route('**/mamak-realism-preview.html',async r=>{const response=await r.fetch();await r.fulfill({response,headers:{...response.headers(),'content-security-policy':policy}});});
  await page.goto('/mamak-realism-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__mamakRealismPreview?.state().state),{timeout:45000}).toBe('ready');
  const budget=await page.evaluate(()=>(window as any).__mamakRealismPreview.state());
  expect(budget.textures).toBe(6);expect(budget.triangles).toBeLessThan(150000);expect(budget.draws).toBeLessThanOrEqual(24);
  await page.unroute('**/mamak-realism-preview.html');await page.reload();
  await expect.poll(()=>page.evaluate(()=>(window as any).__mamakRealismPreview?.state().comparisonReady),{timeout:45000}).toBe(true);
  for(const view of ['dining','table','site']){await page.evaluate(v=>(window as any).__mamakRealismPreview.view(v),view);await page.waitForTimeout(500);await page.screenshot({path:info.outputPath(`mamak-${view}.png`)});}
  await page.evaluate(()=>{(window as any).__mamakRealismPreview.view('dining');(window as any).__mamakRealismPreview.setBefore(true);});await page.screenshot({path:info.outputPath('mamak-before.png')});
  await page.evaluate(()=>{(window as any).__mamakRealismPreview.setBefore(false);(window as any).__mamakRealismPreview.setNight(true);});await page.screenshot({path:info.outputPath('mamak-night.png')});
  expect(errors).toEqual([]);console.log('Mamak realism',budget);
});

test('actual exported chair seats, backs and tabletops match authoritative game coordinates',async({page})=>{
  await page.goto('/mamak-realism-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__mamakRealismPreview?.state().state),{timeout:45000}).toBe('ready');
  const report=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {default:allChairs}=await import('/shared/chairs.json');const {default:allTables}=await import('/shared/tables.json');
    const ids=['meja-1','meja-2','meja-3','meja-4','meja-9'];const asset=(window as any).__mamakRealismPreview.asset();asset.updateMatrixWorld(true);
    const ray=new THREE.Raycaster();const height=(x:number,z:number)=>{ray.set(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0));return ray.intersectObject(asset,true)[0]?.point.y??-1;};
    return {chairs:allChairs.filter(c=>ids.includes(c.tableId)).map(c=>({id:c.id,seat:height(c.x,c.z),back:height(c.x-Math.sin(c.yaw)*.405,c.z-Math.cos(c.yaw)*.405)})),tables:allTables.filter(t=>ids.includes(t.id)).map(t=>({id:t.id,top:height(t.x+.75,t.z)}))};
  });
  expect(report.chairs).toHaveLength(25);
  for(const c of report.chairs){expect(c.seat,c.id).toBeGreaterThan(.60);expect(c.seat,c.id).toBeLessThan(.67);expect(c.back,c.id).toBeGreaterThan(1.15);}
  for(const t of report.tables)expect(t.top,t.id).toBeCloseTo(1.145,2);
});

test('failed detailed asset falls back to the V7 asset',async({page})=>{
  await page.route('**/LM_ENV_MamakMaju_Realism.glb*',r=>r.abort());await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakRealism?.state),{timeout:30000}).toBe('baseline');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.mamakMaju)).toMatchObject({state:'ready',fallbackVisible:false});
});

test('combined V7 contact shading survives export and changes the rendered paving',async({page},info)=>{
  await page.goto('/mamak-realism-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__mamakRealismPreview?.state().state),{timeout:45000}).toBe('ready');
  const report=await page.evaluate(()=>{
    const api=(window as any).__mamakRealismPreview;api.view('site');
    const site=api.asset().getObjectByName('LM_ENV_MamakMaju');let count=0,min=1,max=0;
    site.traverse((mesh:any)=>{const c=mesh.geometry?.getAttribute('color');if(c)for(let i=0;i<c.count;i++){count++;min=Math.min(min,c.getX(i));max=Math.max(max,c.getX(i));}});
    return {count,min,max};
  });
  expect(report.count).toBeGreaterThan(10000);expect(report.min).toBeLessThan(.7);expect(report.max).toBeCloseTo(1,2);
  await page.waitForTimeout(500);const baked=await page.screenshot({path:info.outputPath('combined-contact-baked.png')});
  await page.evaluate(()=>{const site=(window as any).__mamakRealismPreview.asset().getObjectByName('LM_ENV_MamakMaju');site.traverse((m:any)=>{if(m.isMesh)for(const material of Array.isArray(m.material)?m.material:[m.material]){material.vertexColors=false;material.needsUpdate=true;}});});
  await page.waitForTimeout(500);const plain=await page.screenshot({path:info.outputPath('combined-contact-plain.png')});
  expect(baked.equals(plain)).toBe(false);
});

test('realism steam originates above all ten actual mugs and switches fallback layouts',async({page})=>{
  await page.goto('/mamak-realism-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__mamakRealismPreview?.state().state),{timeout:45000}).toBe('ready');
  const report=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {createMamakSteam}=await import('/src/mamak-steam.ts');
    const scene=new THREE.Scene(),steam=createMamakSteam(scene),asset=(window as any).__mamakRealismPreview.asset();asset.updateMatrixWorld(true);
    const positions=scene.getObjectByName('LM_Mamak_TeaSteam').geometry.getAttribute('position');const ray=new THREE.Raycaster();
    steam.setLayout('realism');const mugs=[];
    for(let i=0;i<positions.count;i+=3){const origin=new THREE.Vector3().fromBufferAttribute(positions,i);ray.set(origin,new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(asset,true)[0];mugs.push({y:hit?.point.y??-1,gap:hit?origin.y-hit.point.y:-1});}
    steam.setLayout('baseline');const baseline=Array.from(positions.array);steam.setLayout('procedural');const procedural=Array.from(positions.array);
    return {mugs,baseline,procedural,count:steam.count};
  });
  expect(report.count).toBe(30);expect(report.mugs).toHaveLength(10);
  for(const mug of report.mugs){expect(mug.y).toBeGreaterThan(1.35);expect(mug.gap).toBeGreaterThan(0);expect(mug.gap).toBeLessThan(.07);}
  expect(report.baseline).not.toEqual(report.procedural);
});

test('guest can sit on the upgraded furniture in the actual game',async({page},info)=>{
  await page.routeWebSocket('**/ws',ws=>ws.close());
  await page.goto('/');await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakRealism?.state),{timeout:45000}).toBe('ready');
  await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Dining QA');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await page.keyboard.down('KeyA');
  try{await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.position.x)).toBeLessThan(-26);}finally{await page.keyboard.up('KeyA');}
  await page.locator('#interaction').click();await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.seated)).toBe(true);
  await page.screenshot({path:info.outputPath('mamak-realism-seated-in-game.png')});
  await page.locator('#interaction').click();await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.seated)).toBe(false);
});

test('mobile preview retains all detail textures',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/mamak-realism-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__mamakRealismPreview?.state().state),{timeout:45000}).toBe('ready');
  expect(await page.evaluate(()=>(window as any).__mamakRealismPreview.state().textures)).toBe(6);
  await page.screenshot({path:info.outputPath('mamak-realism-mobile.png')});
});
