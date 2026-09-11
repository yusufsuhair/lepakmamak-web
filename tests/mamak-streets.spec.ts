import { test, expect } from '@playwright/test';

test('street props load together and use instancing across repeated placements', async ({page}) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as any).__lepakStreets?.state)).toBe('ready');
  const status = await page.evaluate(() => (window as any).__lepakStreets);
  expect(status.fallbackVisible).toBe(false);
  expect(status.instances).toBe(10);
  expect(status.draws).toBeLessThanOrEqual(10);
  expect(status.switchableLamps).toBe(3);
  await expect.poll(() => page.evaluate(() => (window as any).__lepak?.mamakMaju?.state)).toBe('ready');
});

test('Mamak foliage assets expose their expected versions and cache keys', async ({page}) => {
  const requests:string[]=[];
  page.on('request',request=>{if(/LM_PROP_(Palm|Planter)Mamak\.glb/.test(request.url()))requests.push(request.url());});
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as any).__lepakStreets?.state)).toBe('ready');
  expect(requests.length).toBe(2);
  expect(requests.find(url=>url.includes('PalmMamak'))).toContain('v=foliage-v4');
  expect(requests.find(url=>url.includes('PlanterMamak'))).toContain('v=foliage-v3');
  const stats=await page.evaluate(async()=>{
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const result:any={};
    for(const name of ['LM_PROP_PalmMamak','LM_PROP_PlanterMamak']){
      const cacheKey=name==='LM_PROP_PalmMamak'?'foliage-v4':'foliage-v3';
      const gltf=await new GLTFLoader().loadAsync(`/assets/models/props/${name}.glb?v=${cacheKey}`);
      let mesh:any;
      let version:any;
      gltf.scene.traverse((node:any)=>{
        if(version===undefined && node.userData?.lm_foliage_version!==undefined)version=node.userData.lm_foliage_version;
        if(!mesh && node.isMesh)mesh=node;
      });
      if(!mesh)throw new Error(`${name} has no mesh node`);
      const geometry=mesh.geometry;
      const triangles=geometry.index?geometry.index.count/3:geometry.attributes.position.count/3;
      const box=new (await import('/node_modules/three/build/three.module.js')).Box3().setFromObject(gltf.scene);
      result[name]={version,triangles,minY:box.min.y,maxY:box.max.y};
    }
    return result;
  });
  expect(stats.LM_PROP_PalmMamak.version).toBe(4);expect(stats.LM_PROP_PalmMamak.triangles).toBeLessThan(1800);
  expect(stats.LM_PROP_PlanterMamak.version).toBe(3);expect(stats.LM_PROP_PlanterMamak.triangles).toBeLessThan(1200);
  expect(stats.LM_PROP_PalmMamak.minY).toBeGreaterThanOrEqual(-1e-4);expect(stats.LM_PROP_PlanterMamak.minY).toBeGreaterThanOrEqual(-1e-4);
});

test('one missing prop leaves the whole neighbourhood fallback visible', async ({page}) => {
  await page.route('**/LM_PROP_BenchMamak.glb', route => route.abort());
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as any).__lepakStreets?.state)).toBe('fallback');
  expect(await page.evaluate(() => (window as any).__lepakStreets)).toMatchObject({fallbackVisible:true,instances:0,draws:0});
  await expect.poll(() => page.evaluate(() => (window as any).__lepak?.mamakMaju?.state)).toBe('ready');
});

test('Blender lamp bodies preserve night overrides, lamp IDs and glow anchors', async ({page}) => {
  await page.route('**/street-harness', route => route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
  await page.goto('/street-harness');
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const {createStreetLights} = await import('/src/world.ts');
    const {installMamakStreets} = await import('/src/mamak-streets.ts');
    const scene = new THREE.Scene(), fallback = new THREE.Group();
    const lights = createStreetLights(scene);
    const index = lights.lamps.findIndex((p:any) => p.x === -10.4 && p.z === 48);
    lights.setLamp(index,true);
    const matrix = new THREE.Matrix4();
    const glow = lights.group.children[4] as any;
    glow.getMatrixAt(index,matrix); const anchorBefore = matrix.elements.slice();
    const model = await installMamakStreets(scene,fallback,lights);
    const litAfter = lights.lit(index);
    glow.getMatrixAt(index,matrix); const anchorAfter = matrix.elements.slice();
    (lights.group.children[0] as any).getMatrixAt(index,matrix); const originalPoleHidden = matrix.determinant() === 0;
    lights.setNight(true); lights.setLamp(index,false);
    const offAtNight = !lights.lit(index);
    lights.setNight(false); lights.setLamp(index,null);
    const followsDay = !lights.lit(index);
    const lampModel = model.getObjectByName('LM_PROP_StreetLamp')!;
    const meshes:any[] = []; lampModel.traverse((o:any) => {if(o.isInstancedMesh) meshes.push(o);});
    const anchorErrors = model.userData.switchableLampIndices.map((id:number, offset:number) => {
      meshes[0].getMatrixAt(2+offset,matrix);
      const newAnchor = new THREE.Vector3(.85,5.3,0).applyMatrix4(matrix);
      (lights.group.children[2] as any).getMatrixAt(id,matrix);
      // Some lamps are off now, so read the stable head pose from the original layout.
      const lamp = lights.lamps[id], toward = -lamp.side;
      const oldAnchor = new THREE.Vector3(lamp.x+(lamp.axis==='ns'?toward*.85:0),5.3,lamp.z+(lamp.axis==='ew'?toward*.85:0));
      return newAnchor.distanceTo(oldAnchor);
    });
    const importedBounds = new THREE.Box3().setFromObject(lampModel);
    return {index,indices:model.userData.switchableLampIndices,litAfter,anchorBefore,anchorAfter,originalPoleHidden,
      offAtNight,followsDay,anchorErrors,lampMeshCount:meshes.length,hasBounds:!importedBounds.isEmpty(),fallback:fallback.visible};
  });
  expect(result.indices).toContain(result.index);
  expect(result.indices).toHaveLength(3);
  for (const error of result.anchorErrors) expect(error).toBeLessThan(1e-4);
  expect(result.anchorAfter).toEqual(result.anchorBefore);
  for (const key of ['litAfter','originalPoleHidden','offAtNight','followsDay','hasBounds'] as const) expect(result[key]).toBe(true);
  expect(result.lampMeshCount).toBe(2);
  expect(result.fallback).toBe(false);
});

test('benches and service props do not cover game chairs or table arrival positions', async ({page}) => {
  await page.route('**/bench-harness', route => route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
  await page.goto('/bench-harness');
  const result = await page.evaluate(async () => {
    const {createWorld} = await import('/src/world.ts');
    const {overlaps} = await import('/src/physics.ts');
    const layout = (await import('/shared/mamak-streets.json')).default;
    const tables = (await import('/shared/tables.json')).default;
    const world = createWorld({add(){}} as any);
    const benches = world.solids.filter((s:any) => [...layout.benches,...layout.serviceProps].some((b:any) => b.x===s.x && b.z===s.z));
    return {count:benches.length, blockedChairs:world.chairs.filter((c:any) => benches.some((s:any) => overlaps(c,.4,s))).map((c:any) => c.id),
      blockedArrivals:tables.filter((t:any) => benches.some((s:any) => overlaps({x:t.arrivalX,z:t.arrivalZ},.4,s))).map((t:any) => t.id)};
  });
  expect(result).toEqual({count:5,blockedChairs:[],blockedArrivals:[]});
});

test('festoon poles stay on the courtyard edge and clear every game seat and arrival', async ({page}) => {
  await page.route('**/festoon-harness', route => route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
  await page.goto('/festoon-harness');
  const result = await page.evaluate(async () => {
    const {createWorld} = await import('/src/world.ts');
    const {overlaps} = await import('/src/physics.ts');
    const layout = (await import('/shared/mamak-streets.json')).default;
    const tables = (await import('/shared/tables.json')).default;
    const world = createWorld({add(){}} as any);
    const poles = world.solids.filter((solid:any) => layout.festoonPoles.some((point:any) => point.x===solid.x && point.z===solid.z));
    return {count:poles.length,
      offEdge:layout.festoonPoles.filter((point:any)=>![44,49,54].includes(point.z)||![-46.25,-11.75].includes(point.x)),
      blockedChairs:world.chairs.filter((chair:any)=>poles.some((solid:any)=>overlaps(chair,.4,solid))).map((chair:any)=>chair.id),
      blockedArrivals:tables.filter((table:any)=>poles.some((solid:any)=>overlaps({x:table.arrivalX,z:table.arrivalZ},.4,solid))).map((table:any)=>table.id)};
  });
  expect(result).toEqual({count:6,offEdge:[],blockedChairs:[],blockedArrivals:[]});
});
