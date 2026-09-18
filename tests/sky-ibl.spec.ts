import {test,expect} from '@playwright/test';
import * as THREE from 'three';
import {ENV_INTENSITY,HEMI_SCALE} from '../src/sky-ibl';
import {enterAt} from './city';

// sky-ibl.ts on its own: wires the shared probe into scene.environment only when told to, exposes its
// status for other agents' tests under __lepakRealism (the shoplotStatus convention), and never touches
// a material's own envMap. No full page entry needed for this half — a blank harness page is enough.
test('sky-ibl wires the shared probe into scene.environment only when enabled, and exposes its status',async({page})=>{
 await page.route('**/sky-ibl-harness',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('/sky-ibl-harness');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js' as string);
  const W=await import('/src/weather.ts' as string);
  const S=await import('/src/sky-ibl.ts' as string);
  const scene=new THREE.Scene();
  let probe:any=null;W.onSkyProbe((t:any)=>probe=t);
  const beforeSetup={env:scene.environment,intensity:scene.environmentIntensity};
  S.setupSkyIbl(scene);
  const afterSetup={env:scene.environment,intensity:scene.environmentIntensity,exposed:(window as any).__lepakRealism?.skyIbl===S.skyIblStatus};
  const calls:number[]=[];
  const weatherUI={setHemisphereScale:(factor:number)=>calls.push(factor)};
  S.setSkyIblQuality(scene,weatherUI,true);
  const high={env:scene.environment,isProbe:scene.environment===probe,enabled:S.skyIblStatus.enabled,mapping:probe.mapping};
  S.setSkyIblQuality(scene,weatherUI,false);
  const low={env:scene.environment,enabled:S.skyIblStatus.enabled};
  return {beforeSetup,afterSetup,high,low,calls};
 });
 expect(result.beforeSetup.env).toBeNull();
 // setupSkyIbl sets environmentIntensity up front but never assigns scene.environment itself: disabled
 // until a quality change (setSkyIblQuality) says otherwise, so Low/touch never pay for it.
 expect(result.afterSetup.env).toBeNull();
 expect(result.afterSetup.intensity).toBe(ENV_INTENSITY);
 expect(result.afterSetup.exposed).toBe(true);
 expect(result.high.isProbe).toBe(true);
 expect(result.high.enabled).toBe(true);
 expect(result.high.mapping).toBe(THREE.EquirectangularReflectionMapping);
 expect(result.low.env).toBeNull();
 expect(result.low.enabled).toBe(false);
 // The hemisphere is scaled down while IBL is live, and fully restored (factor 1) the moment it is not.
 expect(result.calls).toEqual([HEMI_SCALE,1]);
});

// three resolves `material.envMap || scene.environment` per material every frame (WebGLRenderer.js
// setProgram) and recompiles only what actually changed — verified by reading that source, not assumed.
// This checks the other half: sky-ibl.ts itself never writes to a material's own envMap.
test('a material with its own envMap is unaffected by scene.environment turning on',async({page})=>{
 await page.route('**/sky-ibl-envmap-check',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('/sky-ibl-envmap-check');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js' as string);
  const S=await import('/src/sky-ibl.ts' as string);
  const scene=new THREE.Scene();
  const ownEnv=new THREE.Texture();ownEnv.mapping=THREE.EquirectangularReflectionMapping;
  const material=new THREE.MeshStandardMaterial({envMap:ownEnv});
  S.setupSkyIbl(scene);
  S.setSkyIblQuality(scene,{setHemisphereScale(){}},true);
  return {ownEnvKept:material.envMap===ownEnv,sceneEnvSet:scene.environment!=null,differentObjects:scene.environment!==ownEnv};
 });
 expect(result).toEqual({ownEnvKept:true,sceneEnvSet:true,differentObjects:true});
});

// The running game: High wires it in before the first render (main.ts lighting init), Low clears it and
// undoes the hemisphere compensation completely (setShadows' own needsUpdate sweep already forces the
// one recompile a material needs — nothing here adds a second traversal), and neither costs a draw call.
test('the running game enables sky IBL at High, restores Low exactly, and adds no draw calls',async({page})=>{
 await enterAt(page,-18,52);   // spawns beside Mamak Maju
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.graphicsQuality)).toBe('high');
 const high=await page.evaluate(()=>{
  const lepak=(window as any).__lepak,scene=lepak.scene;
  const hemi=scene.children.find((o:any)=>o.isHemisphereLight);
  return {enabled:(window as any).__lepakRealism?.skyIbl?.enabled,mapping:scene.environment?.mapping,hemi:hemi.intensity,drawCalls:lepak.drawCalls};
 });
 expect(high.enabled).toBe(true);
 expect(high.mapping).toBe(THREE.EquirectangularReflectionMapping);

 await page.locator('#menu').click();await page.selectOption('#graphics-quality','low');await page.keyboard.press('Escape');
 const low=await page.evaluate(()=>{
  const lepak=(window as any).__lepak,scene=lepak.scene;
  const hemi=scene.children.find((o:any)=>o.isHemisphereLight);
  return {enabled:(window as any).__lepakRealism?.skyIbl?.enabled,env:scene.environment,hemi:hemi.intensity};
 });
 expect(low.enabled).toBe(false);
 expect(low.env).toBeNull();
 // Same instant, same weather: Low's hemisphere should be High's divided back out by the compensation.
 expect(low.hemi/high.hemi).toBeCloseTo(1/HEMI_SCALE,1);

 await page.locator('#menu').click();await page.selectOption('#graphics-quality','high');await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>(window as any).__lepak.scene.environment!=null)).toBe(true);

 // +0 draw calls: toggling scene.environment alone, independent of the quality menu, must not move the count.
 const draws=await page.evaluate(async()=>{
  const lepak=(window as any).__lepak,scene=lepak.scene,probe=scene.environment;
  const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  scene.environment=probe;await settle();const withEnv=lepak.drawCalls;
  scene.environment=null;await settle();const withoutEnv=lepak.drawCalls;
  scene.environment=probe;await settle();
  return {withEnv,withoutEnv};
 });
 expect(draws.withoutEnv).toBe(draws.withEnv);
});

// Commit 4935b59 removed a 0.7-1.1 s entry freeze from a reflection probe that compiled a second shader
// per material; this feature must not reintroduce it. scene.environment is set before the first render
// (main.ts lighting init, well before the requestAnimationFrame loop starts), so no material compiled at
// entry should ever need a second compile for it — confirmed structurally above (scene.environment is
// already the probe the instant __lepak reports High, with no async gap where it could have rendered
// once without it first).
//
// A PerformanceObserver longtask check on the full running game was tried here and dropped: toggling
// quality already forces one whole-scene recompile via setShadows' pre-existing needsUpdate sweep, which
// alone (confirmed by disabling sky-ibl.ts's own call and reproducing the same long task from setShadows
// alone) already produces a long task whose wall-clock duration swings 5-10x with this machine's shared
// load (measured 371-1074 ms for the identical pre-existing sweep across runs a few minutes apart, three
// other agents building on the same box) — no fixed millisecond threshold is meaningful here. What is
// meaningful and load-independent: sky-ibl.ts's own contribution to that toggle is a handful of property
// assignments, not a traversal, so it costs microseconds regardless of machine load.
test('setSkyIblQuality does a fixed handful of property assignments, not a per-material pass',async({page})=>{
 await page.route('**/sky-ibl-timing-check',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('/sky-ibl-timing-check');
 const msPerCall=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js' as string);
  const S=await import('/src/sky-ibl.ts' as string);
  const scene=new THREE.Scene();S.setupSkyIbl(scene);
  const weatherUI={setHemisphereScale(){}};
  const start=performance.now();
  for(let i=0;i<500;i++)S.setSkyIblQuality(scene,weatherUI,i%2===0);
  return (performance.now()-start)/500;
 });
 // Generous even under heavy contention: a scene.traverse() over a real city (thousands of meshes) costs
 // single-digit milliseconds on its own, so this catches "someone added a traversal here" while tolerating
 // load noise a fixed setSkyIblQuality call should never approach.
 expect(msPerCall).toBeLessThan(2);
});
