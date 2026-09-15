import { test, expect } from '@playwright/test';
import { moveWithCollisions, overlaps, safeDismount } from '../src/physics';
import { DeliveryMission } from '../src/mission';

test('fast movement cannot tunnel through a wall and slides along its edge', () => {
  const wall = { x: 5, z: 0, hx: .2, hz: 20 };
  const position = { x: 0, z: 0 };
  expect(moveWithCollisions(position, 30, 8, .5, [wall])).toBe(true);
  expect(position.x).toBeLessThan(4.31);
  expect(position.z).toBeCloseTo(8, 5);
  expect(overlaps(position, .5, wall)).toBe(false);
});

test('world boundaries and blocked dismounts remain safe', () => {
  const position = { x: 152, z: 152 };
  moveWithCollisions(position, 50, 50, .8, []);
  expect(position.x).toBeLessThanOrEqual(152.2);
  expect(position.z).toBeLessThanOrEqual(152.2);
  expect(safeDismount({ x: 0, z: 0 }, 0, [{ x: 0, z: 0, hx: 5, hz: 5 }])).toBeNull();
  const exit = safeDismount({ x: 0, z: 0 }, 0, [{ x: 2.2, z: 0, hx: 1, hz: 1 }]);
  expect(exit?.x).toBeLessThan(0);
});

test('a rotated object blocks at its body, not at its axis-aligned bounding square', () => {
  const yaw = Math.PI / 4;
  const car = {x: 0, z: 0, hx: 1, hz: 2.2, yaw};
  const worldPoint = (localX: number, localZ: number) => ({
    x: localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    z: -localX * Math.sin(yaw) + localZ * Math.cos(yaw),
  });

  // A character centre 47cm off the body still has a visible sliver of space; one
  // 44cm away has reached it. Both points sat inside the old inflated AABB at 45°.
  expect(overlaps(worldPoint(1.47, 0), .46, car)).toBe(false);
  expect(overlaps(worldPoint(1.44, 0), .46, car)).toBe(true);
  expect(overlaps(worldPoint(0, 2.64), .46, car)).toBe(true);
});

test('a moving Matkool bike cannot leave a player trapped inside its footprint', () => {
  const bike = { x: 0, z: 0, hx: .95, hz: 1.75, yaw: Math.PI / 2, id: 'matkool-bike' };
  const position = { x: .15, z: .2 };
  expect(moveWithCollisions(position, 0, 0, .46, [bike])).toBe(true);
  expect(overlaps(position, .46, bike)).toBe(false);
});

test('delivery only pays after pickup, within range, and on foot', () => {
  const mission = new DeliveryMission();
  expect(mission.interact(7, false)).toBeNull();
  expect(mission.interact(2, true)).toBeNull();
  expect(mission.money).toBe(0);
  expect(mission.interact(2, false)).toBe('pickup');
  expect(mission.interact(6, false)).toBeNull();
  expect(mission.interact(2, true)).toBeNull();
  expect(mission.interact(2, false)).toBe('delivered');
  expect(mission.money).toBe(25);
  expect(mission.completed).toBe(1);
  expect(mission.interact(2, false)).toBe('pickup');
  expect(mission.money).toBe(25);
  expect(new DeliveryMission(mission.save()).money).toBe(25);
});
