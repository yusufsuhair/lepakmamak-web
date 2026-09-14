import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {gltfLoader} from './web-assets';

/** The generic two-storey shophouse rows (every shop()/retail() in world.ts that has no branded GLB),
 * built from the Blender kit in scripts/blender/build_shoplots.py. Each row is split into bays of
 * about 6.5 m; every bay gets the frame, an upper-floor variant, the shopfront and props for its trade,
 * and the row gets end walls and a lightbox behind its canvas sign. Everything is merged by material
 * into one mesh per material for the whole city, so the rows cost about a dozen draws.
 *
 * Paint is per building: node extras name a paint class and the vertex colours are multiplied by the
 * row's colour for that class. The render and tiles are projected in world space, so they run on across
 * bays, and the render shader lays rain streaks under the ledges and algae at the foot in world space.
 * At night the shop interiors, ceiling tubes, pendant lamps and about half the upper windows light up,
 * and additive pools of lamp light appear on the five-foot-way. Colliders, map footprints and the canvas
 * signs stay world.ts's. */
export const SHOPLOTS_URL = '/assets/models/environment/LM_ENV_Shoplots.glb?v=shoplots-v1';

export type ShoplotKind = 'eatery' | 'market' | 'diy' | 'laundry' | 'electric';
export interface Shoplot { x: number; z: number; width: number; facing: number; color: string; accent: string; signBg: string; kind: ShoplotKind }
export interface ShoplotSite { lots: Shoplot[]; fallback: THREE.Group; status: typeof shoplotStatus }

export const shoplotStatus = {state: 'loading' as 'loading' | 'ready' | 'fallback', bays: 0, draws: 0, triangles: 0, night: false, batches: {} as Record<string, number>};

const BAY = 6.5;
const SIGN_INSET = .1;
/** The awning colour world.ts gives a plain shop(); retail() replaces it with the brand. */
export const DEFAULT_ACCENT = '#c57552';
const TRIM = new THREE.Color('#f1e9d6'), BASE = new THREE.Color('#474a44'), SOFFIT = new THREE.Color('#cdc7b6'), INTERIOR = new THREE.Color('#aaa596');
const JOINERY = ['#3f5b45', '#3c6e6e', '#6b4a33', '#4d5f73', '#7a3b2e'];
const GRILLES = ['#e6e3d9', '#2c2e2d', '#56695b', '#e6e3d9'];
/** Window cells bright enough to read as a lit room: curtains, blinds, frosted glass, newspaper. */
const LIT_CELLS = [0, 1, 3, 4, 5, 7];
const UPPERS = ['upper_casement', 'upper_casement', 'upper_louvre', 'upper_sliding'];
const FRONTS: Record<ShoplotKind, string> = {eatery: 'front_open', market: 'front_open', electric: 'front_open', diy: 'front_glazed', laundry: 'front_glazed'};
/** Interior atlas cell offsets in glTF UV space: kopitiam, grocery, laundry, hardware. */
const INTERIOR_CELL: Record<ShoplotKind, [number, number]> = {eatery: [0, 0], market: [.5, 0], laundry: [0, .25], diy: [.5, .25], electric: [.5, .25]};

export function shoplotKind(label: string): ShoplotKind {
  if (/DOBI|LAUNDRY/.test(label)) return 'laundry';
  if (/KOPI|RESTORAN|WARUNG|MAKAN/.test(label)) return 'eatery';
  if (/ELEKTRIK/.test(label)) return 'electric';
  if (/DIY|PERKAKAS|HARDWARE/.test(label)) return 'diy';
  return 'market';
}

/** Stable 0..1 from a position and a salt, so rebuilds never reshuffle a street. */
function hash(x: number, z: number, salt: number) {
  const s = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

const night = {interiors: [] as THREE.MeshStandardMaterial[], windows: [] as THREE.MeshStandardMaterial[], lamps: [] as THREE.MeshStandardMaterial[], washes: [] as THREE.Mesh[]};

export function setShoplotNight(on: boolean) {
  shoplotStatus.night = on;
  for (const m of night.interiors) m.emissiveIntensity = on ? 1 : 0;
  for (const m of night.windows) m.emissiveIntensity = on ? 1.7 : 0;
  for (const m of night.lamps) m.emissiveIntensity = on ? 3.2 : .4;
  for (const w of night.washes) w.visible = on;
}

const GRIME = {
  vertex: ['varying vec3 vShopPos;\nvarying vec3 vShopNrm;\n', '#include <begin_vertex>\nvShopPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvShopNrm = normalize(mat3(modelMatrix) * objectNormal);'],
  fragment: /* glsl */`varying vec3 vShopPos;
varying vec3 vShopNrm;
float shopHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float shopNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(shopHash(i), shopHash(i + vec2(1, 0)), f.x), mix(shopHash(i + vec2(0, 1)), shopHash(i + vec2(1, 1)), f.x), f.y);
}
`,
  // Rain runs off the coping, the cornice and the sills and leaves dark streaks that fade downward;
  // splash-back and algae darken the foot of every wall. The ledge heights are the kit's.
  apply: /* glsl */`#include <color_fragment>
  {
    float along = abs(vShopNrm.x) > abs(vShopNrm.z) ? vShopPos.z : vShopPos.x;
    float y = vShopPos.y;
    float wall = 1. - smoothstep(.45, .75, abs(vShopNrm.y));
    float cols = shopNoise(vec2(along * 6.3, y * .45)) * .6 + shopNoise(vec2(along * 1.7 + 11., y * .16)) * .55;
    float streak = smoothstep(.42, .95, cols);
    float under = step(y, 10.62) * exp(-(10.62 - y) / 1.5) + step(y, 8.56) * exp(-(8.56 - y) / 2.2) * .8
      + step(y, 5.46) * exp(-(5.46 - y) / 1.1) * .45 + step(y, 3.3) * step(.6, y) * exp(-(3.3 - y) / 1.8) * .25;
    float algae = smoothstep(.35, .85, shopNoise(vec2(along * .9 + 5., y * 1.4)));
    float foot = 1. - smoothstep(.05, 1.25, y);
    float grime = clamp(streak * under * .62 + foot * (.25 + .4 * algae), 0., .72) * wall;
    float blotch = shopNoise(vec2(along * .21 + 3., y * .23)) * .7 + shopNoise(vec2(along * .7, y * .9)) * .3;
    diffuseColor.rgb *= (.9 + .16 * blotch) * mix(vec3(1.), vec3(.40, .43, .36), grime);
  }`,
};

function prepareRender(material: THREE.MeshStandardMaterial) {
  material.vertexColors = true;
  material.onBeforeCompile = shader => {
    shader.vertexShader = GRIME.vertex[0] + shader.vertexShader.replace('#include <begin_vertex>', GRIME.vertex[1]);
    shader.fragmentShader = GRIME.fragment + shader.fragmentShader.replace('#include <color_fragment>', GRIME.apply);
  };
  material.customProgramCacheKey = () => 'lm-shoplot-render-v1';
}

/** Box projection in world space, the same as proj() in build_shoplots.py (glTF v runs down). */
function projectUVs(geometry: THREE.BufferGeometry, tile: number) {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ny >= nx && ny >= nz) { u = p.getX(i); v = -p.getZ(i); }
    else if (nx >= nz) { u = n.getX(i) > 0 ? -p.getZ(i) : p.getZ(i); v = p.getY(i); }
    else { u = n.getZ(i) > 0 ? p.getX(i) : -p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / tile, -v / tile);
  }
}

interface Paint { wall: THREE.Color; shade: THREE.Color; trim: THREE.Color; base: THREE.Color; accent: THREE.Color; signbg: THREE.Color; joinery: THREE.Color; grille: THREE.Color }

function bayPaint(lot: Shoplot, bay: number): Paint {
  const wall = new THREE.Color(lot.color), hsl = {h: 0, s: 0, l: 0};
  wall.getHSL(hsl);
  // Owners repaint their own bay: the row keeps its colour, each bay drifts a little in tone.
  wall.setHSL(hsl.h + (hash(lot.x, lot.z, bay) - .5) * .02, hsl.s * (.9 + hash(lot.x, lot.z, bay + 9) * .2), hsl.l + (hash(lot.x, lot.z, bay + 3) - .5) * .05);
  return {
    wall, shade: wall.clone().multiplyScalar(.68), trim: wall.clone().lerp(TRIM, .6), base: wall.clone().lerp(BASE, .6),
    accent: new THREE.Color(lot.accent), signbg: new THREE.Color(lot.signBg),
    joinery: new THREE.Color(JOINERY[Math.floor(hash(lot.x, lot.z, bay + 21) * JOINERY.length)]),
    grille: new THREE.Color(GRILLES[Math.floor(hash(lot.x, lot.z, bay + 33) * GRILLES.length)]),
  };
}

function classColor(cls: string, paint: Paint) {
  switch (cls) {
    case 'wall': return paint.wall;
    case 'trim': return paint.trim;
    case 'base': return paint.base;
    case 'shade': return paint.shade;
    case 'soffit': return SOFFIT;
    case 'interior': return INTERIOR;
    case 'accent': return paint.accent;
    case 'signbg': return paint.signbg;
    case 'joinery': return paint.joinery;
    case 'grille': return paint.grille;
    default: return null;
  }
}

/** Build the merged rows from the loaded kit. */
function assembleShoplots(kit: THREE.Object3D, lots: Shoplot[]) {
  kit.updateMatrixWorld(true);
  const pieces = new Map<string, {mesh: THREE.Mesh; local: THREE.Matrix4}[]>();
  for (const name of ['frame', 'upper_casement', 'upper_louvre', 'upper_sliding', 'front_open', 'front_glazed', 'awning', 'end_l', 'end_r', 'sign', 'sign_cap_l', 'sign_cap_r',
    ...['eatery', 'market', 'diy', 'laundry', 'electric'].flatMap(kind => [`props_${kind}_0`, `props_${kind}_1`])]) {
    const node = kit.getObjectByName(name);
    if (!node) throw new Error(`Shoplot kit is missing ${name}`);
    const inverse = node.matrixWorld.clone().invert(), meshes: {mesh: THREE.Mesh; local: THREE.Matrix4}[] = [];
    node.traverse(o => { if (o instanceof THREE.Mesh) meshes.push({mesh: o, local: inverse.clone().multiply(o.matrixWorld)}); });
    pieces.set(name, meshes);
  }
  const batches = new Map<string, {material: THREE.Material; geometries: THREE.BufferGeometry[]}>();
  const matrix = new THREE.Matrix4(), place = new THREE.Matrix4(), tint = new THREE.Color();
  let bays = 0;

  const add = (piece: string, at: THREE.Matrix4, paint: Paint, lot: Shoplot, salt: number) => {
    for (const {mesh, local} of pieces.get(piece)!) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(matrix.multiplyMatrices(at, local));
      const cls = mesh.userData.lm_class as string, colour = classColor(cls, paint);
      const attr = geometry.getAttribute('color');
      if (colour && attr) for (let i = 0; i < attr.count; i++) {
        tint.setRGB(attr.getX(i), attr.getY(i), attr.getZ(i)).multiply(colour);
        attr.setXYZ(i, tint.r, tint.g, tint.b);
      }
      let key = piece.startsWith('props_') ? `${material.name} props` : material.name;
      const uv = geometry.getAttribute('uv');
      if (material.userData.tile) projectUVs(geometry, material.userData.tile);
      else if (key === 'Night shop interior') {
        const [du, dv] = INTERIOR_CELL[lot.kind];
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
      } else if (cls === 'glass') {
        const window = Number(mesh.userData.lm_window ?? 0), lit = hash(lot.x - salt, lot.z, window * 5 + 2) < .55;
        const pick = hash(lot.x + salt, lot.z, window * 7 + 1), cell = lit ? LIT_CELLS[Math.floor(pick * LIT_CELLS.length)] : Math.floor(pick * 8);
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + (cell % 4) * .25, uv.getY(i) + Math.floor(cell / 4) * .25);
        if (lit) key += ' lit';
      }
      if (!batches.has(key)) batches.set(key, {material, geometries: []});
      batches.get(key)!.geometries.push(geometry);
    }
  };

  for (const lot of lots) {
    const row = new THREE.Matrix4().makeRotationY(lot.facing).premultiply(new THREE.Matrix4().makeTranslation(lot.x, 0, lot.z));
    const count = Math.max(1, Math.round(lot.width / BAY)), width = lot.width / count;
    const branded = lot.accent !== DEFAULT_ACCENT;   // retail rows carry their brand on every bay's awning
    for (let i = 0; i < count; i++) {
      const paint = bayPaint(lot, i), salt = i * 3.17;
      place.makeTranslation(-lot.width / 2 + width * (i + .5), 0, 0).multiply(new THREE.Matrix4().makeScale(width / BAY, 1, 1)).premultiply(row);
      add('frame', place, paint, lot, salt);
      add(UPPERS[Math.floor(hash(lot.x, lot.z, i + 41) * UPPERS.length)], place, paint, lot, salt);
      add(FRONTS[lot.kind], place, paint, lot, salt);
      add(`props_${lot.kind}_${(i + Math.floor(hash(lot.x, lot.z, 51) * 2)) % 2}`, place, paint, lot, salt);
      if (branded || hash(lot.x, lot.z, i + 61) < .55) add('awning', place, paint, lot, salt);
      bays++;
    }
    const first = bayPaint(lot, 0), last = bayPaint(lot, count - 1), span = lot.width - SIGN_INSET;
    add('end_l', new THREE.Matrix4().makeTranslation(-lot.width / 2, 0, 0).premultiply(row), first, lot, 0);
    add('end_r', new THREE.Matrix4().makeTranslation(lot.width / 2, 0, 0).premultiply(row), last, lot, 0);
    add('sign', new THREE.Matrix4().makeScale(span, 1, 1).premultiply(row), first, lot, 0);
    add('sign_cap_l', new THREE.Matrix4().makeTranslation(-span / 2, 0, 0).premultiply(row), first, lot, 0);
    add('sign_cap_r', new THREE.Matrix4().makeTranslation(span / 2, 0, 0).premultiply(row), first, lot, 0);
  }

  const group = new THREE.Group(); group.name = 'LM_ENV_Shoplots';
  night.interiors.length = night.windows.length = night.lamps.length = night.washes.length = 0;
  let triangles = 0;
  for (const [key, {material: source, geometries}] of batches) {
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) throw new Error(`Shoplot batch ${key} would not merge`);
    const material = key.endsWith(' lit') ? source.clone() as THREE.MeshStandardMaterial : source as THREE.MeshStandardMaterial;
    const props = key.endsWith(' props');
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `shoplots | ${key}`; mesh.receiveShadow = true;
    // Props sit in the shade of the arcade: drawing them into the shadow map buys nothing.
    mesh.castShadow = !props && !/^Night|glass|tiles/.test(key);
    for (const t of [material.map, material.normalMap]) if (t) t.anisotropy = 8;
    if (key === 'Shoplot render') prepareRender(material);
    else if (key.startsWith('Shoplot fixtures')) material.vertexColors = true;
    else if (key === 'Night shop interior') { material.emissiveMap = material.map; material.emissive.set('#ffe7c7'); night.interiors.push(material); }
    else if (key === 'Night window glass') { material.emissiveIntensity = 0; }
    else if (key === 'Night window glass lit') { material.emissiveMap = material.map; material.emissive.set('#ffd49a'); night.windows.push(material); }
    else if (key === 'Night lamp') night.lamps.push(material);
    else if (key === 'Night wash') {
      // Light, not paint: the pool texture becomes additive emission over black.
      material.emissiveMap = material.map; material.map = null; material.color.setRGB(0, 0, 0);
      material.emissive.set('#ffb867'); material.emissiveIntensity = 1.25;
      Object.assign(material, {blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
      mesh.renderOrder = 2; night.washes.push(mesh);
    } else if (key === 'Shoplot shopfront glass') { material.depthWrite = false; mesh.renderOrder = 1; }
    material.needsUpdate = true;
    const tris = (merged.index ? merged.index.count : merged.getAttribute('position').count) / 3;
    triangles += tris; shoplotStatus.batches[key] = tris;
    group.add(mesh);
  }
  Object.assign(shoplotStatus, {bays, draws: group.children.length, triangles});
  setShoplotNight(shoplotStatus.night);
  return group;
}

/** Swap the procedural rows for the kit once it loads. The canvas signs (MeshBasicMaterial) stay. */
export function loadShoplots(fallback: THREE.Group, lots: Shoplot[]): ShoplotSite {
  shoplotStatus.state = 'loading';
  void gltfLoader.loadAsync(SHOPLOTS_URL).then(gltf => {
    const rows = assembleShoplots(gltf.scene, lots);
    for (const child of [...fallback.children]) {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) continue;
      child.removeFromParent();
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    fallback.add(rows);
    shoplotStatus.state = 'ready';
  }).catch(error => { shoplotStatus.state = 'fallback'; console.warn('[SHOPLOTS] keeping procedural shophouses', error); });
  return {lots, fallback, status: shoplotStatus};
}
