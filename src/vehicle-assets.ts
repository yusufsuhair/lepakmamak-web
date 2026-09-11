import * as THREE from 'three';
import { MeshoptDecoder } from 'meshoptimizer';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {addVehicleLevel, currentVehicleEnvironment, trackVehicleMaterial} from './vehicle-presentation';

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
let reflections: THREE.DataTexture | undefined;

/** A shared neutral outdoor reflection probe, scoped to vehicle materials only.
 * The city has no scene.environment. Metallic GLBs otherwise appear black there.
 * No renderer/global lighting mutation, so the two owner cars stay visually unchanged.
 */
function vehicleReflections() {
  if (reflections) return reflections;
  const width = 256, height = 128, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const latitude = y / (height - 1), longitude = x / width * Math.PI * 2;
    const sky = latitude > .5;
    const horizon = Math.exp(-Math.abs(latitude - .5) * 10);
    const cloud = sky ? Math.pow(Math.max(0, Math.sin(longitude * 3 + latitude * 14)), 8) * 24 : 0;
    const building = !sky && latitude > .32 && Math.sin(longitude * 11) > .35 ? .55 : 1;
    const rgb = sky ? [110 + horizon * 90 + cloud, 144 + horizon * 70 + cloud, 180 + horizon * 40 + cloud]
      : [51 + horizon * 80, 59 + horizon * 78, 61 + horizon * 74];
    const offset = (y * width + x) * 4;
    rgb.forEach((v, i) => { data[offset + i] = Math.min(255, v * building); });
    data[offset + 3] = 255;
  }
  reflections = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  reflections.mapping = THREE.EquirectangularReflectionMapping;
  reflections.colorSpace = THREE.SRGBColorSpace;
  reflections.minFilter = THREE.LinearFilter; reflections.magFilter = THREE.LinearFilter;
  reflections.needsUpdate = true;
  return reflections;
}

async function template(style: RevampedCarStyle, level = '') {
  const key = style + level;
  let pending = templates.get(key);
  if (!pending) {
    pending = loader.loadAsync(`/assets/models/vehicles/${key}.glb?v=vehicles-v2`).then(gltf => {
      for (const name of wheelNames) {
        if (!gltf.scene.getObjectByName(name)) throw new Error(`${style}: missing ${name}`);
      }
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        object.castShadow = materials.some(m => /Automotive clearcoat|Tyre rubber|Carbon twill/.test(m.name));
        object.receiveShadow = true;
        for (const source of materials) if (source instanceof THREE.MeshStandardMaterial) {
          source.envMap = currentVehicleEnvironment() ?? vehicleReflections(); source.envMapIntensity = .85;
          if (source.name === 'Solar glass') {
            source.transparent = true; source.opacity = .74; source.depthWrite = false; source.side = THREE.DoubleSide;
            object.castShadow = false;
          }
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
    model.group.userData.assetVersion = 'vehicles-v2';
    // Optional detail levels never invalidate a working near asset on network failure.
    void Promise.all([template(style,'-mid'),template(style,'-far')]).then(([mid,far]) => {
      addVehicleLevel(model.group,mid.clone(true),18);
      addVehicleLevel(model.group,far.clone(true),42);
    }).catch(() => { model.group.userData.lodFallback = true; });
    return true;
  } catch (error) {
    model.group.userData.assetState = 'fallback';
    model.group.userData.assetError = error instanceof Error ? error.message : String(error);
    return false;
  }
}
