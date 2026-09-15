import * as THREE from 'three';
import { MeshoptDecoder } from 'meshoptimizer';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {addVehicleLevel, currentVehicleEnvironment, trackVehicleMaterial} from './vehicle-presentation';
import {cdnUrl, type CdnFile} from './cdn';

/** Deliberately excludes both owner Porsches; they never enter this asset pipeline. */
export const vehicleCatalog = {
  axia: {name: 'Perodua Axia AV', width: 1.665, length: 3.760},
  myvi: {name: 'Perodua Myvi AV', width: 1.735, length: 3.895},
  emas: {name: 'Proton e.MAS 7', width: 1.901, length: 4.615},
  avanza: {name: 'Toyota Avanza', width: 1.730, length: 4.395},
  vellfire: {name: 'Toyota Vellfire', width: 1.850, length: 4.995},
  suv: {name: 'Lepak SUV', width: 1.860, length: 4.480},
  sport: {name: 'Lepak GT Coupe', width: 1.860, length: 4.380},
  ferrari: {name: 'Ferrari inspired berlinetta', width: 1.950, length: 4.560},
  lamborghini: {name: 'Lamborghini Aventador SVJ', width: 2.098, length: 4.943},
  'model-y': {name: 'Tesla Model Y', width: 1.920, length: 4.790},
  cybertruck: {name: 'Tesla Cybertruck', width: 2.032, length: 5.683},
  police: {name: 'Polis Malaysia Patrol', width: 1.860, length: 4.480},
  f1: {name: 'Lepak Formula', width: 2.000, length: 5.150},
} as const;
export type RevampedCarStyle = keyof typeof vehicleCatalog;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const templates = new Map<string, Promise<THREE.Group>>();
const wheelNames = ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'] as const;
const cabinHeights: Record<RevampedCarStyle, number> = {axia:1.505,myvi:1.515,emas:1.67,avanza:1.7,vellfire:1.935,suv:1.69,sport:1.3,ferrari:1.21,lamborghini:1.136,'model-y':1.624,cybertruck:1.79,police:1.69,f1:1.12};
const VERSION = 'vehicles-v3';
interface SharedTextures {color: THREE.Texture; normal: THREE.Texture; orm: THREE.Texture; flake: THREE.Texture}
let shared: Promise<SharedTextures | null> | undefined;
/** One colour/normal/ORM atlas for every trim, alloy, tyre, rotor, plate, badge and lamp lens in the fleet,
 * plus the tiling paint flake, loaded once (art/blender/vehicles/vehicle_textures.py). The GLBs carry 4 px
 * stand-ins, so thirteen styles and three detail levels share these four GPU textures. */
function sharedTextures(): Promise<SharedTextures | null> {
  return shared ??= Promise.all(['atlas-color', 'atlas-normal', 'atlas-orm', 'paint-flake'].map(name =>
    new THREE.TextureLoader().loadAsync(`/assets/textures/vehicles/${name}.webp?v=${VERSION}`))).then(([color, normal, orm, flake]) => {
    color.colorSpace = THREE.SRGBColorSpace;
    for (const texture of [color, normal, orm, flake]) { texture.flipY = false; texture.anisotropy = 4; }
    flake.wrapS = flake.wrapT = THREE.RepeatWrapping;
    return {color, normal, orm, flake};
  }).catch(() => null);
}
/** A clone shares the loaded image and its GPU upload, and keeps the glTF slot's KHR_texture_transform:
 * gltfpack uses it to dequantise the UVs. `scale` tiles the texture within that transform. */
function adopt(slot: THREE.Texture | null, texture: THREE.Texture, scale = 1) {
  const next = texture.clone();
  if (slot) {
    next.offset.copy(slot.offset).multiplyScalar(scale); next.repeat.copy(slot.repeat).multiplyScalar(scale);
    next.rotation = slot.rotation; next.center.copy(slot.center); next.channel = slot.channel; slot.dispose();
  }
  return next;
}
const dirt = {value: 1};
/** Road dust on the sills, bumpers and wheels of traffic; the showroom sets 0 for clean cars. */
export function setVehicleDirt(amount: number) { dirt.value = amount; }
function dusty(material: THREE.MeshStandardMaterial) {
  // World height above the road, so the grime sits on the lower body at every detail level.
  material.onBeforeCompile = shader => {
    shader.uniforms.vehicleDirt = dirt;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vDirtHeight;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDirtHeight = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float vehicleDirt;\nvarying float vDirtHeight;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat dirt = vehicleDirt * smoothstep(.66, .12, vDirtHeight);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(.36, .31, .25), dirt * .42);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .9, dirt * .75);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1. - dirt * .55;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1. - dirt * .85;\n#endif');
  };
  material.customProgramCacheKey = () => 'vehicle-dirt';
}
const lampNames = /Red LED|White LED|Indicator |Reverse optics|Police blue LED/;
function dress(material: THREE.MeshStandardMaterial, textures: SharedTextures | null, near: boolean) {
  const name = material.name;
  if (name === 'Vehicle detail atlas') {
    if (textures) {
      material.map = adopt(material.map, textures.color);
      material.roughnessMap = material.metalnessMap = material.aoMap = adopt(material.roughnessMap ?? material.map, textures.orm);
      material.normalMap = adopt(material.normalMap, textures.normal);
      material.roughness = material.metalness = 1;
    } else {
      material.map = material.roughnessMap = material.metalnessMap = material.normalMap = null;
      material.color.set('#1b1e22'); material.roughness = .55; material.metalness = .2;
    }
    dusty(material);
  } else if (lampNames.test(name)) {
    // The lens cell doubles as the emissive map, so LED rows and reflector edges stay legible at night.
    material.map = material.emissiveMap = textures ? adopt(material.map, textures.color) : null;
    // An unlit lens reads as tinted plastic, not as a lamp already on; the police bar keeps its blue.
    material.color.set(name === 'Police blue LED' ? '#2f62e0' : '#8c8c8c');
  } else if (name === 'Automotive clearcoat' && material instanceof THREE.MeshPhysicalMaterial) {
    // Metallic base under a mirror-smooth coat: the coat carries the fresnel reflection, the flake the
    // sparkle (near level only; 5 cm tiles that mip away to plain metallic with distance).
    material.normalMap = near && textures && material.normalMap ? adopt(material.normalMap, textures.flake, 20) : null;
    if (!material.roughnessMap) { material.metalness = .45; material.roughness = .42; }
    material.clearcoat = 1; material.clearcoatRoughness = .04;
    dusty(material);
  } else if (name === 'Solar glass') {
    material.color.set('#0a0f12'); material.metalness = 0; material.roughness = .03;
    material.transparent = true; material.opacity = .8; material.depthWrite = false; material.side = THREE.DoubleSide;
  }
}

async function template(style: RevampedCarStyle, level = '') {
  const key = style + level;
  let pending = templates.get(key);
  if (!pending) {
    // R2 + brotli: all 39 levels load on entry, 4.7 MB on Pages, 2.0 MB from R2.
    pending = Promise.all([loader.loadAsync(cdnUrl(`assets/models/vehicles/${key}.glb` as CdnFile)), sharedTextures()]).then(([gltf, textures]) => {
      for (const name of wheelNames) {
        if (!gltf.scene.getObjectByName(name)) throw new Error(`${style}: missing ${name}`);
      }
      const dressed = new Set<THREE.Material>();
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        // The painted shell and the tyres make the shadow; the atlas chassis (interior, grilles, sills) only
        // adds shadow-pass triangles, except on the open-wheel Formula car where it is the wings and floor.
        let wheel = false;
        for (let parent = object.parent; parent && !wheel; parent = parent.parent) wheel = parent.name.startsWith('wheel_');
        object.castShadow = materials.some(m => m.name === 'Automotive clearcoat' || (m.name === 'Vehicle detail atlas' && (wheel || style === 'f1')));
        object.receiveShadow = true;
        for (const source of materials) if (source instanceof THREE.MeshStandardMaterial && !dressed.has(source)) {
          dressed.add(source); dress(source, textures, !level);
          source.envMap = currentVehicleEnvironment(); source.envMapIntensity = source.name === 'Solar glass' ? 1.5 : 1;
          trackVehicleMaterial(source);
        }
      });
      return gltf.scene;
    }).catch(error => { templates.delete(key); throw error; });
    templates.set(key, pending);
  }
  return pending;
}

export interface VehicleModel {group: THREE.Group; wheels: THREE.Group[]; driver: THREE.Group}

/** Keep the synchronous driving API while replacing its visual shell atomically.
 * Position, driver visibility, network ID and the original wheel array retain identity.
 * Network/GLB failure leaves a complete driveable procedural car in place.
 */
export async function upgradeVehicle(model: VehicleModel, style: RevampedCarStyle): Promise<boolean> {
  const spec = vehicleCatalog[style];
  model.group.userData.model = style;
  model.group.userData.displayName = spec.name;
  model.group.userData.assetState = 'loading';
  model.group.userData.vehicleFootprint = {width: spec.width + .4, length: spec.length + .2};
  const fallback = model.group.children.filter(child => child !== model.driver);
  try {
    const visual = (await template(style)).clone(true);
    visual.name = `vehicle-${style}-blender`;
    const wheels = wheelNames.map(name => visual.getObjectByName(name) as THREE.Group);
    // Preserve spin phase when a GLB finishes downloading during a drive.
    wheels.forEach((wheel, i) => { wheel.rotation.x = model.wheels[i]?.rotation.x || 0; });
    model.group.remove(...fallback);
    addVehicleLevel(model.group, visual, 0);
    model.wheels.splice(0, model.wheels.length, ...wheels);
    // The old shells used taller cabins. Seat the existing avatar inside the new
    // metre-scaled greenhouse so NPC/player heads do not protrude through the roof.
    const driverScale = style === 'f1' ? .4 : (cabinHeights[style]-.28)/2.2;
    const front = style === 'vellfire' ? .345 : style === 'cybertruck' ? .335
      : ['sport','ferrari','lamborghini'].includes(style) ? .255 : .295;
    model.driver.scale.setScalar(driverScale);
    model.driver.position.set(style==='f1'?0:spec.width*.20,style==='f1'?.10:.03,style==='f1'?-.5:spec.length*front-.85);
    model.group.userData.driverScale=driverScale;
    model.group.userData.assetState = 'ready';
    model.group.userData.assetVersion = VERSION;
    // Optional detail levels never invalidate a working near asset on network failure. Defer
    // their fetch/parse until the browser is idle so a phone can reach the first playable frame
    // without 39 GLBs competing with the world and UI.
    const loadDetails = () => void Promise.all([template(style,'-mid'),template(style,'-far')]).then(([mid,far]) => {
      addVehicleLevel(model.group,mid.clone(true),18);
      addVehicleLevel(model.group,far.clone(true),42);
    }).catch(() => { model.group.userData.lodFallback = true; });
    if (typeof requestIdleCallback === 'function') requestIdleCallback(loadDetails, {timeout: 2500});
    else setTimeout(loadDetails, 800);
    return true;
  } catch (error) {
    model.group.userData.assetState = 'fallback';
    model.group.userData.assetError = error instanceof Error ? error.message : String(error);
    return false;
  }
}
