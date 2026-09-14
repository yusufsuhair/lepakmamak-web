import * as THREE from 'three';
import shops from '../shared/mamak-shops.json';
import { loadWebAsset, type WebAssetState } from './web-assets';
import { lightBrands } from './brands';
// Shop GLBs come from R2 under content-hashed keys (scripts/cdn.mjs), so the JSON version is no longer the cache key.
import { cdnUrl, type CdnFile } from './cdn';

/** Each shop retains its own fallback; a missing facade cannot hide its neighbours. */
export function loadMamakShops(scene: THREE.Scene, fallbacks: Map<string, THREE.Group>) {
  const status: Record<string, WebAssetState> = Object.fromEntries(shops.map(shop => [shop.asset, 'loading']));
  const settled = Promise.all(shops.map(async shop => {
    const fallback = fallbacks.get(shop.asset);
    if (!fallback) { status[shop.asset] = 'fallback'; return; }
    try {
      const asset = await loadWebAsset(cdnUrl(`assets/models/shops/${shop.asset}.glb` as CdnFile), scene,
        new THREE.Vector3(shop.x, 0, shop.z), shop.asset);
      lightBrands(asset);
      fallback.visible = false;
      status[shop.asset] = 'ready';
    } catch (error) {
      status[shop.asset] = 'fallback';
      console.warn(`[web-assets] ${shop.label} GLB unavailable; keeping facade fallback`, error);
    }
  }));
  return {status, settled};
}
