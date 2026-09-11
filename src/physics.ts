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

/** Small steps prevent tunnelling; independent axes let a player slide along walls. */
export function moveWithCollisions(position: Point, dx: number, dz: number, radius: number, solids: Solid[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.55)));
  let hit = false;
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
