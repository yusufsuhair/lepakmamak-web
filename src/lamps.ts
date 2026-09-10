// How close you have to stand to reach a lamp's switch. As generous as a traffic car,
// because a lamp post is five metres tall and you are usually looking up at it from the
// pavement. Widening it is only safe because the prompt goes to whichever candidate is
// actually nearest, so a lamp cannot take a car's or a chair's prompt away.
export const LAMP_REACH = 5;

// Every lamp in the city is switchable: this only picks the nearest one within reach, and
// there is no subset that behaves differently.
export function nearestLamp(lamps: {x: number; z: number}[], x: number, z: number, reach = LAMP_REACH) {
  let best = -1, closest = reach;
  for (let index = 0; index < lamps.length; index++) {
    const away = Math.hypot(x - lamps[index].x, z - lamps[index].z);
    if (away < closest) { closest = away; best = index; }
  }
  return best;
}
