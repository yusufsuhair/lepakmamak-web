import quietTables from '../shared/quiet-tables.json';
import tableLocations from '../shared/tables.json';
import fleetSeeds from '../shared/fleet.json';
import {createDurianVillage} from './durian-village';
import chairLocations from '../shared/chairs.json';
import mamakStreetLayout from '../shared/mamak-streets.json';
import mamakShops from '../shared/mamak-shops.json';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type Appearance } from './appearance';
import {createCharacter, applyCharacterAppearance, refreshCharacterAccessories} from './character-assets';
import type { Solid } from './physics';
import { masjidSpots } from './masjid';
import {createTaycan} from './taycan';
import {upgradeVehicle} from './vehicle-assets';
import {createGt3Rs} from './gt3-rs';
import {createRembayung, type RembayungSite} from './rembayung';
import {foliageStatus,foliageYaw,queueFoliage} from './foliage';
import {loadPetronas, type PetronasSite} from './petronas';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

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
// Both drive-throughs live in one asset, so the two sites share a single fetch.
let driveThroughModel: Promise<THREE.Group | null> | undefined;
const driveThroughAsset = () => driveThroughModel ??= new GLTFLoader()
  .loadAsync('/assets/models/environment/LM_ENV_DriveThrough.glb?v=drivethru-v1')
  .then(gltf => {
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = object.receiveShadow = true;
      const material = object.material as THREE.MeshStandardMaterial;
      if (material.transparent) { material.depthWrite = false; object.castShadow = false; }
    });
    return gltf.scene;
  })
  .catch(error => { console.warn('[drive-through] keeping procedural outlets', error); return null; });

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

/** Keep an independently replaceable facade cheap while it waits for its GLB. */
function batchShopFallback(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const sources: THREE.Mesh[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const geometry = object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geometry !== nonIndexed) geometry.dispose();
    if (!batches.has(object.material)) batches.set(object.material, []);
    batches.get(object.material)!.push(nonIndexed); sources.push(object);
  });
  for (const source of sources) source.removeFromParent();
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = !(material instanceof THREE.MeshBasicMaterial); mesh.receiveShadow = true;
      mesh.userData.keepUnbatched = true; root.add(mesh);
    }
    for (const geometry of geometries) geometry.dispose();
  }
}

export interface Person { group: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group }
export function createPerson(shirt = '#ef734c', seated = false, customization?: Appearance): Person {
  return createCharacter(shirt, seated, customization);
}
export const applyAppearance = applyCharacterAppearance;

export function applyAccessories(group: THREE.Group, items: string[]) {
  const key = [...items].sort().join(','); if (group.userData.accessoryKey === key) return;
  group.userData.accessoryKey = key;
  let accessories = group.getObjectByName('shop-accessories') as THREE.Group | undefined;
  if (!accessories) { accessories = new THREE.Group(); accessories.name = 'shop-accessories'; group.add(accessories); }
  accessories.clear();
  if (items.includes('spectacles')) {
    for (const side of [-1, 1]) {
      const x = side * .15;
      for (const y of [1.765, 1.86]) box(accessories, x, y, .327, .22, .025, .025, '#16251f');
      for (const dx of [-.10, .10]) box(accessories, x + dx, 1.812, .327, .018, .10, .025, '#16251f');
      box(accessories, side * .265, 1.822, .19, .018, .018, .29, '#16251f');
    }
    box(accessories, 0, 1.815, .337, .08, .018, .018, '#16251f');
  }
  if (items.includes('cap')) {
    const cap = new THREE.Group(); cap.name = 'shop-cap'; accessories.add(cap);
    const crown = ball(cap, 0, 2.05, -.02, .41, '#245d46'); crown.scale.y *= .48;
    box(cap, 0, 2.03, .29, .61, .035, .39, '#dfff87');
    box(cap, 0, 2.12, .315, .08, .08, .02, '#dfff87');
  }
  if (items.includes('batik')) {
    box(accessories, 0, 1.06, .185, .52, .51, .035, '#244f75');
    for (let i = -2; i <= 2; i++) {
      const motif = box(accessories, i * .10, 1.04 + (i % 2) * .08, .208, .045, .36, .018, '#e2b94e'); motif.rotation.z = i % 2 ? .58 : -.58;
    }
  }
  if (items.includes('harimau')) {
    box(accessories, 0, 1.06, .185, .52, .51, .035, '#efc62f');
    for (const x of [-.19, -.09, .09, .19]) { const stripe = box(accessories, x, 1.06, .208, .045, .44, .018, '#202b2d'); stripe.rotation.z = x * 1.6; }
    box(accessories, 0, 1.24, .219, .22, .08, .018, '#f7e49b');
  }
  refreshCharacterAccessories(group);
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
  queueFoliage(parent,'rain-tree',{x,y:0,z,yaw:foliageYaw(x,z),scale},group);
}
export function palm(parent: THREE.Object3D, x: number, z: number, size = 1) {
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
  queueFoliage(parent,'coconut-palm',{x,y:0,z,yaw:foliageYaw(x,z),scale:size},group);
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

export const KLCC_LIFT_TOP = 76.5;
export interface KlccLift {
  id: string;
  x: number;
  z: number;
  topY: number;
  cabin: THREE.Group;
}

function createKlccLift(parent: THREE.Object3D, x: number, z: number, id: string): KlccLift {
  const metal = material('#cdd9cf', .38);
  const glass = new THREE.MeshStandardMaterial({ color: '#8fd4d0', transparent: true, opacity: .16, roughness: .18, depthWrite: false, side: THREE.DoubleSide });
  const topY = KLCC_LIFT_TOP;
  // The shafts sit just south of the podium, so the entrance remains reachable without
  // punching a hole through the existing building collision box.
  for (const side of [-1, 1]) {
    const wallX = box(parent, x + side * 1.55, topY / 2, z, .08, topY, 3.1, glass); wallX.renderOrder = 2;
    const wallZ = box(parent, x, topY / 2, z + side * 1.55, 3.1, topY, .08, glass); wallZ.renderOrder = 2;
    box(parent, x + side * 1.55, topY / 2, z, .13, topY, .13, metal);
    box(parent, x, topY / 2, z + side * 1.55, .13, topY, .13, metal);
  }
  box(parent, x, .08, z, 4.1, .16, 4.1, '#a9b6a9');
  box(parent, x, topY - .08, z, 7.2, .16, 7.2, '#a9b6a9');
  for (const side of [-1, 1]) {
    box(parent, x + side * 3.25, topY + 1.35, z, .12, 2.7, 7.2, metal);
    box(parent, x, topY + 1.35, z + side * 3.25, 7.2, 2.7, .12, metal);
  }
  sign(parent, 'LIFT · KLCC', x, 3.1, z - 1.66, 2.7, .58, '#245848', '#f8e8ad', Math.PI);

  const cabin = new THREE.Group(); cabin.name = `${id}-cabin`; cabin.position.set(x, 0, z); parent.add(cabin);
  box(cabin, 0, .12, 0, 2.45, .22, 2.45, metal);
  box(cabin, 0, 2.42, 0, 2.45, .14, 2.45, metal);
  for (const side of [-1, 1]) {
    const wallX = box(cabin, side * 1.17, 1.25, 0, .05, 2.5, 2.35, glass); wallX.renderOrder = 3;
    const wallZ = box(cabin, 0, 1.25, side * 1.17, 2.35, 2.5, .05, glass); wallZ.renderOrder = 3;
    box(cabin, side * 1.17, 1.25, 0, .1, 2.5, .1, metal);
    box(cabin, 0, 1.25, side * 1.17, .1, 2.5, .1, metal);
  }
  sign(cabin, 'LIFT · KLCC', 0, 1.25, -1.2, 1.95, .32, '#245848', '#f8e8ad', Math.PI);
  return { id, x, z, topY, cabin };
}

const carGlass = new THREE.MeshStandardMaterial({ color: '#93c5cf', transparent: true, opacity: .3, roughness: .2 });
export type CarStyle = 'emas' | 'axia' | 'myvi' | 'avanza' | 'vellfire' | 'suv' | 'sport' | 'ferrari' | 'lamborghini' | 'f1' | 'model-y' | 'cybertruck' | 'police' | 'taycan' | 'gt3-rs';
export const carStyles: CarStyle[] = ['emas', 'axia', 'myvi', 'avanza', 'vellfire', 'suv', 'sport', 'ferrari', 'lamborghini', 'f1', 'model-y', 'cybertruck', 'police', 'taycan', 'gt3-rs'];
export interface VehicleFootprint { width: number; length: number }
function setVehicleFootprint(group: THREE.Group, width: number, length: number) {
  group.userData.vehicleFootprint = {width, length} satisfies VehicleFootprint;
}
export function vehicleSolid(group: THREE.Group, x = group.position.x, z = group.position.z, yaw = group.rotation.y): Solid {
  const footprint = group.userData.vehicleFootprint as VehicleFootprint | undefined;
  const width = footprint?.width || 1.9, length = footprint?.length || 4;
  return {x, z, hx: width / 2, hz: length / 2, yaw, id: 'vehicle'};
}
export function createDriveableCar(style: CarStyle = 'myvi') {
  const model = createProceduralCar(style === 'emas' ? 'suv' : style);
  // The owner Porsches are intentionally untouched, including their materials/footprints.
  const fallback = model.group.children.filter(child => child !== model.driver);
  const ready = style === 'taycan' || style === 'gt3-rs'
    ? Promise.resolve(false) : upgradeVehicle(model, style).then(loaded => {
      if (loaded) {
        // Procedural cubes/person materials are shared by the whole city. Dispose only
        // this temporary shell's private shapes and window materials; text atlases are cached too.
        const shared = new Set<THREE.Material>([...materials.values(), ...textMaterials.values(), carGlass]);
        const privateGeometry = new Set<THREE.BufferGeometry>();
        const privateMaterials = new Set<THREE.Material>();
        for (const child of fallback) child.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          if (![cube, cylinder, sphere].includes(object.geometry)) privateGeometry.add(object.geometry);
          for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
            if (!shared.has(m)) privateMaterials.add(m);
          }
        });
        for (const geometry of privateGeometry) geometry.dispose();
        for (const m of privateMaterials) { (m as THREE.MeshBasicMaterial).map?.dispose(); m.dispose(); }
      }
      return loaded;
    });
  return {...model, ready};
}

function createProceduralCar(style: Exclude<CarStyle, 'emas'>) {
  if(style==='gt3-rs'){
    const model=createGt3Rs(),driver=createPerson('#eeeeee',true);
    setVehicleFootprint(model.group,2.2,4.44);
    driver.group.scale.setScalar(.54);driver.group.position.set(.32,.15,-.18);driver.group.visible=false;model.group.add(driver.group);
    return{...model,driver:driver.group};
  }
  if(style==='taycan'){
    const model=createTaycan(),driver=createPerson('#e9d8c3',true);
    setVehicleFootprint(model.group,2.16,4.44);
    driver.group.scale.setScalar(.58);driver.group.position.set(.32,.18,-.15);driver.group.visible=false;model.group.add(driver.group);
    return{...model,driver:driver.group};
  }
  const group = new THREE.Group(), wheels: THREE.Group[] = [];
  // An officer at the wheel, decided before any branch narrows the style.
  const driverShirt = style === 'police' ? '#1f3f78' : '#ef734c';
  if(style==='model-y'||style==='cybertruck'){
    const truck=style==='cybertruck',w=truck?2.05:1.92,l=truck?4.8:4.25,color=truck?'#a5adb1':'#eceeea';
    setVehicleFootprint(group,w,l);
    group.userData.model=style;
    const shell=new THREE.Shape();shell.moveTo(-l/2,.55);shell.lineTo(l/2,.55);shell.lineTo(l/2,1.02);
    if(truck){shell.lineTo(.2,2.05);shell.lineTo(-l/2,1.35);}else{shell.quadraticCurveTo(1.65,1.2,1.1,1.22);shell.bezierCurveTo(.65,2.18,-.95,2.05,-1.4,1.4);shell.quadraticCurveTo(-2.1,1.25,-l/2,1.05);}shell.closePath();
    const body=new THREE.Mesh(new THREE.ExtrudeGeometry(shell,{depth:w,bevelEnabled:false,curveSegments:10}),material(color,.35));body.rotation.y=-Math.PI/2;body.position.x=w/2;body.castShadow=true;body.receiveShadow=true;group.add(body);
    for(const side of [-1,1]){
      const windowShape=new THREE.Shape();windowShape.moveTo(-1.32,1.32);windowShape.lineTo(.99,1.32);
      if(truck){windowShape.lineTo(.18,1.93);windowShape.lineTo(-1.32,1.48);}else{windowShape.quadraticCurveTo(.55,1.93,-.3,1.88);windowShape.quadraticCurveTo(-.98,1.88,-1.32,1.32);}windowShape.closePath();
      const glass=new THREE.Mesh(new THREE.ShapeGeometry(windowShape,10),new THREE.MeshStandardMaterial({color:'#263f49',roughness:.22,side:THREE.DoubleSide}));glass.rotation.y=-Math.PI/2;glass.position.x=side*(w/2+.01);group.add(glass);
      box(group,side*(w/2+.025),1.6,-.24,.025,.53,.075,'#263032');
      for(const z of [-.75,.5])box(group,side*(w/2+.025),1.17,z,.035,.04,.23,'#303a3e');
      box(group,side*(w/2+.12),1.36,.77,.23,.13,.27,color);
      box(group,side*(w/2+.025),.58,0,.055,.17,l*.72,'#263032');
      for(const z of [-l*.32,l*.31]){
        const axle=new THREE.Group();axle.position.set(side*w/2,.44,z);group.add(axle);wheels.push(axle);
        const tire=tube(axle,0,0,0,truck?.44:.39,.23,'#192025');tire.rotation.z=Math.PI/2;
        const hub=tube(axle,side*.13,0,0,truck?.32:.29,.025,truck?'#343e43':'#59646b');hub.rotation.z=Math.PI/2;
        for(let i=0;i<7;i++){const spoke=box(axle,side*.15,0,0,.025,.48,.035,'#a5afb2');spoke.rotation.x=i*Math.PI/7;}
      }
    }
    const windshield=box(group,0,truck?1.55:1.57,truck?1.18:.88,w-.2,.025,truck?1.22:.92,'#263f49');windshield.rotation.x=truck?.44:.64;
    if(truck){
      box(group,0,1.08,l/2+.025,w-.05,.065,.035,'#edffff');
      box(group,0,1.24,-l/2-.025,w-.08,.045,.035,'#f24643');
      box(group,0,1.36,-1.74,w-.2,.04,1.17,'#374348');
      for(let z=-2.25;z<-1.2;z+=.15)box(group,0,1.39,z,w-.25,.018,.025,'#606b6f');
    }else{
      box(group,0,1.94,-.24,1.4,.04,1.1,'#243943');
      for(const side of [-1,1]){box(group,side*.63,1.055,l/2+.03,.5,.075,.04,'#edffff');box(group,side*.65,1.13,-l/2-.03,.48,.09,.04,'#d63c42');}
    }
    box(group,0,.65,l/2+.03,w*.65,.15,.04,'#263032');
    sign(group,truck?'CYBERTRUCK':'MODEL Y',0,.7,-l/2-.06,.78,.16,'#182c28','#faf5e3',Math.PI);
    const driver=createPerson(driverShirt,true);driver.group.scale.setScalar(.7);driver.group.position.set(.35,.24,-.1);driver.group.visible=false;group.add(driver.group);
    return{group,wheels,driver:driver.group};
  }
  if (style === 'f1') {
    const red = '#d9272e', carbon = '#20292c', silver = '#d7dedb';
    group.userData.model = style;
    setVehicleFootprint(group,1.9,4.35);
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
    const driver = createPerson(driverShirt, true); driver.group.scale.setScalar(.5); driver.group.position.set(0, .35, -.5); driver.group.visible = false; group.add(driver.group);
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
    // Patrol car: an SUV shell in white, with the livery added below.
    police: { color: '#f3f5f6', roof: 2.02, cabin: 2.22, length: 3.65, width: 1.9 },
  };
  const { color, roof, cabin, length, width } = styles[style];
  setVehicleFootprint(group,width,length);
  const sport = style === 'sport' || style === 'ferrari' || style === 'lamborghini', van = style === 'vellfire';
  const bodyY = sport ? .65 : .8, belt = sport ? .88 : 1.09;
  group.userData.model = style;
  if (style === 'police') {
    // Dark side flashes, a light bar of two lamps, and POLIS across the doors.
    for (const side of [-1, 1]) box(group, side * (width / 2 + .01), .95, .1, .04, .42, length * .52, '#12305e');
    for (const [offset, colour] of [[-.34, '#2f6de0'], [.34, '#e2483c']] as [number, string][]) {
      const lamp = box(group, offset, cabin + .12, -.1, .58, .16, .34, colour);
      lamp.userData.sirenLight = true;
    }
    box(group, 0, cabin + .04, -.1, 1.34, .08, .38, '#243040');
  }
  const perodua=style==='myvi'||style==='axia';
  box(group, 0, bodyY, 0, width, sport ? .5 : .68, length, color);
  if(perodua){
    // Sloping A/C pillars and a shorter roof replace the generic rectangular cabin.
    const shape=new THREE.Shape();shape.moveTo(-cabin/2-.2,belt);shape.lineTo(cabin/2-.2,belt);shape.lineTo(cabin/2-.58,roof);shape.lineTo(-cabin/2+.02,roof);shape.closePath();
    const glass=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:width-.26,bevelEnabled:false}),carGlass);glass.rotation.y=-Math.PI/2;glass.position.x=(width-.26)/2;group.add(glass);
    box(group,0,roof,-.28,width-.26,.09,cabin-.6,color);
    for(const side of [-1,1]){
      const pillar=box(group,side*(width/2-.12),(belt+roof)/2,cabin/2-.39,.07,Math.hypot(roof-belt,.38),.08,color);pillar.rotation.x=-Math.atan2(.38,roof-belt);
      const rear=box(group,side*(width/2-.12),(belt+roof)/2,-cabin/2-.09,.13,Math.hypot(roof-belt,.22),.12,color);rear.rotation.x=Math.atan2(.22,roof-belt);
      box(group,side*(width/2+.018),.63,-.1,.045,.13,length*.65,color);
      // Door shut lines and the pronounced shoulder crease.
      for(const z of [-.15,.72])box(group,side*(width/2+.012),.85,z,.015,.4,.018,'#397069');
      box(group,side*(width/2+.017),1.04,0,.018,.025,length*.82,color);
    }
  }else{
    box(group, 0, (belt + roof) / 2, -.2, width - .22, roof - belt, cabin, carGlass);
    box(group, 0, roof, -.2, width - .14, .12, cabin, color);
  }
  // Windshield surround, door pillars, mirrors and handles.
  for (const side of [-1, 1]) {
    for (const z of perodua?[-.16]:[-.2 - cabin / 2, -.16, -.2 + cabin / 2]) box(group, side * (width / 2 - .08), (belt + roof) / 2, z, .075, roof - belt, .09, perodua?'#253535':color);
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
  if(perodua){
    const front=length/2+.12,rear=-length/2-.09;
    box(group,0,.76,front,width*.58,.28,.08,'#172d30');
    box(group,0,1.035,front,.65,.035,.05,'#d9dddd');
    const badge=ball(group,0,1.06,front+.045,.065,'#dce3df');badge.scale.set(1.3,.8,.3);
    for(const side of [-1,1]){
      // Myvi's vertical corner DRLs and Axia's horizontal accents distinguish the front ends.
      box(group,side*width*.39,.69,front,.19,.3,.055,'#203035');
      box(group,side*width*.39,.7,front+.035,style==='myvi'?.035:.15,style==='myvi'?.22:.035,.025,'#fff7d9');
      const lamp=box(group,side*width*.32,1.005,front,width*.26,.09,.045,'#edfaff');lamp.rotation.z=side*(style==='myvi'?-.09:-.2);
      box(group,side*width*.37,.94,rear,.2,style==='myvi'?.35:.2,.06,'#ca2635');
      box(group,side*width*.29,1.08,rear,width*.18,.06,.065,'#ef5250');
      box(group,side*width*.32,.52,rear,.17,.04,.03,'#be3039');
    }
    box(group,0,roof+.015,-cabin/2+.02,width-.17,.07,.3,color);
    box(group,0,roof-.06,-cabin/2-.14,.38,.035,.025,'#e8473d');
    box(group,.1,1.29,-cabin/2-.18,.42,.025,.03,'#233735');
    sign(group,style==='myvi'?'MYVI':'AXIA',width*.27,1.05,rear-.04,.27,.09,'#244039','#dfdfd3',Math.PI);
  }
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
  const driver = createPerson(driverShirt, true); driver.group.scale.setScalar(.7); driver.group.position.set(.35, .24, -.1); driver.group.visible = false; group.add(driver.group);
  return { group, wheels, driver: driver.group };
}

export interface TrafficCar { id:string; model:ReturnType<typeof createDriveableCar>; owner:string|null; npc:boolean; yaw:number; group: THREE.Group; x: number; z: number; speed: number; axis: 'x' | 'z'; direction: number }
export interface Pedestrian { person: Person; startX: number; startZ: number; phase: number; axis: 'x' | 'z'; range: number }
export interface World { chairs: { id: string; x: number; z: number; y?: number; yaw: number }[]; group: THREE.Group; solids: Solid[]; mapBuildings: { x: number; z: number; w: number; d: number; color: string }[]; traffic: TrafficCar[]; pedestrians: Pedestrian[]; klccLifts: KlccLift[]; mamakProcedural: THREE.Group; mamakStreetFallback: THREE.Group; shopFallbacks: Map<string, THREE.Group>; foliage:typeof foliageStatus; rembayung:RembayungSite; petronas:PetronasSite }

export function createWorshipLandmark(kind: 'mosque' | 'church' | 'hindu' | 'chinese', mosqueName = 'MASJID LEPAK') {
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
  } else if (kind === 'church') {
    const cream='#f1ead8', blue='#507c9a', glass='#87a7b4';
    box(g,0,6,0,15,12,15,cream);
    box(g,0,13,-1,6,14,7,cream);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(6,5,4),material(blue));roof.rotation.y=Math.PI/4;roof.position.set(0,22,-1);g.add(roof);
    box(g,0,16.8,7.62,.55,5,.18,'#d6ae52');box(g,0,18.4,7.64,3.2,.55,.18,'#d6ae52');
    for(const x of [-5,0,5]){const pane=ball(g,x,4.5,7.58,1.5,glass);pane.scale.set(1,1.8,.08);}
    sign(g,'GEREJA HARAPAN',0,9.3,7.72,12,.9,blue,'#ffffff');
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
  // The boxes above are the fallback until the Blender landmark (scripts/blender/build_worship.py)
  // arrives; the canvas name sign is the only child kept, so the wording stays the game's.
  g.traverse(o => { o.userData.keepUnbatched = true; });
  batchShopFallback(g);
  const asset = {mosque: 'Masjid', church: 'Church', hindu: 'HinduTemple', chinese: 'ChineseTemple'}[kind];
  void new GLTFLoader().loadAsync(`/assets/models/environment/LM_ENV_${asset}.glb?v=worship-v1`).then(gltf => {
    gltf.scene.traverse(o => { if (!(o instanceof THREE.Mesh)) return; o.castShadow = o.receiveShadow = true; const m = o.material as THREE.MeshStandardMaterial; if (m.transparent) { m.depthWrite = false; o.castShadow = false; } });
    for (const child of [...g.children]) if (!(child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial)) child.removeFromParent();
    g.add(gltf.scene);
  }).catch(error => console.warn(`[WORSHIP] keeping procedural ${kind}`, error));
  return {group: g, width, depth};
}

export function createWorld(scene: THREE.Scene): World {
  const chairs: World['chairs'] = chairLocations;
  const group = new THREE.Group(); const solids: Solid[] = []; const mapBuildings: World['mapBuildings'] = [];
  const mamakStreetFallback = new THREE.Group(); mamakStreetFallback.name = 'mamak-street-fallback'; group.add(mamakStreetFallback);
  const shopFallbacks = new Map<string, THREE.Group>();
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
  // Podiums, towers and skybridge share one group so the Blender set
  // (scripts/blender/build_klcc.py) can replace them atomically. Collision stays on the
  // podium footprints and the lifts stay procedural: their cabins move.
  const klcc = new THREE.Group(); klcc.name = 'klcc'; klcc.position.set(0, 0, -122); group.add(klcc);
  for (const x of [-22, 22]) {
    box(klcc, x, 1.5, 0, 21, 3, 24, '#c8cbb9'); solid(x, -122, 21, 24); mapBuildings.push({ x, z: -122, w: 21, d: 24, color: '#c8cbb9' });
    tower(klcc, x, 0);
  }
  const klccLifts = [
    createKlccLift(group, -22, -107.8, 'klcc-west-lift'),
    createKlccLift(group, 22, -107.8, 'klcc-east-lift'),
  ];
  box(klcc, 0, 39, 0, 31, 2.2, 3.4, '#aebfba');
  box(klcc, 0, 40.4, 0, 31, .35, 4, '#dce0cd');
  for (const side of [-1, 1]) {
    const brace = box(klcc, side * 12.5, 33.5, 0, .6, 13, .7, '#d0d9c8'); brace.rotation.z = side * -.48;
    for (let j = 0; j < 10; j++) box(klcc, side * (j * 1.4 + 1), 39, 1.8, .12, 2.6, .12, '#e0e2cf');
  }
  klcc.traverse(o => { o.userData.keepUnbatched = true; });
  batchShopFallback(klcc);
  void new GLTFLoader().loadAsync('/assets/models/environment/LM_ENV_KLCC.glb?v=klcc-v1').then(gltf => {
    gltf.scene.traverse(o => { if (!(o instanceof THREE.Mesh)) return; o.castShadow = o.receiveShadow = true; const m = o.material as THREE.MeshStandardMaterial; if (m.transparent) { m.depthWrite = false; o.castShadow = false; } });
    for (const child of [...klcc.children]) child.removeFromParent();
    klcc.add(gltf.scene);
  }).catch(error => console.warn('[KLCC] keeping procedural towers', error));
  sign(group, 'SELAMAT DATANG · KLCC', 0, 3.3, -97, 16, 2, '#376052');
  for (const x of [-6.9, 6.9]) tube(group, x, 1.55, -97, .1, 3.1, '#6a8073');
  for (const x of [-48, -37, 37, 48]) for (const z of [-88, -105, -137]) palm(group, x, z, .85);
  // Low fountain at the delivery plaza.
  tube(group, 19, .4, -87, 4, .6, '#b7baa6'); tube(group, 19, .74, -87, 3.6, .09, '#82b3ab');
  tube(group, 19, 1.15, -87, .55, 1, '#d5d4b9');
  for (const x of [-53, 53]) { box(group, x, .4, -113, 2, .8, 55, '#839468'); solid(x, -113, 2, 55); }

  // Mamak, open ground floor and striped canopy, facing the courtyard to the south.
  const mx = -29, mz = 34;
  const mamakProcedural = new THREE.Group(); mamakProcedural.name = 'mamak-procedural-fallback'; group.add(mamakProcedural);
  // Building, paving, furniture and props swap together after the complete Blender site
  // loads. Collision and authoritative chair records remain independent of the visuals.
  const mamakBox = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => box(mamakProcedural, x, y, z, w, h, d, color);
  mamakBox(mx, .08, 41, 37, .25, 30, '#d7c7a7');
    // The nine-seat table sits past the south edge of that slab, so the paving reaches out
    // to meet it rather than leaving it stranded on bare ground.
    mamakBox(-34, .08, 59, 15, .25, 13, '#d7c7a7');
  mamakBox(mx, 4.4, mz - 4, 30, 8.8, 9, '#e7c78c'); solid(mx, mz - 4, 30, 9); mapBuildings.push({ x: mx, z: mz - 4, w: 30, d: 9, color: '#e7c78c' });
  mamakBox(mx, 8.95, mz - 4, 31, .4, 10, '#ab8d66');
  for (const x of [-39, -29, -19]) {
    mamakBox(x, 6.65, 34.6, 3.2, 2.5, .16, '#446e65');
    mamakBox(x, 6.65, 34.72, .12, 2.5, .12, '#dfcea4');
    mamakBox(x, 6.65, 34.72, 3.2, .12, .12, '#dfcea4');
    mamakBox(x, 5.22, 34.9, 3.7, .16, .62, '#f5dbae');
  }
  for (const x of [-44, -14]) { mamakBox(x, 1.9, 40, .36, 3.8, .36, '#d7c4a0'); solid(x, 40, .36, .36); }
  for (let i = 0; i < 20; i++) {
    const awning = mamakBox(-43.5 + i * 1.53, 4.3, 38.3, 1.54, .17, 8, i % 2 ? '#eee2bd' : '#427863'); awning.rotation.x = .12;
    mamakBox(-43.5 + i * 1.53, 3.64, 42.2, 1.54, .53, .12, i % 2 ? '#eee2bd' : '#427863');
  }
  sign(mamakProcedural, 'MAMAK MAJU', mx, 4.96, 35, 20, 2.05, '#255846', '#f9e7b2');
  sign(mamakProcedural, 'RESTORAN • BUKA 24 JAM', mx, 8.03, 34.72, 18, .8, '#e7c78c', '#654c32');
  sign(mamakProcedural, 'ROTI CANAI   ·   TEH TARIK   ·   NASI KANDAR', mx, 3.36, 34.69, 25, .73, '#efdbad', '#3b6555');
  mamakBox(-39, 1.04, 37, 7, 1.8, 1.8, '#b3c3b6'); solid(-39, 37, 7, 1.8);
  mamakBox(-39, 2.02, 37, 7.3, .13, 2.1, '#e2ddc5');
  for (let i = 0; i < 5; i++) { tube(mamakProcedural, -41.3 + i * 1.14, 2.19, 37, .43, .23, '#899f99'); tube(mamakProcedural, -41.3 + i * 1.14, 2.34, 37, .1, .09, '#485f56'); }
  // The big table: nine seats, so a full Werewolf village can sit at one table instead of
  // scattering across the mamak. Its chairs are drawn from chairs.json, so the seat you
  // can see is the seat the server will sit you in.
  {
    const big = tableLocations.find(t => t.id === 'meja-9');
    if (big) {
      tube(mamakProcedural, big.x, 1.06, big.z, 1.95, .16, '#e9dfc0');
      tube(mamakProcedural, big.x, .53, big.z, .18, 1.02, '#727e6b');
      tube(mamakProcedural, big.x, .06, big.z, .9, .12, '#6b7663');
      solid(big.x, big.z, 2.4, 2.4);
      for (const seat of chairLocations.filter(c => c.tableId === 'meja-9')) {
        const chair = new THREE.Group();
        chair.position.set(seat.x, 0, seat.z); chair.rotation.y = seat.yaw; mamakProcedural.add(chair);
        // The chair yaw is the direction the seated player faces. Keep the backrest
        // behind that direction so the mesh and seated avatar both face the tabletop.
        box(chair, 0, .6, 0, .73, .1, .73, '#be5142'); box(chair, 0, 1.04, -.33, .73, .8, .1, '#be5142');
        for (const dx of [-.28, .28]) for (const dz of [-.28, .28]) box(chair, dx, .3, dz, .06, .6, .06, '#923e35');
      }
    }
  }
  const drawSmallTable=(x:number,z:number,angles:number[])=>{
    const furniture = x >= -39 && x <= -29 && z >= 45 && z <= 52 ? mamakProcedural : group;
    tube(furniture, x, 1.06, z, 1.14, .14, '#e9dfc0'); tube(furniture, x, .53, z, .11, 1.02, '#727e6b'); solid(x, z, 1.8, 1.8);
    for (const a of angles) {
      const chair = new THREE.Group(); chair.position.set(x + Math.sin(a) * 1.65, 0, z + Math.cos(a) * 1.65); chair.rotation.y = a + Math.PI; furniture.add(chair);
      box(chair, 0, .6, 0, .73, .1, .73, '#be5142'); box(chair, 0, 1.04, .33, .73, .8, .1, '#be5142');
      for (const dx of [-.28, .28]) for (const dz of [-.28, .28]) box(chair, dx, .3, dz, .06, .6, .06, '#923e35');
    }
    tube(furniture, x + .35, 1.23, z, .1, .26, '#c28246');
    tube(furniture, x - .35, 1.16, z + .12, .27, .04, '#f5efd4');
  };
  const fourSeatAngles=[0,Math.PI/2,Math.PI,Math.PI*1.5];
  for (const [x, z] of [[-38, 45], [-29, 45], [-39, 51], [-29, 52], [112,-14], [-110,60]]) drawSmallTable(x,z,fourSeatAngles);
  for (const table of quietTables) drawSmallTable(table.x,table.z,[0,2.1,4.2]);
  sign(mamakProcedural, 'LEPAK HERE', -18.5, 1.4, 43.3, 3.4, 1.5, '#edb64f', '#344a36');
  for (const x of [-20, -17]) box(mamakProcedural, x, .65, 43.3, .09, 1.3, .1, '#8f7955');
  // Complete v5 fallback: slim perimeter poles and overhead festoons. Collision
  // footprints match only the poles; cables and bulbs retain generous headroom.
  for (const point of mamakStreetLayout.festoonPoles) {
    tube(mamakProcedural, point.x, 2.625, point.z, .055, 5.25, '#36413d');
    solid(point.x, point.z, .18, .18);
  }
  const festoonHeight=(u:number)=>5.25-.55*(4*u*(1-u));
  for (const point of mamakStreetLayout.serviceProps) {
    solids.push({x:point.x,z:point.z,hx:point.hx,hz:point.hz});
    mamakBox(point.x,.75,point.z,point.hx*2,1.05,point.hz*2,'#427863');
  }
  for (const z of [44,49,54]) {
    const left=-46.25,right=-11.75,steps=7,span=right-left;
    for(let index=0;index<steps;index++){
      const u0=index/steps,u1=(index+1)/steps,x0=left+span*u0,x1=left+span*u1;
      const dy=festoonHeight(u1)-festoonHeight(u0);
      const cable=mamakBox((x0+x1)/2,(festoonHeight(u0)+festoonHeight(u1))/2,z,Math.hypot(x1-x0,dy),.026,.026,'#36413d');
      cable.rotation.z=Math.atan2(dy,x1-x0);
    }
    for(let index=0;index<6;index++){
      const u=(index+1)/7;
      ball(mamakProcedural,left+span*u,festoonHeight(u)-.115,z,.115,'#f6dfa9');
    }
  }
  const chef = createPerson('#efe7cd'); chef.group.position.set(-35.5, .12, 38); group.add(chef.group);
  const customer = createPerson('#829fac', true); customer.group.position.set(-29, .05, 46.7); customer.group.rotation.y = Math.PI; group.add(customer.group);
  // Batch the complete fallback too, so a slow/failed asset download stays inexpensive.
  mamakProcedural.updateMatrixWorld(true);
  const mamakBatches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const mamakSources: THREE.Mesh[] = [];
  mamakProcedural.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geometry !== nonIndexed) geometry.dispose();
    if (!mamakBatches.has(object.material)) mamakBatches.set(object.material, []);
    mamakBatches.get(object.material)!.push(nonIndexed); mamakSources.push(object);
  });
  for (const object of mamakSources) object.removeFromParent();
  for (const [material, geometries] of mamakBatches) {
    const geometry = mergeGeometries(geometries);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = !(material instanceof THREE.MeshBasicMaterial); mesh.receiveShadow = true;
      mesh.userData.keepUnbatched = true; mamakProcedural.add(mesh);
    }
    for (const geometry of geometries) geometry.dispose();
  }

  const shopColors = ['#d8ac89', '#c0c9a4', '#c6aba0', '#edcf93', '#a4baba', '#d7b9a0'];
  function shop(x: number, z: number, width: number, color: string, label: string, facing = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = facing; group.add(g);
    const replacement = mamakShops.find(shop => shop.x === x && shop.z === z);
    if (replacement) { g.name = `${replacement.asset}_Fallback`; shopFallbacks.set(replacement.asset, g); }
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
  // Masjid Kampung Maju now sits in the former sports area, away from Pantai Senja.
  // Rotate its entrance toward the promenade while keeping the courtyard clear.
  {
    const mosque = createWorshipLandmark('mosque', 'MASJID KAMPUNG MAJU');
    const spot = masjidSpots[0];
    mosque.group.position.set(spot.x, 0, spot.z); mosque.group.rotation.y = Math.PI; group.add(mosque.group);
    // The 36 × 28 landmark bounds include the open courtyard and the air between both
    // minarets. Treating that whole rectangle as a wall stopped players several metres
    // before anything visible. Only the prayer hall and the two minaret bases are solid.
    solids.push(
      {x: spot.x, z: spot.z, hx: 12.5, hz: 7.5, id: 'masjid-prayer-hall'},
      {x: spot.x - 15, z: spot.z, hx: 1.25, hz: 1.25, id: 'masjid-minaret-west'},
      {x: spot.x + 15, z: spot.z, hx: 1.25, hz: 1.25, id: 'masjid-minaret-east'},
    );
    mapBuildings.push({ x: spot.x, z: spot.z, w: mosque.width, d: 28, color: '#438d7b' });
  }
  // Neighbourhood retail fronts, with displays visible from the pavement.
  // ZUS Coffee, in place of the 99 Speedmart that stood here. Cobalt frontage, white
  // lettering and a glazed shopfront, with pavement seating in the same two colours so the
  // tables read as the shop's rather than the mamak's.
  const ZUS_BLUE = '#1b31a0', ZUS_DEEP = '#101d63', ZUS_WHITE = '#f2f5ff';
  function zusCoffee(x: number, z: number) {
    const g = shop(x, z, 19, '#dfe3f2', 'ZUS COFFEE');
    // A deep blue fascia carrying the name, over a paler blue awning. The shell's cream
    // trim is covered rather than removed, so every other shop keeps it.
    box(g, 0, 4.75, 6.17, 19.24, .3, .62, ZUS_DEEP);
    box(g, 0, 4.02, 6.28, 19, 1.6, .22, ZUS_BLUE);
    sign(g, 'ZUS COFFEE', 0, 4.05, 6.42, 15.4, 1.2, ZUS_BLUE, ZUS_WHITE);
    box(g, 0, 3.18, 7.12, 19, .15, 2.35, ZUS_BLUE);
    for (const side of [-1, 1]) box(g, side * 9.1, 1.6, 7.05, .5, 3.2, .5, ZUS_BLUE);
    // Glazing: two tall panes either side of the door, framed in white.
    for (const side of [-1, 1]) {
      box(g, side * 4.6, 1.7, 6.3, 7.4, 3.4, .1, '#8fa6d8');
      box(g, side * 4.6, 1.7, 6.36, 7.4, .1, .08, ZUS_WHITE);
      box(g, side * .95, 1.7, 6.36, .12, 3.4, .08, ZUS_WHITE);
    }
    box(g, 0, 1.5, 6.18, 1.9, 3, .12, '#a9bce6');
    for (const side of [-1, 1]) box(g, side * .95, 1.5, 6.3, .1, 3, .12, ZUS_WHITE);
    sign(g, 'KOPI  ·  LATTE  ·  PASTRI', 0, .38, 6.34, 17.8, .42, ZUS_DEEP, ZUS_WHITE);
    // Counter and cups behind the glass, so the inside is not an empty box.
    box(g, 0, .95, 3.4, 11, 1.9, 1.1, ZUS_DEEP);
    box(g, 0, 1.95, 3.4, 11.3, .12, 1.4, ZUS_WHITE);
    for (let i = 0; i < 7; i++) tube(g, -4.2 + i * 1.4, 2.16, 3.35, .17, .42, i % 2 ? ZUS_WHITE : '#cfd8f4');
    return g;
  }

  // A pavement table in the shop's own colours: white top, cobalt frame, four stools.
  function zusTable(tx: number, tz: number) {
    tube(group, tx, 1.02, tz, 1.02, .12, ZUS_WHITE);
    tube(group, tx, .5, tz, .1, .98, ZUS_BLUE);
    tube(group, tx, .05, tz, .62, .1, ZUS_DEEP);
    solid(tx, tz, 1.7, 1.7);
    for (const seat of chairLocations.filter(c => c.tableId === '' && Math.hypot(c.x - tx, c.z - tz) < 2.1)) {
      const stool = new THREE.Group();
      stool.position.set(seat.x, 0, seat.z); stool.rotation.y = seat.yaw; group.add(stool);
      tube(stool, 0, .56, 0, .32, .1, ZUS_WHITE);
      tube(stool, 0, .28, 0, .07, .56, ZUS_BLUE);
      tube(stool, 0, .04, 0, .26, .08, ZUS_DEEP);
      box(stool, 0, .92, .3, .62, .62, .08, ZUS_BLUE);
    }
  }

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
  function driveThrough(x:number,z:number,label:string,brand:string,accent:string,ink:string,laneSide:-1|1,asset:'kfc'|'mcd'){
    const g=new THREE.Group();g.name=`drive-through-${label.toLowerCase().replace(/[^a-z]+/g,'-')}`;g.position.set(x,0,z);group.add(g);
    const buildingX=-laneSide*2.5,laneX=laneSide*8;
    box(g,buildingX,4.2,0,14,8.4,12,'#eee7d8');
    box(g,buildingX,8.55,0,14.5,.3,12.5,brand);
    box(g,buildingX,5.65,6.05,14.2,1.35,.2,brand);
    sign(g,label,buildingX,5.68,6.18,12.5,1,brand,ink);
    for(const wx of [-4,0,4])box(g,buildingX+wx,2.4,6.08,3.5,3.6,.12,'#7ea4a5');
    box(g,buildingX+laneSide*5.4,2.25,6.1,2.2,2.2,.18,accent);
    sign(g,'DRIVE THRU',laneX,3.25,-4.5,4.5,.7,brand,ink);
    box(g,laneX,1.45,-4.5,.22,2.9,.22,brand);
    box(g,laneX,.035,0,5.5,.07,23,'#4d514f');
    for(let dz=-9;dz<=9;dz+=4)box(g,laneX,.08,dz,.16,.03,1.8,'#f5d75b');
    box(g,laneX-laneSide*2.5,1.25,1.3,1.5,2.5,.8,brand);
    sign(g,'ORDER',laneX-laneSide*2.5,2.15,.86,1.25,.42,accent,ink);
    solid(x+buildingX,z,14,12);mapBuildings.push({x:x+buildingX,z,w:14,d:12,color:brand});
    // The boxes above stay out of the world batch so the Blender outlet
    // (scripts/blender/build_fastfood.py) can replace them wholesale. Its lettering is
    // baked geometry, so the canvas nameplate and lane signs go with the boxes.
    g.traverse(object=>{object.userData.keepUnbatched=true;});
    void driveThroughAsset().then(scene=>{
      const outlet=scene?.getObjectByName(asset);if(!outlet)return;
      g.clear();g.add(outlet.clone());
    });
  }
  function shellStation(x:number,z:number){
    const g=new THREE.Group();g.name='shell-station';g.position.set(x,0,z);group.add(g);
    const yellow='#f8c900',red='#d9272e',white='#fff8e8';
    box(g,0,.04,0,25,.08,25,'#7d817d');
    box(g,0,3.1,7,20,6.2,8,white);box(g,0,6.35,7,20.5,.3,8.5,yellow);
    sign(g,'SHELL SELECT',0,5.2,2.92,12,.8,red,white);
    box(g,0,5,-4,18,.5,10,white);box(g,0,4.7,-8.9,18,.45,.25,yellow);box(g,0,4.7,.9,18,.45,.25,red);
    for(const x of [-7,7]){box(g,x,2.5,-4,.4,5,.4,white);box(g,x,1.3,-4,2,2.6,.8,yellow);box(g,x,1.7,-4,1.2,.55,.84,red);}
    box(g,11,5,-9,2.5,10,1,white);sign(g,'SHELL',11,7,-9.54,2.1,.65,red,yellow);sign(g,'95 · 97',11,4.8,-9.55,2,.8,white,red);
    sign(g,'deli2go',-6.5,4.4,2.92,3,.5,red,white);
    solid(x,z+7,20,8);solid(x-7,z-4,2,2.6);solid(x+7,z-4,2,2.6);solid(x+11,z-9,2.5,1);
    mapBuildings.push({x,z:z+7,w:20,d:8,color:yellow});
    // The boxes above stay out of the world batch so the Blender forecourt
    // (scripts/blender/build_shell.py) can replace them; the text signs stay on top.
    g.traverse(o=>{o.userData.keepUnbatched=true;});
    void new GLTFLoader().loadAsync('/assets/models/environment/LM_ENV_Shell.glb?v=shell-v1').then(gltf=>{
      gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;o.castShadow=false;}});
      for(const child of [...g.children])if(!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial))child.removeFromParent();
      g.add(gltf.scene);
    }).catch(error=>console.warn('[SHELL] keeping procedural station',error));
  }
  zusCoffee(27, 58);
  // Tucked against the shopfront: the teleport arrival for ZUS lands at (27, 68) and the
  // middle table used to stand on it, so arriving put you on the table.
  for (const [tx, tz] of [[21.5, 65.4], [27, 65.8], [32.5, 65.4]] as const) zusTable(tx, tz);
  retail(49, 58, 'KK SUPER MART', '#c92536', '#ffffff', 'market');
  retail(-35, -90, 'KEDAI DOBI · 24 JAM', '#348cb1', '#ffffff', 'laundry');
  retail(-56, -90, 'MR.DIY', '#f1c62b', '#253d35', 'diy');
  retail(27,-40,'KEDAI ACEH · SERBANEKA','#317e62','#fff0ce','market');
  retail(49,-40,'MR.DIY','#f1c62b','#253d35','diy');
  driveThrough(105,60,'KFC','#b81924','#8d111a','#ffffff',1,'kfc');
  driveThrough(129,60,"McDONALD'S",'#d71920','#ffc72c','#ffffff',-1,'mcd');
  shellStation(33,103);

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
  let petronas:PetronasSite;
  {
    const px = -31, pz = 112;
    const station = new THREE.Group(); station.position.set(px, 0, pz); scene.add(station);
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
    petronas=loadPetronas(scene,station);
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
  // Contemporary KL skyline landmarks: faceted TRX and the tapering Merdeka 118.
  {
    const x=105,z=-95,trx=new THREE.Group();trx.position.set(x,0,z);group.add(trx);
    box(trx,0,3,0,18,6,18,'#d8d1bc');
    for(const [y,w,d,color] of [[13,15,14,'#5e7e80'],[30,12.8,12,'#688c8e'],[47,10.5,10,'#78999a'],[59,8,8,'#89a9a7']] as const)box(trx,0,y,0,w,y===13?20:17,d,color);
    for(let y=8;y<67;y+=4)for(const side of [-1,1]){box(trx,side*(7.6-y*.045),y,7.08-y*.043,.08,2.1,1.6,'#b8d3cc');box(trx,side*(7.6-y*.045),y,-7.08+y*.043,.08,2.1,1.6,'#b8d3cc');}
    const crown=box(trx,0,69,0,8,5,8,'#b7c9b8');crown.rotation.y=Math.PI/4;tube(trx,0,77,0,.22,13,'#d7d8c9');
    sign(trx,'TRX',-9.08,4.2,0,7,1.8,'#314f50','#ffffff',-Math.PI/2);
    solid(x,z,18,18);mapBuildings.push({x,z,w:18,d:18,color:'#688c8e'});
  }
  {
    const x=129,z=-95,tower118=new THREE.Group();tower118.position.set(x,0,z);group.add(tower118);
    box(tower118,0,3,0,17,6,17,'#d5cfbd');
    for(const [y,w,d,color] of [[14,14,13,'#708486'],[34,11.5,10.5,'#7f9697'],[52,8.5,8,'#90a8a7'],[66,5.5,5.2,'#a7bab5']] as const)box(tower118,0,y,0,w,y===14?22:18,d,color);
    for(let y=8;y<75;y+=4.2)for(const side of [-1,1])box(tower118,side*Math.max(2.2,7.3-y*.071),y,Math.max(2.1,6.8-y*.065),.08,2.2,1.2,'#c5d4cc');
    const needle=tube(tower118,0,86,0,.18,29,'#d9d8c9');needle.rotation.z=-.055;ball(tower118,-.8,100.4,0,.32,'#d9d8c9');
    sign(tower118,'MERDEKA 118',-8.58,4.3,0,11,1.45,'#394f50','#f2df9c',-Math.PI/2);
    solid(x,z,17,17);mapBuildings.push({x,z,w:17,d:17,color:'#7f9697'});
  }
  // Saloma Link: raised pedestrian deck with its distinctive illuminated faceted canopy.
  {
    const x=55,z=-125,bridge=new THREE.Group();bridge.position.set(x,0,z);group.add(bridge);
    box(bridge,0,4,0,48,.65,5.2,'#d9d5c4');
    box(bridge,0,4.38,0,46,.12,4.45,'#466d68');
    for(const side of [-1,1])box(bridge,0,5.05,side*2.3,48,1.45,.18,'#728b84');
    for(const bx of [-22,-11,0,11,22]){
      for(const side of [-1,1])tube(bridge,bx,2,side*2.15,.2,4,'#52665f');
      const rib=new THREE.Group();rib.position.x=bx;bridge.add(rib);
      for(const side of [-1,1]){
        const slope=box(rib,0,7.05,side*1.35,.16,4.7,.16,'#8ce2d0');slope.rotation.x=side*.62;
        box(rib,0,9.02,0,.18,1.15,.18,'#b4f2de');
      }
    }
    // A crystalline roof made from alternating facets gives the bridge its night-time silhouette.
    for(let bx=-20;bx<=20;bx+=4){
      const high=(Math.floor((bx+20)/4)%2===0);
      for(const side of [-1,1]){
        const facet=box(bridge,bx,high?8.05:7.55,side*1.25,4.25,.11,3.1,high?'#4fd3c2':'#7ee7d0');
        facet.rotation.x=side*(high?.4:.28);facet.rotation.z=high?.08:-.08;
      }
    }
    // Short approaches keep the deck readable as a pedestrian bridge from ground level.
    for(const side of [-1,1])for(let step=0;step<6;step++)box(bridge,side*(24.8+step*1.15),3.65-step*.58,0,2.4,.45,5.2,'#d9d5c4');
    sign(bridge,'SALOMA LINK',0,6.05,-2.72,10,1.15,'#1b5b55','#d9fff4',Math.PI);
    // The deck is walkable and the road runs underneath it, so the span itself is not a
    // wall. Only the support columns are physical, and a column standing in a traffic lane
    // would be worse than one you can walk through, so those are left out.
    for(const bx of [-22,-11,0,11,22]){
      const columnX=x+bx;
      if([0,76,-82].some(road=>Math.abs(columnX-road)<9)) continue;
      for(const side of [-1,1]) solid(columnX,z+side*2.15,.28,.28);
    }
    mapBuildings.push({x,z,w:48,d:5.2,color:'#55cdbd'});
    // The Blender bridge (scripts/blender/build_saloma.py) replaces the boxes above; its deck
    // top, step rise and ramp start are read from the same SALOMA constants that decide where
    // a player actually walks, so the swap cannot move the walkable surface. The canvas
    // SALOMA LINK sign is the one child kept, so the wording stays the game's.
    bridge.name='saloma';
    bridge.traverse(o=>{o.userData.keepUnbatched=true;});
    batchShopFallback(bridge);
    void new GLTFLoader().loadAsync('/assets/models/environment/LM_ENV_Saloma.glb?v=saloma-v1').then(gltf=>{
      gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;o.castShadow=false;}});
      for(const child of [...bridge.children])if(!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial))child.removeFromParent();
      bridge.add(gltf.scene);
    }).catch(error=>console.warn('[SALOMA] keeping procedural bridge',error));
  }
  // Zoo Negara Mini Lepak: a walkable park with distinct habitats and a landmark entrance.
  {
    const zx=-123,zz=-112,zoo=new THREE.Group();zoo.position.set(zx,0,zz);group.add(zoo);
    box(zoo,0,.06,0,56,.12,62,'#91a66d');
    // Visitor paths form a loop around the habitats.
    box(zoo,0,.14,0,5,.1,57,'#d9cba8');box(zoo,0,.15,-25,47,.1,4.5,'#d9cba8');box(zoo,0,.15,25,47,.1,4.5,'#d9cba8');
    box(zoo,-21,.15,0,4.5,.1,54,'#d9cba8');box(zoo,21,.15,0,4.5,.1,54,'#d9cba8');
    // Perimeter and habitat rails; the east entrance remains open.
    const rail=(x:number,z:number,w:number,d:number)=>{box(zoo,x,.55,z,w,.12,d,'#536b55');box(zoo,x,1.55,z,w,.12,d,'#536b55');};
    rail(0,-30.5,56,.15);rail(0,30.5,56,.15);rail(-27.5,0,.15,61);rail(27.5,-18,.15,25);rail(27.5,18,.15,25);
    for(const x of [-24,-16,-8,0,8,16,24]){tube(zoo,x,1,-30.5,.09,2,'#536b55');tube(zoo,x,1,30.5,.09,2,'#536b55');}
    for(const z of [-27,-18,-9,0,9,18,27])tube(zoo,-27.5,1,z,.09,2,'#536b55');
    // Grand eastern gateway with twin leaf towers and a large readable sign.
    for(const z of [-8,8]){
      box(zoo,27.5,3.3,z,3.2,6.6,3.2,'#315f48');
      for(let i=0;i<5;i++){const leaf=box(zoo,27.2+i*.28,7+i*.35,z,4.4-i*.35,.18,1.25,'#75a44e');leaf.rotation.z=-.38+i*.17;}
    }
    box(zoo,27.5,7.4,0,3,2.2,15,'#315f48');sign(zoo,'ZOO NEGARA MINI LEPAK',29.05,7.45,0,14,1.7,'#204d3b','#f7d879',Math.PI/2);
    solid(zx+27.5,zz-8,3.2,3.2);solid(zx+27.5,zz+8,3.2,3.2);

    // Elephant family habitat.
    const elephant=(x:number,z:number,s=1)=>{
      const e=new THREE.Group();e.position.set(x,0,z);e.scale.setScalar(s);zoo.add(e);
      const body=ball(e,0,1.45,0,1.2,'#87928d');body.scale.set(1.35,.82,.86);
      const head=ball(e,0,1.42,1.08,.78,'#929d98');head.scale.y=.9;
      for(const side of [-1,1]){const ear=ball(e,side*.58,1.55,1.02,.55,'#7d8985');ear.scale.set(.25,1,.8);for(const dz of [-.62,.58])tube(e,side*.62,.62,dz,.25,1.24,'#7e8b86');}
      const trunk=tube(e,0,.92,1.72,.16,1.35,'#929d98');trunk.rotation.x=.2;
      for(const side of [-1,1])box(e,side*.24,1.24,1.75,.08,.08,.32,'#eee4cb');
    };
    elephant(-12,-14,1.1);elephant(-8,-9,.72);

    // Tall giraffes make the savanna visible from across the city.
    const giraffe=(x:number,z:number,yaw=0)=>{
      const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=yaw;zoo.add(g);
      const yellow='#d5a54f',spot='#76533b';const body=ball(g,0,1.7,0,.9,yellow);body.scale.set(1.1,.62,.62);
      for(const side of [-1,1])for(const dz of [-.5,.5])tube(g,side*.5,.85,dz,.13,1.7,yellow);
      tube(g,0,3.25,.65,.24,3.4,yellow);const head=ball(g,0,5,.88,.42,yellow);head.scale.set(.7,.65,1);
      for(const side of [-1,1]){tube(g,side*.18,5.48,.82,.055,.48,spot);ball(g,side*.18,5.75,.82,.09,spot);}
      for(const [sx,sy,sz] of [[-.55,1.75,0],[.32,1.5,.38],[0,2.6,.69],[-.14,3.5,.72],[.13,4.25,.8]] as const)ball(g,sx,sy,sz,.14,spot);
    };
    giraffe(11,-15,-.4);giraffe(16,-10,.35);

    // Zebra herd in the central savanna.
    const zebra=(x:number,z:number,yaw=0)=>{
      const a=new THREE.Group();a.position.set(x,0,z);a.rotation.y=yaw;zoo.add(a);
      const body=ball(a,0,.85,0,.65,'#eee9d9');body.scale.set(1.25,.65,.58);tube(a,0,1.22,.7,.18,.85,'#eee9d9');ball(a,0,1.66,.85,.3,'#eee9d9');
      for(const side of [-1,1])for(const dz of [-.38,.38])tube(a,side*.42,.4,dz,.1,.8,'#313937');
      for(let i=-3;i<=3;i++){const stripe=box(a,i*.2,.9,.58,.08,.72,.05,'#313937');stripe.rotation.z=i*.14;}
    };
    zebra(9,3,.4);zebra(15,6,-.55);zebra(11,10,.1);

    // Flamingo pond and a shaded lion habitat complete the main loop.
    const pond=tube(zoo,-12,.12,14,6,.16,'#70aaa5');pond.scale.z=.7;
    for(const [x,z] of [[-15,13],[-11,15],[-8,12]] as const){tube(zoo,x,.85,z,.055,1.35,'#e48b93');const neck=tube(zoo,x,1.55,z,.1,.8,'#ef9ba2');neck.rotation.z=.22;const bird=ball(zoo,x+.12,1.95,z,.23,'#ef9ba2');bird.scale.set(.7,.8,1);}
    const lion=(x:number,z:number)=>{const l=new THREE.Group();l.position.set(x,0,z);zoo.add(l);const body=ball(l,0,.65,0,.62,'#c99143');body.scale.set(1.2,.65,.62);for(const side of [-1,1])for(const dz of [-.35,.35])tube(l,side*.4,.32,dz,.1,.64,'#b87c37');ball(l,0,.92,.68,.46,'#704a2e');ball(l,0,.94,.75,.3,'#d09b54');};
    lion(12,20);box(zoo,16,1.3,21,8,2.6,3,'#907553');box(zoo,14,1.15,19.2,5,.35,3.5,'#81704f');
    for(const [x,z] of [[-23,-24],[-5,-24],[21,-24],[-23,24],[5,24],[23,22]] as const)palm(zoo,x,z,.6);
    sign(zoo,'GAJAH',-15,2.4,-2,5,.8,'#315f48','#fff0b9');sign(zoo,'SAVANA',13,2.4,-1,5,.8,'#315f48','#fff0b9');sign(zoo,'KOLAM FLAMINGO',-12,2.4,23,8,.8,'#315f48','#fff0b9');
    mapBuildings.push({x:zx,z:zz,w:56,d:62,color:'#759858'});
  }
  // Mid-rise skyline, deterministically placed away from the road grid.
  createDurianVillage({group,solids,mapBuildings});
  // The Blender restaurant loads outside the static city batch so its fallback can swap atomically.
  const rembayung=createRembayung(scene,solids);
  {
    const r=new THREE.Group();r.position.set(-121,0,101);group.add(r);
    box(r,0,.035,20,56,.1,62,'#b7aa91');
    mapBuildings.push({x:-136,z:108,w:18,d:34,color:'#be8c45'});
    // Parked Malaysian cars and premium MPVs leave the central approach open.
    for(let i=0;i<10;i++){const x=-146+(i%5)*4.8,z=134+Math.floor(i/5)*8;box(group,x,.04,z,3.8,.03,6.4,'#d6cbb1');}
    box(group,-122,.04,134,3.8,.03,6.4,'#d6cbb1');
    box(group,-122,.04,142,3.8,.03,6.4,'#d6cbb1');
    // Keep the western palm's fronds outside the taller, deeper restaurant shell.
    for(const x of [-147,-94])palm(group,x,x===-147?128:119,.8);
  }
  let seed = 37; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const x of [-127, -106, 105, 129]) for (const z of [-128, -95, -37, 37, 113]) {
    if(x>0&&z===-128)continue;
    if(x<0&&z===113)continue;
    if(x<0&&(z===-128||z===-95))continue;
    if(x<0&&(z===-37||z===37))continue;
    if(x>0&&z===-95)continue;
    if (x > 0 && (z === -37 || z === 37 || z === 113)) continue;
    const height = 14 + rand() * 29, w = 13 + rand() * 5, d = 17;
    block(x, z, w, height, d, ['#aab7ad', '#c9bfa5', '#b4bdb6', '#d6c6aa'][Math.floor(rand() * 4)]);
    box(group, x, height + .25, z, w + .5, .5, d + .5, '#cbd0b7');
    for (let y = 3; y < height - 1; y += 3.4) {
      for (let wx = -w / 2 + 2; wx < w / 2 - 1; wx += 3.3) box(group, x + wx, y, z + d / 2 + .015, 1.8, 1.7, .04, '#728e88');
    }
  }
  // Dedicated worship sites replace skyline lots, clear of the roads.
  for (const [kind, x, z] of [['church', 117, -37], ['hindu', 105, 37], ['chinese', 129, 37]] as const) {
    const landmark = createWorshipLandmark(kind); landmark.group.position.set(x, 0, z); group.add(landmark.group);
    solid(x, z, landmark.width, 16);
    mapBuildings.push({x, z, w: landmark.width, d: landmark.depth, color: kind === 'church' ? '#507c9a' : kind === 'hindu' ? '#bd6776' : '#ae4939'});
  }
  // A distant communications tower complements the twin towers.
  tube(group, -104, 42, -145, 1.3, 84, '#c5c6ae');
  tube(group, -104, 70, -145, 6.2, 4, '#aaa991'); tube(group, -104, 73, -145, 4.9, 2, '#637f79');
  tube(group, -104, 89, -145, .3, 21, '#d8d2b6');
  for (const x of [-11.5, 11.5]) for (const z of [-47, -21, 29, 65, 99, 132]) {
    const parent = mamakStreetLayout.lamps.some(p => p.x === x && p.z === z) ? mamakStreetFallback : group;
    streetLamp(parent, x, z, x > 0 ? -1 : 1);
  }
  for (const [x, z, s] of [[-48, 54, 1], [-11, 19, 1], [12, 47, 1.05], [13, -32, .9], [-13, -78, 1], [58, 61, 1], [54, -45, .85], [-61, 91, 1]]) {
    const parent = mamakStreetLayout.palms.some(p => p.x === x && p.z === z) ? mamakStreetFallback : group;
    palm(parent, x, z, s);
  }
  // Keep the basketball sideline clear of the southern tree canopy.
  for (const x of [-67, 64, 93, -95]) for (const z of [-79, -23, 22, 92, 135]) tree(group, x, x===64&&z===135?149:z, .8 + rand() * .45);
  for (const [x, z] of [[12, 58], [-12, -35], [59, 48], [-49, 46]]) {
    const parent = mamakStreetLayout.planters.some(p => p.x === x && p.z === z) ? mamakStreetFallback : group;
    box(parent, x, .45, z, 2, .9, 2, '#bfa687'); ball(parent, x, 1.25, z, 1.05, '#688750'); solid(x, z, 2, 2);
  }
  for (const point of mamakStreetLayout.benches) {
    const bench = new THREE.Group(); bench.position.set(point.x, point.y, point.z); bench.rotation.y = point.yaw; mamakStreetFallback.add(bench);
    box(bench, 0, .55, 0, 2.4, .10, .68, '#9f7049');
    box(bench, 0, 1.04, -.3, 2.4, .6, .09, '#9f7049');
    for (const x of [-.88, .88]) for (const z of [-.23, .23]) box(bench, x, .25, z, .09, .5, .1, '#343f42');
    const c = Math.abs(Math.cos(point.yaw)), s = Math.abs(Math.sin(point.yaw));
    solid(point.x, point.z, 2.4 * c + .72 * s, 2.4 * s + .72 * c);
  }
  mamakStreetFallback.traverse(object => { object.userData.keepUnbatched = true; });
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
  box(group,0,1.1,-156,315,2.2,3,'#718361');
  box(group,-31.5,1.1,156,252,2.2,3,'#718361');

  // Batch the static city by material to avoid thousands of draw calls.
  for (const fallback of shopFallbacks.values()) batchShopFallback(fallback);
  group.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const sources: THREE.Mesh[] = [];
  group.traverse(obj => {
    if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material) || obj.userData.keepUnbatched) return;
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
  for (const seed of fleetSeeds) {
    const model = createDriveableCar(seed.style as CarStyle);
    const car = model.group; car.userData.wheels = model.wheels;
    const {direction,x,z}=seed; const axis=seed.axis as 'x'|'z';
    car.position.set(x, 0, z); car.rotation.y = axis === 'z' ? direction < 0 ? Math.PI : 0 : direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    model.driver.visible=seed.npc;
    scene.add(car); traffic.push({ id:seed.id,model,owner:null,npc:seed.npc,yaw:car.rotation.y,group: car, x, z, speed:seed.speed, axis, direction });
  }
  const pedestrians: Pedestrian[] = [];
  // Keep the restaurant crowd outside the static batches so their limbs can animate.
  for(let i=0;i<12;i++){
    const person=createPerson(['#bb735c','#6d9494','#d1b563','#a68ab0'][i%4]);
    const startX=-105+(i%3)*3,startZ=116+Math.floor(i/3)*3;
    person.group.position.set(startX,.1,startZ);scene.add(person.group);
    pedestrians.push({person,startX,startZ,phase:i*1.7,axis:'z',range:1.1});
  }
  for (let i = 0; i < 10; i++) {
    const person = createPerson(['#efcf8d', '#628f91', '#bd7156', '#eee2c6'][i % 4]);
    const startX = i < 6 ? (i % 2 ? -11 : 11) : -45 + (i - 6) * 27;
    const startZ = i < 6 ? -40 + Math.floor(i / 2) * 44 : -89;
    scene.add(person.group); pedestrians.push({ person, startX, startZ, phase: i * 1.7, axis: i < 6 ? 'z' : 'x', range: i < 6 ? 14 : 7 });
  }
  return { group, solids, mapBuildings, traffic, pedestrians, chairs, klccLifts, mamakProcedural, mamakStreetFallback, shopFallbacks, foliage:foliageStatus, rembayung, petronas };
}

// Street lamps derive from the same road constants the grid above uses, so they can
// never drift away from the roads. Three InstancedMeshes hold roughly eighty lamps at
// three draw calls; real lights would be one shader recompile each and would sink the
// phone build, so night is faked with an emissive head and a glow pool on the ground.
export function createStreetLights(scene: THREE.Scene, solids?: Solid[]) {
  const VERTICAL_X = [0, 76, -82], HORIZONTAL_Z = [-64, 8, 78];
  const KERB = 10.4, JUNCTION = 11, SPACING = 24, REACH = 144;
  const lamps: {x: number; z: number; axis: 'ns' | 'ew'; side: number}[] = [];
  for (const x of VERTICAL_X) {
    let n = 0;
    for (let z = -REACH; z <= REACH; z += SPACING) {
      if (HORIZONTAL_Z.some(cross => Math.abs(z - cross) < JUNCTION)) continue;
      const side = n++ % 2 ? 1 : -1;
      lamps.push({x: x + side * KERB, z, axis: 'ns', side});
    }
  }
  for (const z of HORIZONTAL_Z) {
    let n = 0;
    for (let x = -REACH; x <= REACH; x += SPACING) {
      if (VERTICAL_X.some(cross => Math.abs(x - cross) < JUNCTION)) continue;
      const side = n++ % 2 ? 1 : -1;
      lamps.push({x, z: z + side * KERB, axis: 'ew', side});
    }
  }

  const group = new THREE.Group();
  const poleMaterial = new THREE.MeshStandardMaterial({color: '#46525c', roughness: .8});
  const headMaterial = new THREE.MeshStandardMaterial({color: '#e8e2cd', roughness: .5});
  // The lit shell wraps the matte head rather than replacing it, so a lamp that is off is
  // still a lamp. Every per-lamp mesh is switched by scaling its instance, because the
  // materials are shared across all eighty of them.
  const litMaterial = new THREE.MeshStandardMaterial({color: '#e8e2cd', emissive: '#ffcf82', emissiveIntensity: 2.4, roughness: .5});
  const glowMaterial = new THREE.MeshBasicMaterial({color: '#ffcf82', transparent: true, opacity: .3, depthWrite: false});
  const bulbMaterial = new THREE.MeshBasicMaterial({color: '#ffe6b8', transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false});
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.1, .14, 5.4, 6), poleMaterial, lamps.length);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, .24, .52), headMaterial, lamps.length);
  const lit = new THREE.InstancedMesh(new THREE.BoxGeometry(1.76, .3, .58), litMaterial, lamps.length);
  const glows = new THREE.InstancedMesh(new THREE.CircleGeometry(4.4, 14), glowMaterial, lamps.length);
  // A sphere reads the same from every angle, so the halo needs no per-frame billboarding.
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.62, 8, 6), bulbMaterial, lamps.length);

  const matrix = new THREE.Matrix4(), euler = new THREE.Euler(), quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1), position = new THREE.Vector3();
  const OFF = new THREE.Vector3(0, 0, 0);
  // Where each switchable piece sits, kept so a lamp can be re-lit without rebuilding it.
  const places: {head: THREE.Vector3; quaternion: THREE.Quaternion; bulb: THREE.Vector3; glow: THREE.Vector3; flat: THREE.Quaternion}[] = [];
  lamps.forEach((lamp, index) => {
    // The arm always reaches out over the tarmac, whichever kerb the post stands on.
    const towardRoad = -lamp.side, yaw = lamp.axis === 'ns' ? 0 : Math.PI / 2;
    const armX = lamp.axis === 'ns' ? towardRoad * .85 : 0;
    const armZ = lamp.axis === 'ns' ? 0 : towardRoad * .85;

    position.set(lamp.x, 2.7, lamp.z);
    poles.setMatrixAt(index, matrix.compose(position, quaternion.identity(), scale));

    places.push({
      head: new THREE.Vector3(lamp.x + armX, 5.3, lamp.z + armZ),
      quaternion: new THREE.Quaternion().setFromEuler(euler.set(0, yaw, 0)),
      bulb: new THREE.Vector3(lamp.x + armX, 5.18, lamp.z + armZ),
      glow: new THREE.Vector3(lamp.x + armX, .035, lamp.z + armZ),
      flat: new THREE.Quaternion().setFromEuler(euler.set(-Math.PI / 2, 0, 0)),
    });
    heads.setMatrixAt(index, matrix.compose(places[index].head, places[index].quaternion, scale));

    solids?.push({x: lamp.x, z: lamp.z, hx: .22, hz: .22});
  });
  group.add(poles, heads, lit, bulbs, glows);
  scene.add(group);

  // Night is only the default. A lamp somebody switched keeps its own answer, and that is
  // what `overrides` holds — sparse, so a room that nobody has touched costs nothing.
  let night = false;
  const overrides = new Map<number, boolean>();
  const isLit = (index: number) => overrides.get(index) ?? night;

  function paint() {
    for (let index = 0; index < lamps.length; index++) {
      const on = isLit(index), place = places[index];
      lit.setMatrixAt(index, matrix.compose(place.head, place.quaternion, on ? scale : OFF));
      bulbs.setMatrixAt(index, matrix.compose(place.bulb, quaternion.identity(), on ? scale : OFF));
      glows.setMatrixAt(index, matrix.compose(place.glow, place.flat, on ? scale : OFF));
    }
    lit.instanceMatrix.needsUpdate = true;
    bulbs.instanceMatrix.needsUpdate = true;
    glows.instanceMatrix.needsUpdate = true;
  }
  paint();

  return {
    group, lamps, headMaterial,
    useBlenderBodies(indices: number[]) {
      const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
      for (const index of indices) {
        if (!Number.isInteger(index) || index < 0 || index >= lamps.length) continue;
        poles.setMatrixAt(index, hidden); heads.setMatrixAt(index, hidden);
      }
      poles.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
      // Emissive heads, glow pools and switch overrides keep the same indexed state.
    },
    lit: (index: number) => isLit(index),
    setNight(on: boolean) { if (night === on) return; night = on; paint(); },
    setLamp(index: number, on: boolean | null) {
      if (!(index >= 0 && index < lamps.length)) return;
      if (on === null) overrides.delete(index); else overrides.set(index, on);
      paint();
    },
    setLamps(state: Record<string, boolean>) {
      overrides.clear();
      for (const [key, on] of Object.entries(state || {})) {
        const index = Number(key);
        if (Number.isInteger(index) && index >= 0 && index < lamps.length && typeof on === 'boolean') overrides.set(index, on);
      }
      paint();
    },
  };
}
