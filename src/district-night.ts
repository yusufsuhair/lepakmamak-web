import * as THREE from 'three';
import {prepareLeaves} from './foliage';

/** Load-time dressing and night lighting for the photographic districts: LM_ENV_Kampung,
 * LM_ENV_Zoo, LM_ENV_Basketball and LM_ENV_Pickleball (scripts/blender/build_kampung.py,
 * build_zoo_negara.py, build_courts.py). Material names are the contract:
 *   'Night glow <kind>'  emissive, dark by day and GLOW[kind] at night (floodlight lenses, lamps,
 *                        lit windows behind louvres and kerawang)
 *   'Night wash <kind>'  additive pools of light on the ground: the texture moves to emission over
 *                        a black base, tinted WASH[kind], hidden by day so it costs nothing
 *   'Ground ...'         terrain and court surfaces: receive shadows, never cast them
 * Alpha-tested cards (leaves, chain link, nets) get the city trees' leaf shading. Night is a flag,
 * so a district that streams in after dark lights up. */
const GLOW: Record<string, number> = {'Night glow floodlight': 3.2, 'Night glow lamp': 2.6, 'Night glow window': .55};
const WASH: Record<string, [string, number]> = {'Night wash floodlight': ['#e6eeff', .42], 'Night wash lamp': ['#ffbd73', .75]};
const glows: {material: THREE.MeshStandardMaterial; intensity: number}[] = [];
const washes: THREE.Mesh[] = [];
let districtNight = false;

export function dressDistrict(model: THREE.Object3D) {
  prepareLeaves(model);
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    mesh.castShadow = !material.name.startsWith('Ground') && !material.transparent;
    mesh.receiveShadow = true;
    if (material.transparent) material.depthWrite = false;
    if (material.name in GLOW) {
      if (!glows.some(glow => glow.material === material)) glows.push({material, intensity: GLOW[material.name]});
    } else if (material.name in WASH) {
      material.emissiveMap = material.map ?? material.emissiveMap; material.map = null; material.color.setRGB(0, 0, 0);
      material.emissive.set(WASH[material.name][0]); material.emissiveIntensity = WASH[material.name][1];
      Object.assign(material, {blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
      material.needsUpdate = true;
      mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = 2; washes.push(mesh);
    }
  });
  setDistrictNight(districtNight);
}

export function setDistrictNight(night: boolean) {
  districtNight = night;
  for (const glow of glows) glow.material.emissiveIntensity = night ? glow.intensity : 0;
  for (const wash of washes) wash.visible = night;
}
