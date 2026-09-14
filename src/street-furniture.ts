import * as THREE from 'three';
import {ROAD_X, ROAD_Z} from './ground';

/** Feeder bus stops beside each LRT station's stair tower, on the verge, facing the road (local +z). */
export const BUS_STOPS = [
  {x: 40, z: 89, yaw: Math.PI}, {x: -40, z: 89, yaw: Math.PI}, {x: -40, z: -75, yaw: 0}, {x: 40, z: -75, yaw: 0},
  {x: 87, z: -38, yaw: -Math.PI / 2}, {x: 87, z: 38, yaw: -Math.PI / 2}, {x: -93, z: 38, yaw: Math.PI / 2}, {x: -93, z: -38, yaw: Math.PI / 2},
];

/** Every road crossing, and whether its north-south approaches show green. The phases alternate
 * like a checkerboard so the whole city is never red at once. */
export const JUNCTIONS = ROAD_X.flatMap((x, i) => ROAD_Z.map((z, j) => ({x, z, nsGo: (i + j) % 2 === 0})));

/** Instance the furniture LM_ENV_Furniture carries once as prototypes (scripts/blender/
 * furniture_models.py): a junction's signal poles and bollards, its lenses in each phase, and the
 * bus shelter. One draw per prototype material for the whole city. Skin only: no colliders.
 * Returns the number of instanced meshes made. */
export function instanceStreetFurniture(model: THREE.Object3D): number {
  const up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const at = (x: number, z: number, yaw = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(up, yaw), one);
  const placements: Record<string, THREE.Matrix4[]> = {
    junction: JUNCTIONS.map(j => at(j.x, j.z)),
    junction_lens_ns_go: JUNCTIONS.filter(j => j.nsGo).map(j => at(j.x, j.z)),
    junction_lens_ns_stop: JUNCTIONS.filter(j => !j.nsGo).map(j => at(j.x, j.z)),
    bus_stop: BUS_STOPS.map(s => at(s.x, s.z, s.yaw)),
  };
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert();
  let made = 0;
  for (const [name, matrices] of Object.entries(placements)) {
    const prototype = model.getObjectByName(name);
    if (!prototype) continue;
    prototype.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const mesh = new THREE.InstancedMesh(geometry, object.material, matrices.length);
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.name = object.name; mesh.castShadow = object.castShadow; mesh.receiveShadow = true;
      mesh.computeBoundingSphere(); model.add(mesh); made++;
    });
    prototype.removeFromParent();
  }
  return made;
}
