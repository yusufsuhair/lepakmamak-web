import * as THREE from 'three';
import shops from '../shared/mamak-shops.json';
import { loadWebAsset, type WebAssetState } from './web-assets';

/** Each shop retains its own fallback; a missing facade cannot hide its neighbours. */
export function loadMamakShops(scene: THREE.Scene, fallbacks: Map<string, THREE.Group>) {
  const status: Record<string, WebAssetState> = Object.fromEntries(shops.map(shop => [shop.asset, 'loading']));
  const settled = Promise.all(shops.map(async shop => {
    const fallback = fallbacks.get(shop.asset);
    if (!fallback) { status[shop.asset] = 'fallback'; return; }
    try {
      await loadWebAsset(`/assets/models/shops/${shop.asset}.glb`, scene,
        new THREE.Vector3(shop.x, 0, shop.z), shop.asset);
      fallback.visible = false;
      status[shop.asset] = 'ready';
    } catch (error) {
      status[shop.asset] = 'fallback';
      console.warn(`[web-assets] ${shop.label} GLB unavailable; keeping facade fallback`, error);
    }
  }));
  return {status, settled};
}
