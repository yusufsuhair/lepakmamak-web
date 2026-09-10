export type RemotePoint = {x: number; z: number};

export function horizontalDistance(a: RemotePoint, b: RemotePoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function remoteIsVisible(target: RemotePoint, viewer: RemotePoint, range: number) {
  return horizontalDistance(target, viewer) < range;
}

// A teleport or a server correction can leave the rendered group far behind its
// authoritative target. Smooth ordinary movement; apply a large correction at once so
// visibility is evaluated at the new place rather than stranding an avatar at the old one.
export function remoteNeedsSnap(current: RemotePoint, target: RemotePoint, threshold = 40) {
  return horizontalDistance(current, target) > threshold;
}
