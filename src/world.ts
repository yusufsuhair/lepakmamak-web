import quietTables from '../shared/quiet-tables.json';
import chairLocations from '../shared/chairs.json';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { appearance, type Appearance } from './appearance';
import type { Solid } from './physics';
import { masjidSpots } from './masjid';

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
    ctx.font = `700 ${text.length > 24 ? 49 : text.length > 17 ? 60 : 85}px "Oxanium", sans-serif`;
    ctx.fillText(text, 512, 136, 960);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    textMaterials.set(key, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), textMaterials.get(key));
  mesh.position.set(x, y, z); mesh.rotation.y = rotation; parent.add(mesh); return mesh;
}

export interface Person { group: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group }
export function createPerson(shirt = '#ef734c', seated = false, customization?: Appearance): Person {
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
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      const color = (object.material as THREE.MeshStandardMaterial).color.getHexString();
      object.userData.avatarPart = color === shirt.slice(1) ? 'shirt' : color === 'b98157' || color === 'ac744c' ? 'skin' : color === '202c2b' ? 'hair' : color === 'c7be9c' ? 'trousers' : '';
    }
  });
  if (customization) applyAppearance(group, customization);
  return { group, leftLeg: limbs[0], rightLeg: limbs[1], leftArm: limbs[2], rightArm: limbs[3] };
}

export function applyAppearance(group: THREE.Group, value: unknown) {
  const look = appearance(value);
  group.traverse(object => { if (object instanceof THREE.Mesh && object.userData.avatarPart) object.material = material(look[object.userData.avatarPart as keyof Appearance]); });
  group.children[0].scale.x = look.gender === 'female' ? .55 : .61;
  group.children[1].scale.x = look.gender === 'female' ? .55 : .5;
  const old = group.getObjectByName('avatar-hair'); if (old) group.remove(old);
  const extra = new THREE.Group(); extra.name = 'avatar-hair'; group.add(extra);
  if (look.hairstyle === 'bob') {
    box(extra, 0, 1.79, -.17, .48, .46, .2, look.hair);
    for (const side of [-1, 1]) box(extra, side * .225, 1.83, -.025, .10, .4, .3, look.hair);
  } else if (look.hairstyle === 'ponytail') {
    const tail = ball(extra, 0, 1.76, -.29, .15, look.hair); tail.scale.y = .36;
  }
  group.userData.appearance = look;
}

export function applyAccessories(group: THREE.Group, items: string[]) {
  const key = [...items].sort().join(','); if (group.userData.accessoryKey === key) return;
  group.userData.accessoryKey = key;
  const old = group.getObjectByName('shop-accessories'); if (old) group.remove(old);
  const accessories = new THREE.Group(); accessories.name = 'shop-accessories'; group.add(accessories);
  if (items.includes('spectacles')) {
    for (const side of [-1, 1]) {
      const x = side * .115;
      for (const y of [1.845, 1.97]) box(accessories, x, y, .257, .19, .025, .025, '#16251f');
      for (const dx of [-.085, .085]) box(accessories, x + dx, 1.91, .257, .025, .14, .025, '#16251f');
      box(accessories, side * .215, 1.93, .1, .025, .025, .32, '#16251f');
    }
    box(accessories, 0, 1.93, .267, .065, .025, .025, '#16251f');
  }
  if (items.includes('cap')) {
    const crown = ball(accessories, 0, 2.04, -.02, .27, '#245d46'); crown.scale.y *= .7;
    box(accessories, 0, 2.025, .22, .43, .04, .36, '#dfff87');
    box(accessories, 0, 2.12, .21, .08, .09, .02, '#dfff87');
  }
  if (items.includes('batik')) {
    box(accessories, 0, 1.2, .185, .62, .68, .035, '#244f75');
    for (let i = -2; i <= 2; i++) {
      const motif = box(accessories, i * .12, 1.2 + (i % 2) * .13, .208, .055, .47, .018, '#e2b94e'); motif.rotation.z = i % 2 ? .58 : -.58;
    }
    for (const side of [-1, 1]) box(accessories, side * .39, 1.4, .145, .235, .34, .035, '#244f75');
  }
  if (items.includes('harimau')) {
    box(accessories, 0, 1.2, .185, .62, .68, .035, '#efc62f');
    for (const x of [-.23, -.11, .11, .23]) { const stripe = box(accessories, x, 1.22, .208, .055, .6, .018, '#202b2d'); stripe.rotation.z = x * 1.6; }
    box(accessories, 0, 1.45, .219, .22, .08, .018, '#f7e49b');
    for (const side of [-1, 1]) box(accessories, side * .39, 1.4, .145, .235, .34, .035, '#efc62f');
  }
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
  box(group, 0, 1.08, -.38, .57, .18, 1.35, '#253034');
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
  const rider = createPerson('#e87043', true); rider.group.position.set(0, .25, .1); rider.group.visible = false; group.add(rider.group);
  group.scale.setScalar(1.18);
  return { group, wheels, rider: rider.group, riderRig: rider };
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

/** Rahim’s ice-cream kapcai, with a seated vendor and animated wheels. */
export function createIceCreamBike() {
  const { group, rider, wheels } = createBike();
  rider.visible = true;
  applyAppearance(rider, { gender: 'male', hairstyle: 'short', hair: '#202c2b', skin: '#8b583d', shirt: '#628fbb', trousers: '#253a40' });
  // Rahim wears a yellow helmet and blue work shirt.
  const helmet = ball(rider, 0, 2.05, -.025, .28, '#ffd735'); helmet.scale.y *= .7;
  box(rider, 0, 1.76, .225, .22, .12, .06, '#202c2b');
  group.userData.wheels = wheels;
  const yellow = '#ffd735', blue = '#2263bb';
  // Rear freezer, insulated lid and stainless mounting rack.
  box(group, 0, 1.13, -.98, 1.5, .12, 1.05, '#bdcbd1');
  box(group, 0, 1.62, -.98, 1.4, .9, 1, yellow);
  box(group, 0, 2.1, -.98, 1.47, .12, 1.07, '#fff6df');
  box(group, 0, 1.97, -1.495, .35, .08, .04, blue);
  sign(group, 'MATKOOL', 0, 1.74, -1.49, 1.27, .34, blue, '#ffffff', Math.PI);
  sign(group, 'AIS KRIM', 0, 1.39, -1.49, 1.27, .22, yellow, blue, Math.PI);
  for (const side of [-1, 1]) {
    sign(group, 'MATKOOL', side * .706, 1.8, -.98, .93, .28, blue, '#ffffff', side * Math.PI / 2);
    // Colourful ice lolly illustrations on both freezer panels.
    for (let i = 0; i < 3; i++) {
      box(group, side * .715, 1.48, -1.26 + i * .28, .025, .24, .14, ['#f26b85', '#81d4d2', '#aa673c'][i]);
      box(group, side * .715, 1.31, -1.26 + i * .28, .025, .11, .035, '#e7bf83');
    }
  }
  tube(group, .62, 2.03, -.85, .035, 3.1, '#c5d5dc');
  for (let i = 0; i < 8; i++) {
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.48, .48, 1, 1, true, i * Math.PI / 4, Math.PI / 4), material(i % 2 ? blue : yellow));
    canopy.material.side = THREE.DoubleSide;
    canopy.position.set(.2, 3.55, -.65); canopy.castShadow = true; group.add(canopy);
  }
  ball(group, .2, 3.82, -.65, .085, yellow);
  sign(group, 'RAHIM · AIS KRIM', 0, 2.23, -1.5, 1.45, .22, blue, '#ffffff', Math.PI);
  return group;
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

const carGlass = new THREE.MeshStandardMaterial({ color: '#93c5cf', transparent: true, opacity: .3, roughness: .2 });
export type CarStyle = 'axia' | 'myvi' | 'avanza' | 'vellfire' | 'suv' | 'sport' | 'ferrari' | 'lamborghini' | 'f1';
export const carStyles: CarStyle[] = ['axia', 'myvi', 'avanza', 'vellfire', 'suv', 'sport', 'ferrari', 'lamborghini', 'f1'];
export function createDriveableCar(style: CarStyle = 'myvi') {
  const group = new THREE.Group(), wheels: THREE.Group[] = [];
  if (style === 'f1') {
    const red = '#d9272e', carbon = '#20292c', silver = '#d7dedb';
    group.userData.model = style;
    // Low open-wheel body, long nose, cockpit and front/rear aero wings.
    box(group, 0, .43, -.15, 1.08, .36, 2.85, red);
    box(group, 0, .38, 1.6, .48, .24, 1.35, red);
    box(group, 0, .38, 2.28, 1.85, .08, .38, carbon);
    box(group, 0, .78, -1.65, 1.9, .1, .38, carbon);
    for (const x of [-.82, .82]) box(group, x, .58, -1.65, .08, .72, .12, carbon);
    const cockpit = ball(group, 0, .72, -.48, .48, carbon); cockpit.scale.set(1, .62, 1.25);
    box(group, 0, .88, -.63, .08, .58, .72, silver);
    box(group, 0, 1.14, -.43, .64, .07, .08, silver);
    for (const side of [-1, 1]) {
      const haloSide = box(group, side * .28, 1.02, -.39, .055, .45, .58, silver); haloSide.rotation.z = side * -.34;
      for (const z of [-1.18, 1.32]) {
        const axle = new THREE.Group(); axle.position.set(side * .84, .43, z); group.add(axle);
        const wheel = tube(axle, 0, 0, 0, z < 0 ? .46 : .41, .3, '#151b1d'); wheel.rotation.z = Math.PI / 2; wheels.push(axle);
        const hub = tube(axle, side * .17, 0, 0, .16, .04, '#e2b63d'); hub.rotation.z = Math.PI / 2;
      }
    }
    sign(group, 'F1', 0, .5, 2.5, .52, .18, '#f5eee0', '#b32027');
    const driver = createPerson('#ef734c', true); driver.group.scale.setScalar(.5); driver.group.position.set(0, .35, -.5); driver.group.visible = false; group.add(driver.group);
    return { group, wheels, driver: driver.group };
  }
  const styles = {
    axia: { color: '#e4bf38', roof: 1.67, cabin: 1.85, length: 3.15, width: 1.64 },
    myvi: { color: '#57a99b', roof: 1.76, cabin: 1.95, length: 3.5, width: 1.8 },
    avanza: { color: '#c1c9cc', roof: 2.02, cabin: 2.4, length: 3.6, width: 1.78 },
    vellfire: { color: '#eee8dc', roof: 2.17, cabin: 2.68, length: 3.7, width: 1.9 },
    suv: { color: '#3e5364', roof: 2.02, cabin: 2.22, length: 3.65, width: 1.9 },
    sport: { color: '#c44338', roof: 1.38, cabin: 1.5, length: 3.55, width: 1.88 },
    ferrari: { color: '#d9272e', roof: 1.25, cabin: 1.35, length: 3.78, width: 1.92 },
    lamborghini: { color: '#efbd27', roof: 1.18, cabin: 1.24, length: 3.82, width: 1.96 },
  };
  const { color, roof, cabin, length, width } = styles[style];
  const sport = style === 'sport' || style === 'ferrari' || style === 'lamborghini', van = style === 'vellfire';
  const bodyY = sport ? .65 : .8, belt = sport ? .88 : 1.09;
  group.userData.model = style;
  box(group, 0, bodyY, 0, width, sport ? .5 : .68, length, color);
  box(group, 0, (belt + roof) / 2, -.2, width - .22, roof - belt, cabin, carGlass);
  box(group, 0, roof, -.2, width - .14, .12, cabin, color);
  // Windshield surround, door pillars, mirrors and handles.
  for (const side of [-1, 1]) {
    for (const z of [-.2 - cabin / 2, -.16, -.2 + cabin / 2]) box(group, side * (width / 2 - .08), (belt + roof) / 2, z, .075, roof - belt, .09, color);
    box(group, side * (width / 2 + .08), belt + .12, .65, .21, .12, .23, color);
    for (const z of sport ? [-.15] : [-.7, .35]) box(group, side * (width / 2 + .01), belt - .06, z, .035, .06, .22, '#c9d2d2');
    for (const z of [-length * .32, length * .31]) {
      const axle = new THREE.Group(); axle.position.set(side * width / 2, .4, z); group.add(axle);
      const wheel = tube(axle, 0, 0, 0, .36, .19, '#243034'); wheel.rotation.z = Math.PI / 2; wheels.push(axle);
      const hub = tube(axle, side * .105, 0, 0, sport ? .26 : .2, .025, sport ? '#b9c6c8' : '#96a5aa'); hub.rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++) { const spoke = box(axle, side * .125, 0, 0, .026, .43, .04, '#dce0d8'); spoke.rotation.x = i * Math.PI / 5; }
    }
    const light = box(group, side * width * .32, belt - .13, length / 2 + .025, width * .24, sport ? .08 : van ? .1 : .18, .055, '#fff3cb');
    if (style === 'axia' || sport) light.rotation.z = side * -.16;
    box(group, side * width * .35, belt - .18, -length / 2 - .025, van || style === 'avanza' ? .14 : .36, van || style === 'avanza' ? .49 : .16, .055, '#d84d42');
  }
  const grilleHeight = van ? .72 : style === 'suv' ? .48 : .27;
  box(group, 0, bodyY, length / 2 + .03, width * .52, grilleHeight, .05, '#24383d');
  for (let i = 0; i < (van ? 5 : 2); i++) box(group, 0, bodyY - grilleHeight / 2 + (i + .5) * grilleHeight / (van ? 5 : 2), length / 2 + .065, width * .5, .04, .03, '#c9d3d3');
  box(group, 0, .44, length / 2 + .04, width * .89, .1, .1, '#2b3b3c');
  sign(group, style.toUpperCase(), 0, .57, length / 2 + .105, .66, .16, '#172923', '#fff8e4');
  sign(group, style.toUpperCase(), 0, .59, -length / 2 - .06, .66, .16, '#172923', '#fff8e4', Math.PI);
  if (sport) {
    for (const x of [-.57, .57]) box(group, x, 1.04, -1.37, .08, .36, .1, '#283d3d');
    box(group, 0, 1.24, -1.4, 1.85, .085, .3, '#263b3c');
    for (const x of [-.23, .23]) box(group, x, bodyY + .26, .98, .18, .025, 1.45, '#eee7cf');
  }
  if (style === 'ferrari') {
    box(group, 0, .47, 1.89, 1.12, .11, .08, '#202b2d');
    for (const x of [-.63, .63]) { const intake = box(group, x, .62, .86, .36, .2, .07, '#202b2d'); intake.rotation.z = x > 0 ? -.18 : .18; }
  }
  if (style === 'lamborghini') {
    for (const x of [-.7, .7]) { const intake = box(group, x, .62, .88, .34, .28, .08, '#202b2d'); intake.rotation.z = x > 0 ? -.28 : .28; }
    const rearWing = box(group, 0, 1.05, -1.65, 1.72, .08, .28, '#202b2d'); rearWing.rotation.x = -.08;
  }
  if (style === 'suv' || style === 'avanza') for (const x of [-.62, .62]) box(group, x, roof + .12, -.2, .07, .12, cabin - .2, '#384b50');
  if (van) for (const side of [-1, 1]) box(group, side * width / 2, .81, -.6, .035, .04, 1.35, '#cad6d3');
  const driver = createPerson('#ef734c', true); driver.group.scale.setScalar(.7); driver.group.position.set(.35, .24, -.1); driver.group.visible = false; group.add(driver.group);
  return { group, wheels, driver: driver.group };
}

export interface TrafficCar { group: THREE.Group; x: number; z: number; speed: number; axis: 'x' | 'z'; direction: number }
export interface Pedestrian { person: Person; startX: number; startZ: number; phase: number; axis: 'x' | 'z'; range: number }
export interface World { chairs: { id: string; x: number; z: number; yaw: number }[]; group: THREE.Group; solids: Solid[]; mapBuildings: { x: number; z: number; w: number; d: number; color: string }[]; traffic: TrafficCar[]; pedestrians: Pedestrian[] }

export function createWorshipLandmark(kind: 'mosque' | 'hindu' | 'chinese', mosqueName = 'MASJID LEPAK') {
  const g = new THREE.Group(); g.name = kind;
  const width = kind === 'mosque' ? 36 : 18, depth = 20;
  box(g, 0, .12, 3, width + 2, .24, 28, '#ded3b8');
  const wall = kind === 'mosque' ? '#f1e9d4' : kind === 'hindu' ? '#edc5a5' : '#decba6';
  box(g, 0, 3, 0, kind === 'mosque' ? 25 : 15, 6, 15, wall);
  for (const x of [-5, 0, 5]) {
    box(g, x, 1.8, 7.56, 2.5, 3.6, .1, kind === 'chinese' ? '#762f2d' : '#376e66');
    const arch = ball(g, x, 3.65, 7.55, 1.25, kind === 'chinese' ? '#762f2d' : '#376e66'); arch.scale.z = .08;
  }
  if (kind === 'mosque') {
    tube(g, 0, 6.3, 0, 5.4, .6, '#d7bd75');
    const dome = ball(g, 0, 6.8, 0, 5.4, '#438d7b'); dome.scale.y *= .8;
    tube(g, 0, 11.4, 0, .1, 1.4, '#dbb956');
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(.5, .085, 8, 24, Math.PI * 1.5), material('#edca69')); crescent.position.set(0, 12.2, 0); crescent.rotation.z = Math.PI / 4; g.add(crescent);
    for (const x of [-15, 15]) {
      tube(g, x, 6, 0, 1.25, 12, '#efe6cc');
      for (const y of [3, 8, 11.5]) tube(g, x, y, 0, 1.55, .35, '#d5bc76');
      const cap = ball(g, x, 12.2, 0, 1.5, '#438d7b'); cap.scale.y *= .8;
      tube(g, x, 14, 0, .08, 1.4, '#dbb956');
    }
    sign(g, mosqueName, 0, 5.25, 7.7, 17, .8, '#438d7b');
  } else if (kind === 'hindu') {
    box(g, 0, 6.2, 0, 16.5, .5, 16.5, '#ad667c');
    for (let tier = 0; tier < 6; tier++) {
      const w = 8 - tier * .85, y = 6.5 + tier * 1.05;
      box(g, 0, y, 4, w, 1, Math.max(2.8, w * .6), ['#69aca6', '#d98991', '#cfb066'][tier % 3]);
      box(g, 0, y + .5, 4, w + .5, .18, Math.max(3, w * .6 + .5), '#efdbab');
      for (let x = -w / 2 + .65; x < w / 2; x += 1.2) { tube(g, x, y + .15, 4 + w * .3, .18, .5, '#efcf7d'); ball(g, x, y + .47, 4 + w * .3, .22, '#edc366'); }
    }
    for (const x of [-1.5, 0, 1.5]) { tube(g, x, 12.7, 4, .12, .7, '#dcb75a'); ball(g, x, 13.1, 4, .28, '#edc366'); }
    for (const x of [-7, 7]) { tube(g, x, 2.5, 8, .3, 5, '#bd6776'); tube(g, x, 4.7, 8, .5, .25, '#e4c17c'); }
    sign(g, 'KUIL SERI HARMONI', 0, 5.2, 8, 12, .8, '#955563');
  } else {
    for (const x of [-6.5, 6.5]) for (const z of [-6.5, 7.5]) tube(g, x, 3, z, .35, 6, '#af3e33');
    for (let tier = 0; tier < 2; tier++) {
      const w = 18 - tier * 4, y = 6.2 + tier * 2.4;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w / Math.SQRT2, 2.8, 4), material('#526c61')); roof.rotation.y = Math.PI / 4; roof.position.y = y + 1; roof.castShadow = true; g.add(roof);
      for (const side of [-1, 1]) { const eave = box(g, side * (w / 2 - .5), y, 0, 1.8, .2, w, '#ae4939'); eave.rotation.z = side * .25; }
      box(g, 0, y + 2.5, 0, w * .65, .22, .3, '#d7b368');
    }
    for (const x of [-5, 5]) { tube(g, x, 4.6, 8, .045, 1, '#d5af55'); const lantern = ball(g, x, 3.9, 8, .58, '#da5341'); lantern.scale.y = 1.2; tube(g, x, 3.15, 8, .045, .5, '#e0bd69'); }
    sign(g, 'TOKONG HARMONI', 0, 5.1, 8, 11, .8, '#8d352f', '#f2d38e');
    tube(g, 0, .65, 11, .8, 1.1, '#997956'); tube(g, 0, 1.25, 11, 1, .18, '#be9a62');
  }
  return {group: g, width, depth};
}

export function createWorld(scene: THREE.Scene): World {
  const chairs: World['chairs'] = chairLocations;
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
  for (const [x, z] of [[-38, 45], [-29, 45], [-39, 51], [-29, 52], [112,-14], [-110,60], ...quietTables.map(t=>[t.x,t.z])]) {
    tube(group, x, 1.06, z, 1.14, .14, '#e9dfc0'); tube(group, x, .53, z, .11, 1.02, '#727e6b'); solid(x, z, 1.8, 1.8);
    for (const a of [0, 2.1, 4.2]) {
      const chair = new THREE.Group(); chair.position.set(x + Math.sin(a) * 1.65, 0, z + Math.cos(a) * 1.65); chair.rotation.y = a; group.add(chair);
      box(chair, 0, .6, 0, .73, .1, .73, '#be5142'); box(chair, 0, 1.04, .33, .73, .8, .1, '#be5142');
      for (const dx of [-.28, .28]) for (const dz of [-.28, .28]) box(chair, dx, .3, dz, .06, .6, .06, '#923e35');
    }
    tube(group, x + .35, 1.23, z, .1, .26, '#c28246');
    tube(group, x - .35, 1.16, z + .12, .27, .04, '#f5efd4');
  }
  sign(group, 'LEPAK HERE', -18.5, 1.4, 43.3, 3.4, 1.5, '#edb64f', '#344a36');
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
    return g;
  }
  shop(-60, 58, 18, shopColors[0], 'BENGKEL AZLAN');
  shop(-36, -12, 19, shopColors[4], 'DOBI LAYAN DIRI');
  shop(-57, -12, 20, shopColors[3], 'KEDAI KOPI');
  shop(-35, -40, 18, shopColors[2], 'PASAR MINI');
  shop(27, 34, 19, shopColors[0], 'WARUNG KAK ANA');
  shop(28, -16, 21, shopColors[3], 'RESTORAN SERI KL');
  shop(51, -16, 20, shopColors[2], 'KEDAI ELEKTRIK');
  shop(33, 103, 24, shopColors[1], 'SELAMAT JALAN');
  // Masjid Kampung Maju occupies the former PETRONAS site.
  // Rotate its entrance toward the mamak while keeping the courtyard clear.
  {
    const mosque = createWorshipLandmark('mosque', 'MASJID KAMPUNG MAJU');
    const spot = masjidSpots[0];
    mosque.group.position.set(spot.x, 0, spot.z); mosque.group.rotation.y = Math.PI; group.add(mosque.group);
    solid(spot.x, spot.z, mosque.width, 28);
    mapBuildings.push({ x: spot.x, z: spot.z, w: mosque.width, d: 28, color: '#438d7b' });
  }
  // Neighbourhood retail fronts, with displays visible from the pavement.
  function retail(x: number, z: number, label: string, brand: string, ink: string, kind: 'market' | 'diy' | 'laundry') {
    const g = shop(x, z, 19, '#e2d5b5', label);
    sign(g, label, 0, 4.02, 6.3, 18.7, 1.22, brand, ink);
    box(g, 0, 3.18, 7.12, 19, .15, 2.35, brand);
    box(g, 0, 1.5, 6.18, 2.1, 3, .12, '#a2c5c0');
    for (const side of [-1, 1]) {
      box(g, side * 1.12, 1.5, 6.3, .1, 3, .12, '#e7e6d8');
      box(g, side * .17, 1.4, 6.3, .06, .42, .06, '#34453d');
    }
    sign(g, kind === 'laundry' ? 'BASUH · KERING · LIPAT' : kind === 'diy' ? 'BARANG RUMAH & PERKAKAS' : 'BARANGAN KEPERLUAN HARIAN', 0, .38, 6.34, 17.8, .42, brand, ink);
    for (const side of [-1, 1]) {
      if (kind === 'laundry') {
        for (let i = 0; i < 3; i++) {
          const x = side * (2.7 + i * 2.1);
          box(g, x, 1.45, 6.3, 1.85, 1.9, .55, '#e6eded');
          const drum = tube(g, x, 1.36, 6.62, .61, .07, '#697f88'); drum.rotation.x = Math.PI / 2;
          const glass = tube(g, x, 1.36, 6.68, .43, .08, '#253f54'); glass.rotation.x = Math.PI / 2;
          box(g, x + .42, 2.13, 6.62, .3, .12, .06, '#80cc9b');
        }
      } else {
        for (const y of [.9, 1.65, 2.4]) {
          box(g, side * 5.15, y - .22, 6.32, 6.3, .1, .55, '#d8d2be');
          for (let i = 0; i < 6; i++) {
            const x = side * (2.7 + i * .95);
            box(g, x, y + .05, 6.35, .62, .44, .3, (kind === 'diy' ? ['#e9b929', '#263f4a', '#d86b3e'] : ['#c95b49', '#a8bf72', '#dfc35c', '#79b7c4'])[i % (kind === 'diy' ? 3 : 4)]);
          }
        }
      }
    }
  }
  retail(27, 58, '99 SPEEDMART', '#df3437', '#fff4d9', 'market');
  retail(49, 58, 'KK SUPER MART', '#c92536', '#ffffff', 'market');
  retail(-35, -90, 'KEDAI DOBI · 24 JAM', '#348cb1', '#ffffff', 'laundry');
  retail(-56, -90, 'MR.DIY', '#f1c62b', '#253d35', 'diy');
  retail(27,-40,'KEDAI ACEH · SERBANEKA','#317e62','#fff0ce','market');
  retail(49,-40,'MR.DIY','#f1c62b','#253d35','diy');
  retail(105,60,'99 SPEEDMART','#df3437','#fff4d9','market');
  retail(129,60,'KK SUPER MART','#c92536','#ffffff','market');

  // Watsons health and beauty shop: a bright turquoise frontage, glazed doors
  // and compact product displays make it recognisable from the street.
  {
    const watsons = shop(-56, -40, 19, '#e4e9df', 'WATSONS');
    const turquoise = '#00a58f', deep = '#087565', white = '#fffef3';
    sign(watsons, 'Watsons', 0, 4.05, 6.31, 18.7, 1.3, turquoise, white);
    box(watsons, 0, 3.18, 7.12, 19, .15, 2.35, turquoise);
    box(watsons, 0, 1.52, 6.2, 2.25, 3.05, .13, '#a9d4cf');
    for (const side of [-1, 1]) {
      box(watsons, side * 1.2, 1.52, 6.3, .1, 3.05, .12, white);
      for (const y of [.9, 1.55, 2.2]) {
        box(watsons, side * 5.05, y - .2, 6.33, 6.25, .1, .52, '#d8ded5');
        for (let i = 0; i < 6; i++) box(watsons, side * (2.62 + i * .98), y + .04, 6.36, .55, .38, .27, ['#8bc8bd', '#efb4b6', '#f3d579', '#f7f4e8'][i % 4]);
      }
    }
    sign(watsons, 'HEALTH · BEAUTY · PHARMACY', 0, .39, 6.35, 17.8, .42, deep, white);
    sign(watsons, '+', 7.55, 5.35, 6.32, 1.35, 1.35, white, turquoise);
  }

  // FamilyMart Malaysia storefront, using its white fascia and signature
  // green-over-blue bands with café, fresh-food and snack displays.
  {
    const familyMart = shop(49, 34, 22, '#f4f4ec', 'FAMILYMART');
    const green = '#159447', blue = '#1674be', white = '#fffef7', glass = '#8ebbbb';
    box(familyMart, 0, 4.72, 6.28, 22, .42, .2, green);
    box(familyMart, 0, 4.35, 6.29, 22, .32, .21, white);
    box(familyMart, 0, 4.03, 6.3, 22, .34, .22, blue);
    sign(familyMart, 'Family', -3.65, 5.55, 6.32, 10.3, 1.25, white, green);
    sign(familyMart, 'Mart', 4.45, 5.55, 6.32, 6.1, 1.25, white, blue);
    box(familyMart, 0, 3.17, 7.14, 22, .15, 2.35, green);
    box(familyMart, 0, 2.93, 7.15, 22, .16, 2.36, white);
    box(familyMart, 0, 2.69, 7.16, 22, .15, 2.37, blue);
    box(familyMart, 0, 1.52, 6.2, 2.5, 3.05, .13, glass);
    for (const x of [-8.2, -5.6, -3, 3, 5.6, 8.2]) {
      box(familyMart, x, 1.52, 6.21, 2.35, 3.05, .13, glass);
      box(familyMart, x - 1.18, 1.52, 6.3, .08, 3.05, .1, white);
    }
    for (const side of [-1, 1]) for (const y of [.83, 1.48, 2.13]) {
      box(familyMart, side * 6.1, y - .18, 6.36, 6.3, .08, .45, white);
      for (let i = 0; i < 6; i++) box(familyMart, side * (3.7 + i * .98), y + .04, 6.4, .55, .36, .25, ['#f0d56d', '#eb8d69', '#83b887', '#f5f0df'][i % 4]);
    }
    sign(familyMart, 'FRESH FOOD · CAFÉ · BAKERY', -1.5, .38, 6.38, 15.8, .42, blue, white);
    sign(familyMart, 'SOFUTO', 8.35, .38, 6.38, 4.4, .42, green, white);
  }

  // 7-Eleven Malaysia storefront with its striped fascia, glazed entrance,
  // Fresh to Go panel, CAFé counter and colourful Slurpee display.
  {
    const seven = shop(-59, 32, 17, '#f2f0e6', '7-ELEVEN');
    const green = '#168447', orange = '#f28b22', red = '#d83c2f', white = '#fffdf3', charcoal = '#242b29', glass = '#85b4b2';
    box(seven, 0, 5.02, 6.28, 17, .44, .2, green);
    box(seven, 0, 4.63, 6.29, 17, .23, .21, white);
    box(seven, 0, 4.39, 6.3, 17, .24, .22, orange);
    box(seven, 0, 4.14, 6.31, 17, .25, .23, red);
    box(seven, -5.9, 5.75, 6.32, 2.55, 2.05, .22, green);
    sign(seven, '7', -5.9, 5.75, 6.45, 2.15, 1.65, white, red);
    sign(seven, 'ELEVEN', 1.65, 5.75, 6.33, 10.8, 1.42, white, green);
    box(seven, 0, 3.14, 7.12, 17, .14, 2.3, green);
    box(seven, 0, 2.91, 7.13, 17, .13, 2.31, orange);
    box(seven, 0, 2.69, 7.14, 17, .13, 2.32, red);
    box(seven, 0, 1.5, 6.2, 2.35, 3, .13, glass);
    for (const x of [-6.8, -4.45, -2.1, 2.1, 4.45, 6.8]) {
      box(seven, x, 1.5, 6.21, 2.05, 3, .13, glass);
      box(seven, x - 1.03, 1.5, 6.3, .08, 3, .1, white);
    }
    box(seven, -5.15, 1.25, 6.39, 5.3, 2.35, .2, charcoal);
    sign(seven, 'FRESH TO GO', -5.15, 2.05, 6.52, 4.7, .55, charcoal, white);
    sign(seven, '7CAFÉ', -5.15, 1.3, 6.52, 4.2, .5, charcoal, orange);
    sign(seven, 'SLURPEE', 5.2, 2.28, 6.45, 4.7, .55, white, green);
    for (let i = 0; i < 4; i++) {
      const x = 3.75 + i * .95;
      box(seven, x, 1.13, 6.43, .62, 1.15, .28, ['#dc4b45', '#58a8d2', '#8f65b7', '#e4c641'][i]);
      box(seven, x, 1.78, 6.43, .75, .18, .3, white);
    }
    sign(seven, 'OPEN 24 HOURS', 0, .38, 6.4, 15.8, .42, green, white);
  }

  // A recognisably Malaysian PETRONAS forecourt: Mesra shop, turquoise canopy,
  // six pumps and a roadside fuel pylon. The open forecourt remains driveable.
  {
    const px = -31, pz = 112;
    const station = new THREE.Group(); station.position.set(px, 0, pz); group.add(station);
    const stationSolid = (x: number, z: number, w: number, d: number) => solid(px + x, pz + z, w, d);
    const green = '#00a58f', darkGreen = '#087565', white = '#f5f4e9', charcoal = '#293d3b';

    box(station, 0, .03, 0, 58, .12, 52, '#aaa99e');
    box(station, 0, .11, -9, 40, .08, 25, '#d8d5c9');
    for (const x of [-15, -5, 5, 15]) box(station, x, .17, -20, 7, .04, 3, '#f3eee0');

    // Kedai Mesra, with a glazed frontage and familiar green fascia.
    box(station, 0, 3.3, 18, 36, 6.6, 14, white);
    box(station, 0, 6.7, 18, 37, .35, 14.6, darkGreen);
    box(station, 0, 5.55, 10.94, 36.2, 1.55, .16, green);
    sign(station, 'KEDAI MESRA', 0, 5.6, 10.84, 17, .92, green, '#ffffff', Math.PI);
    for (const x of [-12.5, -8, -3.5, 3.5, 8, 12.5]) {
      box(station, x, 2.45, 10.9, 3.7, 4.35, .18, '#76a9a7');
      box(station, x, 2.45, 10.78, .1, 4.35, .08, white);
    }
    box(station, 0, 2.25, 10.72, 2.5, 4.1, .12, '#dce8df');
    box(station, 0, 1.35, 10.62, .12, .35, .1, charcoal);
    stationSolid(0, 18, 36, 14); mapBuildings.push({ x: px, z: pz + 18, w: 36, d: 14, color: green });

    // Wide canopy with four slim supports and a green band visible from the road.
    box(station, 0, 6.45, -9, 38, .55, 19, white);
    box(station, 0, 6.38, -18.55, 38.2, .72, .28, green);
    box(station, 0, 6.38, .55, 38.2, .72, .28, green);
    box(station, -19.05, 6.38, -9, .28, .72, 19, green);
    box(station, 19.05, 6.38, -9, .28, .72, 19, green);
    sign(station, 'PETRONAS', 0, 6.38, -18.72, 12, .58, green, '#ffffff', Math.PI);
    for (const x of [-16, 16]) for (const z of [-15, -3]) {
      box(station, x, 3.25, z, .48, 6.5, .48, white);
      box(station, x, 4.2, z - .26, .58, 1.4, .08, green);
      stationSolid(x, z, .55, .55);
    }
    mapBuildings.push({ x: px, z: pz - 9, w: 38, d: 19, color: green });

    // Three pump islands, with a dispenser on each side.
    for (const x of [-11, 0, 11]) {
      box(station, x, .18, -9, 5.5, .28, 2.25, '#e8e4d7');
      for (const z of [-9.65, -8.35]) {
        box(station, x, 1.55, z, 1.55, 2.7, .72, white);
        box(station, x, 2.48, z - .38, 1.25, .55, .06, green);
        box(station, x, 1.75, z - .39, .76, .52, .05, charcoal);
        box(station, x + .66, 1.25, z, .12, 1.25, .18, '#202c2b');
      }
      for (const edge of [-1, 1]) box(station, x + edge * 2.45, .28, -9, .32, .45, 2.28, edge > 0 ? '#f2c944' : charcoal);
      stationSolid(x, -9, 5.5, 2.25);
    }

    // Roadside brand pylon; fuel names avoid prices that change over time.
    box(station, 23, 5.5, -24, 3.8, 11, 1.1, white);
    box(station, 23, 8.9, -24.58, 3.9, 3.1, .12, green);
    sign(station, 'PETRONAS', 23, 9.05, -24.66, 3.45, .58, green, '#ffffff', Math.PI);
    sign(station, 'RON 95', 23, 6.35, -24.66, 3.2, 1.05, '#f5f4e9', darkGreen, Math.PI);
    sign(station, 'RON 97', 23, 5.25, -24.66, 3.2, 1.05, '#f5f4e9', darkGreen, Math.PI);
    sign(station, 'DIESEL', 23, 4.15, -24.66, 3.2, 1.05, '#f5f4e9', darkGreen, Math.PI);
    box(station, 23, 2.65, -24.62, 3.5, .7, .12, green);
    stationSolid(23, -24, 3.8, 1.1);
  }

  for(const [x,z,label] of [[112,-14,'DATARAN SANTAI'],[-110,60,'LAMAN LEPAK']] as const){
    box(group,x,.02,z,13,.04,10,'#c6b891');
    sign(group,label,x,2.5,z-3.8,6,1,'#376b55','#fff0ce');
    for(const side of [-1,1]){box(group,x+side*3,1.2,z-3.8,.1,2.4,.1,'#6b7759');palm(group,x+side*5,z-2,.5);solid(x+side*5,z-2,.6,.6);}
    box(group,x,3.8,z,6,.12,5,'#bc875b');for(const side of [-1,1])for(const front of [-1,1]){box(group,x+side*2.8,1.9,z+front*2.3,.12,3.8,.12,'#755741');solid(x+side*2.8,z+front*2.3,.15,.15);}
  }
  // Named city block: recognisable silhouettes replace four generic towers.
  function cityLandmark(x:number,z:number,name:string,accent:string,height:number,kind:'bank'|'civic'|'hotel'){
    const landmark=new THREE.Group();landmark.position.set(x,0,z);group.add(landmark);
    const w=kind==='hotel'?17:16,d=17,body=kind==='hotel'?'#e4d7bd':'#c8d0c9';
    box(landmark,0,height/2,0,w,height,d,body);
    box(landmark,w/2+.04,height/2,0,.16,height-.8,d-.8,kind==='hotel'?'#746855':'#607675');
    for(let y=3;y<height-2;y+=3.2)for(let wz=-d/2+2;wz<d/2-1;wz+=3.2)box(landmark,w/2+.15,y,wz,.08,1.55,1.7,kind==='hotel'?'#d8ad65':'#79a0a0');
    box(landmark,w/2+.24,1.6,0,.3,3.2,5.6,'#283f3c');
    sign(landmark,name,w/2+.42,height-3,0,kind==='hotel'?11:9,1.5,accent,'#ffffff',Math.PI/2);
    box(landmark,0,height+.3,0,w+.5,.6,d+.5,accent);
    if(kind==='bank'){for(const side of [-1,1])tube(landmark,w/2+1.1,2.2,side*3.2,.18,4.4,'#ddd8c7');}
    if(kind==='civic'){sign(landmark,'PUSAT KOMUNITI',w/2+.43,4.2,0,10,.8,'#f4f0df','#b63035',Math.PI/2);box(landmark,w/2+1.1,5.9,-4.7,.1,4.8,.1,'#d8d4bd');box(landmark,w/2+1.1,7.8,-4.7,.08,.9,1.45,'#df3d42');}
    if(kind==='hotel'){box(landmark,0,height+1.1,0,7,1.6,7,'#b99551');for(const side of [-1,1])tube(landmark,w/2+1.2,1.7,side*4.6,.16,3.4,'#b99551');}
    solid(x,z,w,d);mapBuildings.push({x,z,w,d,color:accent});
  }
  cityLandmark(-127,-37,'UOB','#b52e35',30,'bank');
  cityLandmark(-106,-37,'HSBC','#d33b3e',27,'bank');
  cityLandmark(-127,37,'DAP','#c62e34',22,'civic');
  cityLandmark(-106,37,'HOTEL MAHKOTA','#a5813e',38,'hotel');
  // Mid-rise skyline, deterministically placed away from the road grid.
  let seed = 37; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const x of [-127, -106, 105, 129]) for (const z of [-128, -95, -37, 37, 113]) {
    if(x<0&&(z===-37||z===37))continue;
    if (x > 0 && (z === -37 || z === 37 || z === 113)) continue;
    const height = 14 + rand() * 29, w = 13 + rand() * 5, d = 17;
    block(x, z, w, height, d, ['#aab7ad', '#c9bfa5', '#b4bdb6', '#d6c6aa'][Math.floor(rand() * 4)]);
    box(group, x, height + .25, z, w + .5, .5, d + .5, '#cbd0b7');
    for (let y = 3; y < height - 1; y += 3.4) {
      for (let wx = -w / 2 + 2; wx < w / 2 - 1; wx += 3.3) box(group, x + wx, y, z + d / 2 + .015, 1.8, 1.7, .04, '#728e88');
    }
  }
  // Dedicated worship sites replace skyline lots, clear of the roads.
  for (const [kind, x, z] of [['mosque', masjidSpots[1].x, masjidSpots[1].z], ['hindu', 105, 37], ['chinese', 129, 37]] as const) {
    const landmark = createWorshipLandmark(kind); landmark.group.position.set(x, 0, z); group.add(landmark.group);
    solid(x, z, landmark.width, 16);
    mapBuildings.push({x, z, w: landmark.width, d: landmark.depth, color: kind === 'mosque' ? '#438d7b' : kind === 'hindu' ? '#bd6776' : '#ae4939'});
  }
  // A distant communications tower complements the twin towers.
  tube(group, -104, 42, -145, 1.3, 84, '#c5c6ae');
  tube(group, -104, 70, -145, 6.2, 4, '#aaa991'); tube(group, -104, 73, -145, 4.9, 2, '#637f79');
  tube(group, -104, 89, -145, .3, 21, '#d8d2b6');
  for (const x of [-11.5, 11.5]) for (const z of [-47, -21, 29, 65, 99, 132]) streetLamp(group, x, z, x > 0 ? -1 : 1);
  for (const [x, z, s] of [[-48, 54, 1], [-11, 19, 1], [12, 47, 1.05], [13, -32, .9], [-13, -78, 1], [58, 61, 1], [54, -45, .85], [-61, 91, 1]]) palm(group, x, z, s);
  // Keep the basketball sideline clear of the southern tree canopy.
  for (const x of [-67, 64, 93, -95]) for (const z of [-79, -23, 22, 92, 135]) tree(group, x, x===64&&z===135?149:z, .8 + rand() * .45);
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
  for (let i = 0; i < 12; i++) {
    const model = createDriveableCar(carStyles[i % carStyles.length]);
    const car = model.group; car.userData.wheels = model.wheels;
    const direction = i % 2 ? 1 : -1;
    const axis = i < 6 ? 'z' : 'x';
    const x = axis === 'z' ? (i < 3 ? 0 : 76) + direction * 4 : -138 + (i - 6) * 52;
    const z = axis === 'z' ? -142 + i * 56 : 78 - direction * 4;
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
