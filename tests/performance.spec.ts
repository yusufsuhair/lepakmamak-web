import {test,expect} from '@playwright/test';

test('spatial instances preserve every placement and cull streets outside the camera',async({page})=>{
 await page.route('**/instance-budget',r=>r.fulfill({contentType:'text/html',body:'<canvas></canvas>'}));
 await page.goto('/instance-budget');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {spatialInstances}=await import('/src/web-assets.ts');
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
  const matrices=[-130,0,130].flatMap(x=>Array.from({length:20},(_,i)=>new THREE.Matrix4().makeTranslation(x+i*.1,0,0)));
  const meshes=spatialInstances(geometry,material,matrices),positions:number[]=[];
  for(const mesh of meshes){scene.add(mesh);const matrix=new THREE.Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);positions.push(matrix.elements[12]);}}
  const camera=new THREE.PerspectiveCamera(50,1,.1,40);camera.position.set(1,3,12);camera.lookAt(1,0,0);
  const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!});renderer.setSize(128,128);renderer.render(scene,camera);
  const result={positions:positions.sort((a,b)=>a-b),expected:matrices.map(m=>m.elements[12]).sort((a,b)=>a-b),triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};
  geometry.dispose();material.dispose();renderer.dispose();return result;
 });
 expect(result.positions).toHaveLength(60);
 result.positions.forEach((x,i)=>expect(x).toBeCloseTo(result.expected[i],4));
 expect(result.calls).toBe(1);expect(result.triangles).toBe(20*12);
});

test('hidden scene branches catch up before their first visible frame',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).__lepak);
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const scene=(window as any).__lepak.scene,group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  group.position.x=37;mesh.position.x=4;mesh.updateMatrix();mesh.matrixAutoUpdate=false;group.add(mesh);group.visible=false;scene.add(group);
  await frame();await frame();const hidden=mesh.matrixWorld.elements[12];
  group.visible=true;await frame();await frame();const visible=mesh.matrixWorld.elements[12];
  group.visible=false;group.position.x=73;await frame();await frame();group.visible=true;await frame();await frame();
  const returned=mesh.matrixWorld.elements[12];group.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();
  return {hidden,visible,returned};
 });
 expect(result).toEqual({hidden:0,visible:41,returned:77});
});

test('graphics quality switches shadows and persists across reload',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('lepak-graphics','low'));
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await page.locator('#menu').click();
 await expect(page.locator('#graphics-quality option')).toHaveText(['Lowest','Low','High']);
 await expect(page.locator('#shadow-toggle')).toHaveCount(0);
 await page.locator('#graphics-quality').selectOption('low');
 expect(await page.evaluate(()=>(window as any).__lepak.shadows)).toBe(false);
 expect(await page.evaluate(()=>(window as any).__lepak.pixelRatio)).toBeLessThanOrEqual(1);
 await page.waitForTimeout(500);expect(await page.evaluate(()=>(window as any).__lepakPetronas.state)).toBe('idle');
 await page.reload();await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await page.locator('#menu').click();
 await expect(page.locator('#graphics-quality')).toHaveValue('low');
 await page.locator('#graphics-quality').selectOption('high');expect(await page.evaluate(()=>(window as any).__lepak.shadows)).toBe(true);
 await page.locator('#graphics-quality').selectOption('lowest');
 expect(await page.evaluate(()=>(window as any).__lepak)).toMatchObject({graphicsQuality:'lowest',shadows:false,pixelRatio:.75});
});

test('touch ignores high saved by an earlier browser session',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844}}),page=await context.newPage();
 await page.addInitScript(()=>localStorage.setItem('lepak-graphics','high'));await page.goto('/');
 await expect(page.locator('#graphics-quality')).toHaveValue('lowest');
 expect(await page.evaluate(()=>(window as any).__lepak)).toMatchObject({shadows:false,pixelRatio:.75});
 await page.locator('#graphics-quality').evaluate((select:HTMLSelectElement)=>{select.value='high';select.dispatchEvent(new Event('change'));});
 await page.reload();await expect(page.locator('#graphics-quality')).toHaveValue('high');await context.close();
});

for(const [old,current] of [['smooth','low'],['detailed','high'],['auto','high']])test(`migrates ${old} graphics to ${current}`,async({page})=>{
 await page.addInitScript(value=>localStorage.setItem('lepak-graphics',value),old);
 await page.goto('/');
 await expect(page.locator('#graphics-quality')).toHaveValue(current);
 expect(await page.evaluate(()=>localStorage.getItem('lepak-graphics'))).toBe(current);
});

test('slow phone frames reduce only the render buffer and pause stops adaptation', async ({browser}) => {
 const context = await browser.newContext({hasTouch:true, viewport:{width:390,height:844}});
 const page = await context.newPage();
 page.setDefaultTimeout(15000);
 await page.addInitScript(() => localStorage.setItem('lepakmamak-onboarded','1'));
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Tester');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await page.getByRole('button',{name:'More controls'}).click();
 await page.locator('#menu').click();
 await page.evaluate(() => {
   const raf = window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame = callback => {
     const start = performance.now();
     return raf(function delay(time) {
       if (time - start < 32) raf(delay);
       else callback(time);
     });
   };
 });
 await page.waitForTimeout(3500);
 expect(await page.evaluate(()=>(window as any).__lepak.pixelRatio)).toBe(.75);
 await page.locator('#resume').click();
 await expect.poll(() => page.evaluate(()=>(window as any).__lepak.pixelRatio), {timeout:20000}).toBe(.5);
 expect(await page.evaluate(() => {
   const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
   return {quality:(window as any).__lepak.graphicsQuality, reduced:(window as any).__lepak.autoReduced,
     width:canvas.width, cssWidth:canvas.getBoundingClientRect().width, viewport:innerWidth};
 })).toEqual({quality:'lowest',reduced:true,width:195,cssWidth:390,viewport:390});
 if (!(await page.locator('#menu').isVisible())) await page.getByRole('button',{name:'More controls'}).click();
 await page.locator('#menu').click();
 await page.locator('#graphics-quality').selectOption('low');
 expect(await page.evaluate(()=>(window as any).__lepak.pixelRatio)).toBe(.75);
 await context.close();
});
