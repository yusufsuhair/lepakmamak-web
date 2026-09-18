import * as THREE from 'three';
import {inSkyPool} from '../shared/sky-dining.mjs';

/** Soft round decals stamped just above the floor so chairs, tables, players, NPCs, animals,
 * pets and vehicles read as grounded instead of floating. Real shadows (sun.castShadow) are off
 * on every touch device and on 'low'/'lowest' quality (src/main.ts applyQuality), and even where
 * they are on, rain drops the sun to 20% and night to moonlight, so this is the only shadow most
 * players see most of the time.
 *
 * One 64x64 canvas gradient, one MeshBasicMaterial, two InstancedMeshes (static furniture, whose
 * matrices are written once; dynamic actors, rewritten every frame from a running cursor with no
 * per-frame allocation of Matrix4/Vector3/Quaternion). A vehicle is the same round gradient
 * stretched into an ellipse by a non-uniform xz scale and rotated to its yaw, so no second texture
 * or material is needed for the "elliptical, oriented to yaw" requirement. */
export const contactShadowStatus = {staticCount: 0, dynamicCount: 0, dynamicCapacity: 0, draws: 2, triangles: 0, alpha: 0};

const CULL_DISTANCE = 60;              // dynamic actors beyond this range from the viewer are dropped
const DYNAMIC_CAPACITY = 200;          // local + own vehicle + nearby remotes/pedestrians/animals/pets/traffic
const STRONG_ALPHA = .45, LIGHT_ALPHA = .18;   // brief: ~0.4-0.5 with no real shadow, ~0.15-0.2 alongside a strong one
const SUN_REFERENCE = 2.7;             // weather.ts's CLEAR table: brightest zenith lightIntensity (noon, clear)
const FADE_RATE = 3;                   // THREE.MathUtils.damp rate: a quality/sky change eases in over ~1/3 s
const JUMP_FADE_HEIGHT = .9;           // apex of a jump is ~1.17 m (v0=6.5, g=18 in main.ts); fade out well before it

const CHAIR_DIAMETER = 1.05, TABLE_DIAMETER = 2.5, BIG_TABLE_DIAMETER = 4.4;   // meja-9 seats nine, world.ts's tube radius 1.95
const HUMAN_DIAMETER = .72, PET_DIAMETER = .5;
const BIKE_FOOTPRINT = {width: .6, length: 1.7};        // createBike() sets no vehicleFootprint of its own
const DEFAULT_CAR_FOOTPRINT = {width: 1.9, length: 4};  // matches vehicleSolid()'s own fallback in world.ts
const VEHICLE_SHRINK = .82;                             // a shadow hugs the body, not the collision box

const UP = new THREE.Vector3(0, 1, 0);

function gradientTexture() {
  const size = 64, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = size / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, 'rgba(0,0,0,.9)'); gradient.addColorStop(.55, 'rgba(0,0,0,.5)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface Footprint { width: number; length: number }
function footprintOf(group: THREE.Object3D, bike: boolean): Footprint {
  return (group.userData as {vehicleFootprint?: Footprint}).vehicleFootprint || (bike ? BIKE_FOOTPRINT : DEFAULT_CAR_FOOTPRINT);
}

export interface ContactShadowChair { x: number; z: number; y?: number }
export interface ContactShadowTable { id: string; x: number; z: number; y?: number }
/** A vehicle group with a position and a facing (rotation.y), local or remote. */
interface VehicleActor { group: THREE.Object3D; bike: boolean }
/** Anything from src/animals.ts (street cats/dogs) or the per-player follower a cat pet returns. */
interface FollowerActor { group: THREE.Object3D }
interface RemoteActor {
  id: string; group: THREE.Object3D; riding: boolean; passengerOf: string | null;
  vehicle: string; seated: boolean; resting: unknown; car: {group: THREE.Object3D}; bike: {group: THREE.Object3D};
}
interface TrafficActor { owner: string | null; group: THREE.Object3D }
interface RoomPlayer { id: string; jumpHeight?: number; skyDining?: boolean; lrtId?: number | null }
interface PedestrianActor { person: {group: THREE.Object3D} }

export interface ContactShadowFrame {
  shadowsOn: boolean; sunIntensity: number; viewer: {x: number; z: number};
  /** hidden covers seated/riding/swimming/LRT/beach-rest: anything not standing on a floor.
   * vehicle is set only for the actual driver, so a passenger does not draw the car twice. */
  local: {x: number; z: number; floor: number; jump: number; hidden: boolean; vehicle: VehicleActor | null};
  remotePlayers: Iterable<RemoteActor>;
  roomPlayers: readonly RoomPlayer[];
  pedestrians: readonly PedestrianActor[];
  animals: readonly FollowerActor[];
  pets: readonly THREE.Object3D[];
  traffic: readonly TrafficActor[];
}

export function createContactShadows(scene: THREE.Scene, chairs: readonly ContactShadowChair[], tables: readonly ContactShadowTable[]) {
  const texture = gradientTexture();
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, fog: true,
    // A shadow is a fixed darkening, not a lit surface: it must not brighten or shift with ACES
    // exposure the way the sun-lit ground does, so it stays a consistent blob across quality tiers.
    toneMapped: false,
    // 0.02 m above the floor (composed into every matrix below) already clears the PBR ground
    // (src/ground.ts is flat at y=0); the offset is a second guard against mobile z-fighting.
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    opacity: STRONG_ALPHA,
  });
  const staticCount = chairs.length + tables.length;
  const staticMesh = new THREE.InstancedMesh(geometry, material, Math.max(1, staticCount));
  const dynamicMesh = new THREE.InstancedMesh(geometry, material, DYNAMIC_CAPACITY);
  for (const mesh of [staticMesh, dynamicMesh]) {
    mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 1;
    // One instanced mesh spans the whole map; a single frustum box around it would keep it in
    // view (or fully culled) far too eagerly either way, so per-instance range is handled below.
    mesh.frustumCulled = false;
  }
  staticMesh.name = 'contact-shadows-static'; dynamicMesh.name = 'contact-shadows-dynamic';

  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(), upright = new THREE.Quaternion();
  let cursor = 0;
  for (const chair of chairs) {
    position.set(chair.x, (chair.y || 0) + .02, chair.z); scale.set(CHAIR_DIAMETER, 1, CHAIR_DIAMETER);
    matrix.compose(position, upright, scale); staticMesh.setMatrixAt(cursor++, matrix);
  }
  for (const table of tables) {
    const diameter = table.id === 'meja-9' ? BIG_TABLE_DIAMETER : TABLE_DIAMETER;
    position.set(table.x, (table.y || 0) + .02, table.z); scale.set(diameter, 1, diameter);
    matrix.compose(position, upright, scale); staticMesh.setMatrixAt(cursor++, matrix);
  }
  staticMesh.count = staticCount; staticMesh.instanceMatrix.needsUpdate = true;
  dynamicMesh.count = 0;
  scene.add(staticMesh, dynamicMesh);

  contactShadowStatus.staticCount = staticCount;
  contactShadowStatus.dynamicCapacity = DYNAMIC_CAPACITY;
  contactShadowStatus.triangles = staticCount * 2;
  if (import.meta.env.DEV) ((window as unknown as {__lepakRealism?: Record<string, unknown>}).__lepakRealism ??= {}).contactShadows = contactShadowStatus;

  let alpha = STRONG_ALPHA;
  cursor = 0;
  function stamp(x: number, z: number, floor: number, yaw: number, sx: number, sz: number, viewerX: number, viewerZ: number) {
    if (cursor >= DYNAMIC_CAPACITY || sx <= 0 || sz <= 0) return;
    const dx = x - viewerX, dz = z - viewerZ;
    if (dx * dx + dz * dz > CULL_DISTANCE * CULL_DISTANCE) return;
    position.set(x, floor + .02, z); quaternion.setFromAxisAngle(UP, yaw); scale.set(sx, 1, sz);
    matrix.compose(position, quaternion, scale); dynamicMesh.setMatrixAt(cursor++, matrix);
  }
  function stampVehicle(vehicle: VehicleActor, viewerX: number, viewerZ: number) {
    const footprint = footprintOf(vehicle.group, vehicle.bike);
    stamp(vehicle.group.position.x, vehicle.group.position.z, 0, vehicle.group.rotation.y,
      footprint.width * VEHICLE_SHRINK, footprint.length * VEHICLE_SHRINK, viewerX, viewerZ);
  }

  return {
    update(dt: number, frame: ContactShadowFrame) {
      // Strong with no real shadow pass (touch, 'low'/'lowest' quality) or a weak sun (rain,
      // night); light once the sun is doing the work, so the two never stack. Settles over the
      // FADE_RATE damp rather than snapping, so a quality toggle or a cloud rolling in is smooth.
      const sunStrength = frame.shadowsOn ? THREE.MathUtils.clamp(frame.sunIntensity / SUN_REFERENCE, 0, 1) : 0;
      const target = THREE.MathUtils.lerp(STRONG_ALPHA, LIGHT_ALPHA, sunStrength);
      alpha = THREE.MathUtils.damp(alpha, target, FADE_RATE, dt);
      material.opacity = alpha; contactShadowStatus.alpha = alpha;

      cursor = 0;
      const {x: vx, z: vz} = frame.viewer;

      if (!frame.local.hidden) {
        const settle = THREE.MathUtils.clamp(1 - frame.local.jump / JUMP_FADE_HEIGHT, 0, 1);
        stamp(frame.local.x, frame.local.z, frame.local.floor, 0, HUMAN_DIAMETER * settle, HUMAN_DIAMETER * settle, vx, vz);
      }
      if (frame.local.vehicle) stampVehicle(frame.local.vehicle, vx, vz);

      for (const remote of frame.remotePlayers) {
        if (!remote.group.visible) continue;
        const state = frame.roomPlayers.find(p => p.id === remote.id);
        const onTrain = state?.lrtId != null;
        const swimming = !!state?.skyDining && inSkyPool(remote.group.position);
        if (remote.seated || remote.passengerOf || remote.resting || swimming || onTrain) continue;
        if (remote.riding) { stampVehicle({group: remote.vehicle === 'car' ? remote.car.group : remote.bike.group, bike: remote.vehicle !== 'car'}, vx, vz); continue; }
        const jump = state?.jumpHeight || 0;
        const settle = THREE.MathUtils.clamp(1 - jump / JUMP_FADE_HEIGHT, 0, 1);
        // remote.group.position.y already bakes in jump and any deck elevation (main.ts's
        // remoteBaseY is .12 in this standing branch), so the floor is just the jump undone.
        stamp(remote.group.position.x, remote.group.position.z, remote.group.position.y - jump - .12, 0, HUMAN_DIAMETER * settle, HUMAN_DIAMETER * settle, vx, vz);
      }
      for (const ped of frame.pedestrians) {
        if (!ped.person.group.visible) continue;
        stamp(ped.person.group.position.x, ped.person.group.position.z, ped.person.group.position.y, 0, HUMAN_DIAMETER, HUMAN_DIAMETER, vx, vz);
      }
      for (const animal of frame.animals) {
        const lift = animal.group.userData.poseYOffset || 0;
        stamp(animal.group.position.x, animal.group.position.z, animal.group.position.y - lift, 0, PET_DIAMETER, PET_DIAMETER, vx, vz);
      }
      for (const pet of frame.pets) {
        const lift = pet.userData.poseYOffset || 0;
        stamp(pet.position.x, pet.position.z, pet.position.y - lift, 0, PET_DIAMETER, PET_DIAMETER, vx, vz);
      }
      for (const car of frame.traffic) {
        // Once a fleet car is claimed (by anyone) main.ts hides its own group and draws the
        // driver's rig instead (car.group for the local driver, remote.car.group for a remote
        // one) — both already handled above, so an owned, invisible traffic entry is skipped here.
        if (car.owner || !car.group.visible) continue;
        stampVehicle({group: car.group, bike: false}, vx, vz);
      }

      dynamicMesh.count = cursor; dynamicMesh.instanceMatrix.needsUpdate = true;
      contactShadowStatus.dynamicCount = cursor;
      contactShadowStatus.triangles = (staticCount + cursor) * 2;
    },
  };
}
