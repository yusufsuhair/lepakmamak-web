import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export type WebAssetState = 'loading' | 'ready' | 'fallback';

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
