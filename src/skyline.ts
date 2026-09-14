import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {cdnUrl} from './cdn';
import {onSkyProbe} from './weather';

/** The Blender KL skyline (scripts/blender/build_skyline.py): The Exchange 106, Merdeka 118, Menara KL
 * and the four city towers. Each GLB replaces its procedural stand-in, keeping the game's canvas name
 * signs. Like the KLCC set, glass and metal reflect the shared sky probe (weather.ts onSkyProbe), never
 * scene.environment. At night each facade's emissive mask becomes lit windows (a hash of bay and storey)
 * and floodlit frames, the crowns, spires and Menara KL glow, and the aviation lights come on. */
export const SKYLINE_ASSETS = ['LM_ENV_TRX', 'LM_ENV_Merdeka118', 'LM_ENV_KLTower', 'LM_ENV_TowerUOB', 'LM_ENV_TowerHSBC', 'LM_ENV_TowerDAP', 'LM_ENV_TowerMahkota'] as const;
export type SkylineAsset = typeof SKYLINE_ASSETS[number];
export const skylineStatus = {night: false, towers: {} as Partial<Record<SkylineAsset, 'loading' | 'ready' | 'fallback'>>};

/** Night looks for the facade materials (the names are the contract with the builder): hash cells per
 * texture tile (bays, storeys), the share of windows lit, the share of lit runs that are warm rather than
 * cool, how bright the lit glass is, and the floodlight on the mask's frame channel. */
const FACADES: Record<string, {cells: [number, number]; lit: number; warm: number; boost: number; frame: string; glow: number}> = {
  'TRX curtain wall': {cells: [8, 8], lit: .26, warm: .45, boost: 1, frame: '#cfe0ff', glow: .08},
  'TRX crown': {cells: [8, 8], lit: .6, warm: 0, boost: 1, frame: '#dfeaff', glow: 1.4},
  'Merdeka 118 curtain wall': {cells: [8, 8], lit: .24, warm: .4, boost: 1, frame: '#d6e6ff', glow: .1},
  'KL Tower pod': {cells: [12, 4], lit: 1, warm: .1, boost: 1.7, frame: '#eef3ff', glow: .9},
  'KL Tower deck glass': {cells: [16, 1], lit: 1, warm: .85, boost: 2.1, frame: '#fff1d8', glow: .35},
  'UOB curtain wall': {cells: [4, 4], lit: .36, warm: .3, boost: 1, frame: '#dfe8f0', glow: .04},
  'HSBC granite wall': {cells: [4, 4], lit: .3, warm: .55, boost: 1, frame: '#000000', glow: 0},
  'Pusat Komuniti wall': {cells: [4, 4], lit: .26, warm: .1, boost: 1, frame: '#000000', glow: 0},
  'Hotel Mahkota wall': {cells: [4, 4], lit: .55, warm: .95, boost: 1.1, frame: '#ffd9a0', glow: .05},
};
/** Flat night glows: [colour, intensity]. Textured ones glow with their own streaks. */
const GLOWS: Record<string, [string, number]> = {
  'Merdeka 118 facet frame': ['#cfe2ff', 1.1], 'Merdeka 118 spire': ['#f2f6ff', 1.5],
  'KL Tower concrete': ['#9fb0f0', .45], 'KL Tower mast': ['#f4f6ff', 1.3], 'Hotel Mahkota gold': ['#ffc873', .75],
};

const nightUniform = {value: 0};
const reflective: THREE.MeshStandardMaterial[] = [];
const glows: {material: THREE.MeshStandardMaterial; colour: string; intensity: number}[] = [];
const beacons: THREE.Sprite[] = [];
const textures = new Map<string, THREE.Texture>();
let beaconMaterial: THREE.SpriteMaterial | null = null, probe: THREE.Texture | null = null;

function beacon() {
  if (!beaconMaterial) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!, g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,235,225,1)'); g.addColorStop(.18, 'rgba(255,60,40,.95)'); g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    beaconMaterial = new THREE.SpriteMaterial({map, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false});
  }
}

/** One GPU copy of a texture the towers share (the aluminium, the podium granite). */
function share(texture: THREE.Texture | null) {
  if (!texture?.name) return texture;
  const key = `${texture.name}|${texture.colorSpace}`, known = textures.get(key);
  if (known && known !== texture) { texture.dispose(); return known; }
  texture.anisotropy = 8; textures.set(key, texture); return texture;
}

function lightFacade(material: THREE.MeshStandardMaterial, look: typeof FACADES[string]) {
  const uniforms = {skylineNight: nightUniform, skylineCells: {value: new THREE.Vector2(...look.cells)}, skylineLit: {value: look.lit}, skylineBoost: {value: look.boost},
    skylineWarm: {value: look.warm}, skylineFrame: {value: new THREE.Color(look.frame).multiplyScalar(look.glow)}};
  // The emissive map is a mask, not a colour: R marks glass, lit in runs of three bays picked by a hash of
  // the bay and storey the world-metre UVs name; G marks the frames a facade floodlights.
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = 'uniform float skylineNight;\nuniform vec2 skylineCells;\nuniform float skylineLit;\nuniform float skylineBoost;\nuniform float skylineWarm;\nuniform vec3 skylineFrame;\n' +
      shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      vec4 skyMask = texture2D( emissiveMap, vEmissiveMapUv );
      vec2 skyCell = floor( vEmissiveMapUv * skylineCells );
      float skyRun = fract( sin( dot( vec2( floor( skyCell.x / 3.0 ), skyCell.y ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
      float skyOne = fract( sin( dot( skyCell, vec2( 39.3468, 11.135 ) ) ) * 24634.6345 );
      float skyOn = step( 1.0 - skylineLit, skyRun ) * ( .55 + .45 * skyOne );
      vec3 skyTone = mix( vec3( .82, .9, 1.0 ), vec3( 1.0, .8, .56 ), step( fract( skyRun * 3.71 ), skylineWarm ) );
      totalEmissiveRadiance = skylineNight * ( skyMask.r * skylineBoost * ( skyOn * skyTone * .75 + vec3( .04, .055, .08 ) ) + skyMask.g * skylineFrame );`);
  };
  material.customProgramCacheKey = () => 'skyline-facade';
}

function applyNight() {
  const night = skylineStatus.night;
  nightUniform.value = night ? 1 : 0;
  for (const {material, colour, intensity} of glows) { material.emissive.set(night ? colour : '#000000'); material.emissiveIntensity = night ? intensity : 1; }
  for (const beacon of beacons) beacon.visible = night;
}

export function setSkylineNight(night: boolean) { skylineStatus.night = night; applyNight(); }

/** Swap a tower's procedural stand-in for its GLB, keeping the canvas name signs (MeshBasicMaterial).
 * The seven GLBs load at world creation, so they come from R2 with brotli (643 KB -> 384 KB). */
export function loadSkylineTower(holder: THREE.Object3D, asset: SkylineAsset) {
  skylineStatus.towers[asset] = 'loading';
  void new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(cdnUrl(`assets/models/environment/${asset}.glb`)).then(gltf => {
    beacon();
    const lights: THREE.Object3D[] = [];
    gltf.scene.traverse(o => {
      if (o.name.startsWith('aviation_light')) { lights.push(o); return; }
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = o.receiveShadow = true;
      const m = o.material as THREE.MeshStandardMaterial;
      m.map = share(m.map); m.normalMap = share(m.normalMap); m.roughnessMap = share(m.roughnessMap); m.metalnessMap = share(m.metalnessMap);
      reflective.push(m);
      const look = FACADES[m.name], glow = GLOWS[m.name];
      if (look) { m.side = THREE.FrontSide; lightFacade(m, look); }
      else if (glow) { m.emissiveMap = m.map; glows.push({material: m, colour: glow[0], intensity: glow[1]}); }
    });
    for (const light of lights) {
      const beacon = new THREE.Sprite(beaconMaterial!); beacon.scale.setScalar(2.6); beacon.name = 'aviation glow';
      light.add(beacon); beacons.push(beacon);
    }
    for (const child of [...holder.children]) if (!(child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial)) child.removeFromParent();
    holder.add(gltf.scene);
    skylineStatus.towers[asset] = 'ready';
    applyNight();
    // Every tower shares the one sky probe (weather.ts), repainted only when the sky visibly changes.
    if (!probe) onSkyProbe(texture => { probe = texture; for (const material of reflective) material.envMap = texture; });
    for (const material of reflective) material.envMap = probe;
  }).catch(error => { skylineStatus.towers[asset] = 'fallback'; console.warn(`[SKYLINE] keeping procedural ${asset}`, error); });
}
