import {test,expect} from '@playwright/test';
import registry from '../shared/mamak-shops.json' with {type:'json'};

test('every Blender facade loads and hides only its own fallback',async ({page}) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>Object.values((window as any).__lepakShops ?? {}).filter((s:any)=>s.state==='ready').length)).toBe(registry.length);
  const states=await page.evaluate(()=>Object.values((window as any).__lepakShops));
  expect(states.every((s:any)=>s.fallbackVisible===false)).toBe(true);
  expect(errors).toEqual([]);
});

test('missing shop keeps its facade while the others still load',async ({page}) => {
  await page.route('**/LM_SHOP_ZusCoffee.glb*',route=>route.abort());
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>Object.values((window as any).__lepakShops ?? {}).filter((s:any)=>s.state==='ready').length)).toBe(registry.length-1);
  expect(await page.evaluate(()=>(window as any).__lepakShops.LM_SHOP_ZusCoffee)).toEqual({state:'fallback',fallbackVisible:true});
});

test('facade replacement preserves collision, map footprints and playable chairs',async ({page}) => {
  await page.route('**/shops-harness',route=>route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
  await page.goto('/shops-harness');
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {createWorld}=await import('/src/world.ts');
    const {loadMamakShops}=await import('/src/mamak-shops.ts');
    const {overlaps}=await import('/src/physics.ts');
    const shops=(await import('/shared/mamak-shops.json')).default;
    const scene=new THREE.Scene(),world=createWorld(scene);
    const snapshot=()=>JSON.stringify({solids:world.solids,chairs:world.chairs,map:world.mapBuildings});
    const before=snapshot();
    const fallbackPositions=shops.map((shop:any)=>{
      const box=new THREE.Box3().setFromObject(world.shopFallbacks.get(shop.asset)!);
      return {x:box.getCenter(new THREE.Vector3()).x,shopX:shop.x,width:box.getSize(new THREE.Vector3()).x};
    });
    await loadMamakShops(scene,world.shopFallbacks).settled;
    const imported=shops.map((shop:any)=>{
      const model=scene.getObjectByName(shop.asset)!;
      const collider=world.solids.find((s:any)=>s.x===shop.x && s.z===shop.z);
      return {name:shop.asset,position:model.position.toArray(),expected:[shop.x,0,shop.z],collider:!!collider,
        hidden:!world.shopFallbacks.get(shop.asset)!.visible,children:model.children.length};
    });
    const zusChairs=world.chairs.filter((c:any)=>Math.abs(c.x-27)<12 && c.z>64 && c.z<69);
    return {unchanged:before===snapshot(),fallbackPositions,imported,zusChairCount:zusChairs.length,
      zusArrivalBlocked:world.solids.some((s:any)=>overlaps({x:27,z:68},.4,s))};
  });
  expect(result.unchanged).toBe(true);
  expect(result.imported).toHaveLength(registry.length);
  for(const model of result.imported){expect(model.position).toEqual(model.expected);expect(model.collider && model.hidden).toBe(true);expect(model.children).toBeGreaterThan(0);}
  for(const fallback of result.fallbackPositions){expect(Math.abs(fallback.x-fallback.shopX)).toBeLessThan(.5);expect(fallback.width).toBeGreaterThan(16);expect(fallback.width).toBeLessThan(23);}
  expect(result.zusChairCount).toBe(12);
  expect(result.zusArrivalBlocked).toBe(false);
});
