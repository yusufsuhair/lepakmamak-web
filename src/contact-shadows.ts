import * as THREE from 'three';
import {inSkyPool} from '../shared/sky-dining.mjs';

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
 * The floor is not y=0: the base city slab sits at -0.05 (src/ground.ts), but the Mamak Maju plaza
 * (its realism GLB, baseline GLB or procedural fallback -- src/mamak-realism.ts loads whichever
 * resolves, asynchronously) sits proud of it at about +0.2, and shoplot arcades, Rembayung and other
 * sites are higher still. A decal at a hardcoded height is buried under the real floor mesh wherever
 * a site is elevated -- which is most of the mamak plaza, i.e. most of where players actually stand.
 * Every instance's height is instead resolved by raycasting straight down against the live scene. */
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

// --- Floor resolution -------------------------------------------------------------------------
// A ray straight through a chair's own seat or a table's own top reports the FURNITURE's height,
// not the floor beneath it (measured: a chair seat sits at 0.65 on the mamak plaza, whose real
// floor is 0.2). So a furniture probe is offset a few metres out to the side, in several
// directions, and the LOWEST of the readings wins -- furniture can only ever read higher than the
// real floor under it, never lower, so the minimum across a few tries reliably finds the floor as
// long as at least one direction clears the object. 2.3 m clears even meja-9's 1.95 m radius.
const PROBE_RADIUS = 2.3;
const PROBE_ANGLES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
const CENTRE_ONLY = [0];
const DOWN = new THREE.Vector3(0, -1, 0);
const raycaster = new THREE.Raycaster();
raycaster.far = 8;
const probeOrigin = new THREE.Vector3();

/** Lowest hit straight down at (x + r*sin(a), hintY+3, z + r*cos(a)) over the given angles, or
 * null if nothing was hit in any direction (floors not loaded yet, or genuinely open air). */
function probeFloor(candidates: THREE.Object3D[], x: number, z: number, hintY: number, radius: number, angles: readonly number[]): number | null {
  let best: number | null = null;
  for (const a of angles) {
    probeOrigin.set(x + Math.sin(a) * radius, hintY + 3, z + Math.cos(a) * radius);
    raycaster.set(probeOrigin, DOWN);
    // Sprites (name tags, speech-bubble anchors) need Raycaster.camera set just to avoid throwing,
    // and floating text is never a floor, so the first non-sprite hit is what is actually wanted.
    const hit = raycaster.intersectObjects(candidates, true).find(i => !(i.object as THREE.Sprite).isSprite);
    if (hit && (best === null || hit.point.y < best)) best = hit.point.y;
  }
  return best;
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
   * vehicle is set only for the actual driver, so a passenger does not draw the car twice.
   * excludeGroups keeps the local rig itself (and the bikes/cars parked nearby) out of its own
   * floor raycasts -- without it, a probe straight down the player finds their own hair first. */
  local: {x: number; z: number; floor: number; jump: number; hidden: boolean; vehicle: VehicleActor | null; excludeGroups: readonly THREE.Object3D[]};
  remotePlayers: Iterable<RemoteActor>;
  roomPlayers: readonly RoomPlayer[];
  pedestrians: readonly PedestrianActor[];
  animals: readonly FollowerActor[];
  /** Iterate active pet followers without allocating an array every frame (src/pets.ts's forEach). */
  petsForEach: (fn: (group: THREE.Object3D) => void) => void;
  traffic: readonly TrafficActor[];
}

interface StaticItem { x: number; z: number; seedY: number; diameter: number; floor: number }

export function createContactShadows(scene: THREE.Scene, camera: THREE.Camera, chairs: readonly ContactShadowChair[], tables: readonly ContactShadowTable[]) {
  // Only needed so Raycaster.intersectObjects does not throw when a probe's line happens to pass
  // a name-tag Sprite (it billboards against the camera); the module never renders through it.
  raycaster.camera = camera;
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

  // Static furniture starts at its seed height (0, or a table/chair's own known deck y) and self
  // corrects once the async mamak floor resolves -- the round-robin refinement in update() below.
  // Wrong for at most a couple of seconds at spawn rather than blocking on any asset's load event.
  const staticItems: StaticItem[] = [
    ...chairs.map((c): StaticItem => ({x: c.x, z: c.z, seedY: c.y || 0, diameter: CHAIR_DIAMETER, floor: c.y || 0})),
    ...tables.map((t): StaticItem => ({x: t.x, z: t.z, seedY: t.y || 0, diameter: t.id === 'meja-9' ? BIG_TABLE_DIAMETER : TABLE_DIAMETER, floor: t.y || 0})),
  ];
  function writeStatic(item: StaticItem, index: number) {
    position.set(item.x, item.floor + .02, item.z); scale.set(item.diameter, 1, item.diameter);
    matrix.compose(position, upright, scale); staticMesh.setMatrixAt(index, matrix);
  }
  staticItems.forEach(writeStatic);
  staticMesh.count = staticCount; staticMesh.instanceMatrix.needsUpdate = true;
  dynamicMesh.count = 0;
  scene.add(staticMesh, dynamicMesh);

  contactShadowStatus.staticCount = staticCount;
  contactShadowStatus.dynamicCapacity = DYNAMIC_CAPACITY;
  contactShadowStatus.triangles = staticCount * 2;
  if (import.meta.env.DEV) ((window as unknown as {__lepakRealism?: Record<string, unknown>}).__lepakRealism ??= {}).contactShadows = contactShadowStatus;

  let alpha = STRONG_ALPHA;
  let cursor = 0;
  // Round-robins every static instance; fast for the first few passes (while the mamak asset is
  // still loading and swapping), then a slow trickle forever after so a much later change (a
  // quality swap re-triggering a fallback, say) still eventually corrects itself.
  let staticCursor = 0, staticPasses = 0, staticAccum = 0;
  const dynamicFloors = new Map<string, {x: number; z: number; floor: number; checkedAt: number}>();
  let clock = 0;

  /** Everything that should never itself be read as "the floor": both contact-shadow meshes and
   * every actor rig, local or otherwise, so a probe never finds a character's own hair or a
   * neighbour's shoe instead of the pavement under it. Rebuilt per call, only when a raycast is
   * about to happen -- see budget-gated call sites below. */
  function envCandidates(frame: ContactShadowFrame): THREE.Object3D[] {
    const exclude = new Set<THREE.Object3D>([staticMesh, dynamicMesh, ...frame.local.excludeGroups]);
    for (const remote of frame.remotePlayers) exclude.add(remote.group);
    for (const car of frame.traffic) exclude.add(car.group);
    for (const animal of frame.animals) exclude.add(animal.group);
    for (const ped of frame.pedestrians) exclude.add(ped.person.group);
    frame.petsForEach(group => exclude.add(group));
    return scene.children.filter(o => !exclude.has(o));
  }

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
    // their floor is not raycast -- unlike people, who reach the mamak plaza, shoplots and decks.
    stamp(vehicle.group.position.x, vehicle.group.position.z, 0, vehicle.group.rotation.y,
      footprint.width * VEHICLE_SHRINK, footprint.length * VEHICLE_SHRINK, viewerX, viewerZ);
  }

  /** Cached per-actor floor height, refreshed only when it has moved noticeably or gone stale
   * (catches an async floor swap while an actor stands still), never every frame. budget caps how
   * many *new* raycasts a single frame may spend so a burst of newly-spawned actors cannot spike
   * a frame; a probe deferred this way just keeps its last known (or seed) height for now. */
  function dynamicFloor(candidates: () => THREE.Object3D[], budget: {left: number}, key: string, x: number, z: number, hintY: number): number {
    const cached = dynamicFloors.get(key);
    if (cached && Math.hypot(x - cached.x, z - cached.z) < 1 && clock - cached.checkedAt < 4) return cached.floor;
    if (budget.left <= 0) return cached?.floor ?? hintY;
    budget.left--;
    const found = probeFloor(candidates(), x, z, hintY, 0, CENTRE_ONLY);
    const floor = found ?? cached?.floor ?? hintY;
    dynamicFloors.set(key, {x, z, floor, checkedAt: clock});
    return floor;
  }

  return {
    update(dt: number, frame: ContactShadowFrame) {
      clock += dt;
      // Strong with no real shadow pass (touch, 'low'/'lowest' quality) or a weak sun (rain,
      // night); light once the sun is doing the work, so the two never stack. Settles over the
      // FADE_RATE damp rather than snapping, so a quality toggle or a cloud rolling in is smooth.
      const sunStrength = frame.shadowsOn ? THREE.MathUtils.clamp(frame.sunIntensity / SUN_REFERENCE, 0, 1) : 0;
      const target = THREE.MathUtils.lerp(STRONG_ALPHA, LIGHT_ALPHA, sunStrength);
      alpha = THREE.MathUtils.damp(alpha, target, FADE_RATE, dt);
      material.opacity = alpha; contactShadowStatus.alpha = alpha;

      // Candidates are rebuilt at most once per frame, and only if something below actually asks
      // for them -- most frames, every dynamic floor is already fresh and none do.
      let candidates: THREE.Object3D[] | null = null;
      const envCandidatesLazy = () => candidates ??= envCandidates(frame);
      const dynamicBudget = {left: 6};

      // Static furniture: while the mamak asset is still settling, resolve several per frame
      // (139 instances / 6 per frame ~= 1.5 s to fully settle); afterwards, one every ~0.5 s is
      // plenty to notice a later change. Only rewrites a matrix when the height actually moves.
      const staticPerFrame = staticPasses < 3 ? 6 : (staticAccum += dt) > .5 ? (staticAccum = 0, 1) : 0;
      for (let n = 0; n < staticPerFrame && staticItems.length; n++) {
        const item = staticItems[staticCursor];
        const found = probeFloor(envCandidatesLazy(), item.x, item.z, item.seedY, PROBE_RADIUS, PROBE_ANGLES);
        if (found !== null && Math.abs(found - item.floor) > .01) { item.floor = found; writeStatic(item, staticCursor); staticMesh.instanceMatrix.needsUpdate = true; }
        if (++staticCursor >= staticItems.length) { staticCursor = 0; staticPasses++; }
      }

      cursor = 0;
      const {x: vx, z: vz} = frame.viewer;

      if (!frame.local.hidden) {
        const floor = dynamicFloor(envCandidatesLazy, dynamicBudget, 'local', frame.local.x, frame.local.z, frame.local.floor);
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
        // remote.group.position.y already bakes in jump and any deck elevation; undoing just the
        // jump gives a reasonable seed for the raycast even before the cache has a real sample.
        const seed = remote.group.position.y - jump - .12;
        const floor = dynamicFloor(envCandidatesLazy, dynamicBudget, remote.id, remote.group.position.x, remote.group.position.z, seed);
        stamp(remote.group.position.x, remote.group.position.z, floor, 0, HUMAN_DIAMETER * settle, HUMAN_DIAMETER * settle, vx, vz);
      }
      frame.pedestrians.forEach((ped, i) => {
        if (!ped.person.group.visible) return;
        const floor = dynamicFloor(envCandidatesLazy, dynamicBudget, `ped${i}`, ped.person.group.position.x, ped.person.group.position.z, ped.person.group.position.y);
        stamp(ped.person.group.position.x, ped.person.group.position.z, floor, 0, HUMAN_DIAMETER, HUMAN_DIAMETER, vx, vz);
      });
      frame.animals.forEach((animal, i) => {
        const lift = animal.group.userData.poseYOffset || 0, seed = animal.group.position.y - lift;
        const floor = dynamicFloor(envCandidatesLazy, dynamicBudget, `animal${i}`, animal.group.position.x, animal.group.position.z, seed);
        stamp(animal.group.position.x, animal.group.position.z, floor, 0, PET_DIAMETER, PET_DIAMETER, vx, vz);
      });
      frame.petsForEach(group => {
        const lift = group.userData.poseYOffset || 0, seed = group.position.y - lift;
        const floor = dynamicFloor(envCandidatesLazy, dynamicBudget, `pet${group.uuid}`, group.position.x, group.position.z, seed);
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
