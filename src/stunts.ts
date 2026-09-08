import * as THREE from 'three';
import type { Person } from './world';

type Transform = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  limbRotations: THREE.Euler[];
  active: boolean;
};
const transforms = new WeakMap<Person, Transform>();

export function supermanPose(person: Person, active: boolean, time = 0, reducedMotion = false) {
  let state = transforms.get(person);
  if (!state) {
    state = {
      position: person.group.position.clone(),
      rotation: person.group.rotation.clone(),
      limbRotations: [person.leftLeg, person.rightLeg, person.leftArm, person.rightArm].map(limb => limb.rotation.clone()),
      active: false,
    };
    transforms.set(person, state);
  }
  if (!active) {
    if (state.active) {
      person.group.position.copy(state.position); person.group.rotation.copy(state.rotation);
      [person.leftLeg, person.rightLeg, person.leftArm, person.rightArm].forEach((limb, index) => limb.rotation.copy(state!.limbRotations[index]));
      state.active = false;
    }
    return;
  }
  state.active = true;
  const bob = reducedMotion ? 0 : Math.sin(time * 7) * .025;
  person.group.position.set(0, 1.17 + bob, -.78);
  person.group.rotation.set(Math.PI / 2 - .08, 0, reducedMotion ? 0 : Math.sin(time * 4) * .025);
  person.leftLeg.rotation.set(.12, 0, -.12); person.rightLeg.rotation.set(.12, 0, .12);
  person.leftArm.rotation.set(-.24, 0, -.2); person.rightArm.rotation.set(-.24, 0, .2);
}
