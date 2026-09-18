import * as THREE from 'three';
import {onSkyProbe} from './weather';

/** Wires the shared sky probe (weather.ts onSkyProbe) into scene.environment on High graphics quality:
 * the fallback envMap for the ~1,100 MeshStandardMaterials that carry none of their own (chairs, tables,
 * stainless steel, characters, generic buildings), so they pick up sky-tinted specular and diffuse
 * response instead of reading as matte plastic under bare directional/hemisphere light.
 *
 * A material's own envMap still wins: WebGLRenderer resolves `material.envMap || scene.environment`
 * per material every frame and only recompiles the ones whose result actually changed (its own
 * needsProgramChange diff, not a scene.traverse we run) — so klcc.ts/skyline.ts/brands.ts/lrt.ts glass
 * is untouched and toggling quality costs one recompile per affected material, not two. The probe is the
 * SAME texture object those modules already assign to material.envMap; three's WebGLEnvironments PMREM
 * cache is keyed by texture identity, so this reuses their conversion rather than running a second one. */

// Full-strength probe roughly doubled the ambient the HemisphereLight already supplies (measured by
// sampling mean screenshot luminance at spawn — see tests/sky-ibl.spec.ts and the commit body). .4 keeps
// IBL visible as sky-tinted sheen without pushing overall brightness past the ±5% budget; the hemisphere
// is cut to HEMI_SCALE alongside it to give back the diffuse half IBL now supplies on top of it, so
// day/night brightness at spawn stays where it was before this feature.
export const ENV_INTENSITY = .3;
export const HEMI_SCALE = .88;

export const skyIblStatus = {enabled: false};
let probeTexture: THREE.Texture | null = null;

/** Call once at startup, before the first render (main.ts lighting init, right after the scene and
 * HemisphereLight exist): subscribes to the shared probe so a texture is ready the moment applyQuality()
 * first runs. Never assigns scene.environment itself — only setSkyIblQuality does that, gated to High —
 * so this alone costs nothing on touch or Low/Lowest. */
export function setupSkyIbl(scene: THREE.Scene) {
  scene.environmentIntensity = ENV_INTENSITY;
  onSkyProbe(texture => { probeTexture = texture; if (skyIblStatus.enabled) scene.environment = texture; });
  ((window as any).__lepakRealism ??= {}).skyIbl = skyIblStatus;
}

/** Called from applyQuality() on every quality change, including the first: scene.environment only at
 * High, cleared completely below it so Low/Lowest render exactly as they did before this feature, with
 * the HemisphereLight compensation undone in the same step (see weather.ts setHemisphereScale). */
export function setSkyIblQuality(scene: THREE.Scene, weatherUI: {setHemisphereScale(factor: number): void}, high: boolean) {
  skyIblStatus.enabled = high;
  scene.environment = high ? probeTexture : null;
  weatherUI.setHemisphereScale(high ? HEMI_SCALE : 1);
}
