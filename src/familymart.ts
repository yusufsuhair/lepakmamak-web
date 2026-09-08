export const familyMartSpot = { x: 49, z: 43 };

export function familyMartVolume(distance: number) {
  const t = Math.max(0, Math.min(1, (24 - distance) / 20));
  return .3 * t * t * (3 - 2 * t);
}
