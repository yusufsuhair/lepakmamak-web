import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {appearance, defaultAppearance, tudungColour, type Appearance} from './appearance';
import catalog from '../shared/character-styles.json';

export type Character = {group: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group};
const VERSION = catalog.version;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const templates = new Map<string, Promise<THREE.Group>>();
type Channel = 'skin' | 'shirt' | 'trousers' | 'hair' | 'tudung';
type State = {rig: Character; slots: Record<string, THREE.Group>; palette: Record<Channel, THREE.MeshStandardMaterial>; look: Appearance; revision: number; key: string; disposed: boolean; pending: Promise<void>};
const states = new WeakMap<THREE.Group, State>();
const fallbackBox = new THREE.BoxGeometry(1, 1, 1);
const fallbackSphere = new THREE.SphereGeometry(1, 16, 12);
const fixedFallback = new THREE.MeshStandardMaterial({color: '#f6efd7', roughness: .7});

function template(key: string) {
  let pending = templates.get(key);
  if (!pending) {
    pending = loader.loadAsync(`/assets/models/characters/${key}.glb?v=${VERSION}`).then(gltf => {
      if (!gltf.scene.children.length) throw new Error(`Empty character asset: ${key}`);
      return gltf.scene;
    }).catch(error => { templates.delete(key); throw error; });
    templates.set(key, pending);
  }
  return pending;
}

function slot(parent: THREE.Group, name: string, position: [number, number, number] = [0, 0, 0]) {
  const group = new THREE.Group(); group.name = name; group.position.set(...position); parent.add(group); return group;
}
function fallback(parent: THREE.Group, position: [number, number, number], scale: [number, number, number], material: THREE.Material, round = false) {
  const object = new THREE.Mesh(round ? fallbackSphere : fallbackBox, material);
  object.position.set(...position); object.scale.set(...scale); object.castShadow = true; object.userData.keepUnbatched = true; parent.add(object);
}

/** Stable slots are created synchronously. Loading a visual never replaces a limb,
 * elbow, accessory anchor or a group that dance/gameplay code already references. */
export function createCharacter(shirt = defaultAppearance.shirt, seated = false, customization?: Appearance): Character {
  const group = new THREE.Group(); group.name = 'avatar';
  const body = slot(group, 'avatar-body'), head = slot(group, 'avatar-head');
  const hair = slot(group, 'avatar-hair'), tudung = slot(group, 'avatar-tudung');
  slot(group, 'shop-accessories');
  const leftLeg = slot(group, 'avatar-left-leg', [-.153, .846, 0]);
  const rightLeg = slot(group, 'avatar-right-leg', [.153, .846, 0]);
  const leftArm = slot(group, 'avatar-left-arm', [-.2925, 1.224, 0]);
  const rightArm = slot(group, 'avatar-right-arm', [.2925, 1.224, 0]);
  const slots: State['slots'] = {body, head, hair, tudung, leftLeg, rightLeg};
  for (const [side, arm] of [['left', leftArm], ['right', rightArm]] as const) {
    slots[`${side}UpperArm`] = slot(arm, `${side}-upper-arm`);
    slots[`${side}Forearm`] = slot(arm, `${side}-forearm`);
    arm.userData.elbowY = -.21;
  }
  const palette = Object.fromEntries(['skin', 'shirt', 'trousers', 'hair', 'tudung'].map(channel => [channel,
    new THREE.MeshStandardMaterial({name: `LM_${channel}`, roughness: channel === 'skin' ? .57 : channel === 'hair' ? .43 : .68})])) as State['palette'];
  const rig = {group, leftLeg, rightLeg, leftArm, rightArm};
  const state: State = {rig, slots, palette, look: customization ? appearance(customization) : {...defaultAppearance, shirt}, revision: 0, key: '', disposed: false, pending: Promise.resolve()};
  states.set(group, state);
  fallback(body, [0, 1.05, 0], [.52, .54, .32], palette.shirt);
  fallback(head, [0, 1.77, 0], [.37, .40, .30], palette.skin, true);
  fallback(hair, [0, 1.97, -.025], [.38, .22, .30], palette.hair, true);
  for (const side of ['left', 'right']) {
    fallback(slots[`${side}Leg`], [0, -.38, 0], [.22, .70, .23], palette.trousers);
    fallback(slots[`${side}Leg`], [0, -.76, .065], [.25, .13, .36], fixedFallback);
    fallback(slots[`${side}UpperArm`], [side === 'left' ? -.035 : .035, -.075, 0], [.20, .23, .23], palette.shirt);
    fallback(slots[`${side}Forearm`], [side === 'left' ? -.10 : .10, -.29, .015], [.14, .30, .15], palette.skin);
  }
  if (seated) {
    for (const [side, leg, arm] of [[-1, leftLeg, leftArm], [1, rightLeg, rightArm]] as const) {
      leg.rotation.set(-.92, 0, side * .24); arm.rotation.set(-1.08, 0, side * -.12);
    }
  }
  update(state, state.look);
  return rig;
}

function tint(state: State) {
  for (const channel of ['skin', 'shirt', 'trousers', 'hair', 'tudung'] as const)
    state.palette[channel].color.set(channel === 'tudung' ? (state.look.tudung === 'none' ? '#ffffff' : tudungColour(state.look.tudung)) : state.look[channel]);
  const equipment = String(state.rig.group.userData.accessoryKey || '').split(',');
  if (equipment.includes('batik')) state.palette.shirt.color.set('#244f75');
  else if (equipment.includes('harimau')) state.palette.shirt.color.set('#efc62f');
  // Head coverings fully suppress hair and a worn cap, including during asset loading.
  state.slots.hair.visible = state.look.tudung === 'none' && !state.rig.group.userData.hideHair && !equipment.includes('cap');
  state.slots.tudung.visible = state.look.tudung !== 'none';
  const cap = state.rig.group.getObjectByName('shop-cap');
  if (cap) cap.visible = state.look.tudung === 'none';
}

function visual(source: THREE.Object3D, state: State) {
  const object = source.clone(true);
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true; child.receiveShadow = true; child.userData.keepUnbatched = true;
    const replace = (material: THREE.Material) => state.palette[material.name.replace('LM_', '') as Channel] || material;
    child.material = Array.isArray(child.material) ? child.material.map(replace) : replace(child.material);
  });
  return object;
}

function update(state: State, look: Appearance) {
  if (state.disposed) return;
  state.look = {...look}; state.rig.group.userData.appearance = {...look}; tint(state);
  const style = look.tudung === 'none' ? `hair-${look.hairstyle}` : `tudung-${look.tudung}`;
  const key = `${look.gender}/${style}`;
  if (state.key === key) return;
  state.key = key; const revision = ++state.revision;
  const group = state.rig.group;
  group.userData.assetState = 'loading'; group.userData.assetVersion = VERSION;
  state.pending = Promise.all([template(`base-${look.gender}`), template(style)]).then(([base, covering]) => {
    if (state.disposed || revision !== state.revision) return;
    const replacements: Record<string, THREE.Object3D[]> = {};
    base.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const role = child.name.split('__')[0];
      if (!state.slots[role]) throw new Error(`Unknown character slot: ${role}`);
      (replacements[role] ||= []).push(visual(child, state));
    });
    for (const role of ['body', 'head', 'leftLeg', 'rightLeg', 'leftUpperArm', 'leftForearm', 'rightUpperArm', 'rightForearm']) {
      if (!replacements[role]?.length) throw new Error(`Missing character slot: ${role}`);
    }
    for (const [role, objects] of Object.entries(replacements)) { state.slots[role].clear(); state.slots[role].add(...objects); }
    state.slots.hair.clear(); state.slots.tudung.clear();
    const target = state.slots[state.look.tudung === 'none' ? 'hair' : 'tudung'];
    target.add(visual(covering, state)); tint(state);
    group.userData.assetState = 'ready'; group.userData.assetKey = key;
    delete group.userData.assetError;
  }).catch(error => {
    if (state.disposed || revision !== state.revision) return;
    state.key = ''; group.userData.assetState = 'fallback';
    group.userData.assetError = error instanceof Error ? error.message : String(error);
  });
}

export function applyCharacterAppearance(group: THREE.Group, value: unknown) {
  const state = states.get(group); if (state) update(state, appearance(value));
}
export function refreshCharacterAccessories(group: THREE.Group) { const state = states.get(group); if (state) tint(state); }
export function whenCharacterReady(group: THREE.Group) { return states.get(group)?.pending || Promise.resolve(); }
/** GPU geometry belongs to the shared template cache; only per-avatar tint materials are owned here. */
export function disposeCharacter(group: THREE.Group) {
  const state = states.get(group); if (!state) return;
  state.disposed = true; state.revision++; Object.values(state.palette).forEach(material => material.dispose());
  group.clear(); states.delete(group);
}
