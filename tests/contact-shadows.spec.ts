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
    const camera = new THREE.PerspectiveCamera();
    const shadows = createContactShadows(scene, camera, chairs, tables);
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
      local: {x: 0, z: 0, floor: 0, jump: 0, hidden: true, vehicle: null, excludeGroups: []},
      remotePlayers, roomPlayers: [], pedestrians: [], animals: [], petsForEach: () => {}, traffic: [],
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
    const camera = new THREE.PerspectiveCamera();
    const shadows = createContactShadows(scene, camera, [], []);
    const frame = (shadowsOn: boolean, sunIntensity: number) => {
      // A big dt fully settles THREE.MathUtils.damp in one call, so the target reads exactly.
      shadows.update(10, {
        shadowsOn, sunIntensity, viewer: {x: 0, z: 0},
        local: {x: 0, z: 0, floor: 0, jump: 0, hidden: true, vehicle: null, excludeGroups: []},
        remotePlayers: [], roomPlayers: [], pedestrians: [], animals: [], petsForEach: () => {}, traffic: [],
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
    const camera = new THREE.PerspectiveCamera();
    const shadows = createContactShadows(scene, camera, [], []);
    const dynamicMesh = scene.getObjectByName('contact-shadows-dynamic');
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const localAt = (x: number, z: number, jump: number) => {
      shadows.update(1 / 60, {
        shadowsOn: false, sunIntensity: 2.7, viewer: {x, z},
        local: {x, z, floor: 0, jump, hidden: false, vehicle: null, excludeGroups: []},
        remotePlayers: [], roomPlayers: [], pedestrians: [], animals: [], petsForEach: () => {}, traffic: [],
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
      local: {x: 20, z: -8, floor: 0, jump: 0, hidden: true, vehicle: {group: vehicleGroup, bike: false}, excludeGroups: []},
      remotePlayers: [], roomPlayers: [], pedestrians: [], animals: [], petsForEach: () => {}, traffic: [],
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

// Objective visibility check: the Mamak plaza floor is not y=0 (its GLB/procedural floor sits at
// about +0.2, above the base city slab at -0.05 -- see src/contact-shadows.ts's floor-resolution
// comment), so a decal at the wrong height renders buried under the real floor mesh and a
// screenshot "looks fine" while showing nothing. This measures actual rendered luminance with the
// two contact-shadow meshes hidden vs shown, in the same frame, so "visible" is a number, not eyeballing.
async function dismissExploreTeaser(page: Page) {
  const dismiss = page.getByRole('button', {name: 'Dismiss exploration hint'});
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
}
async function setContactShadowsVisible(page: Page, visible: boolean) {
  await page.evaluate(v => {
    const scene = (window as any).__lepakScene;
    for (const name of ['contact-shadows-static', 'contact-shadows-dynamic']) { const mesh = scene.getObjectByName(name); if (mesh) mesh.visible = v; }
  }, visible);
  // One rendered frame with the new visibility before anything reads the canvas back.
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
/** The decal's own resolved world position (from its instance matrix, not a guess), so the
 * screen-space clip is centred on wherever the shadow actually is even if the floor fix regresses. */
async function decalPosition(page: Page, meshName: string, index: number) {
  return page.evaluate(async ([meshName, index]) => {
    // @ts-ignore Vite browser module.
    const THREE = await import('/node_modules/three/build/three.module.js');
    const mesh = (window as any).__lepakScene.getObjectByName(meshName as string);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    mesh.getMatrixAt(index as number, m); m.decompose(p, q, s);
    return {x: p.x, y: p.y, z: p.z};
  }, [meshName, index] as const);
}
async function screenPointForWorld(page: Page, world: {x: number; y: number; z: number}) {
  return page.evaluate(async ([wx, wy, wz]) => {
    // @ts-ignore Vite browser module.
    const THREE = await import('/node_modules/three/build/three.module.js');
    const v = new THREE.Vector3(wx as number, wy as number, wz as number).project((window as any).__lepak.camera);
    return {x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2, onScreen: v.z > -1 && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1};
  }, [world.x, world.y, world.z] as const);
}
async function screenClipForWorld(page: Page, world: {x: number; y: number; z: number}, size: number) {
  const point = await screenPointForWorld(page, world);
  const viewport = page.viewportSize()!;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max - size, Math.round(v - size / 2)));
  return {x: clamp(point.x, viewport.width), y: clamp(point.y, viewport.height), width: size, height: size};
}
/** meja-1..4's chairs sit close to spawn on the desktop 1280x800 frame, but the narrower mobile
 * frame (390x844, less horizontal field of view at the same vertical FOV) can push the same fixed
 * world point off to the side. Picking whichever chair actually projects nearest the centre of
 * (i.e. is genuinely visible on) this specific viewport keeps the test meaningful on both. One
 * evaluate call projects every candidate, rather than one round trip per chair. */
async function nearestVisibleChairIndex(page: Page): Promise<number> {
  return page.evaluate(async (points: {x: number; z: number}[]) => {
    // @ts-ignore Vite browser module.
    const THREE = await import('/node_modules/three/build/three.module.js');
    const camera = (window as any).__lepak.camera;
    let best = -1, bestDistance = Infinity;
    points.forEach((c, i) => {
      const v = new THREE.Vector3(c.x, 0, c.z).project(camera);
      if (v.z <= -1 || v.z >= 1 || Math.abs(v.x) >= 1 || Math.abs(v.y) >= 1) return;
      const sx = (v.x + 1) * innerWidth / 2, sy = (1 - v.y) * innerHeight / 2;
      const distance = Math.hypot(sx - innerWidth / 2, sy - innerHeight / 2);
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    });
    return best;
  }, chairs.map(c => ({x: c.x, z: c.z})));
}
// page.screenshot() goes through Chromium's compositor (like a real screen capture), unlike
// reading the WebGL canvas back with drawImage/getImageData, which came back all zeros here
// because the renderer does not set preserveDrawingBuffer (rightly -- that costs performance on
// every frame just to support this kind of readback). So the screenshot PNG is decoded instead,
// using the browser's own <img>.decode() rather than a hand-rolled PNG parser or a new dependency.
async function meanLuminance(page: Page, clip: {x: number; y: number; width: number; height: number}, path: string) {
  const buffer = await page.screenshot({clip, path});
  const base64 = buffer.toString('base64');
  return page.evaluate(async b64 => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
    return sum / (data.length / 4);
  }, base64);
}

async function measureVisibility(page: Page, label: string) {
  await dismissExploreTeaser(page);
  await page.waitForTimeout(2500);   // let the static floor round-robin (src/contact-shadows.ts) settle
  const chairIndex = await nearestVisibleChairIndex(page);
  expect(chairIndex).toBeGreaterThanOrEqual(0);   // spawn must actually see at least one chair
  const feetWorld = await decalPosition(page, 'contact-shadows-dynamic', 0);
  const chairWorld = await decalPosition(page, 'contact-shadows-static', chairIndex);
  // Tight around the decal's own centre: a wide clip dilutes the mean with untouched floor around
  // the soft gradient's edge, since the whole point is to sample where it is darkest.
  const feetClip = await screenClipForWorld(page, feetWorld, 34);
  const chairClip = await screenClipForWorld(page, chairWorld, 34);
  await setContactShadowsVisible(page, false);
  const feetOff = await meanLuminance(page, feetClip, `test-results-contact-shadows/shots/luminance-${label}-feet-off.png`);
  const chairOff = await meanLuminance(page, chairClip, `test-results-contact-shadows/shots/luminance-${label}-chair-off.png`);
  await setContactShadowsVisible(page, true);
  const feetOn = await meanLuminance(page, feetClip, `test-results-contact-shadows/shots/luminance-${label}-feet-on.png`);
  const chairOn = await meanLuminance(page, chairClip, `test-results-contact-shadows/shots/luminance-${label}-chair-on.png`);
  return {feetOff, feetOn, chairOff, chairOn, chairFloorY: chairWorld.y - .02};
}

test('desktop night: the shadow measurably darkens the floor under the feet and a chair', async ({page}) => {
  await setWeather(page, '2026-09-18T14:00:00Z', 'sunny');   // clear night: moonlight, alpha strong
  await enterAt(page, -33, 49);
  const m = await measureVisibility(page, 'night');
  console.log('[contact-shadows] desktop night luminance', m);
  expect(m.feetOn).toBeLessThanOrEqual(m.feetOff * .94);     // at least a 6% drop
  expect(m.chairOn).toBeLessThanOrEqual(m.chairOff * .94);
  // Resolved to the elevated mamak plaza floor (~0.2), not buried in the base city slab (-0.05).
  expect(m.chairFloorY).toBeGreaterThan(-0.03);
});

test('touch/mobile emulation, daytime: the shadow measurably darkens the floor under the feet and a chair', async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  const page = await context.newPage();
  await setWeather(page, '2026-09-18T04:00:00Z', 'sunny');   // daytime; touch means shadowsOn is false regardless
  await enterAt(page, -33, 49);
  await expect.poll(async () => (await page.evaluate(() => (window as any).__lepak.shadows))).toBe(false);
  const m = await measureVisibility(page, 'mobile');
  console.log('[contact-shadows] touch/mobile daytime luminance', m);
  expect(m.feetOn).toBeLessThanOrEqual(m.feetOff * .94);
  expect(m.chairOn).toBeLessThanOrEqual(m.chairOff * .94);
  expect(m.chairFloorY).toBeGreaterThan(-0.03);
  await context.close();
});
