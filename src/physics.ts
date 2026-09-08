export interface Solid { x: number; z: number; hx: number; hz: number }
export interface Point { x: number; z: number }
export const WORLD_LIMIT = 153;

export function overlaps(point: Point, radius: number, solid: Solid): boolean {
  const dx = point.x - Math.max(solid.x - solid.hx, Math.min(point.x, solid.x + solid.hx));
  const dz = point.z - Math.max(solid.z - solid.hz, Math.min(point.z, solid.z + solid.hz));
  return dx * dx + dz * dz < radius * radius;
}

/** Small steps prevent tunnelling; independent axes let a player slide along walls. */
export function moveWithCollisions(position: Point, dx: number, dz: number, radius: number, solids: Solid[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.55)));
  let hit = false;
  for (let i = 0; i < steps; i++) {
    const nextX = Math.max(-WORLD_LIMIT + radius, Math.min(WORLD_LIMIT - radius, position.x + dx / steps));
    if (!solids.some(s => overlaps({ x: nextX, z: position.z }, radius, s))) position.x = nextX;
    else hit = true;
    const nextZ = Math.max(-WORLD_LIMIT + radius, Math.min(WORLD_LIMIT - radius, position.z + dz / steps));
    if (!solids.some(s => overlaps({ x: position.x, z: nextZ }, radius, s))) position.z = nextZ;
    else hit = true;
  }
  return hit;
}

export function safeDismount(position: Point, yaw: number, solids: Solid[]): Point | null {
  for (const offset of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
    const point = { x: position.x + Math.sin(yaw + offset) * 2.2, z: position.z + Math.cos(yaw + offset) * 2.2 };
    if (Math.abs(point.x) < WORLD_LIMIT - 1 && Math.abs(point.z) < WORLD_LIMIT - 1 && !solids.some(s => overlaps(point, 0.48, s))) return point;
  }
  return null;
}

export function dampAngle(current: number, target: number, factor: number): number {
  return current + Math.atan2(Math.sin(target - current), Math.cos(target - current)) * factor;
}
