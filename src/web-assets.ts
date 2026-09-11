import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export type WebAssetState = 'loading' | 'ready' | 'fallback';

export interface WebAssetPlacement { x: number; y: number; z: number; yaw: number; scale: number }

export interface MamakLighting {
  bulbCount: number;
  setNight(night: boolean): void;
  readonly intensity: number;
}

/** Isolate the festoon primitive's shared cream material, then fake warm bulbs cheaply. */
export function configureMamakLighting(asset: THREE.Group): MamakLighting {
  const festoon = asset.getObjectByName('LM_ENV_MamakMaju_Festoon');
  if (!festoon) throw new Error('Mamak v5 festoon node is missing');
  const bulbs: THREE.MeshStandardMaterial[] = [];
  const warmth = {value: 0};
  // Three soft pools reach the paving and service frontage under the canopy.
  // Applied only to the Mamak asset; no extra draws, textures or light variants.
  asset.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.parent === festoon || mesh === festoon) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const copies = materials.map(source => {
      const material = source.clone() as THREE.MeshStandardMaterial;
      if (!material.isMeshStandardMaterial) return material;
      material.onBeforeCompile = shader => {
        shader.uniforms.lmWarmth = warmth;
        shader.vertexShader = 'varying vec3 lmPosition;\nvarying vec3 lmNormal;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nlmPosition = position;\nlmNormal = normal;');
        shader.fragmentShader = 'uniform float lmWarmth;\nvarying vec3 lmPosition;\nvarying vec3 lmNormal;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float zone = 1.0 - smoothstep(3.5, 5.0, lmPosition.y);
          float pools = 0.0;
          for (int i = 0; i < 3; i++) {
            vec2 delta = (lmPosition.xz - vec2(-11.0 + float(i)*11.0, 8.2)) / vec2(6.2, 5.0);
            vec3 toLamp = vec3(-11.0 + float(i)*11.0, 3.70, 10.0) - lmPosition;
            float facing = 0.18 + 0.82 * max(dot(normalize(lmNormal), normalize(toLamp)), 0.0);
            pools += exp(-dot(delta,delta)*1.8) * facing;
          }
          outgoingLight += diffuseColor.rgb * vec3(1.0, 0.52, 0.19) * min(pools,1.0) * zone * lmWarmth;
          #include <opaque_fragment>`);
      };
      material.customProgramCacheKey = () => 'lm-canopy-warmth-v7';
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? copies : copies[0];
  });
  festoon.traverse(object => {
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = source.map(material => {
      const copy = material.clone();
      if ((copy as THREE.MeshStandardMaterial).isMeshStandardMaterial && copy.name === 'LM_Wall_Cream') {
        const bulb = copy as THREE.MeshStandardMaterial;
        bulb.emissive.set('#ffb45c');
        bulbs.push(bulb);
      }
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
  });
  if (!bulbs.length) throw new Error('Mamak v5 festoon bulb material is missing');
  let intensity = 0.08;
  const setNight = (night: boolean) => {
    intensity = night ? 2.4 : 0.08;
    warmth.value = night ? 0.85 : 0;
    for (const material of bulbs) material.emissiveIntensity = intensity;
  };
  setNight(false);
  return { bulbCount: Number(festoon.userData.lm_bulb_count || 0), setNight, get intensity() { return intensity; } };
}

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
