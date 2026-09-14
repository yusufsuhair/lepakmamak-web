import * as THREE from 'three';
import {onSkyProbe} from './weather';

const wheelNames = ['wheel_FL','wheel_FR','wheel_RL','wheel_RR'];
const states = new WeakMap<THREE.Group, Presentation>();
const vehicles = new Set<WeakRef<THREE.Group>>();
const worldPosition = new THREE.Vector3(), cameraPosition = new THREE.Vector3(), displacement = new THREE.Vector3();
const worldRotation = new THREE.Quaternion(), forward = new THREE.Vector3();
const materialSets = new Set<THREE.MeshStandardMaterial>();
const headlightPools = new WeakMap<THREE.Scene, THREE.SpotLight[]>();
let environment: THREE.Texture | undefined, sky: THREE.Texture | null = null;
// Until the local probe has sampled the city, cars reflect the live sky palette (weather.ts), not a fixed one.
onSkyProbe(texture => { sky = texture; if (!environment) for (const material of materialSets) material.envMap = texture; });
export function currentVehicleEnvironment(): THREE.Texture | null { return environment ?? sky; }
export function trackVehicleMaterial(material: THREE.MeshStandardMaterial) {
  materialSets.add(material);
  material.envMap = currentVehicleEnvironment();
}
interface Level {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  steering: THREE.Object3D[];
  chassis?: THREE.Object3D;
}
interface Presentation {
  lod: THREE.LOD;
  levels: Level[];
  lamps: Map<string, THREE.MeshStandardMaterial>;
  previous: THREE.Vector3;
  yaw: number;
  speed: number;
  steer: number;
  pitch: number;
  roll: number;
  initialized: boolean;
}
export interface VehicleControls {speed: number; steering: number; braking: boolean; indicator?: -1 | 0 | 1}

/** Geometry and paint stay shared; only animated lamp materials are per vehicle. */
export function addVehicleLevel(group: THREE.Group, root: THREE.Group, distance: number) {
  let state = states.get(group);
  if (!state) {
    const lod = new THREE.LOD(); lod.name = 'vehicle-detail-levels'; lod.autoUpdate = false;
    group.add(lod);
    state = {lod, levels: [], lamps: new Map(), previous: new THREE.Vector3(), yaw: 0,
      speed: 0, steer: 0, pitch: 0, roll: 0, initialized: false};
    states.set(group, state);
    vehicles.add(new WeakRef(group));
  }
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const mapped = source.map(material => {
      if (!(material instanceof THREE.MeshStandardMaterial) || !/Red LED|White LED|Indicator |Reverse optics|Police blue LED/.test(material.name)) return material;
      let clone = state!.lamps.get(material.name);
      if (!clone) { clone = material.clone(); state!.lamps.set(material.name, clone); }
      return clone;
    });
    object.material = Array.isArray(object.material) ? mapped : mapped[0];
  });
  state.lod.addLevel(root, distance, .12);
  state.levels.push({root, wheels: wheelNames.map(n => root.getObjectByName(n)!),
    steering: ['steer_FL','steer_FR'].map(n => root.getObjectByName(n)!), chassis: root.getObjectByName('chassis')});
  group.userData.lodCount = state.levels.length;
}

export function vehiclePresentationState(group: THREE.Group) {
  const state = states.get(group);
  return state ? {lod: state.lod.getCurrentLevel(), levels: state.levels.length, steering: state.steer,
    pitch: state.pitch, roll: state.roll, speed: state.speed,
    brake: state.lamps.get('Red LED optics')?.emissiveIntensity,
    reverse: state.lamps.get('Reverse optics')?.emissiveIntensity,
    left: state.lamps.get('Indicator left')?.emissiveIntensity,
    right: state.lamps.get('Indicator right')?.emissiveIntensity} : undefined;
}

function visibleVehicles(scene: THREE.Scene, visit: (group: THREE.Group) => void) {
  for (const ref of vehicles) {
    const group=ref.deref();
    if (!group) { vehicles.delete(ref); continue; }
    let ancestor: THREE.Object3D | null=group;
    while (ancestor && ancestor!==scene && ancestor.visible) ancestor=ancestor.parent;
    if (ancestor===scene && scene.visible) visit(group);
  }
}

/** Motion is visual only; authoritative physics, collision and owner cars are untouched. */
export function updateVehiclePresentation(scene: THREE.Scene, camera: THREE.Camera, dt: number, night: boolean,
  controlled?: {group: THREE.Group; controls: VehicleControls}, time = performance.now() / 1000, groundOffset = 0) {
  const step = Math.max(.001, Math.min(dt, .08));
  camera.getWorldPosition(cameraPosition);
  let closest: THREE.Object3D | undefined, closestDistance=30*30;
  visibleVehicles(scene,object => {
    const state = states.get(object as THREE.Group);
    if (!state) return;
    object.getWorldPosition(worldPosition); object.getWorldQuaternion(worldRotation);
    const cameraDistance=worldPosition.distanceToSquared(cameraPosition);
    if (object.userData.model!=='f1' && cameraDistance<closestDistance) { closest=object; closestDistance=cameraDistance; }
    forward.set(0,0,1).applyQuaternion(worldRotation);
    const yaw = Math.atan2(forward.x, forward.z);
    const distance = state.previous.distanceTo(worldPosition);
    // A hidden/reused car or network teleport must not produce a suspension impulse.
    const reset = !state.initialized || distance > 3;
    const local = controlled?.group === object ? controlled.controls : undefined;
    const velocity = local?.speed ?? (reset ? 0 : displacement.copy(worldPosition).sub(state.previous).dot(forward) / step);
    const yawRate = reset ? 0 : Math.atan2(Math.sin(yaw-state.yaw), Math.cos(yaw-state.yaw)) / step;
    const accel = reset ? 0 : THREE.MathUtils.clamp((velocity-state.speed)/step, -12, 9);
    const steering = local ? local.steering * .40 : Math.abs(velocity) > .3 ? Math.atan(yawRate*2.65/velocity) : 0;
    const braking = local?.braking ?? (Math.abs(velocity) > .5 && accel*Math.sign(velocity) < -1.3);
    state.steer = THREE.MathUtils.damp(state.steer, THREE.MathUtils.clamp(steering,-.52,.52), 12, step);
    state.pitch = THREE.MathUtils.damp(state.pitch, -accel*.0025, 7, step);
    state.roll = THREE.MathUtils.damp(state.roll, THREE.MathUtils.clamp(-yawRate*velocity*.0018,-.035,.035), 6, step);
    state.lod.position.y=-groundOffset;
    state.lod.updateWorldMatrix(true,false);state.lod.update(camera);
    const spins = state.levels[0].wheels.map(w => w.rotation.x);
    for (const [i, level] of state.levels.entries()) {
      level.steering.forEach(steer => { steer.rotation.y = state.steer; });
      if (i) level.wheels.forEach((wheel,k) => { wheel.rotation.x = spins[k]; });
      if (level.chassis) { level.chassis.rotation.x = state.pitch; level.chassis.rotation.z = state.roll; }
    }
    const set = (name: string, color: THREE.ColorRepresentation, intensity: number) => {
      const material = state.lamps.get(name);
      if (material) { material.emissive.set(color); material.emissiveIntensity = intensity; }
    };
    set('White LED optics', '#e2f0ff', night ? 2.5 : .65);
    set('Red LED optics', '#ff1020', braking ? 3.2 : night ? .75 : .12);
    set('Reverse optics', '#e6f4ff', velocity < -.2 ? 2 : 0);
    // Turn signal follows deliberate local steering; parked cars remain unlit.
    const indicator = local?.indicator ?? (Math.abs(state.steer) > .18 && Math.abs(velocity) > .6 ? Math.sign(state.steer) : 0);
    const flash = Math.floor(time*2.5)%2 === 0;
    set('Indicator left', '#ff8800', indicator < 0 && flash ? 3 : 0);
    set('Indicator right', '#ff8800', indicator > 0 && flash ? 3 : 0);
    set('Police blue LED', '#146bff', Math.abs(velocity) > .5 && flash ? 3 : .12);
    state.previous.copy(worldPosition); state.yaw=yaw; state.speed=velocity; state.initialized=true;
    object.userData.detailLevel = state.lod.getCurrentLevel();
  });
  // Two shadow-free beams are reused by the closest car; distant LED lenses remain
  // visible without multiplying expensive realtime lights across the entire fleet.
  let beams=headlightPools.get(scene);
  if (!beams && closest) {
    beams=[-1,1].map(() => {
      const light=new THREE.SpotLight('#e1efff',0,25,.42,.65,1.6);
      light.name='Vehicle headlight pool';scene.add(light,light.target);return light;
    });
    headlightPools.set(scene,beams);
  }
  beams?.forEach((beam,i) => {
    beam.intensity=night && closest ? 55 : 0;
    if (!closest) return;
    const footprint=closest.userData.vehicleFootprint;
    const halfLength=(footprint?.length ?? 4)/2-.15;
    beam.position.set((i?1:-1)*(footprint?.width ?? 1.8)*.28,.75,halfLength).applyMatrix4(closest.matrixWorld);
    beam.target.position.set((i?1:-1)*1.2,.05,halfLength+14).applyMatrix4(closest.matrixWorld);
    beam.target.updateMatrixWorld();
  });
}

let probe: THREE.WebGLCubeRenderTarget | undefined, pmrem: THREE.PMREMGenerator | undefined;
let filtered: THREE.WebGLRenderTarget | undefined, lastProbeTime = -100, lastNight: boolean | undefined;
const lastProbePosition = new THREE.Vector3(Infinity,Infinity,Infinity);

/** One small shared probe samples the actual city near the camera, at most every 20s.
 * Hide upgraded cars to avoid self-reflections; restore every render setting on failure.
 * This never assigns scene.environment or changes the two Porsche material sets.
 */
export function updateVehicleReflections(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, night: boolean, time: number) {
  if (!materialSets.size || time-lastProbeTime < 20) return;
  camera.getWorldPosition(cameraPosition);
  if (lastNight === night && lastProbePosition.distanceTo(cameraPosition) < 18) return;
  const hidden: THREE.Object3D[] = [];
  visibleVehicles(scene,o => { hidden.push(o); });
  if (!hidden.length) return;
  probe ??= new THREE.WebGLCubeRenderTarget(64, {type: THREE.HalfFloatType, generateMipmaps: false});
  pmrem ??= new THREE.PMREMGenerator(renderer);
  const cube = new THREE.CubeCamera(.2, 160, probe);
  let nearestDistance=Infinity;
  for (const car of hidden) {
    car.getWorldPosition(worldPosition);
    const distance=worldPosition.distanceToSquared(cameraPosition);
    if (distance<nearestDistance) { nearestDistance=distance; cube.position.copy(worldPosition); }
  }
  cube.position.y += 1.3;
  const target = renderer.getRenderTarget(), autoShadow = renderer.shadowMap.autoUpdate;
  try {
    hidden.forEach(o => { o.visible=false; }); renderer.shadowMap.autoUpdate=false;
    cube.update(renderer, scene);
    const next = pmrem.fromCubemap(probe.texture);
    environment = next.texture;
    for (const material of materialSets) { material.envMap = environment; material.needsUpdate = true; }
    filtered?.dispose(); filtered=next; lastProbePosition.copy(cameraPosition); lastNight=night;
  } catch (error) {
    console.warn('Vehicle reflection probe unavailable; retaining previous environment',error);
  } finally {
    hidden.forEach(o => { o.visible=true; }); renderer.shadowMap.autoUpdate=autoShadow; renderer.setRenderTarget(target);
    lastProbeTime=time;
  }
}
