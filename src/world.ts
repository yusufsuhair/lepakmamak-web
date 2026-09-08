import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Solid } from './physics';

const materials = new Map<string, THREE.MeshStandardMaterial>();
const cube = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
const sphere = new THREE.IcosahedronGeometry(1, 1);
export function material(color: string, roughness = 0.82) {
  const key = `${color}:${roughness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(key)!;
}
export function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string | THREE.Material) {
  const mesh = new THREE.Mesh(cube, typeof color === 'string' ? material(color) : color);
  mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function tube(parent: THREE.Object3D, x: number, y: number, z: number, r: number, h: number, color: string) {
  const mesh = new THREE.Mesh(cylinder, material(color)); mesh.position.set(x, y, z); mesh.scale.set(r, h, r);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function ball(parent: THREE.Object3D, x: number, y: number, z: number, r: number, color: string) {
  const mesh = new THREE.Mesh(sphere, material(color)); mesh.position.set(x, y, z); mesh.scale.setScalar(r);
  mesh.castShadow = true; parent.add(mesh); return mesh;
}
const textMaterials = new Map<string, THREE.MeshBasicMaterial>();
function sign(parent: THREE.Object3D, text: string, x: number, y: number, z: number, w: number, h: number, bg = '#183f36', fg = '#fff6d5', rotation = 0) {
  const key = text + bg + fg;
  if (!textMaterials.has(key)) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = bg; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${text.length > 24 ? 49 : text.length > 17 ? 60 : 85}px "Barlow Condensed", sans-serif`;
    ctx.fillText(text, 512, 136, 960);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    textMaterials.set(key, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), textMaterials.get(key));
  mesh.position.set(x, y, z); mesh.rotation.y = rotation; parent.add(mesh); return mesh;
}

export interface Person { group: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group }
export function createPerson(shirt = '#ef734c', seated = false): Person {
  const group = new THREE.Group();
  box(group, 0, 1.2, 0, .61, .68, .34, shirt);
  box(group, 0, .91, 0, .5, .18, .31, '#253a40');
  tube(group, 0, 1.62, 0, .12, .15, '#b98157');
  const head = ball(group, 0, 1.85, .015, .255, '#b98157'); head.scale.y *= 1.14;
  const hair = ball(group, 0, 2.01, -.04, .24, '#202c2b'); hair.scale.y *= .65;
  box(group, 0, 1.84, .247, .08, .1, .045, '#ac744c');
  box(group, -.1, 1.91, .22, .055, .035, .025, '#27332d');
  box(group, .1, 1.91, .22, .055, .035, .025, '#27332d');
  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .16, .88, 0);
    box(leg, 0, -.3, 0, .23, .59, .25, '#c7be9c');
    box(leg, 0, -.7, .065, .24, .24, .38, '#f6efd7');
    box(leg, 0, -.81, .07, .26, .06, .4, '#27403c');
    if (seated) { leg.rotation.x = -.92; leg.rotation.z = side * .24; }
    group.add(leg); limbs.push(leg);
  }
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .39, 1.43, 0);
    box(arm, 0, -.16, 0, .23, .36, .27, shirt);
    box(arm, 0, -.44, .015, .16, .28, .17, '#b98157');
    if (seated) { arm.rotation.x = -1.08; arm.rotation.z = side * -.12; }
    group.add(arm); limbs.push(arm);
  }
  return { group, leftLeg: limbs[0], rightLeg: limbs[1], leftArm: limbs[2], rightArm: limbs[3] };
}

export function createBike() {
  const group = new THREE.Group(); const wheels: THREE.Mesh[] = [];
  for (const z of [-.8, .8]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.38, .115, 7, 18), material('#202b2d'));
    wheel.rotation.y = Math.PI / 2; wheel.position.set(0, .49, z); wheel.castShadow = true; group.add(wheel); wheels.push(wheel);
    const hub = tube(group, 0, .49, z, .24, .12, '#b1bdba'); hub.rotation.z = Math.PI / 2;
    box(group, -.12, .66, z, .065, .65, .085, '#b8c5c2');
    box(group, .12, .66, z, .065, .65, .085, '#b8c5c2');
  }
  box(group, 0, .8, -.45, .5, .37, 1, '#178e86');
  const frame = box(group, 0, .84, .26, .28, .22, .97, '#b0bcb3'); frame.rotation.x = -.3;
  box(group, 0, 1.08, -.36, .57, .18, .9, '#253034');
  const front = box(group, 0, 1.04, .73, .43, .74, .27, '#2ab4a1'); front.rotation.x = -.2;
  box(group, 0, 1.48, .83, .55, .25, .28, '#239b8b');
  box(group, 0, 1.49, .989, .31, .15, .03, '#fff2b9');
  box(group, 0, 1.52, .72, .95, .065, .08, '#b6c8c1');
  for (const x of [-.48, .48]) {
    box(group, x, 1.52, .72, .19, .11, .13, '#243330');
    const stem = box(group, x, 1.75, .78, .035, .38, .035, '#c1cec2'); stem.rotation.z = x * -.5;
    box(group, x * 1.16, 1.91, .78, .2, .13, .05, '#7eaaa7');
  }
  box(group, .34, .48, -.51, .16, .17, .94, '#879996');
  box(group, 0, .9, -1.01, .27, .12, .035, '#e8573b');
  box(group, 0, .71, -1.035, .32, .17, .04, '#20312f');
  // Insulated delivery box mounted behind the rider.
  box(group, 0, 1.41, -.86, .74, .64, .64, '#e7b632');
  box(group, 0, 1.73, -.86, .77, .06, .67, '#f8d665');
  sign(group, 'MAJU', 0, 1.45, -1.185, .55, .23, '#e7b632', '#244e3e', Math.PI);
  const rider = createPerson('#e87043', true); rider.group.position.set(0, .62, -.18); rider.group.visible = false; group.add(rider.group);
  group.scale.setScalar(1.18);
  return { group, wheels, rider: rider.group };
}

function tree(parent: THREE.Object3D, x: number, z: number, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); parent.add(group);
  tube(group, 0, 2.1, 0, .27, 4.2, '#8f7961');
  for (const [dx, dy, dz, r] of [[0, 5.4, 0, 2.4], [-1.5, 4.6, .6, 1.8], [1.3, 5, -.6, 1.9]]) {
    const b = ball(group, dx, dy, dz, r, dy > 5 ? '#658853' : '#53764d'); b.scale.y *= .85;
  }
}
function palm(parent: THREE.Object3D, x: number, z: number, size = 1) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(size); parent.add(group);
  for (let i = 0; i < 8; i++) {
    const trunk = tube(group, Math.sin(i * .1) * .5, .5 + i * .84, 0, .25 - i * .014, .9, i % 2 ? '#a69770' : '#8c805e');
    trunk.rotation.z = -.045;
  }
  for (let j = 0; j < 9; j++) {
    const positions: number[] = [];
    for (let i = 0; i < 6; i++) {
      const t = i / 6, t2 = (i + 1) / 6;
      const p = (u: number, side: number) => [u * 4.5, Math.sin(u * Math.PI) * 1.15 - u * 1.45, Math.sin(u * Math.PI) * .57 * side];
      positions.push(...p(t, -1), ...p(t2, -1), ...p(t2, 1), ...p(t, -1), ...p(t2, 1), ...p(t, 1));
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    const mat = material(j % 2 ? '#577a3c' : '#6f9046'); mat.side = THREE.DoubleSide;
    const leaf = new THREE.Mesh(geometry, mat); leaf.position.set(.35, 7, 0); leaf.rotation.y = j * Math.PI * 2 / 9; leaf.castShadow = true; group.add(leaf);
  }
}

function streetLamp(parent: THREE.Object3D, x: number, z: number, facing = 1) {
  tube(parent, x, 3.65, z, .095, 7.3, '#465852');
  box(parent, x + facing * .82, 7.3, z, 1.8, .12, .13, '#465852');
  box(parent, x + facing * 1.63, 7.22, z, .85, .16, .43, '#f2e9c9');
  box(parent, x + facing * 1.63, 7.12, z, .73, .035, .32, '#fff4c1');
}
function tower(parent: THREE.Object3D, x: number, z: number) {
  const glass = material('#8babae', .33);
  const silver = material('#d1d8cb', .4);
  const group = new THREE.Group(); group.position.set(x, 0, z); parent.add(group);
  // Paired eight-point footprints and repeating silver bands evoke the KL landmark.
  const floors = 42;
  for (let i = 0; i < floors; i++) {
    const y = 3 + i * 1.75;
    const r = i < 22 ? 8 : i < 30 ? 7.1 : i < 36 ? 5.9 : 4.5;
    for (const rotation of [0, Math.PI / 4]) {
      const body = box(group, 0, y, 0, r * 1.64, 1.7, r * 1.64, glass); body.rotation.y = rotation;
      const rim = box(group, 0, y + .74, 0, r * 1.72, .15, r * 1.72, silver); rim.rotation.y = rotation;
    }
  }
  for (let i = 0; i < 6; i++) tube(group, 0, 77 + i * 1.5, 0, 3.8 - i * .48, 1.4, '#bfcdc3');
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.92, 12, 10), silver); tip.position.y = 90; group.add(tip);
  tube(group, 0, 98, 0, .13, 5, '#d8dccb');
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    box(group, Math.sin(a) * 7.6, 21, Math.cos(a) * 7.6, .13, 38, .13, silver);
  }
}

export interface TrafficCar { group: THREE.Group; x: number; z: number; speed: number; axis: 'x' | 'z'; direction: number }
export interface Pedestrian { person: Person; startX: number; startZ: number; phase: number; axis: 'x' | 'z'; range: number }
export interface World { chairs: { x: number; z: number; yaw: number }[]; group: THREE.Group; solids: Solid[]; mapBuildings: { x: number; z: number; w: number; d: number; color: string }[]; traffic: TrafficCar[]; pedestrians: Pedestrian[] }

export function createWorld(scene: THREE.Scene): World {
  const chairs: World['chairs'] = [];
  const group = new THREE.Group(); const solids: Solid[] = []; const mapBuildings: World['mapBuildings'] = [];
  scene.add(group);
  const solid = (x: number, z: number, w: number, d: number) => solids.push({ x, z, hx: w / 2, hz: d / 2 });
  const block = (x: number, z: number, w: number, h: number, d: number, color: string) => {
    box(group, x, h / 2, z, w, h, d, color); solid(x, z, w, d); mapBuildings.push({ x, z, w, d, color });
  };
  box(group, 0, -.38, 0, 340, .5, 340, '#829178');
  box(group, 0, -.11, 0, 318, .12, 318, '#c3bba4');
  // A connected road grid. North is negative Z.
  for (const x of [0, 76, -82]) {
    box(group, x, -.028, 0, 17, .06, 312, '#637373');
    for (const side of [-1, 1]) box(group, x + side * 9.2, .04, 0, 1.25, .17, 312, '#ddd3b9');
    for (let z = -149; z <= 149; z += 8) {
      if ([-64, 8, 78].some(cross => Math.abs(z - cross) < 11)) continue;
      box(group, x, .016, z, .14, .012, 3.2, '#e3d8ad');
    }
  }
  for (const z of [-64, 8, 78]) {
    box(group, 0, .009, z, 312, .055, 17, '#637373');
    for (let x = -147; x <= 147; x += 8) {
      if ([0, 76, -82].some(cross => Math.abs(x - cross) < 11)) continue;
      box(group, x, .043, z, 3.2, .01, .14, '#e3d8ad');
    }
    for (const x of [0, 76, -82]) {
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) box(group, x - 6 + i * 2.4, .046, z + side * 11, 1.3, .014, 3, '#e2dece');
    }
  }
  // KLCC park and podium.
  box(group, 0, .07, -114, 124, .24, 66, '#b1bb83');
  box(group, 0, .21, -99, 104, .18, 14, '#ded5bd');
  box(group, 0, .3, -104, 80, .18, 9, '#8db5af');
  box(group, 0, .42, -104, 76, .12, 6.5, '#75b3b1');
  block(-22, -122, 21, 3, 24, '#c8cbb9'); block(22, -122, 21, 3, 24, '#c8cbb9');
  tower(group, -22, -122); tower(group, 22, -122);
  box(group, 0, 39, -122, 31, 2.2, 3.4, '#aebfba');
  box(group, 0, 40.4, -122, 31, .35, 4, '#dce0cd');
  for (const side of [-1, 1]) {
    const brace = box(group, side * 12.5, 33.5, -122, .6, 13, .7, '#d0d9c8'); brace.rotation.z = side * -.48;
    for (let j = 0; j < 10; j++) box(group, side * (j * 1.4 + 1), 39, -120.2, .12, 2.6, .12, '#e0e2cf');
  }
  sign(group, 'SELAMAT DATANG · KLCC', 0, 3.3, -97, 16, 2, '#376052');
  for (const x of [-6.9, 6.9]) tube(group, x, 1.55, -97, .1, 3.1, '#6a8073');
  for (const x of [-48, -37, 37, 48]) for (const z of [-88, -105, -137]) palm(group, x, z, .85);
  // Low fountain at the delivery plaza.
  tube(group, 19, .4, -87, 4, .6, '#b7baa6'); tube(group, 19, .74, -87, 3.6, .09, '#82b3ab');
  tube(group, 19, 1.15, -87, .55, 1, '#d5d4b9');
  for (const x of [-53, 53]) { box(group, x, .4, -113, 2, .8, 55, '#839468'); solid(x, -113, 2, 55); }

  // Mamak, open ground floor and striped canopy, facing the courtyard to the south.
  const mx = -29, mz = 34;
  box(group, mx, .08, 41, 37, .25, 30, '#d7c7a7');
  block(mx, mz - 4, 30, 8.8, 9, '#e7c78c');
  box(group, mx, 8.95, mz - 4, 31, .4, 10, '#ab8d66');
  for (const x of [-39, -29, -19]) {
    box(group, x, 6.65, 34.6, 3.2, 2.5, .16, '#446e65');
    box(group, x, 6.65, 34.72, .12, 2.5, .12, '#dfcea4');
    box(group, x, 6.65, 34.72, 3.2, .12, .12, '#dfcea4');
    box(group, x, 5.22, 34.9, 3.7, .16, .62, '#f5dbae');
  }
  for (const x of [-44, -14]) { box(group, x, 1.9, 40, .36, 3.8, .36, '#d7c4a0'); solid(x, 40, .36, .36); }
  for (let i = 0; i < 20; i++) {
    const awning = box(group, -43.5 + i * 1.53, 4.3, 38.3, 1.54, .17, 8, i % 2 ? '#eee2bd' : '#427863'); awning.rotation.x = .12;
    box(group, -43.5 + i * 1.53, 3.64, 42.2, 1.54, .53, .12, i % 2 ? '#eee2bd' : '#427863');
  }
  sign(group, 'MAMAK MAJU', mx, 4.96, 35, 20, 2.05, '#255846', '#f9e7b2');
  sign(group, 'RESTORAN • BUKA 24 JAM', mx, 8.03, 34.72, 18, .8, '#e7c78c', '#654c32');
  sign(group, 'ROTI CANAI   ·   TEH TARIK   ·   NASI KANDAR', mx, 3.36, 34.69, 25, .73, '#efdbad', '#3b6555');
  box(group, -39, 1.04, 37, 7, 1.8, 1.8, '#b3c3b6'); solid(-39, 37, 7, 1.8);
  box(group, -39, 2.02, 37, 7.3, .13, 2.1, '#e2ddc5');
  for (let i = 0; i < 5; i++) { tube(group, -41.3 + i * 1.14, 2.19, 37, .43, .23, '#899f99'); tube(group, -41.3 + i * 1.14, 2.34, 37, .1, .09, '#485f56'); }
  for (const [x, z] of [[-38, 45], [-29, 45], [-39, 51], [-29, 52]]) {
    tube(group, x, 1.06, z, 1.14, .14, '#e9dfc0'); tube(group, x, .53, z, .11, 1.02, '#727e6b'); solid(x, z, 1.8, 1.8);
    for (const a of [0, 2.1, 4.2]) {
      const chair = new THREE.Group(); chair.position.set(x + Math.sin(a) * 1.65, 0, z + Math.cos(a) * 1.65); chair.rotation.y = a; group.add(chair);
      if (!(x === -29 && z === 45 && a === 0)) chairs.push({ x: chair.position.x, z: chair.position.z, yaw: a + Math.PI });
      box(chair, 0, .6, 0, .73, .1, .73, '#be5142'); box(chair, 0, 1.04, .33, .73, .8, .1, '#be5142');
      for (const dx of [-.28, .28]) for (const dz of [-.28, .28]) box(chair, dx, .3, dz, .06, .6, .06, '#923e35');
    }
    tube(group, x + .35, 1.23, z, .1, .26, '#c28246');
    tube(group, x - .35, 1.16, z + .12, .27, .04, '#f5efd4');
  }
  sign(group, 'PICK UP HERE', -18.5, 1.4, 43.3, 3.4, 1.5, '#edb64f', '#344a36');
  for (const x of [-20, -17]) box(group, x, .65, 43.3, .09, 1.3, .1, '#8f7955');
  const chef = createPerson('#efe7cd'); chef.group.position.set(-35.5, .12, 38); group.add(chef.group);
  const customer = createPerson('#829fac', true); customer.group.position.set(-29, .05, 46.7); customer.group.rotation.y = Math.PI; group.add(customer.group);

  const shopColors = ['#d8ac89', '#c0c9a4', '#c6aba0', '#edcf93', '#a4baba', '#d7b9a0'];
  function shop(x: number, z: number, width: number, color: string, label: string, facing = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = facing; group.add(g);
    box(g, 0, 5.5, 0, width, 11, 12, color);
    box(g, 0, 11.05, 0, width + .4, .4, 12.5, '#bfa98a');
    box(g, 0, 11.4, 5.8, width + .15, .5, .45, '#ead9b9');
    box(g, 0, 4.75, 6.16, width + .2, .27, .6, '#eedabd');
    box(g, 0, 1.8, 6.04, width - 1.2, 3.55, .12, '#4c6159');
    for (let k = -1; k <= 1; k++) {
      box(g, k * width / 3.5, 7.4, 6.08, width / 5, 3, .15, '#4c766e');
      box(g, k * width / 3.5, 7.4, 6.2, .1, 3, .13, '#dac8a3');
      box(g, k * width / 3.5, 7.4, 6.2, width / 5, .1, .13, '#dac8a3');
    }
    sign(g, label, 0, 3.96, 6.19, width - .3, 1.05, '#355d50', '#f6e4ba');
    const awning = box(g, 0, 3.22, 7.1, width + .1, .13, 2.3, '#c57552'); awning.rotation.x = .13;
    solid(x, z, width, 12); mapBuildings.push({ x, z, w: width, d: 12, color });
    box(g, width / 2 - 1.1, 5.65, 6.5, 1.4, .7, .7, '#e1d5b9');
  }
  shop(-59, 32, 17, shopColors[1], 'KEDAI RUNCIT SINAR');
  shop(-60, 58, 18, shopColors[0], 'BENGKEL AZLAN');
  shop(-36, -12, 19, shopColors[4], 'DOBI LAYAN DIRI');
  shop(-57, -12, 20, shopColors[3], 'KEDAI KOPI');
  shop(-35, -40, 18, shopColors[2], 'PASAR MINI');
  shop(-56, -40, 19, shopColors[1], 'FARMASI MAJU');
  shop(27, 34, 19, shopColors[0], 'WARUNG KAK ANA');
  shop(49, 34, 22, shopColors[4], 'KEDAI BUKU');
  shop(28, -16, 21, shopColors[3], 'RESTORAN SERI KL');
  shop(51, -16, 20, shopColors[2], 'KEDAI ELEKTRIK');
  shop(33, 103, 24, shopColors[1], 'SELAMAT JALAN');
  shop(-32, 107, 24, shopColors[4], 'HOTEL MERDEKA');
  // Mid-rise skyline, deterministically placed away from the road grid.
  let seed = 37; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const x of [-127, -106, 105, 129]) for (const z of [-128, -95, -37, 37, 113]) {
    const height = 14 + rand() * 29, w = 13 + rand() * 5, d = 17;
    block(x, z, w, height, d, ['#aab7ad', '#c9bfa5', '#b4bdb6', '#d6c6aa'][Math.floor(rand() * 4)]);
    box(group, x, height + .25, z, w + .5, .5, d + .5, '#cbd0b7');
    for (let y = 3; y < height - 1; y += 3.4) {
      for (let wx = -w / 2 + 2; wx < w / 2 - 1; wx += 3.3) box(group, x + wx, y, z + d / 2 + .015, 1.8, 1.7, .04, '#728e88');
    }
  }
  // A distant communications tower complements the twin towers.
  tube(group, -104, 42, -145, 1.3, 84, '#c5c6ae');
  tube(group, -104, 70, -145, 6.2, 4, '#aaa991'); tube(group, -104, 73, -145, 4.9, 2, '#637f79');
  tube(group, -104, 89, -145, .3, 21, '#d8d2b6');
  for (const x of [-11.5, 11.5]) for (const z of [-47, -21, 29, 65, 99, 132]) streetLamp(group, x, z, x > 0 ? -1 : 1);
  for (const [x, z, s] of [[-48, 54, 1], [-11, 19, 1], [12, 47, 1.05], [13, -32, .9], [-13, -78, 1], [58, 61, 1], [54, -45, .85], [-61, 91, 1]]) palm(group, x, z, s);
  for (const x of [-67, 64, 93, -95]) for (const z of [-79, -23, 22, 92, 135]) tree(group, x, z, .8 + rand() * .45);
  for (const [x, z] of [[12, 58], [-12, -35], [59, 48], [-49, 46]]) {
    box(group, x, .45, z, 2, .9, 2, '#bfa687'); ball(group, x, 1.25, z, 1.05, '#688750'); solid(x, z, 2, 2);
  }
  // Malaysian flags and street signs.
  function flag(x: number, z: number) {
    tube(group, x, 4, z, .055, 8, '#b9c1aa');
    for (let i = 0; i < 14; i++) box(group, x + 1.22, 7.7 - i * .1, z, 2.4, .1, .025, i % 2 ? '#f5e7cc' : '#c34d3c');
    box(group, x + .55, 7.37, z + .02, 1.05, .75, .02, '#344f7a');
    sign(group, '☾ ✦', x + .55, 7.4, z + .04, .8, .55, '#344f7a', '#f1cc57');
  }
  flag(-13, 54); flag(13, -77);
  sign(group, 'JALAN LEPAK', -11, 3.7, 14, 5, .8, '#245c4b'); tube(group, -11, 1.8, 14, .07, 3.6, '#728571');
  sign(group, 'KLCC ↑', 11.5, 3.6, -48, 3.8, .9, '#245c4b'); tube(group, 11.5, 1.8, -48, .07, 3.6, '#728571');
  // Bunting over the courtyard.
  for (let i = 0; i < 18; i++) {
    const geo = new THREE.BufferGeometry(); const y = 6.6 - Math.sin(i / 17 * Math.PI) * 1.1;
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-.35, 0, 0, .35, 0, 0, 0, -.6, 0], 3)); geo.computeVertexNormals();
    const mat = material(['#e4b64d', '#b95240', '#578c76'][i % 3]); mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(-46 + i * 1.9, y, 49); group.add(mesh);
  }
  // Boundary hedges: world limits are enforced in physics.
  for (const x of [-156, 156]) box(group, x, 1.1, 0, 3, 2.2, 315, '#718361');
  for (const z of [-156, 156]) box(group, 0, 1.1, z, 315, 2.2, 3, '#718361');

  // Batch the static city by material to avoid thousands of draw calls.
  group.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const sources: THREE.Mesh[] = [];
  group.traverse(obj => {
    if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
    const geometry = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geometry !== nonIndexed) geometry.dispose();
    if (!batches.has(obj.material)) batches.set(obj.material, []);
    batches.get(obj.material)!.push(nonIndexed); sources.push(obj);
  });
  for (const mesh of sources) mesh.removeFromParent();
  for (const [mat, geometries] of batches) {
    const merged = mergeGeometries(geometries); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = !(mat instanceof THREE.MeshBasicMaterial); mesh.receiveShadow = true; group.add(mesh);
    for (const g of geometries) g.dispose();
  }

  const traffic: TrafficCar[] = [];
  for (let i = 0; i < 8; i++) {
    const car = new THREE.Group(); const color = ['#bd6950', '#d8d3ba', '#d5af4c', '#7eaaa1'][i % 4];
    box(car, 0, .83, 0, 1.8, .72, 3.5, color); box(car, 0, 1.38, -.18, 1.57, .69, 1.83, '#547f80');
    box(car, 0, 1.76, -.18, 1.62, .1, 1.83, color);
    for (const side of [-1, 1]) {
      box(car, side * .79, 1.38, -.15, .09, .77, .1, color);
      for (const z of [-1.09, 1.08]) { const wheel = tube(car, side * .91, .49, z, .38, .18, '#283a37'); wheel.rotation.z = Math.PI / 2; }
      box(car, side * .59, .97, 1.77, .38, .21, .04, '#f1e5ae'); box(car, side * .59, .97, -1.77, .35, .19, .04, '#a94738');
    }
    const direction = i % 2 ? 1 : -1;
    const axis = i < 4 ? 'z' : 'x';
    const x = axis === 'z' ? (i < 2 ? 0 : 76) + direction * 4 : -130 + (i - 4) * 66;
    const z = axis === 'z' ? -130 + i * 70 : 78 - direction * 4;
    car.position.set(x, 0, z); car.rotation.y = axis === 'z' ? direction < 0 ? Math.PI : 0 : direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(car); traffic.push({ group: car, x, z, speed: 5 + i % 3, axis, direction });
  }
  const pedestrians: Pedestrian[] = [];
  for (let i = 0; i < 10; i++) {
    const person = createPerson(['#efcf8d', '#628f91', '#bd7156', '#eee2c6'][i % 4]);
    const startX = i < 6 ? (i % 2 ? -11 : 11) : -45 + (i - 6) * 27;
    const startZ = i < 6 ? -40 + Math.floor(i / 2) * 44 : -89;
    scene.add(person.group); pedestrians.push({ person, startX, startZ, phase: i * 1.7, axis: i < 6 ? 'z' : 'x', range: i < 6 ? 14 : 7 });
  }
  return { group, solids, mapBuildings, traffic, pedestrians, chairs };
}
