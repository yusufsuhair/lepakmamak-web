import {test,expect} from '@playwright/test';

// Duplicated from the road grid in world.ts on purpose: if the roads move and the
// lamps do not follow, this fails instead of leaving lamp posts stranded in a field.
const VERTICAL_X=[0,76,-82], HORIZONTAL_Z=[-64,8,78], KERB=10.4, JUNCTION=11;

test('street lamps line the roads, clear the junctions and light only at night',async({page})=>{
 await page.route('**/lamp-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/lamp-harness');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createStreetLights}=await import('/src/world.ts');
  const scene=new THREE.Scene();
  const lights=createStreetLights(scene);
  lights.setNight(true);
  const lit=lights.headMaterial.emissiveIntensity;
  lights.setNight(false);
  const dark=lights.headMaterial.emissiveIntensity;
  return {lamps:lights.lamps,meshes:lights.group.children.length,lit,dark,inScene:scene.children.includes(lights.group)};
 });

 expect(result.inScene).toBe(true);
 expect(result.lamps.length).toBeGreaterThan(40);
 // Instanced, so the whole lamp network costs a handful of draw calls, not one per post.
 expect(result.meshes).toBeLessThanOrEqual(4);
 expect(result.lit).toBeGreaterThan(0);
 expect(result.dark).toBe(0);

 for(const lamp of result.lamps){
  if(lamp.axis==='ns'){
   expect(VERTICAL_X.some(x=>Math.abs(Math.abs(lamp.x-x)-KERB)<1e-6)).toBe(true);
   expect(HORIZONTAL_Z.some(z=>Math.abs(lamp.z-z)<JUNCTION)).toBe(false);
  } else {
   expect(HORIZONTAL_Z.some(z=>Math.abs(Math.abs(lamp.z-z)-KERB)<1e-6)).toBe(true);
   expect(VERTICAL_X.some(x=>Math.abs(lamp.x-x)<JUNCTION)).toBe(false);
  }
 }
});

test('no lamp adds a real light to the scene, which would cost a shader recompile each',async({page})=>{
 await page.route('**/lamp-cost-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/lamp-cost-harness');
 const lightCount=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createStreetLights}=await import('/src/world.ts');
  const scene=new THREE.Scene();
  createStreetLights(scene);
  let lights=0; scene.traverse(object=>{if((object as any).isLight)lights++;});
  return lights;
 });
 expect(lightCount).toBe(0);
});

test('night is lifted enough to see the street',async({page})=>{
 await page.route('**/night-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/night-harness');
 const levels=await page.evaluate(async()=>{
  const {NIGHT_SUN,NIGHT_AMBIENT}=await import('/src/weather.ts');
  return {NIGHT_SUN,NIGHT_AMBIENT};
 });
 // The old values were .22 and .7, which is what "too dark" looked like.
 expect(levels.NIGHT_SUN).toBeGreaterThan(.22);
 expect(levels.NIGHT_AMBIENT).toBeGreaterThan(.7);
});

test('a lamp actually puts light on the screen, not just on a material property',async({page})=>{
 await page.route('**/lamp-pixel-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/lamp-pixel-harness');
 const brightness=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createStreetLights}=await import('/src/world.ts');
  const scene=new THREE.Scene();
  const lights=createStreetLights(scene);
  // Night lighting, so the lamp is the only thing with anything to give.
  scene.add(new THREE.HemisphereLight('#f6edcf','#758b75',1.15));
  const lamp=lights.lamps[0];
  const camera=new THREE.PerspectiveCamera(60,1,.1,100);
  camera.position.set(lamp.x+7,6,lamp.z+9);camera.lookAt(lamp.x,2.4,lamp.z);
  const renderer=new THREE.WebGLRenderer({antialias:false});
  const target=new THREE.WebGLRenderTarget(64,64);
  const pixels=new Uint8Array(64*64*4);
  const measure=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,64,64,pixels);let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];return sum/(64*64*3);};
  lights.setNight(false);const dark=measure();
  lights.setNight(true);const lit=measure();
  renderer.dispose();
  return {dark,lit};
 });
 // Regression floor, not a target: the shipped lamp measures about 9.7 against an
 // unlit 0.1, so anything near the unlit frame means the glow has been lost again.
 expect(brightness.lit).toBeGreaterThan(5);
 expect(brightness.lit).toBeGreaterThan(brightness.dark * 20);
});
