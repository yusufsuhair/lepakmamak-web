import * as THREE from 'three';
import {animateAnimal, createAnimal, petBreedList} from './animals';
import {box} from './world';
import {moveWithCollisions, type Solid} from './physics';

function createPetLabel(value: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const context = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({map: texture, transparent: true, depthWrite: false, depthTest: false});
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 1.78, 0); sprite.scale.set(3.1, .58, 1);
  const draw = (next: string) => {
    const shown = next || 'Pet';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '700 38px Oxanium, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    const width = Math.min(canvas.width - 24, context.measureText(shown).width + 28);
    context.fillStyle = '#173c32eb'; context.strokeStyle = '#ddf69a99'; context.lineWidth = 3;
    context.beginPath(); context.roundRect((canvas.width - width) / 2, 9, width, canvas.height - 18, 18); context.fill(); context.stroke();
    context.fillStyle = '#f7efd9'; context.fillText(shown, canvas.width / 2, canvas.height / 2 + 1);
    texture.needsUpdate = true; sprite.userData.name = shown;
  };
  draw(value);
  return {sprite, draw, dispose() { texture.dispose(); material.dispose(); }};
}

// Pets use the owner's existing, server-authorized equipment stream.
export function createPets(scene: THREE.Scene, solids: Solid[]) {
  const followers = new Map<string, {animal: ReturnType<typeof createAnimal>; key: string; stuck: number; phase: number; label: ReturnType<typeof createPetLabel>}>();
  const seen = new Set<string>();
  function remove(id: string) {
    const pet = followers.get(id);
    if (!pet) return;
    scene.remove(pet.animal.group);
    pet.label.dispose();
    // Spheres, boxes and model geometry are shared; only cloned model materials are owned here.
    pet.animal.group.traverse(object => { if (object instanceof THREE.Mesh && object.geometry.type === 'ConeGeometry') object.geometry.dispose(); });
    for (const material of pet.animal.group.userData.catMaterials || []) material.dispose?.();
    followers.delete(id);
  }
  return {
    begin() { seen.clear(); },
    update(id: string, x: number, y: number, z: number, yaw: number, equipment: string, dt: number, time: number, petName = '', petBreed = '') {
      const items = equipment.split(',');
      const savedBreed = petBreedList.find(item => item.id === petBreed);
      const hasPet = items.includes('pet-companion') || items.includes('pet-ginger') || items.includes('pet-cream');
      const cat = hasPet ? (savedBreed?.base || (items.includes('pet-cream') ? 'pet-cream' : 'pet-ginger')) : '';
      if (!cat) return;
      seen.add(id);
      const ribbon = items.includes('pet-collar-red') ? '#df655e' : items.includes('pet-collar-teal') ? '#51b8ab' : '';
      const breed = savedBreed?.base === cat ? savedBreed.id : (cat === 'pet-ginger' ? 'ginger-tabby' : 'cream-shorthair');
      const key = cat + ribbon + breed;
      let pet = followers.get(id);
      if (pet?.key !== key) {
        remove(id);
        const animal = createAnimal(true, cat === 'pet-ginger' ? '#e6a34e' : '#f0e8d8', breed);
        const label = createPetLabel(String(petName || '').trim().slice(0, 18) || 'Lepak Cat');
        animal.group.name = `Pet · ${id}`; animal.group.scale.setScalar(.8);
        animal.group.position.set(x - Math.sin(yaw), y, z - Math.cos(yaw));
        animal.group.add(label.sprite);
        if (ribbon) {
          box(animal.group, 0, .52, .30, .39, .08, .2, ribbon);
          for (const side of [-1, 1]) { const bow = box(animal.group, side * .09, .52, .42, .16, .14, .06, ribbon); bow.rotation.z = side * .35; }
        }
        scene.add(animal.group); pet = {animal, key, stuck: 0, phase: [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 32, label}; followers.set(id, pet);
      }
      const {group} = pet.animal;
      const shownName = String(petName || '').trim().slice(0, 18) || 'Lepak Cat';
      if (pet.label.sprite.userData.name !== shownName) pet.label.draw(shownName);
      group.userData.petName = shownName;
      const dx = x - group.position.x, dz = z - group.position.z, distance = Math.hypot(dx, dz);
      const walking = distance > 1.1;
      // Catch up after teleports and rides; normal walking uses the city's collisions.
      if (distance > 8 || Math.abs(y - group.position.y) > 2) group.position.set(x - Math.sin(yaw), y, z - Math.cos(yaw));
      else if (walking) {
        const step = Math.min(distance - 1.1, Math.max(3.5, distance * 3) * Math.max(0, dt));
        const previousX = group.position.x, previousZ = group.position.z;
        moveWithCollisions(group.position, dx / distance * step, dz / distance * step, .23, solids);
        pet.stuck = Math.hypot(group.position.x - previousX, group.position.z - previousZ) < step * .1 ? pet.stuck + dt : 0;
        // ponytail: no pathfinder; recall beside the owner after two seconds blocked.
        if (pet.stuck > 2) { group.position.set(x, y, z); pet.stuck = 0; }
        group.rotation.y = Math.atan2(dx, dz);
      }
      const cycle = (time + pet.phase) % 16;
      const action = walking ? 'walk' : cycle < 4 ? 'idle' : cycle < 8 ? 'lie' : cycle < 12 ? 'play' : 'jump';
      animateAnimal(pet.animal, action, time, pet.phase);
      group.position.y = y + (group.userData.poseYOffset || 0);
    },
    end() { for (const id of followers.keys()) if (!seen.has(id)) remove(id); },
  };
}
