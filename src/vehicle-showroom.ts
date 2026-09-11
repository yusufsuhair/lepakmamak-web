import * as THREE from 'three';
import './vehicle-showroom.css';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createDriveableCar, vehicleSolid } from './world';
import { vehicleCatalog, type RevampedCarStyle } from './vehicle-assets';
import {updateVehiclePresentation,updateVehicleReflections,vehiclePresentationState} from './vehicle-presentation';

const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#171c23');
scene.fog = new THREE.Fog('#171c23', 22, 55);
const camera = new THREE.PerspectiveCamera(36, 1, .05, 100); camera.position.set(6.4, 3.4, 7.4);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, .65, 0);
controls.minDistance = 3; controls.maxDistance = 65; controls.maxPolarAngle = Math.PI * .49;
const ambient = new THREE.HemisphereLight('#d3e7ff', '#645444', 2.2); scene.add(ambient);
const key = new THREE.DirectionalLight('#fff3dc', 3.2); key.position.set(4, 7, 5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -6; key.shadow.camera.right = 6;
key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; key.shadow.normalBias = .025;
scene.add(key);
const rim = new THREE.DirectionalLight('#a8cbff', 1.8); rim.position.set(-5, 4, -3); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({color: '#414951', roughness: .7}));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const modelSelect = document.querySelector<HTMLSelectElement>('#model')!;
for (const [style, spec] of Object.entries(vehicleCatalog)) modelSelect.add(new Option(spec.name, style));
let current: ReturnType<typeof createDriveableCar>, generation = 0, night = false, spinning = false;
async function show(style: RevampedCarStyle) {
  const ticket = ++generation;
  const next = createDriveableCar(style);
  if (current) scene.remove(current.group);
  current = next; scene.add(next.group);
  document.querySelector('#model-name')!.textContent = vehicleCatalog[style].name;
  document.querySelector('#status')!.textContent = 'Memuatkan model Blender…';
  await next.ready;
  if (ticket !== generation) return;
  document.querySelector('#status')!.textContent = next.group.userData.assetState === 'ready' ? 'Blender · PBR · Sedia' : 'Model sementara · Aset gagal dimuatkan';
}
modelSelect.onchange = () => { void show(modelSelect.value as RevampedCarStyle); };
document.querySelector<HTMLButtonElement>('#lighting')!.onclick = event => {
  night = !night; ambient.intensity = night ? .35 : 2.2; key.intensity = night ? .4 : 3.2;
  rim.intensity = night ? .7 : 1.8;
  (event.target as HTMLButtonElement).textContent = night ? 'Siang' : 'Malam';
};
document.querySelector<HTMLButtonElement>('#spin')!.onclick = event => {
  spinning = !spinning; (event.target as HTMLButtonElement).textContent = spinning ? 'Henti roda' : 'Putar roda';
};
const initial = new URLSearchParams(location.search).get('model') || 'myvi';
modelSelect.value = initial in vehicleCatalog ? initial : 'myvi'; void show(modelSelect.value as RevampedCarStyle);
function resize() {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(18)) * Math.max(1, .85 / camera.aspect)));
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
let previous = performance.now();
let previewSteering = 0, previewBraking = false, previewReverse = false;
document.querySelector<HTMLButtonElement>('#steer')!.onclick = () => { previewSteering = previewSteering ? 0 : 1; };
document.querySelector<HTMLButtonElement>('#brake')!.onclick = () => { previewBraking = !previewBraking; };
document.querySelector<HTMLButtonElement>('#reverse')!.onclick = () => { previewReverse = !previewReverse; };
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - previous) / 1000, .05); previous = now;
  if (spinning && current) current.wheels.forEach(wheel => { wheel.rotation.x += dt * 3; });
  controls.update();
  updateVehiclePresentation(scene,camera,dt,night,current?{group:current.group,controls:{speed:previewReverse?-2:spinning?3:0,steering:previewSteering,braking:previewBraking}}:undefined,now/1000);
  updateVehicleReflections(renderer,scene,camera,night,now/1000);
  renderer.render(scene, camera);
});
Object.defineProperty(window, '__vehicleStudio', {get: () => ({
  state: current?.group.userData.assetState, style: current?.group.userData.model,
  wheels: current?.wheels.length, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
  bounds: current ? new THREE.Box3().setFromObject(current.group).getSize(new THREE.Vector3()).toArray() : [],
  footprint: current ? vehicleSolid(current.group) : null,
  rotations: current?.wheels.map(wheel => wheel.rotation.x),
  presentation: current ? vehiclePresentationState(current.group) : undefined,
  setDistance: (distance: number) => { camera.position.set(0,3,distance); controls.update(); },
})});
