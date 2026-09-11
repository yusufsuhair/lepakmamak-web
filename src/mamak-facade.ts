import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeWebAsset} from './web-assets';

export const MAMAK_FACADE_URL = '/assets/models/environment/LM_ENV_MamakFacade.glb?v=facade-1';

/** Optional overhead kit. Never hides/replaces the accepted site or its fallback. */
export function createMamakFacade(scene: THREE.Scene) {
  let asset: THREE.Group | undefined;
  let lamps: THREE.MeshStandardMaterial[] = [];
  let pending: Promise<void> | undefined;
  let enabled = true;
  const status = {state: 'idle' as 'idle'|'loading'|'ready'|'unavailable', night: false,
    draws: 0, triangles: 0, lampCount: 0, intensity: 0};
  function setNight(night: boolean) {
    status.night = night;
    status.intensity = night ? 2.0 : .04;
    for (const material of lamps) material.emissiveIntensity = status.intensity;
  }
  function load() {
    return pending ??= (async () => {
      status.state = 'loading';
      let candidate: THREE.Group | undefined;
      try {
        candidate = (await new GLTFLoader().loadAsync(MAMAK_FACADE_URL)).scene;
        candidate.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(candidate);
        const newLamps: THREE.MeshStandardMaterial[] = [];
        let draws = 0, triangles = 0, lampCount = 0;
        candidate.traverse(object => {
          if (object instanceof THREE.Light) throw new Error('Facade must not export real-time lights');
          if (!(object instanceof THREE.Mesh)) return;
          const origin = object.userData.lm_origin_world;
          if (object.userData.lm_version !== 1 || !Array.isArray(origin) ||
            origin.length !== 3 || origin.some((value, index) => value !== [-29, 3.555, 30][index]))
            throw new Error('Facade placement contract mismatch');
          if (object.name === 'LM_ENV_MamakFacade_Lamps') {
            object.material = Array.isArray(object.material)
              ? object.material.map(material => material.clone()) : object.material.clone();
          }
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
          draws += materials.length;
          for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) throw new Error('Facade requires PBR materials');
            if (object.name === 'LM_ENV_MamakFacade_Lamps') {
              material.emissive.set('#ffcc88');
              newLamps.push(material);
            }
          }
          lampCount += Number(object.userData.lm_lamp_count || 0);
          object.castShadow = object.receiveShadow = true;
        });
        if (!draws || draws > 6 || triangles > 12000 || bounds.min.y + 3.555 < 3.5 || lampCount !== 4 || !newLamps.length)
          throw new Error('Invalid or over-budget facade kit');
        candidate.name = 'LM_ENV_MamakFacade';
        candidate.position.set(-29, 3.555, 30);
        candidate.visible = enabled;
        asset = candidate;
        lamps = newLamps;
        setNight(status.night);
        scene.add(asset);
        Object.assign(status, {state: 'ready', draws, triangles, lampCount});
      } catch (error) {
        if (candidate) disposeWebAsset(candidate);
        status.state = 'unavailable';
        console.warn('[mamak-facade] Optional detail unavailable; existing Mamak retained', error);
      }
    })();
  }
  return {load, setNight, status, get asset() { return asset; },
    setVisible(value: boolean) { enabled = value; if (asset) asset.visible = value; }};
}
