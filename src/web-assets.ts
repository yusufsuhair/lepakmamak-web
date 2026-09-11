import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export type WebAssetState = 'loading' | 'ready' | 'fallback';

export interface WebAssetPlacement { x: number; y: number; z: number; yaw: number; scale: number }

/** Prepare a complete reusable model without attaching partial results to the live world. */
export async function loadInstancedWebAsset(url: string, placements: WebAssetPlacement[], name: string) {
  const gltf = await loader.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const group = new THREE.Group(); group.name = name;
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  gltf.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const mesh = new THREE.InstancedMesh(geometry, object.material, placements.length);
    mesh.name = object.name;
    placements.forEach((point, index) => {
      position.set(point.x, point.y, point.z); scale.setScalar(point.scale);
      quaternion.setFromAxisAngle(up, point.yaw);
      mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    object.geometry.dispose();
  });
  if (!group.children.length) throw new Error(`Empty web asset: ${name}`);
  group.userData.instances = placements.length;
  return group;
}

export function disposeWebAsset(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) material.dispose();
}

export async function loadWebAsset(url: string, scene: THREE.Scene, position: THREE.Vector3, name: string) {
  const gltf = await loader.loadAsync(url);
  const asset = gltf.scene;
  asset.name = name;
  asset.position.copy(position);
  asset.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
  });
  scene.add(asset);
  return asset;
}
