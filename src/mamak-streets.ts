import * as THREE from 'three';
import layout from '../shared/mamak-streets.json';
import { disposeWebAsset, loadInstancedWebAsset } from './web-assets';

interface StreetLights {
  lamps: {x: number; z: number; axis: 'ns' | 'ew'; side: number}[];
  useBlenderBodies(indices: number[]): void;
}

/** Switch the neighbourhood scenery atomically; lamp state/glows keep their existing IDs. */
export async function installMamakStreets(scene: THREE.Scene, fallback: THREE.Group, lights: StreetLights) {
  const region = layout.switchableLampRegion;
  const selected = lights.lamps.flatMap((lamp, index) =>
    lamp.x >= region.minX && lamp.x <= region.maxX && lamp.z >= region.minZ && lamp.z <= region.maxZ ? [{lamp, index}] : []);
  const lamps = [...layout.lamps, ...selected.map(({lamp}) => ({
    x: lamp.x, y: 0, z: lamp.z, scale: 1,
    yaw: lamp.axis === 'ns' ? (lamp.side < 0 ? 0 : Math.PI) : (lamp.side < 0 ? -Math.PI / 2 : Math.PI / 2),
  }))];
  const assets = [
    ['LM_PROP_PalmMamak', layout.palms], ['LM_PROP_BenchMamak', layout.benches],
    ['LM_PROP_PlanterMamak', layout.planters], ['LM_PROP_StreetLamp', lamps],
  ] as const;
  const results = await Promise.allSettled(assets.map(([name, points]) =>
    loadInstancedWebAsset(`/assets/models/props/${name}.glb`, [...points], name)));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) {
    for (const result of results) if (result.status === 'fulfilled') disposeWebAsset(result.value);
    throw failed.reason;
  }
  const group = new THREE.Group(); group.name = 'LM_ENV_MamakStreets';
  for (const result of results) if (result.status === 'fulfilled') group.add(result.value);
  group.userData.switchableLampIndices = selected.map(({index}) => index);
  scene.add(group);
  lights.useBlenderBodies(group.userData.switchableLampIndices);
  fallback.visible = false;
  return group;
}
