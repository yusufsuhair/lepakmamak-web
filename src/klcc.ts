import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

/** The Blender PETRONAS Twin Towers (scripts/blender/build_klcc.py). Glass and stainless reflect a
 * small painted sky of their own, never scene.environment, so no other asset changes; at night the
 * curtain wall's emissive mask lights a random spread of windows and the floodlit steel, and the
 * pinnacles glow brightest, the way the real towers read after dark. */
export const KLCC_URL = '/assets/models/environment/LM_ENV_KLCC.glb?v=klcc-v2';
export const klccStatus = {state: 'loading' as 'loading' | 'ready' | 'fallback', night: false};

const nightUniform = {value: 0};
const lit: {material: THREE.MeshStandardMaterial; colour: string; intensity: number}[] = [];
const envs: Record<'day' | 'night', THREE.Texture | null> = {day: null, night: null};

/** Equirectangular sky, row 0 straight up. Stops are [elevation in degrees, sRGB]. */
function paintSky(stops: [number, string][], glow?: {azimuth: number; elevation: number; colour: string}) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  for (const [elevation, colour] of stops) gradient.addColorStop((90 - elevation) / 180, colour);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 128);
  if (glow) {
    const x = (glow.azimuth / 360 + .5) * 256, y = (90 - glow.elevation) / 180 * 128;
    for (const dx of [-256, 0, 256]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, 70); g.addColorStop(0, glow.colour); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function skies() {
  // The city sun sits at (-70, 110, 60): azimuth atan2(60, -70), 48 degrees up.
  envs.day ??= paintSky([[90, '#4c7fbd'], [35, '#8bb7da'], [8, '#d4e3e8'], [0, '#e6ebe8'], [-8, '#b9bdb9'], [-90, '#7d8480']],
    {azimuth: Math.atan2(60, -70) * 180 / Math.PI, elevation: 48, colour: 'rgba(255,246,222,.85)'});
  envs.night ??= paintSky([[90, '#070d18'], [30, '#101b2c'], [4, '#26314a'], [0, '#4a4038'], [-6, '#2a2622'], [-90, '#0b0d10']]);
}

function applyNight() {
  const night = klccStatus.night;
  nightUniform.value = night ? 1 : 0;
  for (const {material, colour, intensity} of lit) {
    material.envMap = night ? envs.night : envs.day;
    material.emissive.set(night ? colour : '#000000'); material.emissiveIntensity = night ? intensity : 1;
  }
}

export function setKlccNight(night: boolean) { klccStatus.night = night; applyNight(); }

export function loadKlcc(group: THREE.Group) {
  void new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(KLCC_URL).then(gltf => {
    skies();
    gltf.scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = o.receiveShadow = true;
      const m = o.material as THREE.MeshStandardMaterial;
      for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = 8;
      if (m.name === 'KLCC podium granite') return;
      m.envMap = envs.day; m.envMapIntensity = 1;
      if (m.name === 'KLCC curtain wall') {
        m.side = THREE.FrontSide;
        lit.push({material: m, colour: '#ffffff', intensity: 1});
        // The emissive map is a mask, not a colour: R marks glass, lit in runs of three panes picked by
        // a hash of the pane and storey the UVs name; G marks the floodlit mullions and spandrels.
        m.onBeforeCompile = shader => {
          shader.uniforms.klccNight = nightUniform;
          shader.fragmentShader = 'uniform float klccNight;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>', `
            vec4 klccMask = texture2D( emissiveMap, vEmissiveMapUv );
            vec2 klccPane = floor( vEmissiveMapUv * vec2( 8.0, 8.0 ) );
            float klccRun = fract( sin( dot( vec2( floor( klccPane.x / 3.0 ), klccPane.y ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
            float klccOne = fract( sin( dot( klccPane, vec2( 39.3468, 11.135 ) ) ) * 24634.6345 );
            float klccOn = step( .7, klccRun ) * ( .5 + .5 * klccOne );
            vec3 klccWarm = mix( vec3( 1.0, .82, .6 ), vec3( .85, .92, 1.0 ), step( .6, fract( klccRun * 3.71 ) ) );
            totalEmissiveRadiance = klccNight * ( klccMask.r * ( klccOn * klccWarm * .7 + vec3( .06, .08, .11 ) ) + klccMask.g * vec3( .62, .68, .8 ) * .45 );`);
        };
      } else {
        m.emissiveMap = m.map;   // the floodlit glow keeps the brushed streaks
        lit.push({material: m, colour: m.name === 'KLCC pinnacle steel' ? '#f2f5ff' : '#b9c4d6', intensity: m.name === 'KLCC pinnacle steel' ? 1.6 : .7});
      }
    });
    applyNight();
    for (const child of [...group.children]) child.removeFromParent();
    group.add(gltf.scene);
    klccStatus.state = 'ready';
  }).catch(error => { klccStatus.state = 'fallback'; console.warn('[KLCC] keeping procedural towers', error); });
}
