import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('#preview');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e1e4e7');
scene.add(new THREE.HemisphereLight(0xffffff, 0x697375, 2));
const key = new THREE.DirectionalLight(0xffffff, 3);
key.position.set(3, 6, 4); scene.add(key);
const camera = new THREE.PerspectiveCamera(36, 1, .01, 100);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, .5, 0); controls.minDistance = 1.5; controls.maxDistance = 8;
const views = { iso: [2.6, 2.6, 3.6], front: [0, .5, 4], right: [4, .5, 0], top: [0, 4.5, .0001] };
function resize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
function setView(name) {
  camera.position.set(...views[name]); controls.target.set(0, .5, 0); controls.update();
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
  renderer.render(scene, camera);
}
setView('iso'); resize();
controls.addEventListener('change', () => renderer.render(scene, camera));
new ResizeObserver(resize).observe(canvas);
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
try {
  const gltf = await new GLTFLoader().loadAsync('../generated/exports/LM_TEST_ScaleMeter.glb');
  scene.add(gltf.scene);
  renderer.render(scene, camera);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const assetOnly = { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  window.LM_ASSET_CHECK = {
    loaded: true, threeRevision: THREE.REVISION, webgl: renderer.getContext().getParameter(renderer.getContext().VERSION),
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new THREE.Vector3()).toArray() },
    assetOnly, pixelRatio: renderer.getPixelRatio(),
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#d9dce0', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.006; scene.add(floor);
  const grid = new THREE.GridHelper(3, 30, 0x829b8e, 0xb2bcb7); grid.position.y = -.003; scene.add(grid);
  renderer.render(scene, camera);
  document.querySelector('#status').textContent = `PASS · ${bounds.getSize(new THREE.Vector3()).toArray().map(n => n.toFixed(3)).join(' × ')} m\nGLB only: ${assetOnly.triangles} triangles · ${assetOnly.drawCalls} draw calls · Three.js r${THREE.REVISION}`;
} catch (error) {
  window.LM_ASSET_CHECK = { loaded: false, error: String(error) };
  document.querySelector('#status').textContent = `FAIL · ${error.message}`;
  throw error;
}
