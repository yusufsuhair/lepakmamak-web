import {test, expect} from '@playwright/test';
import {enterAt} from './city';

// Measured from the V2 GLBs before the photographic pass: wheel_FR centre (x,y,z), its radius, the
// near model's bounding size and the seated driver (x,y,z,scale). The V3 atlas pass must not move any of it.
const V2 = {"axia":{"wheel":[0.7625,0.297,1.2625,0.285],"size":[1.991,1.521,3.916],"driver":[0.333,0.03,0.2592,0.5568]},"myvi":{"wheel":[0.7975,0.314,1.25,0.302],"size":[2.061,1.532,4.051],"driver":[0.347,0.03,0.299,0.5614]},"emas":{"wheel":[0.8805,0.372,1.375,0.36],"size":[2.225,1.685,4.771],"driver":[0.3802,0.03,0.5114,0.6318]},"avanza":{"wheel":[0.795,0.337,1.375,0.325],"size":[2.056,1.738,4.551],"driver":[0.346,0.03,0.4465,0.6455]},"vellfire":{"wheel":[0.855,0.367,1.5,0.355],"size":[2.174,1.949,5.152],"driver":[0.37,0.03,0.8733,0.7523]},"suv":{"wheel":[0.86,0.377,1.335,0.365],"size":[2.184,1.728,4.636],"driver":[0.372,0.03,0.4716,0.6409]},"sport":{"wheel":[0.86,0.347,1.285,0.335],"size":[2.183,1.317,4.588],"driver":[0.372,0.03,0.2669,0.4636]},"ferrari":{"wheel":[0.905,0.357,1.325,0.345],"size":[2.276,1.226,4.768],"driver":[0.39,0.03,0.3128,0.4227]},"lamborghini":{"wheel":[0.979,0.367,1.35,0.355],"size":[2.424,1.175,5.151],"driver":[0.4196,0.03,0.4105,0.3891]},"model-y":{"wheel":[0.89,0.372,1.445,0.36],"size":[2.245,1.641,4.946],"driver":[0.384,0.03,0.563,0.6109]},"cybertruck":{"wheel":[0.946,0.45,1.8175,0.438],"size":[2.358,1.76,5.84],"driver":[0.4064,0.03,1.0538,0.6864]},"police":{"wheel":[0.86,0.377,1.335,0.365],"size":[2.183,1.852,4.636],"driver":[0.372,0.03,0.4716,0.6409]},"f1":{"wheel":[0.93,0.372,1.575,0.36],"size":[2.391,1.105,4.845],"driver":[0,0.1,-0.5,0.4]}} as const;

test('atlas fleet keeps wheels, bounds and seats, shares its textures and stays within the draw budget', async ({page}) => {
  await page.goto('/vehicles-preview.html');
  const result = await page.evaluate(async styles => {
    const {createDriveableCar} = await import('/src/world.ts');
    const THREE = await import('/node_modules/three/build/three.module.js');
    const out: Record<string, any> = {}, atlasSources = new Set<unknown>();
    for (const style of styles) {
      const car = createDriveableCar(style as any); await car.ready;
      const lod = car.group.getObjectByName('vehicle-detail-levels')!;
      for (let i = 0; i < 100 && lod.children.length < 3; i++) await new Promise(r => setTimeout(r, 100));
      car.group.updateMatrixWorld(true);
      const levels = lod.children.map(level => {
        let draws = 0; const names = new Set<string>();
        level.traverse((o: any) => { if (!o.isMesh) return; for (const m of [o.material].flat()) { draws++; names.add(m.name);
          if (m.name === 'Vehicle detail atlas' && m.map) atlasSources.add(m.map.source); } });
        return {draws, names: [...names]};
      });
      let lamps = 0, lit = 0;
      lod.children[0].traverse((o: any) => { if (o.isMesh && /LED optics/.test(o.material.name)) { lamps++; if (o.material.emissiveMap) lit++; } });
      const size = new THREE.Box3().setFromObject(lod.children[0]).getSize(new THREE.Vector3()).toArray();
      const fr = car.wheels[1];
      out[style] = {levels, lamps, lit, size, wheel: [...fr.getWorldPosition(new THREE.Vector3()).toArray(), fr.userData.wheelRadius],
        driver: [...car.driver.position.toArray(), car.driver.scale.x], version: car.group.userData.assetVersion};
    }
    return {out, atlasSources: atlasSources.size};
  }, Object.keys(V2));
  expect(result.atlasSources).toBe(1);   // one colour atlas image serves every style and level
  for (const [style, before] of Object.entries(V2)) {
    const car = result.out[style];
    expect(car.version).toBe('vehicles-v3');
    expect(car.levels).toHaveLength(3);
    for (const level of car.levels) {
      expect(level.draws, `${style} draws`).toBeLessThanOrEqual(14);
      if (style !== 'f1') expect(level.names).toContain('Vehicle detail atlas');
    }
    expect(car.lit).toBe(car.lamps);
    car.wheel.forEach((v: number, i: number) => expect(v, `${style} wheel ${i}`).toBeCloseTo(before.wheel[i], 3));
    car.driver.forEach((v: number, i: number) => expect(v, `${style} driver ${i}`).toBeCloseTo(before.driver[i], 3));
    car.size.forEach((v: number, i: number) => expect(Math.abs(v - before.size[i]), `${style} size ${i}`).toBeLessThan(.03));
  }
});

test('lamps light with the night flag and brake independently; showroom paint is clean', async ({page}) => {
  await page.goto('/vehicles-preview.html');
  const result = await page.evaluate(async () => {
    const {createDriveableCar} = await import('/src/world.ts');
    const {updateVehiclePresentation, vehiclePresentationState} = await import('/src/vehicle-presentation.ts');
    const THREE = await import('/node_modules/three/build/three.module.js');
    const car = createDriveableCar('suv'); await car.ready;
    const scene = new THREE.Scene(); scene.add(car.group);
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 3, 8);
    const white = () => { let m: any; car.group.traverse((o: any) => { if (o.isMesh && o.material.name === 'White LED optics') m = o.material; }); return m; };
    updateVehiclePresentation(scene, camera, .016, false, {group: car.group, controls: {speed: 0, steering: 0, braking: false}}, 1);
    const day = {white: white().emissiveIntensity, red: vehiclePresentationState(car.group)?.brake};
    updateVehiclePresentation(scene, camera, .016, true, {group: car.group, controls: {speed: 3, steering: 0, braking: true}}, 1);
    const night = {white: white().emissiveIntensity, red: vehiclePresentationState(car.group)?.brake, map: !!white().emissiveMap};
    return {day, night};
  });
  expect(result.day).toEqual({white: .65, red: .12});
  expect(result.night).toEqual({white: 2.5, red: 3.2, map: true});
});

test('busy parking view stays within the traffic draw-call budget', async ({page}) => {
  await page.clock.install({time: '2026-09-12T05:00:00Z'});
  await enterAt(page, -132, 152);
  await expect.poll(() => page.evaluate(() => {
    const states: string[] = [];
    (window as any).__lepakScene?.traverse((o: any) => { if (o.userData?.displayName && o.userData.assetState) states.push(`${o.userData.assetState}:${o.userData.lodCount}`); });
    return states.length > 10 && states.every(s => s === 'ready:3');
  }), {timeout: 120000}).toBe(true);
  await page.waitForTimeout(3000);
  const vehicles = await page.evaluate(async () => {
    const frames = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await frames(); const all = (window as any).__lepak.drawCalls;
    const hidden: any[] = [];
    (window as any).__lepakScene.traverse((o: any) => { if (o.name === 'vehicle-detail-levels') o.traverse((m: any) => { if (m.isMesh && m.visible) { m.visible = false; hidden.push(m); } }); });
    await frames(); const without = (window as any).__lepak.drawCalls;
    hidden.forEach(m => { m.visible = true; });
    return all - without;
  });
  // V2 drew 473 calls for the fourteen GLB cars in this view (colour + shadow passes); the budget is +10%.
  expect(vehicles).toBeGreaterThan(50);
  expect(vehicles).toBeLessThanOrEqual(520);
});
