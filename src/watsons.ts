export const watsonsSpot = { x: -56, z: -31 };

export function watsonsVolume(distance: number) {
  const t = Math.max(0, Math.min(1, (24 - distance) / 20));
  return .35 * t * t * (3 - 2 * t);
}
