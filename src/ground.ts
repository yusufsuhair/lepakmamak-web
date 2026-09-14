import * as THREE from 'three';
import {onSkyChange} from './weather';

/** The photographic city ground. The road, kerb, slab and apron boxes in createWorld keep their
 * sizes and heights; only their materials change. Each material projects its textures in world
 * space (top faces on x/z, sides on their own plane), so a 312 m road box tiles at real scale
 * with no UVs, and the static batch that merges every box by material keeps one draw per
 * surface. Wheel paths, oil drips, repairs, manholes, gully grates, kerb paint and road markings
 * are placed from world position against the road grid below, not baked into a repeating tile.
 * Textures come from scripts/blender/build_ground.py. */
export const ROAD_X = [0, 76, -82], ROAD_Z = [-64, 8, 78];
export const ROAD_HALF = 8.5, KERB_INNER = 8.575, KERB_WIDTH = 1.25;
const GROUND_TEXTURES = 'ground-v1';
/** The ground mask texture covers x and z in ±MASK_EXTENT. */
const MASK_EXTENT = 160;

type Kind = 'asphalt' | 'kerb' | 'slab' | 'apron' | 'lines';
const FALLBACK: Record<Kind, string> = {asphalt: '#637373', kerb: '#ddd3b9', slab: '#c3bba4', apron: '#829178', lines: '#e3d8ad'};

const shared = {
  gAsphalt: {value: null as THREE.Texture | null}, gAsphaltN: {value: null as THREE.Texture | null},
  gPaver: {value: null as THREE.Texture | null}, gPaverN: {value: null as THREE.Texture | null},
  gConcrete: {value: null as THREE.Texture | null}, gConcreteN: {value: null as THREE.Texture | null},
  gGrass: {value: null as THREE.Texture | null}, gGrassN: {value: null as THREE.Texture | null},
  gMacro: {value: null as THREE.Texture | null}, gMask: {value: null as THREE.Texture | null},
  gReady: {value: 0},
  // Rain (weather.ts): 1 soaks every surface, and the wet sheen takes the sky's horizon colour.
  gWet: {value: 0}, gSky: {value: new THREE.Color('#9aa6ab')},
};
/** Read-only view of the wet-ground state, for tests and debugging. */
export const groundWeather = {get wet() { return shared.gWet.value; }, get sky() { return `#${shared.gSky.value.getHexString()}`; }};
onSkyChange(sky => { shared.gWet.value = sky.wet; shared.gSky.value.copy(sky.horizon); });
/** How each surface takes the rain: [darkening when soaked, wet roughness ceiling, puddle share]. */
const WET: Record<Kind, [number, number, number]> = {asphalt: [.45, .3, 1], lines: [.25, .32, .6], kerb: [.3, .45, .35], slab: [.22, .62, .2], apron: [.18, .8, 0]};
let loading: Promise<void> | undefined;
function loadTextures() {
  if (loading) return;
  const loader = new THREE.TextureLoader();
  const names: [keyof typeof shared, string, boolean][] = [
    ['gAsphalt', 'asphalt-color', true], ['gAsphaltN', 'asphalt-normal', false], ['gPaver', 'pavers-color', true], ['gPaverN', 'pavers-normal', false],
    ['gConcrete', 'concrete-color', true], ['gConcreteN', 'concrete-normal', false], ['gGrass', 'grass-color', true], ['gGrassN', 'grass-normal', false],
    ['gMacro', 'macro', false],
  ];
  loading = Promise.all(names.map(([uniform, name, colour]) => new Promise<void>(done => {
    const texture = loader.load(`/assets/textures/ground/${name}.webp?v=${GROUND_TEXTURES}`, () => done(), undefined, () => done());
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
    texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    (shared[uniform] as {value: THREE.Texture | null}).value = texture;
  }))).then(() => { shared.gReady.value = 1; });
}

/** Paved (R) and trodden (G) zones on the city slab, painted from the footprints the map already
 * knows: forecourts around every building and seating, cow grass everywhere else. */
export function paintGroundMask(buildings: {x: number; z: number; w: number; d: number}[], seats: {x: number; z: number}[]) {
  const size = 1024, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = size / (MASK_EXTENT * 2), at = (v: number) => (v + MASK_EXTENT) * scale;
  const rect = (x: number, z: number, w: number, d: number, pad: number) => ctx.fillRect(at(x - w / 2 - pad), at(z - d / 2 - pad), (w + pad * 2) * scale, (d + pad * 2) * scale);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  // Trodden ground fades out from forecourts and kerbs: a stack of faint, growing rectangles.
  ctx.fillStyle = 'rgba(0,26,0,1)';
  for (let pad = 3; pad <= 12; pad += 1.5) {
    for (const b of buildings) rect(b.x, b.z, b.w, b.d, pad);
    for (const x of ROAD_X) rect(x, 0, (KERB_INNER + KERB_WIDTH) * 2 + pad * .6, 312, 0);
    for (const z of ROAD_Z) rect(0, z, 312, ROAD_HALF * 2 + pad * .6, 0);
  }
  ctx.fillStyle = 'rgba(255,0,0,1)';
  // Parks (the zoo) keep their grass; anything smaller gets a paved forecourt.
  for (const b of buildings) if (b.w * b.d < 2000) rect(b.x, b.z, b.w, b.d, 3.5);
  for (const s of seats) rect(s.x, s.z, 0, 0, 2.4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false; texture.colorSpace = THREE.NoColorSpace; texture.generateMipmaps = true;
  shared.gMask.value?.dispose(); shared.gMask.value = texture;
}

const COMMON = /* glsl */`
varying vec3 vGPos;
varying vec3 vGNrm;
uniform sampler2D gAsphalt, gAsphaltN, gPaver, gPaverN, gConcrete, gConcreteN, gGrass, gGrassN, gMacro, gMask;
uniform float gReady, gWet;
uniform vec3 gFallback, gSky;
const vec3 G_X = vec3(0., 76., -82.);
const vec3 G_Z = vec3(-64., 8., 78.);
float gHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
/** Signed offset of v from the nearest of three road centres. */
float gNear(float v, vec3 c) { float a = v - c.x, b = v - c.y, d = v - c.z; return abs(a) < abs(b) ? (abs(a) < abs(d) ? a : d) : (abs(b) < abs(d) ? b : d); }
vec3 gLin(vec3 c) { return pow(c, vec3(2.2)); }
float gLuma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
/** 1 inside |d| < halfWidth, antialiased over a pixel. */
float gBand(float d, float halfWidth) { float w = fwidth(d) * .8 + 1e-5; return 1. - smoothstep(halfWidth - w, halfWidth + w, abs(d)); }
/** 1 where a box distance is negative, antialiased. */
float gInside(float d) { float w = fwidth(d) * .8 + 1e-5; return 1. - smoothstep(-w, w, d); }
vec3 gTN(sampler2D t, vec2 uv) { return texture2D(t, uv).xyz * 2. - 1.; }
/** Colour sampled twice, the second rotated and 2.37x larger, blended by a macro field. */
vec3 gTex2(sampler2D t, vec2 uv, float tile) {
  vec3 a = texture2D(t, uv / tile).rgb;
  vec3 b = texture2D(t, vec2(-uv.y, uv.x) / (tile * 2.37) + .31).rgb;
  return mix(a, b, smoothstep(.38, .62, texture2D(gMacro, uv / (tile * 7.3) + .19).b));
}
struct GFrame { vec2 uv; vec3 T; vec3 B; vec3 N; };
/** World-space box projection: top faces read x/-z, sides their own plane, v always up. */
GFrame gFrame(vec3 n) {
  GFrame f; vec3 a = abs(n);
  if (a.y >= a.x && a.y >= a.z) { float s = sign(n.y); f.N = vec3(0., s, 0.); f.T = vec3(1., 0., 0.); f.B = vec3(0., 0., -s); f.uv = vec2(vGPos.x, -vGPos.z * s); }
  else if (a.x >= a.z) { float s = sign(n.x); f.N = vec3(s, 0., 0.); f.T = vec3(0., 0., -s); f.B = vec3(0., 1., 0.); f.uv = vec2(-vGPos.z * s, vGPos.y); }
  else { float s = sign(n.z); f.N = vec3(0., 0., s); f.T = vec3(s, 0., 0.); f.B = vec3(0., 1., 0.); f.uv = vec2(vGPos.x * s, vGPos.y); }
  return f;
}
/** Worn road paint over whatever is underneath: thermoplastic flakes off in wheel paths. */
vec3 gPaint(vec3 under, vec3 paint, float amount, float wear, vec2 w) {
  float flake = smoothstep(.1, .38, texture2D(gMacro, w / 1.9).g * .7 + texture2D(gMacro, w / .37).r * .5 - wear * .5);
  return mix(under, paint * (.8 + .2 * smoothstep(.03, .25, gLuma(under))), amount * flake);
}
`;

const SURFACE: Record<Kind, string> = {
  asphalt: /* glsl */`
  vec2 w = vGPos.xz;
  float ox = gNear(vGPos.x, G_X), oz = gNear(vGPos.z, G_Z);
  bool ew = abs(oz) < 8.55;                       // the east-west roads lie on top at junctions
  float lat = ew ? oz : ox, alat = abs(lat), along = ew ? vGPos.x : vGPos.z;
  float toJ = ew ? abs(ox) : abs(oz), centre = ew ? vGPos.z - oz : vGPos.x - ox;
  float junction = step(abs(ox), 8.5) * step(abs(oz), 8.5);
  float px = length(fwidth(w));
  vec3 base = gTex2(gAsphalt, gf.uv, 7.);
  vec3 soft = texture2D(gAsphalt, gf.uv / 7., 3.5).rgb;
  vec4 m1 = texture2D(gMacro, w / 97.), m2 = texture2D(gMacro, w / 23. + .5), m3 = texture2D(gMacro, w / 4.3 + .2);
  tn = gTN(gAsphaltN, gf.uv / 7.);
  alb = base * vec3(.86, .9, .97) * (.86 + .28 * m1.r);
  rough = .93 - .25 * smoothstep(.02, .07, .12 - gLuma(base));
  // the step down to the verge beside an east-west road reads as a concrete kerb face; every
  // sample is taken on both paths and mixed, so derivatives stay defined for mobile GPUs
  vec3 sideAlb = texture2D(gConcrete, gf.uv / 2.).rgb * .82, sideTn = gTN(gConcreteN, gf.uv / 2.);
  {
    // tyre polish: two darker, smoother bands per lane where the wheels run
    float wheel = (exp(-pow((alat - 3.2) / .42, 2.)) + exp(-pow((alat - 4.8) / .42, 2.))) * (1. - junction) * (.5 + .5 * m2.r);
    alb = mix(alb, soft * .74, wheel * .7); rough -= wheel * .3; tn = mix(tn, vec3(0., 0., 1.), wheel * .6);
    // oil drips down the lane centre, heaviest where traffic queues for a junction
    float queue = smoothstep(34., 14., toJ);
    float oil = exp(-pow((alat - 4.) / .55, 2.)) * smoothstep(.5, .8, m2.g * .55 + m3.g * .6) * (.45 + queue);
    oil = clamp(oil + junction * smoothstep(.6, .9, texture2D(gMacro, w / 6.1).g) * .7, 0., 1.);
    alb *= 1. - oil * .32; rough -= oil * .3;
    // dust and grit washed against the kerb
    float gutterDust = smoothstep(7.3, 8.45, alat) * (1. - junction);
    alb = mix(alb, gLin(vec3(.50, .47, .41)) * (.7 + .6 * gLuma(soft) / .12), gutterDust * .35 * (.6 + .4 * m3.r));
    // repairs: a third of 14 m cells hold a rectangle of newer, darker premix with a sealed seam
    vec2 cell = floor(w / 14.), lc = w - cell * 14.;
    vec2 ctr = 3. + 8. * vec2(gHash(cell + 7.1), gHash(cell + 3.3)), hs = vec2(.6 + 1.7 * gHash(cell + 1.7), .45 + 1.1 * gHash(cell + 9.2));
    vec2 pd = abs(lc - ctr) - hs; float box = max(pd.x, pd.y);
    float patchOn = step(.64, gHash(cell)) * (1. - junction);
    vec3 fresh = texture2D(gAsphalt, gf.uv / 3.1 + .47).rgb * vec3(.74, .76, .79);
    // utility trench reinstatement straight across the road
    float tcell = floor((along + centre * .61) / 43.);
    float tpos = tcell * 43. + 6. + 30. * gHash(vec2(tcell, centre + 5.));
    float trench = step(.58, gHash(vec2(tcell, centre))) * gInside(abs(along + centre * .61 - tpos) - .38) * step(alat, 8.5) * (1. - junction);
    float repaired = max(gInside(box) * patchOn, trench);
    alb = mix(alb, fresh, repaired); rough -= repaired * .1;
    float seam = max(gBand(box, .03) * patchOn, trench * (1. - gInside(abs(along + centre * .61 - tpos) - .34)));
    alb = mix(alb, gLin(vec3(.09)), seam * .6); rough -= seam * .25;
    // road markings painted flush: double yellow lines along the kerbs, solid centre line and
    // stop lines on the approaches (left-hand traffic: the approaching lane is the one where
    // the offset across and the offset along from the junction have opposite signs, north-south)
    float kerbSide = step(12.5, toJ);
    float yellow = (gBand(alat - 7.88, .05) + gBand(alat - 8.08, .05)) * kerbSide;
    float oa = ew ? ox : oz;
    float approach = ew ? step(0., lat * oa) : step(lat * oa, 0.);
    float stopAt = ew ? 10.4 : 13.6;
    float white = gBand(lat, .06) * step(11., toJ) * step(toJ, 30.) + gBand(toJ - stopAt, .15) * approach * step(.15, alat) * step(alat, 8.25);
    // gully grates tucked against the kerb every 22 m, and manhole covers in the lanes
    float gcell = floor((along + centre * .37) / 22.);
    vec2 gd = vec2(alat - 8.12, along + centre * .37 - gcell * 22. - 11.);
    float grateBox = max(abs(gd.x) - .2, abs(gd.y) - .46);
    float grate = gInside(grateBox) * kerbSide * step(alat, 8.5);
    float frame = gInside(grateBox - .05) * kerbSide * step(alat, 8.5) - grate;
    float mcell = floor((along + centre * 1.3) / 31.);
    float mOn = step(.42, gHash(vec2(mcell, centre + 41.))) * (1. - junction) * step(15., toJ);
    vec2 md = vec2(lat - sign(gHash(vec2(mcell, centre + 47.)) - .5) * (1.7 + 4.6 * gHash(vec2(mcell, centre + 53.))), along + centre * 1.3 - mcell * 31. - 5. - 21. * gHash(vec2(mcell, centre + 43.)));
    float mr = length(md), cover = gInside(mr - .31) * mOn, ring = gInside(mr - .36) * mOn - cover;
    yellow *= 1. - gInside(grateBox - .08); white *= 1. - cover;
    alb = gPaint(alb, gLin(vec3(.86, .70, .24)), clamp(yellow, 0., 1.), wheel, w);
    alb = gPaint(alb, gLin(vec3(.88, .87, .83)), clamp(white, 0., 1.), wheel, w);
    rough = mix(rough, .6, clamp(yellow + white, 0., 1.) * .8);
    tn = mix(tn, vec3(0., 0., 1.), clamp(yellow + white, 0., 1.) * .7);
    float bars = smoothstep(.35, .65, abs(fract(gd.y * 8.) - .5) * 2.);
    bars = mix(bars, .5, smoothstep(.02, .06, px));
    alb = mix(alb, gLin(vec3(.17, .16, .15)), frame);
    alb = mix(alb, mix(gLin(vec3(.03)), gLin(vec3(.28, .22, .17)), bars), grate);
    rough = mix(rough, .5, grate + frame);
    tn = mix(tn, normalize(vec3(0., (bars - .5) * .8, 1.)), grate);
    vec2 q = md * 16.;
    float lattice = smoothstep(.55, .75, abs(fract(q.x + q.y) - .5) + abs(fract(q.x - q.y) - .5));
    lattice = mix(lattice, .4, smoothstep(.015, .05, px));
    float rim = gBand(mr - .28, .025);
    alb = mix(alb, gLin(vec3(.14, .13, .12)), ring);
    alb = mix(alb, mix(gLin(vec3(.10, .095, .09)), gLin(vec3(.34, .25, .18)), lattice * .6 + rim * .4), cover);
    rough = mix(rough, .42, cover); tn = mix(tn, normalize(vec3((lattice - .5) * .5, (lattice - .5) * .5, 1.)), cover);
  }
  float top = step(.5, gf.N.y);
  alb = mix(sideAlb, alb, top); tn = mix(sideTn, tn, top); rough = mix(.9, rough, top);
`,
  kerb: /* glsl */`
  vec2 w = vGPos.xz;
  float ox = gNear(vGPos.x, G_X), alat = abs(ox), toJ = abs(gNear(vGPos.z, G_Z));
  vec3 concrete = texture2D(gConcrete, gf.uv / 2.).rgb;
  vec4 m3 = texture2D(gMacro, w / 5.3 + .7);
  float stone = gf.N.y > .5 ? gInside(alat - 8.9) : (gf.N.x * ox < 0. ? 1. : 0.);
  // black-and-white kerb stones a metre long near the junctions, plain weathered concrete elsewhere
  float joint = gBand(fract(vGPos.z + .5) - .5, .008);
  float white = mod(floor(vGPos.z), 2.);
  float painted = smoothstep(34., 30., toJ) * smoothstep(.3, .55, m3.g * .8 + gLuma(concrete) * 1.6 - .2);
  vec3 stoneCol = mix(concrete * .9, mix(gLin(vec3(.10, .10, .10)), gLin(vec3(.90, .89, .84)) * (.85 + .3 * gLuma(concrete)), white), painted);
  stoneCol *= 1. - joint * .55;
  vec3 paverCol = texture2D(gPaver, gf.uv / 4.).rgb * (.88 + .22 * texture2D(gMacro, w / 41.).r);
  vec3 backCol = concrete * .78;
  float top = step(.5, gf.N.y);
  vec3 paverN = gTN(gPaverN, gf.uv / 4.), concreteN = gTN(gConcreteN, gf.uv / 2.);
  alb = mix(mix(backCol, stoneCol, stone), mix(paverCol, stoneCol, stone), top);
  tn = mix(concreteN, mix(paverN, concreteN, stone), top);
  tn = mix(tn, vec3(0., 0., 1.), stone * painted * .5);
  rough = mix(.86, .7, stone * painted);
  alb *= 1. - gBand(alat - 8.9, .012) * top * .6;
`,
  slab: /* glsl */`
  vec2 w = vGPos.xz;
  vec4 mask = texture2D(gMask, (w + ${MASK_EXTENT.toFixed(1)}) / ${(MASK_EXTENT * 2).toFixed(1)});
  vec4 m1 = texture2D(gMacro, w / 53.), m2 = texture2D(gMacro, w / 11. + .3);
  vec3 grassCol = gTex2(gGrass, gf.uv, 4.);
  float jitter = (gLuma(grassCol) - .09) * 1.2 + (m2.r - .5) * .1;
  float paved = smoothstep(.47, .53, mask.r + jitter * .12);
  // sun-scorched straw and trodden laterite, most where people cut across near forecourts and kerbs
  float dry = smoothstep(.55, .8, m1.b + mask.g * .12);
  grassCol = mix(grassCol, vec3(gLuma(grassCol)) * vec3(1.38, 1.2, .62), dry * .6);
  float soilAmt = smoothstep(.68, .86, texture2D(gMacro, w / 31.7 + .7).b * .5 + m2.b * .24 + mask.g * .22 + (1. - gLuma(grassCol) / .09) * .08);
  vec3 soil = gLin(vec3(.47, .39, .31)) * (.6 + .8 * gLuma(texture2D(gConcrete, gf.uv / 1.3).rgb) / .4) * (.8 + .4 * gLuma(grassCol) / .09);
  grassCol = mix(grassCol, soil, soilAmt * .8);
  grassCol *= .9 + .2 * m1.r;
  vec3 paverCol = texture2D(gPaver, gf.uv / 4.).rgb * (.84 + .28 * texture2D(gMacro, w / 37.).r);
  paverCol = mix(paverCol, soil * .8, smoothstep(.7, .95, m2.g) * .25);
  alb = mix(grassCol, paverCol, paved);
  tn = mix(gTN(gGrassN, gf.uv / 4.), gTN(gPaverN, gf.uv / 4.), paved);
  tn = mix(tn, vec3(0., 0., 1.), soilAmt * (1. - paved) * .5);
  rough = mix(.95, .85, paved);
  // the concrete channel in the slot between a north-south road and its kerb
  float channel = step(abs(abs(gNear(vGPos.x, G_X)) - 8.54), .05);
  alb = mix(alb, texture2D(gConcrete, gf.uv / 2.).rgb * .55, channel);
  // past the south edge the slab is seabed under the sea
  float seabed = smoothstep(156.2, 156.4, vGPos.z);
  alb = mix(alb, gLin(vec3(.62, .58, .50)) * (.8 + .4 * m2.r), seabed);
  float top = step(.5, gf.N.y);
  alb = mix(texture2D(gConcrete, gf.uv / 2.).rgb * .7, alb, top); tn = mix(gTN(gConcreteN, gf.uv / 2.), tn, top); rough = mix(.9, rough, top);
`,
  apron: /* glsl */`
  vec2 w = vGPos.xz;
  vec4 m1 = texture2D(gMacro, w / 61.), m2 = texture2D(gMacro, w / 13. + .6);
  vec3 grassCol = gTex2(gGrass, gf.uv, 4.);
  float dry = smoothstep(.42, .7, m1.b);
  grassCol = mix(grassCol, vec3(gLuma(grassCol)) * vec3(1.38, 1.2, .62), dry * .7);
  vec3 soil = gLin(vec3(.47, .39, .31)) * (.6 + .8 * gLuma(texture2D(gConcrete, gf.uv / 1.3).rgb) / .4);
  alb = mix(grassCol, soil, smoothstep(.7, .88, texture2D(gMacro, w / 37.3 + .1).b * .65 + m2.b * .3) * .7) * (.88 + .24 * m1.r);
  tn = gTN(gGrassN, gf.uv / 4.); rough = .96;
  float seabed = smoothstep(156.2, 156.4, vGPos.z);
  alb = mix(alb, gLin(vec3(.62, .58, .50)) * (.8 + .4 * m2.r), seabed);
  tn = mix(tn, vec3(0., 0., 1.), seabed * .7);
`,
  lines: /* glsl */`
  vec2 w = vGPos.xz;
  float lat = abs(gNear(vGPos.x, G_X)), latEW = abs(gNear(vGPos.z, G_Z));
  float wheel = exp(-pow((lat - 3.2) / .42, 2.)) + exp(-pow((lat - 4.8) / .42, 2.));
  vec3 road = texture2D(gAsphalt, gf.uv / 7.).rgb;
  alb = gPaint(road, gLin(vec3(.88, .87, .83)), 1., wheel * step(8.6, latEW) * .8, w);
  alb *= .9 + .1 * texture2D(gMacro, w / 3.1).r;
  tn = mix(gTN(gAsphaltN, gf.uv / 7.), vec3(0., 0., 1.), .6);
  rough = .62;
  alb *= mix(.7, 1., step(.5, gf.N.y));
`,
};

const materials = new Map<Kind, THREE.MeshStandardMaterial>();
/** One shared material per ground surface; every box of that surface batches into one draw. */
export function groundMaterial(kind: Kind) {
  let material = materials.get(kind);
  if (material) return material;
  loadTextures();
  material = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 1, metalness: 0});
  const fallback = {value: new THREE.Color(FALLBACK[kind])};
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, shared, {gFallback: fallback});
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGPos;\nvarying vec3 vGNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGNrm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      .replace('#include <map_fragment>', `GFrame gf = gFrame(normalize(vGNrm));
  vec3 alb = vec3(1.); vec3 tn = vec3(0., 0., 1.); float rough = 1.;
  {${SURFACE[kind]}}
  // Monsoon rain: soaked surfaces darken and go glossy, and still water lies in the hollows of the macro
  // field (one extra sample; gWet is 0 in the dry).
  float gTop = step(.5, gf.N.y);
  float gPuddle = gWet * gTop * ${WET[kind][2].toFixed(2)} * smoothstep(.6, .7, texture2D(gMacro, vGPos.xz / 19. + .37).g);
  alb *= 1. - gWet * ${WET[kind][0].toFixed(2)} - gPuddle * .2;
  rough = mix(mix(rough, min(rough, ${WET[kind][1].toFixed(2)}), gWet), .04, gPuddle);
  tn = mix(tn, vec3(0., 0., 1.), gPuddle);
  alb = mix(gFallback, alb, gReady); tn = normalize(mix(vec3(0., 0., 1.), tn, gReady));
  diffuseColor.rgb *= alb;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, clamp(rough, .04, 1.), gReady);')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(normalize(gf.T * tn.x + gf.B * tn.y + gf.N * tn.z), 0.)).xyz);')
      // The wet sheen: there is no environment map, so the sky's colour is laid on at grazing angles.
      .replace('#include <opaque_fragment>', `outgoingLight = mix(outgoingLight, gSky, gWet * gTop * (pow(1. - saturate(dot(normalize(vViewPosition), normal)), 5.) * .5 + gPuddle * .22));
  #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `lepak-ground-${kind}`;
  material.name = `ground-${kind}`;
  materials.set(kind, material);
  return material;
}
