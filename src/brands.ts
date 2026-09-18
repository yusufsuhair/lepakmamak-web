import * as THREE from 'three';
import {GM_DAY_SUN, GM_NIGHT_SUN, onSkyChange, paintSky, skyPalette, skyState, type SkyPalette} from './weather';

/** Night lighting and glass reflections for the branded stops: the Shell forecourt, the KFC and
 * McDonald's drive-throughs and the LM_SHOP shoplots (scripts/blender/brand_kit.py). The material
 * names are the contract:
 *   'Night glow LED' / 'Night glow sign'   emissive white times the vertex colour, so one draw
 *                                          lights every colour of a fascia; dimmer by day
 *   'Night glow menu ...' / 'Night glow shelves'   pictures that are their own emission map
 *   'Night wash'                           additive pools of light, drawn only at night
 *   '... glass', 'Satin metal'             reflect a small painted street under the current sky as
 *                                          their own envMap, which wins over the scene.environment
 *                                          sky-ibl.ts sets for everything else on High graphics quality
 * Night is a flag, so an outlet that streams in after dark still lights up. */
const GLOW: [prefix: string, day: number, night: number][] = [
  ['Night glow LED', 1.1, 2.6], ['Night glow sign', .3, 1.2], ['Night glow menu', .6, 1.35], ['Night glow shelves', .16, .8],
];
const glows: {material: THREE.MeshStandardMaterial; day: number; night: number}[] = [];
const washes: THREE.Material[] = [];
const reflective: {material: THREE.MeshStandardMaterial; day: number; night: number}[] = [];
let brandsNight = false, street: THREE.CanvasTexture | null = null;

/** Equirectangular street: the current sky (weather.ts) above, a band of buildings, trees and lamps at
 * the horizon, pavement below, all dimmed with the light. Row 0 is straight up. A shopfront has the
 * street, not the sky, in most of its glass. */
function paintStreet(sky: Readonly<SkyPalette>, night: boolean) {
  const w = 512, h = 256, canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!, horizon = h / 2;
  paintSky(ctx, w, h, sky);
  // How lit the street is: the horizon's own brightness, full by day, about a fifth at night, less in rain.
  const hz = sky.horizon.clone().convertLinearToSRGB(), level = THREE.MathUtils.clamp((hz.r * .2126 + hz.g * .7152 + hz.b * .0722) / .8, .12, 1);
  const grey = (v: number, r = 1, g = .98, b = .95) => `rgb(${Math.round(v * level * r)},${Math.round(v * level * g)},${Math.round(v * level * b)})`;
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, grey(141, 1, .98, .93)); ground.addColorStop(1, grey(62));
  ctx.fillStyle = ground; ctx.fillRect(0, horizon, w, h - horizon);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let x = 0; x < w;) {
    const bw = 14 + rnd() * 40, bh = 10 + rnd() * 46;
    ctx.fillStyle = grey(120 + rnd() * 70); ctx.fillRect(x, horizon - bh, bw, bh + 2);
    if (night) for (let k = 0; k < bw * bh / 30; k++) { ctx.fillStyle = rnd() > .5 ? '#ffd9a0' : '#bcd4ff'; ctx.fillRect(x + rnd() * bw, horizon - rnd() * bh, 1.5, 1.5); }
    x += bw + rnd() * 6;
  }
  ctx.fillStyle = grey(107, .74, 1, .65);
  for (let x = 0; x < w; x += 9 + rnd() * 20) { ctx.beginPath(); ctx.arc(x, horizon - 4, 5 + rnd() * 7, 0, Math.PI * 2); ctx.fill(); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace; texture.name = 'brands street probe';
  return texture;
}

/** A new street probe when the sky or night changes, never per frame: three caches the PMREM per texture. */
function repaintStreet() {
  if (!reflective.length) return;
  const old = street;
  street = paintStreet(skyState() ?? skyPalette(brandsNight ? GM_NIGHT_SUN : GM_DAY_SUN, 'sunny'), brandsNight);
  for (const entry of reflective) apply(entry, 'reflect');
  old?.dispose();
}
onSkyChange(repaintStreet);

function apply(entry: {material: THREE.MeshStandardMaterial; day: number; night: number}, kind: 'glow' | 'reflect') {
  if (kind === 'glow') entry.material.emissiveIntensity = brandsNight ? entry.night : entry.day;
  else { entry.material.envMap = street; entry.material.envMapIntensity = brandsNight ? entry.night : entry.day; }
}

/** Register a freshly loaded branded model. Materials are shared by clones, so once is enough. */
export function lightBrands(model: THREE.Object3D) {
  const seen = new Set<THREE.Material>();
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (material.name === 'Night wash') mesh.castShadow = mesh.receiveShadow = false;
    if (material.name.endsWith('glass')) mesh.castShadow = false;
    if (seen.has(material) || material.userData.brand) return;
    seen.add(material); material.userData.brand = true;
    const glow = GLOW.find(([prefix]) => material.name.startsWith(prefix));
    if (glow) {
      if (material.vertexColors) {
        // emissive (white) times the vertex colour: a red lightbox glows red, its letters white
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\n#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\ntotalEmissiveRadiance *= vColor.rgb;\n#endif');
        };
        material.customProgramCacheKey = () => 'brands-glow-vcolor';
      }
      const entry = {material, day: glow[1], night: glow[2]}; glows.push(entry); apply(entry, 'glow');
    } else if (material.name === 'Night wash') {
      // light, not paint: the pool texture is emission over black, added on top of the ground
      Object.assign(material, {blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4});
      material.color.setRGB(0, 0, 0); material.emissive.set('#ffe7c2'); material.emissiveIntensity = .9; material.needsUpdate = true;
      material.visible = brandsNight; washes.push(material);
    } else if (material.name.endsWith('glass') || material.name === 'Satin metal') {
      const glass = material.name.endsWith('glass');
      if (glass) { material.depthWrite = false; material.side = THREE.DoubleSide; }
      const entry = {material, day: glass ? 1.0 : .55, night: glass ? .9 : .35}; reflective.push(entry);
      if (street) apply(entry, 'reflect'); else repaintStreet();
      material.needsUpdate = true;
    }
  });
}

export function setBrandsNight(night: boolean) {
  const changed = night !== brandsNight;
  brandsNight = night;
  if (changed) repaintStreet();
  for (const entry of glows) apply(entry, 'glow');
  for (const entry of reflective) apply(entry, 'reflect');
  for (const material of washes) material.visible = night;
}

export const brandsStatus = () => ({night: brandsNight, glows: glows.length, washes: washes.length, reflective: reflective.length});
