import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {cdnUrl} from './cdn';
import {onSkyProbe} from './weather';

/** The Blender PETRONAS Twin Towers (scripts/blender/build_klcc.py). Glass and stainless reflect the
 * shared sky probe (weather.ts onSkyProbe: the current palette, sun and weather) as their own envMap,
 * which always wins over the scene.environment sky-ibl.ts sets for everything else on High graphics
 * quality, so this reflection is unchanged by that feature; at night the curtain wall's emissive mask
 * lights a random spread of windows and the floodlit steel, and the pinnacles glow brightest, the way
 * the real towers read after dark. */
// Served from R2 with brotli (1.17 MB meshopt -> 0.33 MB on the wire): it loads on the landing screen.
export const KLCC_URL = cdnUrl('assets/models/environment/LM_ENV_KLCC.glb');
export const klccStatus = {state: 'loading' as 'loading' | 'ready' | 'fallback', night: false};

const nightUniform = {value: 0};
const lit: {material: THREE.MeshStandardMaterial; colour: string; intensity: number}[] = [];
const reflective: THREE.MeshStandardMaterial[] = [];

function applyNight() {
  const night = klccStatus.night;
  nightUniform.value = night ? 1 : 0;
  for (const {material, colour, intensity} of lit) {
    material.emissive.set(night ? colour : '#000000'); material.emissiveIntensity = night ? intensity : 1;
  }
}

export function setKlccNight(night: boolean) { klccStatus.night = night; applyNight(); }

export function loadKlcc(group: THREE.Group) {
  void new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(KLCC_URL).then(gltf => {
    gltf.scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = o.receiveShadow = true;
      const m = o.material as THREE.MeshStandardMaterial;
      for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = 8;
      if (m.name === 'KLCC podium granite') return;
      m.envMapIntensity = 1; reflective.push(m);
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
    // The glass follows the one sky (weather.ts): a new probe only when the sky visibly changes.
    onSkyProbe(texture => { for (const m of reflective) m.envMap = texture; });
    for (const child of [...group.children]) child.removeFromParent();
    group.add(gltf.scene);
    klccStatus.state = 'ready';
  }).catch(error => { klccStatus.state = 'fallback'; console.warn('[KLCC] keeping procedural towers', error); });
}
