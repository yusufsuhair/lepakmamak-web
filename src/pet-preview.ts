import * as THREE from 'three';
import {animateAnimal, createAnimal, type PetBreedId, type AnimalAction} from './animals';
import {box} from './world';

export type PetKind = 'pet-ginger' | 'pet-cream';

const colour = (kind: PetKind) => kind === 'pet-ginger' ? '#e6a34e' : '#f0e8d8';

function disposeAnimal(animal: ReturnType<typeof createAnimal>) {
  animal.group.userData.disposed = true;
  animal.group.traverse(object => {
    if (object instanceof THREE.Mesh && object.geometry.type === 'ConeGeometry') object.geometry.dispose();
  });
  for (const material of animal.group.userData.catMaterials || []) material.dispose?.();
}

/** A lightweight companion-only preview; it deliberately shares the city's cat rig. */
export function createPetPreview(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 20);
  camera.position.set(1.9, 1.6, 4.1); camera.lookAt(0, .85, 0);
  scene.add(new THREE.HemisphereLight(0xe8f7e5, 0x102c27, 2.4));
  const keyLight = new THREE.DirectionalLight(0xfff0c8, 3); keyLight.position.set(-3, 5, 5); scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x8ed5ca, 1.4); fillLight.position.set(3, 2, 2); scene.add(fillLight);

  let animal = createAnimal(true, colour('pet-ginger'), 'ginger-tabby');
  animal.group.scale.setScalar(1.35); animal.group.position.y = .08; scene.add(animal.group);
  let kind: PetKind = 'pet-ginger', ribbon = '', breed: PetBreedId = 'ginger-tabby', running = false, disposed = false, frame = 0;
  let width = 0, height = 0, yaw = 0, pointerId: number | null = null, pointerX = 0;
  let selectedAction: AnimalAction | 'auto' = 'auto';

  const addRibbon = (value: string) => {
    if (!value) return;
    const shade = value === 'pet-collar-red' ? '#df655e' : '#51b8ab';
    box(animal.group, 0, .52, .30, .39, .08, .2, shade);
    for (const side of [-1, 1]) {
      const bow = box(animal.group, side * .09, .52, .42, .16, .14, .06, shade);
      bow.rotation.z = side * .35;
    }
  };
  const setPet = (nextKind: PetKind, nextRibbon = '', nextBreed: PetBreedId = (nextKind === 'pet-ginger' ? 'ginger-tabby' : 'cream-shorthair')) => {
    if (nextKind === kind && nextRibbon === ribbon && nextBreed === breed) return;
    scene.remove(animal.group); disposeAnimal(animal);
    animal = createAnimal(true, colour(nextKind), nextBreed); animal.group.scale.setScalar(1.35); animal.group.position.y = .08;
    addRibbon(nextRibbon); scene.add(animal.group); kind = nextKind; ribbon = nextRibbon;
    breed = nextBreed; canvas.dataset.pet = kind; canvas.dataset.ribbon = ribbon; canvas.dataset.breed = breed;
    canvas.dataset.model = 'loading';
    if (!running) draw();
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const nextWidth = Math.max(1, Math.round(rect.width)), nextHeight = Math.max(1, Math.round(rect.height));
    if (nextWidth === width && nextHeight === height) return true;
    width = nextWidth; height = nextHeight; renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); return true;
  };
  const renderOnce = () => { if (!disposed && resize()) renderer.render(scene, camera); };
  const draw = () => { const time = performance.now() / 1000, cycle = time % 20, action = selectedAction === 'auto' ? (cycle < 4 ? 'idle' : cycle < 8 ? 'walk' : cycle < 12 ? 'lie' : cycle < 16 ? 'play' : 'jump') : selectedAction; animateAnimal(animal, action, time, 0); animal.group.position.y = .08 + (animal.group.userData.poseYOffset || 0); animal.group.rotation.y = yaw; canvas.dataset.model = animal.group.userData.catModel || 'loading'; renderOnce(); };
  const publishYaw = () => { canvas.dataset.rotation = String(Math.round(THREE.MathUtils.euclideanModulo(yaw + Math.PI, Math.PI * 2) * 180 / Math.PI - 180)); };
  const paint = () => { if (!running) return; draw(); frame = requestAnimationFrame(paint); };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointerId !== null) return;
    event.preventDefault(); pointerId = event.pointerId; pointerX = event.clientX; canvas.classList.add('is-dragging'); canvas.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const delta = event.clientX - pointerX; pointerX = event.clientX;
    if (!delta) return; event.preventDefault(); yaw += delta * .012; publishYaw(); if (!running) draw();
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null; canvas.classList.remove('is-dragging'); if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize); observer?.observe(canvas);
  canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd); canvas.addEventListener('pointercancel', onPointerEnd); canvas.addEventListener('lostpointercapture', onPointerEnd);
  canvas.dataset.preview = 'pet-3d'; canvas.dataset.pet = kind; canvas.dataset.ribbon = ribbon; canvas.dataset.breed = breed; publishYaw();
  return {
    setPet,
    setAction(action: AnimalAction | 'auto') { selectedAction = action; canvas.dataset.action = action; if (!running) draw(); },
    start() { if (running || disposed) return; running = true; resize(); frame = requestAnimationFrame(paint); },
    stop() { running = false; cancelAnimationFrame(frame); },
    dispose() { if (disposed) return; disposed = true; running = false; cancelAnimationFrame(frame); observer?.disconnect(); disposeAnimal(animal); renderer.dispose(); canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerup', onPointerEnd); canvas.removeEventListener('pointercancel', onPointerEnd); canvas.removeEventListener('lostpointercapture', onPointerEnd); },
    rotate(delta: number) { yaw += delta; publishYaw(); if (!running) draw(); },
  };
}
