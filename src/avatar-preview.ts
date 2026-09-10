import * as THREE from 'three';
import {appearance, type Appearance} from './appearance';
import {applyAppearance, createPerson} from './world';

/** Render the same Three.js avatar rig used by the city in the character screen. */
export function createAvatarPreview(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(25, 280 / 360, .1, 20);
  camera.position.set(2.8, 2.15, 5.8);
  camera.lookAt(0, 1.12, 0);
  scene.add(new THREE.HemisphereLight(0xe8f7e5, 0x102c27, 2.4));
  const key = new THREE.DirectionalLight(0xfff0c8, 3.2);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8ed5ca, 1.4);
  fill.position.set(3, 2, 2);
  scene.add(fill);

  const avatar = createPerson();
  avatar.group.scale.setScalar(1.18);
  scene.add(avatar.group);

  let running = false;
  let frame = 0;
  let width = 0;
  let height = 0;
  let yaw = 0;
  let pointerId: number | null = null;
  let pointerX = 0;
  let dragging = false;
  const publishYaw = () => { canvas.dataset.rotation = String(Math.round(THREE.MathUtils.euclideanModulo(yaw + Math.PI, Math.PI * 2) * 180 / Math.PI - 180)); };
  const draw = () => { avatar.group.rotation.y = yaw; renderOnce(); };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width || canvas.width || 280));
    const nextHeight = Math.max(1, Math.round(rect.height || canvas.height || 360));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth; height = nextHeight;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(canvas);

  const paint = () => {
    if (!running) return;
    resize();
    avatar.group.rotation.y = yaw;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(paint);
  };
  const renderOnce = () => { resize(); renderer.render(scene, camera); };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointerId !== null) return;
    event.preventDefault();
    pointerId = event.pointerId;
    pointerX = event.clientX;
    dragging = false;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const delta = event.clientX - pointerX;
    if (Math.abs(delta) > .25) dragging = true;
    pointerX = event.clientX;
    if (!dragging) return;
    event.preventDefault();
    yaw += delta * .012;
    publishYaw();
    if (!running) draw();
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    canvas.classList.remove('is-dragging');
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);
  publishYaw();
  const setLook = (value: Appearance) => {
    const look = appearance(value);
    applyAppearance(avatar.group, look);
    canvas.dataset.preview = 'live-3d';
    canvas.dataset.shirt = look.shirt;
    canvas.dataset.trousers = look.trousers;
    canvas.dataset.tudung = look.tudung;
    if (!running) renderOnce();
  };
  const start = () => {
    if (running) return;
    running = true;
    resize();
    frame = requestAnimationFrame(paint);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };
  const dispose = () => {
    stop(); observer?.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerEnd);
    canvas.removeEventListener('pointercancel', onPointerEnd);
    canvas.removeEventListener('lostpointercapture', onPointerEnd);
    avatar.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
    renderer.dispose();
  };

  return {setLook, start, stop, dispose, avatar: avatar.group, rotate(delta: number) { yaw += delta; publishYaw(); if (!running) draw(); }};
}
