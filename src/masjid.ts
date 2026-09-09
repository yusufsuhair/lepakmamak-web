export const masjidSpots = [
  { name: 'Masjid Kampung Maju', x: 117, z: 115 },
  { name: 'Masjid Lepak', x: 117, z: -37 },
] as const;

export function nearestMasjidDistance(position: { x: number; z: number }) {
  return Math.min(...masjidSpots.map(spot => Math.hypot(position.x - spot.x, position.z - spot.z)));
}

// Clear around the mosque grounds, then fade smoothly to silence at 32 metres.
export function masjidVolume(distance: number) {
  const t = Math.max(0, Math.min(1, (32 - distance) / 26));
  return .38 * t * t * (3 - 2 * t);
}
