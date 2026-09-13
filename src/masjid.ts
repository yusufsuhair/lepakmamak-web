import {AdditiveBlending, type Mesh, type MeshStandardMaterial, type Object3D} from 'three';

export const masjidSpots = [
  { name: 'Masjid Kampung Maju', x: 54, z: 129 },
] as const;

export function nearestMasjidDistance(position: { x: number; z: number }) {
  return Math.min(...masjidSpots.map(spot => Math.hypot(position.x - spot.x, position.z - spot.z)));
}

// Clear around the mosque grounds, then fade smoothly to silence at 32 metres.
export function masjidVolume(distance: number) {
  const t = Math.max(0, Math.min(1, (32 - distance) / 26));
  return .38 * t * t * (3 - 2 * t);
}

// Night lighting for LM_ENV_Masjid.glb (scripts/blender/build_masjid.py). The material names are
// the contract: LED strips, lanterns, jali openings and the lit interior only emit at night, and
// the 'Night wash' planes become additive warm uplight on the walls and green floodlight on the
// domes, hidden by day so they cost nothing. Night is a flag, so a model that streams in after
// dark still lights up.
const NIGHT_GLOW: Record<string, number> = {'Night LED green': 2.6, 'Night lantern': 2.2, 'Night glow jali': 1.7, 'Night glow interior': .8};
const glows: {material: MeshStandardMaterial; intensity: number}[] = [];
const washes: Mesh[] = [];
let masjidNight = false;

export function lightMasjid(model: Object3D) {
  model.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    if (material.name in NIGHT_GLOW) glows.push({material, intensity: NIGHT_GLOW[material.name]});
    else if (material.name.startsWith('Night wash')) {
      // Light, not paint: the wash texture moves to emission over a black base and is added on top.
      material.emissiveMap = material.map; material.map = null; material.color.setRGB(0, 0, 0);
      material.emissive.set(material.name.endsWith('green') ? '#25b865' : '#ffb869'); material.emissiveIntensity = 1;
      Object.assign(material, {blending: AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
      material.needsUpdate = true;
      mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = 2; washes.push(mesh);
    }
  });
  setMasjidNight(masjidNight);
}

export function setMasjidNight(night: boolean) {
  masjidNight = night;
  for (const glow of glows) glow.material.emissiveIntensity = night ? glow.intensity : 0;
  for (const wash of washes) wash.visible = night;
}
