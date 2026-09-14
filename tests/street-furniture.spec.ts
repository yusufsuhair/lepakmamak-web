import {test, expect} from '@playwright/test';

// The photographic street furniture is a skin: the Blender lamp swaps into the same five lamp
// meshes, the furniture set instances its signals and shelters without a collider, the lamp and
// map data the game reads stay put, and night lights the lamps, lenses and adverts.
test('photographic lamps and street furniture swap in without moving anything the game reads', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (/keeping procedural|Couldn't load texture|Shader Error|WebGLProgram/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  await page.route('**/furniture-harness', r => r.fulfill({contentType: 'text/html', body: '<div id="hud"></div>'}));
  await page.goto('/furniture-harness');
  const state = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const {createWorld, createStreetLights} = await import('/src/world.ts');
    // The world's own brands module instance (Vite may add ?t= after an edit), so night reaches its materials.
    const brandsUrl = ((await (await fetch('/src/world.ts')).text()).match(/from\s*["'](\/src\/brands\.ts[^"']*)["']/) || [])[1] || '/src/brands.ts';
    const {setBrandsNight} = await import(/* @vite-ignore */ brandsUrl);
    const {BUS_STOPS, JUNCTIONS} = await import('/src/street-furniture.ts');
    const {ROAD_X, ROAD_Z, ROAD_HALF} = await import('/src/ground.ts');
    const scene = new THREE.Scene();
    const world = createWorld(scene);
    const count = world.solids.length, before = JSON.stringify({solids: world.solids, map: world.mapBuildings});
    const lights = createStreetLights(scene, world.solids);
    const lampsBefore = JSON.stringify(lights.lamps);
    const furniture = world.group.getObjectByName('street-furniture')!;
    const meshes = lights.group.children as any[];
    for (let i = 0; i < 400 && !(furniture.getObjectByName('furniture') && meshes[0].material.name === 'Satin metal'); i++) await new Promise(r => setTimeout(r, 50));
    const instanced: Record<string, number> = {};
    furniture.traverse((o: any) => { if (o.isInstancedMesh) instanced[o.name] = o.count; });
    const canvasSigns = furniture.children.filter((o: any) => o.isMesh && o.material.isMeshBasicMaterial).length;
    const glowAt = (index: number) => { const m = new THREE.Matrix4(); meshes[4].getMatrixAt(index, m); return m.determinant() !== 0; };
    const avenue = meshes[4].count - 1;
    const day = {lamp: lights.lit(0), avenue: glowAt(avenue)};
    lights.setNight(true);
    const night = {lamp: lights.lit(0), avenue: glowAt(avenue)};
    let lens: any; furniture.traverse((o: any) => { if (o.isInstancedMesh && o.material.name === 'Night glow LED') lens = o; });
    setBrandsNight(false); const lensDay = lens?.material.emissiveIntensity;
    setBrandsNight(true); const lensNight = lens?.material.emissiveIntensity;
    lights.setNight(false); setBrandsNight(false);
    let realLights = 0; scene.traverse((o: any) => { if (o.isLight) realLights++; });
    const onRoad = (x: number, z: number, r: number) => ROAD_X.some(rx => Math.abs(x - rx) < ROAD_HALF + r) || ROAD_Z.some(rz => Math.abs(z - rz) < ROAD_HALF + r);
    const blocked = (x: number, z: number, r: number) => world.solids.some((s: any) => Math.abs(x - s.x) < s.hx + r && Math.abs(z - s.z) < s.hz + r);
    const poles = JUNCTIONS.flatMap(j => [[-10.5, 10], [10.5, -10], [-10.5, -10], [10.5, 10]].map(([dx, dz]) => ({x: j.x + dx, z: j.z + dz})));
    return {
      unchanged: before === JSON.stringify({solids: world.solids.slice(0, count), map: world.mapBuildings}),
      lampSolids: world.solids.length - count === lights.lamps.length, lampsSame: lampsBefore === JSON.stringify(lights.lamps),
      lampMeshes: meshes.length, body: meshes[0].material.name, lens: meshes[1].material.name, litTextured: !!meshes[2].material.emissiveMap,
      instanced, canvasSigns, day, night, lensDay, lensNight, realLights,
      stopsClear: BUS_STOPS.every(s => !onRoad(s.x, s.z, 1.2) && !blocked(s.x, s.z, 1.2)),
      polesClear: poles.every(p => !onRoad(p.x, p.z, .5) && !world.solids.some((s: any) => Math.abs(p.x - s.x) < s.hx && Math.abs(p.z - s.z) < s.hz)),
      junctions: JUNCTIONS.length, stops: BUS_STOPS.length,
    };
  });
  // The world's colliders and map are untouched; the lamps add only their own posts, as before.
  expect(state).toMatchObject({unchanged: true, lampSolids: true, lampsSame: true, lampMeshes: 5, body: 'Satin metal', lens: 'Lamp LED lens', litTextured: true, realLights: 0, stopsClear: true, polesClear: true});
  expect(state.day).toEqual({lamp: false, avenue: false});
  expect(state.night).toEqual({lamp: true, avenue: true});
  expect(state.lensNight).toBeGreaterThan(state.lensDay);
  // One instanced draw per prototype material, however many junctions and shelters there are.
  expect(state.instanced).toMatchObject({
    junction_Satin_metal: state.junctions, junction_Street_powder_coat: state.junctions, junction_Street_concrete: state.junctions,
    junction_lens_ns_go_Night_glow_LED: 5, junction_lens_ns_stop_Night_glow_LED: 4,
    bus_stop_Street_powder_coat: state.stops, bus_stop_Road_signs: state.stops, bus_stop_Night_glow_menu_advert: state.stops,
  });
  // JALAN LEPAK and KLCC ↑ stay the game's canvas; the flag prints its own crescent.
  expect(state.canvasSigns).toBe(2);
  expect(errors).toEqual([]);
});
