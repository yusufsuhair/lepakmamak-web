import {clampWorldPoint,insideWorld} from '../shared/world-bounds.mjs';
export interface Solid { x: number; z: number; hx: number; hz: number; yaw?: number; id?: string; cameraTop?:number }
export interface Point { x: number; z: number }
export const WORLD_LIMIT = 153;

export function overlaps(point: Point, radius: number, solid: Solid): boolean {
  // Solids are stored in their object's local footprint. Static city blocks omit yaw,
  // while cars carry their live rotation so their wide side never behaves like their
  // long bonnet. Transforming the player into that local space keeps the same cheap
  // circle-vs-box test without inflating a turned object to a large world-space AABB.
  const worldX = point.x - solid.x, worldZ = point.z - solid.z;
  const yaw = solid.yaw || 0, cos = Math.cos(yaw), sin = Math.sin(yaw);
  const localX = worldX * cos - worldZ * sin;
  const localZ = worldX * sin + worldZ * cos;
  const dx = localX - Math.max(-solid.hx, Math.min(localX, solid.hx));
  const dz = localZ - Math.max(-solid.hz, Math.min(localZ, solid.hz));
  return dx * dx + dz * dz < radius * radius;
}

// A moving prop can cross the player between frames. Push the player to the nearest free
// side before applying input so a transient overlap cannot become a permanent deadlock.
function separateFromSolid(position: Point, radius: number, solid: Solid): boolean {
  const yaw = solid.yaw || 0, cos = Math.cos(yaw), sin = Math.sin(yaw);
  const worldX = position.x - solid.x, worldZ = position.z - solid.z;
  const localX = worldX * cos - worldZ * sin, localZ = worldX * sin + worldZ * cos;
  const nearestX = Math.max(-solid.hx, Math.min(localX, solid.hx));
  const nearestZ = Math.max(-solid.hz, Math.min(localZ, solid.hz));
  let nx = localX - nearestX, nz = localZ - nearestZ, distance = Math.hypot(nx, nz), push: number;
  if (distance > .0001) {
    if (distance >= radius) return false;
    nx /= distance; nz /= distance; push = radius - distance + .02;
  } else {
    const xGap = solid.hx - Math.abs(localX), zGap = solid.hz - Math.abs(localZ);
    if (xGap <= zGap) { nx = localX < 0 ? -1 : 1; nz = 0; push = radius + xGap + .02; }
    else { nx = 0; nz = localZ < 0 ? -1 : 1; push = radius + zGap + .02; }
  }
  position.x += (nx * cos + nz * sin) * push;
  position.z += (-nx * sin + nz * cos) * push;
  return true;
}

function recoverFromOverlaps(position: Point, radius: number, solids: Solid[]): boolean {
  let moved = false;
  // Three passes handle a moving vehicle that has squeezed the player against a wall without
  // turning collision recovery into an unbounded loop when two solids overlap by design.
  for (let pass = 0; pass < 3; pass++) {
    let passMoved = false;
    for (const solid of solids) if (separateFromSolid(position, radius, solid)) passMoved = moved = true;
    if (!passMoved) break;
  }
  return moved;
}

/** Small steps prevent tunnelling; independent axes let a player slide along walls. */
export function moveWithCollisions(position: Point, dx: number, dz: number, radius: number, solids: Solid[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.55)));
  let hit = recoverFromOverlaps(position, radius, solids);
  for (let i = 0; i < steps; i++) {
    const nextX = clampWorldPoint(position.x + dx / steps,position.z,radius).x;
    if (!solids.some(s => overlaps({ x: nextX, z: position.z }, radius, s))) position.x = nextX;
    else hit = true;
    const nextZ = clampWorldPoint(position.x,position.z + dz / steps,radius).z;
    if (!solids.some(s => overlaps({ x: position.x, z: nextZ }, radius, s))) position.z = nextZ;
    else hit = true;
  }
  return hit;
}

export function safeDismount(position: Point, yaw: number, solids: Solid[], distance = 2.2): Point | null {
  for (const offset of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
    const point = { x: position.x + Math.sin(yaw + offset) * distance, z: position.z + Math.cos(yaw + offset) * distance };
    if (insideWorld(point.x,point.z,1) && !solids.some(s => overlaps(point, 0.48, s))) return point;
  }
  return null;
}

export function dampAngle(current: number, target: number, factor: number): number {
  return current + Math.atan2(Math.sin(target - current), Math.cos(target - current)) * factor;
}
