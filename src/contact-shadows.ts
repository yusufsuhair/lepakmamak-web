import * as THREE from 'three';
import {inSkyPool} from '../shared/sky-dining.mjs';
import {rembayungGroundHeight} from './rembayung-layout';
import {shoplotFloorHeight, type Shoplot} from './shoplots';

/** Soft round decals stamped just above the floor so chairs, tables, players, NPCs, animals,
 * pets and vehicles read as grounded instead of floating. Real shadows (sun.castShadow) are off
 * on every touch device and on 'low'/'lowest' quality (src/main.ts applyQuality), and even where
 * they are on, rain drops the sun to 20% and night to moonlight, so this is the only shadow most
 * players see most of the time.
 *
 * One 64x64 canvas gradient, one MeshBasicMaterial, two InstancedMeshes (static furniture, dynamic
 * actors). A vehicle is the same round gradient stretched into an ellipse by a non-uniform xz scale
 * and rotated to its yaw, so no second texture or material is needed.
 *
 * The floor is not y=0: the base city slab sits at -0.05 (src/world.ts/ground.ts), but the Mamak
 * Maju plaza (its realism GLB, baseline GLB and procedural fallback all measured the same) sits
 * proud of it at +0.205, and shoplot arcades and Rembayung are higher still. None of these floors
 * move, and the game already has pure functions for two of them (rembayungGroundHeight,
 * shoplotFloorHeight -- the same ones main.ts uses for the player's own deckY), so floorHeightAt()
 * below resolves every height with arithmetic instead of raycasting the scene: a first version of
 * this file raycast every instance and measured 1.6 ms median per ray against this city's merged,
 * unindexed batches -- tens of milliseconds a frame, exactly where the brief says a phone can least
 * afford it. Static furniture resolves its floor once, at creation; dynamic actors resolve it fresh
 * every frame, but it is a handful of comparisons, not a ray. */
export const contactShadowStatus = {staticCount: 0, dynamicCount: 0, dynamicCapacity: 0, draws: 2, triangles: 0, alpha: 0, raycasts: 0};

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

// --- Floor height, by arithmetic ---------------------------------------------------------------
// src/world.ts / src/ground.ts: box(group,0,-.11,0,318,.12,318,groundMaterial('slab')) -> top y.
const SLAB_Y = -.05;
// Measured 2026-09-18 by raycasting straight down: the realism GLB (LM_ENV_MamakMaju) and the
// procedural fallback both put the plaza floor at y=0.205, matching the fallback's own paving --
// src/world.ts: mamakBox(mx,.08,41,37,.25,30,...) and mamakBox(-34,.08,59,15,.25,13,...), i.e.
// centre y .08 + half height .125. Both assets agree, so nothing needs to re-run if one swaps
// for the other later; the two boxes are the plaza's footprint (meja-1..4 fall in the first,
// meja-9 in the second, both including a margin for the paving around each table).
const MAMAK_PLAZA_Y = .205;
const MAMAK_RECTS = [
  {x: -29, z: 41, hx: 37 / 2, hz: 30 / 2},
  {x: -34, z: 59, hx: 15 / 2, hz: 13 / 2},
] as const;
// src/world.ts: box(group,x,.02,z,13,.04,10,'#c6b891') for [112,-14] ('DATARAN SANTAI') and
// [-110,60] ('LAMAN LEPAK') -- the two scattered picnic tables outside the Mamak plaza each get
// their own small raised paving too, centre y .02 + half height .02.
const DATARAN_Y = .04;
const DATARAN_RECTS = [
  {x: 112, z: -14, hx: 13 / 2, hz: 10 / 2},
  {x: -110, z: 60, hx: 13 / 2, hz: 10 / 2},
] as const;
function inRect(x: number, z: number, r: {x: number; z: number; hx: number; hz: number}) {
  return Math.abs(x - r.x) <= r.hx && Math.abs(z - r.z) <= r.hz;
}

/** The height of whatever the player would actually see underfoot at (x, z): Rembayung's ramps
 * and mezzanine, then a shoplot arcade's five-foot-way, then the Mamak Maju plaza, then the two
 * scattered picnic-table plazas, then the base city slab. Elevated decks that are not a fixed
 * function of (x, z) -- Sky Dining, the KLCC lift, the Saloma bridge deck -- are not covered here;
 * those already come from deckY (the local player) or the server's own y (remotes, seated chairs),
 * which this module takes as a floor rather than overriding, via Math.max at each call site below. */
export function floorHeightAt(x: number, z: number, shoplotLots: readonly Shoplot[]): number {
  const rembayung = rembayungGroundHeight({x, z});
  if (rembayung !== null) return rembayung;
  const shoplot = shoplotFloorHeight(shoplotLots, {x, z});
  if (shoplot !== null) return shoplot;
  if (MAMAK_RECTS.some(r => inRect(x, z, r))) return MAMAK_PLAZA_Y;
  if (DATARAN_RECTS.some(r => inRect(x, z, r))) return DATARAN_Y;
  return SLAB_Y;
}

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
   * vehicle is set only for the actual driver, so a passenger does not draw the car twice. floor
   * is deckY -- correct on its own for Sky Dining/the KLCC lift/the Saloma bridge, and combined
   * with floorHeightAt(x,z) via max so the Mamak plaza (which deckY does not know about) still
   * wins there. */
  local: {x: number; z: number; floor: number; jump: number; hidden: boolean; vehicle: VehicleActor | null};
  remotePlayers: Iterable<RemoteActor>;
  roomPlayers: readonly RoomPlayer[];
  pedestrians: readonly PedestrianActor[];
  animals: readonly FollowerActor[];
  /** Iterate active pet followers without allocating an array every frame (src/pets.ts's forEach). */
  petsForEach: (fn: (group: THREE.Object3D) => void) => void;
  traffic: readonly TrafficActor[];
}

export function createContactShadows(scene: THREE.Scene, shoplotLots: readonly Shoplot[], chairs: readonly ContactShadowChair[], tables: readonly ContactShadowTable[]) {
  const texture = gradientTexture();
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, fog: true,
    // A shadow is a fixed darkening, not a lit surface: it must not brighten or shift with ACES
    // exposure the way the sun-lit ground does, so it stays a consistent blob across quality tiers.
    toneMapped: false,
    // depthTest stays on (the default): a chair leg or a character must still cover the decal
    // normally. polygonOffset is the z-fight guard instead, alongside the 0.02 m rise below.
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

  // Furniture never moves, so its floor is resolved once, here, and never revisited: a chair or
  // table's own y (set only for the Sky Dining deck) wins outright, since floorHeightAt has no
  // idea a rooftop deck exists at that (x, z); everything else asks floorHeightAt.
  let cursor = 0;
  for (const chair of chairs) {
    const floor = chair.y || floorHeightAt(chair.x, chair.z, shoplotLots);
    position.set(chair.x, floor + .02, chair.z); scale.set(CHAIR_DIAMETER, 1, CHAIR_DIAMETER);
    matrix.compose(position, upright, scale); staticMesh.setMatrixAt(cursor++, matrix);
  }
  for (const table of tables) {
    const floor = table.y || floorHeightAt(table.x, table.z, shoplotLots);
    const diameter = table.id === 'meja-9' ? BIG_TABLE_DIAMETER : TABLE_DIAMETER;
    position.set(table.x, floor + .02, table.z); scale.set(diameter, 1, diameter);
    matrix.compose(position, upright, scale); staticMesh.setMatrixAt(cursor++, matrix);
  }
  staticMesh.count = staticCount; staticMesh.instanceMatrix.needsUpdate = true;
  dynamicMesh.count = 0;
  scene.add(staticMesh, dynamicMesh);

  contactShadowStatus.staticCount = staticCount;
  contactShadowStatus.dynamicCapacity = DYNAMIC_CAPACITY;
  contactShadowStatus.triangles = staticCount * 2;
  if (import.meta.env.DEV) {
    const realism = (window as unknown as {__lepakRealism?: Record<string, unknown>});
    realism.__lepakRealism ??= {};
    // floorHeightAt nested on the same status object the tests already poll, so tests/contact-shadows.spec.ts
    // can hold the arithmetic honest against a real raycast without the module raycasting itself.
    realism.__lepakRealism.contactShadows = Object.assign(contactShadowStatus, {floorHeightAt: (x: number, z: number) => floorHeightAt(x, z, shoplotLots)});
  }

  let alpha = STRONG_ALPHA;

  function stamp(x: number, z: number, floor: number, yaw: number, sx: number, sz: number, viewerX: number, viewerZ: number) {
    if (cursor >= DYNAMIC_CAPACITY || sx <= 0 || sz <= 0) return;
    const dx = x - viewerX, dz = z - viewerZ;
    if (dx * dx + dz * dz > CULL_DISTANCE * CULL_DISTANCE) return;
    position.set(x, floor + .02, z); quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); scale.set(sx, 1, sz);
    matrix.compose(position, quaternion, scale); dynamicMesh.setMatrixAt(cursor++, matrix);
  }
  function stampVehicle(vehicle: VehicleActor, viewerX: number, viewerZ: number) {
    const footprint = footprintOf(vehicle.group, vehicle.bike);
    // Cars and bikes only ever run at street level in this city (no elevated driving decks), so
    // their floor is fixed at 0 rather than looked up.
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
        const floor = Math.max(frame.local.floor, floorHeightAt(frame.local.x, frame.local.z, shoplotLots));
        const settle = THREE.MathUtils.clamp(1 - frame.local.jump / JUMP_FADE_HEIGHT, 0, 1);
        stamp(frame.local.x, frame.local.z, floor, 0, HUMAN_DIAMETER * settle, HUMAN_DIAMETER * settle, vx, vz);
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
        // remoteBaseY is .12 in this standing branch); undoing just the jump gives deckY-like
        // elevation for Sky Dining etc, then max()'d with floorHeightAt for the Mamak plaza.
        const seed = remote.group.position.y - jump - .12;
        const floor = Math.max(seed, floorHeightAt(remote.group.position.x, remote.group.position.z, shoplotLots));
        stamp(remote.group.position.x, remote.group.position.z, floor, 0, HUMAN_DIAMETER * settle, HUMAN_DIAMETER * settle, vx, vz);
      }
      frame.pedestrians.forEach(ped => {
        if (!ped.person.group.visible) return;
        const floor = Math.max(ped.person.group.position.y, floorHeightAt(ped.person.group.position.x, ped.person.group.position.z, shoplotLots));
        stamp(ped.person.group.position.x, ped.person.group.position.z, floor, 0, HUMAN_DIAMETER, HUMAN_DIAMETER, vx, vz);
      });
      frame.animals.forEach(animal => {
        const lift = animal.group.userData.poseYOffset || 0, seed = animal.group.position.y - lift;
        const floor = Math.max(seed, floorHeightAt(animal.group.position.x, animal.group.position.z, shoplotLots));
        stamp(animal.group.position.x, animal.group.position.z, floor, 0, PET_DIAMETER, PET_DIAMETER, vx, vz);
      });
      frame.petsForEach(group => {
        const lift = group.userData.poseYOffset || 0, seed = group.position.y - lift;
        const floor = Math.max(seed, floorHeightAt(group.position.x, group.position.z, shoplotLots));
        stamp(group.position.x, group.position.z, floor, 0, PET_DIAMETER, PET_DIAMETER, vx, vz);
      });
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
