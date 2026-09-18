import {test, expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import chairs from '../shared/chairs.json' with {type: 'json'};
import tables from '../shared/tables.json' with {type: 'json'};
import {enterAt} from './city';

// Isolated module tests, in the style of tests/animals.spec.ts and tests/ground.spec.ts: import
// the module straight into the page and drive it with synthetic frames, so the geometry and the
// strength math are checked precisely without depending on the whole game's timing.
test('static instances match every chair and table, and the draw/triangle budget holds under load', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    // @ts-ignore Vite browser module.
    const {createContactShadows, contactShadowStatus} = await import('/src/contact-shadows.ts');
    // @ts-ignore Vite browser module.
    const THREE = await import('/node_modules/three/build/three.module.js');
    const chairs = (await import('/shared/chairs.json')).default;
    const tables = (await import('/shared/tables.json')).default;
    const scene = new THREE.Scene();
    const shadows = createContactShadows(scene, chairs, tables);
    const meshes = scene.children.filter((o: any) => o.isInstancedMesh);
    const staticMesh = scene.getObjectByName('contact-shadows-static');
    const before = {staticCount: contactShadowStatus.staticCount, draws: meshes.length, staticMeshCount: staticMesh.count};
    // Stress it well past the capacity: 250 fake standing actors, all within range of the viewer.
    const remotePlayers = Array.from({length: 250}, (_, i) => ({
      id: `r${i}`, group: {position: new THREE.Vector3(i * .1, .12, 0), visible: true},
      riding: false, passengerOf: null, vehicle: 'bike', seated: false, resting: null,
      car: {group: new THREE.Object3D()}, bike: {group: new THREE.Object3D()},
    }));
    shadows.update(1 / 60, {
      shadowsOn: true, sunIntensity: 2.7, viewer: {x: 0, z: 0},
      local: {x: 0, z: 0, floor: 0, jump: 0, hidden: true, vehicle: null},
      remotePlayers, roomPlayers: [], pedestrians: [], animals: [], pets: [], traffic: [],
    });
    return {before, afterLoad: {...contactShadowStatus}};
  });
  expect(result.before.staticCount).toBe(chairs.length + tables.length);
  expect(result.before.staticMeshCount).toBe(chairs.length + tables.length);
  expect(result.before.draws).toBe(2);   // one InstancedMesh for static furniture, one for dynamic actors
  expect(result.afterLoad.dynamicCount).toBeLessThanOrEqual(200);   // capped even with 250 candidates
  expect(result.afterLoad.draws).toBeLessThanOrEqual(2);
  expect(result.afterLoad.triangles).toBeLessThanOrEqual(2000);     // task budget: +-2000 triangles at spawn
});

test('alpha is stronger with real shadows off, or the sun weak, than with shadows on in strong sun', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    // @ts-ignore Vite browser module.
    const {createContactShadows, contactShadowStatus} = await import('/src/contact-shadows.ts');
    // @ts-ignore Vite browser module.
    const THREE = await import('/node_modules/three/build/three.module.js');
    const scene = new THREE.Scene();
    const shadows = createContactShadows(scene, [], []);
    const frame = (shadowsOn: boolean, sunIntensity: number) => {
      // A big dt fully settles THREE.MathUtils.damp in one call, so the target reads exactly.
      shadows.update(10, {
        shadowsOn, sunIntensity, viewer: {x: 0, z: 0},
        local: {x: 0, z: 0, floor: 0, jump: 0, hidden: true, vehicle: null},
        remotePlayers: [], roomPlayers: [], pedestrians: [], animals: [], pets: [], traffic: [],
      });
      return contactShadowStatus.alpha;
    };
    return {shadowsOff: frame(false, 2.7), strongSun: frame(true, 2.7), rain: frame(true, 2.7 * .2), night: frame(true, .34)};
  });
  expect(result.shadowsOff).toBeGreaterThan(result.strongSun);
  expect(result.shadowsOff).toBeCloseTo(.45, 1);
  expect(result.strongSun).toBeCloseTo(.18, 1);
  // Rain drops the sun to 20% and night to moonlight (src/weather.ts): shadows nominally "on" but
  // starved of real light should read close to the no-shadow strength, not the strong-sun one.
  expect(result.rain).toBeGreaterThan(result.strongSun);
  expect(result.night).toBeGreaterThan(result.strongSun);
});

test('the local blob follows position and shrinks with jump height; a vehicle stretches into an oriented ellipse', async ({page}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    // @ts-ignore Vite browser module.
    const {createContactShadows} = await import('/src/contact-shadows.ts');
    // @ts-ignore Vite browser module.
    const THREE = await import('/node_modules/three/build/three.module.js');
    const scene = new THREE.Scene();
    const shadows = createContactShadows(scene, [], []);
    const dynamicMesh = scene.getObjectByName('contact-shadows-dynamic');
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const localAt = (x: number, z: number, jump: number) => {
      shadows.update(1 / 60, {
        shadowsOn: false, sunIntensity: 2.7, viewer: {x, z},
        local: {x, z, floor: 0, jump, hidden: false, vehicle: null},
        remotePlayers: [], roomPlayers: [], pedestrians: [], animals: [], pets: [], traffic: [],
      });
      // Fully faded (scale would be 0) is skipped rather than stamped, so nothing is left to draw:
      // that shows up as an empty mesh, not a zero-scale instance sitting in the buffer.
      if (dynamicMesh.count === 0) return {x: NaN, z: NaN, scale: 0};
      dynamicMesh.getMatrixAt(0, m); m.decompose(p, q, s);
      return {x: p.x, z: p.z, scale: s.x};
    };
    const grounded = localAt(5, 7, 0);
    const midJump = localAt(5, 7, .45);
    const apex = localAt(12, -3, 1.2);   // past the fade height: should be fully gone
    const vehicleGroup = new THREE.Object3D(); vehicleGroup.position.set(20, 0, -8); vehicleGroup.rotation.y = Math.PI / 4;
    shadows.update(1 / 60, {
      shadowsOn: false, sunIntensity: 2.7, viewer: {x: 20, z: -8},
      local: {x: 20, z: -8, floor: 0, jump: 0, hidden: true, vehicle: {group: vehicleGroup, bike: false}},
      remotePlayers: [], roomPlayers: [], pedestrians: [], animals: [], pets: [], traffic: [],
    });
    dynamicMesh.getMatrixAt(0, m); m.decompose(p, q, s);
    const vehicleAngle = new THREE.Euler().setFromQuaternion(q).y;
    return {grounded, midJump, apex, vehicle: {x: p.x, z: p.z, width: s.x, length: s.z, angle: vehicleAngle}};
  });
  expect(result.grounded.x).toBeCloseTo(5, 5); expect(result.grounded.z).toBeCloseTo(7, 5);
  expect(result.grounded.scale).toBeGreaterThan(0);
  expect(result.midJump.scale).toBeLessThan(result.grounded.scale);   // shrinks as it rises
  expect(result.apex.scale).toBeCloseTo(0, 5);                        // faded out well before the ~1.17 m apex
  expect(result.vehicle.x).toBeCloseTo(20, 5); expect(result.vehicle.z).toBeCloseTo(-8, 5);
  expect(result.vehicle.length).toBeGreaterThan(result.vehicle.width);   // longer than it is wide: a car, not a coin
  expect(result.vehicle.angle).toBeCloseTo(Math.PI / 4, 5);               // oriented to the vehicle's yaw
});

// Full-game integration: the wiring in main.ts actually creates the meshes at the documented size
// and moves the real dynamic instance as the real player moves and jumps.
async function contactStatus(page: Page) {
  return page.evaluate(() => (window as any).__lepakRealism?.contactShadows);
}
async function localShadowScale(page: Page) {
  return page.evaluate(async () => {
    const w = window as any;
    // @ts-ignore Vite browser module.
    const THREE = await import('/node_modules/three/build/three.module.js');
    const mesh = w.__lepakScene.getObjectByName('contact-shadows-dynamic');
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    mesh.getMatrixAt(0, m); m.decompose(p, q, s);
    return {x: p.x, z: p.z, scale: s.x, count: mesh.count};
  });
}

test('the running game wires static furniture and the local player into the real scene, and the shrink survives a real jump', async ({page}) => {
  await enterAt(page, -18, 52);
  await expect.poll(async () => (await contactStatus(page))?.staticCount).toBe(chairs.length + tables.length);
  const grounded = await localShadowScale(page);
  const lepak = await page.evaluate(() => (window as any).__lepak.position);
  expect(grounded.x).toBeCloseTo(lepak.x, 1); expect(grounded.z).toBeCloseTo(lepak.z, 1);
  expect(grounded.scale).toBeGreaterThan(0);
  let minScale = grounded.scale;
  await page.keyboard.down('Space');
  for (let i = 0; i < 20; i++) { minScale = Math.min(minScale, (await localShadowScale(page)).scale); await page.waitForTimeout(20); }
  await page.keyboard.up('Space');
  await expect.poll(async () => (await page.evaluate(() => (window as any).__lepak.jumpHeight))).toBe(0);
  expect(minScale).toBeLessThan(grounded.scale);   // the jump visibly shrank the blob at some point mid-arc
  const settled = await localShadowScale(page);
  expect(settled.scale).toBeCloseTo(grounded.scale, 1);   // and it is back once landed
});

// Visual verification: soft grounding, not black discs or dirty smudges, across the conditions
// where the brief says real shadows are weakest (rain, night) or absent (touch/mobile).
async function setWeather(page: Page, isoTime: string, condition: string) {
  const now = Date.parse(isoTime);
  await page.clock.install({time: now});
  await page.route('**/weather', r => r.fulfill({json: {available: true, condition, observedAt: now, serverTime: now, source: 'Contact-shadow test'}}));
}

test('desktop screenshot beside Mamak Maju in day-sunny', async ({page}) => {
  await setWeather(page, '2026-09-18T04:00:00Z', 'sunny');   // ~noon MYT, clear: strong sun, light blobs
  await enterAt(page, -33, 49);
  await page.waitForTimeout(400);
  await page.screenshot({path: 'test-results-contact-shadows/shots/day-sunny.png'});
});

test('desktop screenshot beside Mamak Maju in day-rain', async ({page}) => {
  await setWeather(page, '2026-09-18T04:00:00Z', 'rain');    // same clock, sun cut to 20% (src/weather.ts)
  await enterAt(page, -33, 49);
  await page.waitForTimeout(600);
  await page.screenshot({path: 'test-results-contact-shadows/shots/day-rain.png'});
});

test('desktop screenshot beside Mamak Maju at night', async ({page}) => {
  await setWeather(page, '2026-09-18T14:00:00Z', 'sunny');   // ~10pm MYT, clear night: moonlight only
  await enterAt(page, -33, 49);
  await page.waitForTimeout(600);
  await page.screenshot({path: 'test-results-contact-shadows/shots/night.png'});
});

test('street view with cars', async ({page}) => {
  await enterAt(page, 0, -60);
  await page.waitForTimeout(400);
  await page.screenshot({path: 'test-results-contact-shadows/shots/street-cars.png'});
});

test('touch/mobile emulation shows the strong blob where real shadows are off', async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  const page = await context.newPage();
  await enterAt(page, -33, 49);
  await expect.poll(async () => (await page.evaluate(() => (window as any).__lepak.shadows))).toBe(false);
  await page.waitForTimeout(400);
  await page.screenshot({path: 'test-results-contact-shadows/shots/mobile.png'});
  await context.close();
});
