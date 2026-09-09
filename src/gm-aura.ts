import * as THREE from 'three';

// The Game Master hovers. The bob is shared by the local player and every remote one, so a
// GM looks the same to themselves and to everybody watching them.
export const GM_HOVER = {lift: .34, bob: .09, period: 2.6};

export function gmHover(seconds: number): number {
  return GM_HOVER.lift + Math.sin(seconds * (Math.PI * 2) / GM_HOVER.period) * GM_HOVER.bob;
}

const slab = (group: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, colour: string, opacity = 1) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({color: colour, roughness: .7, transparent: opacity < 1, opacity}),
  );
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
};

// One wing dark and membranous, one pale and feathered, as in the reference. Built as a
// right wing and mirrored for the left, so both fan identically. Quills sweep up and back
// from the shoulder along an arc rather than sticking out sideways.
function buildWing(dark: boolean) {
  const wing = new THREE.Group();
  const shade = dark ? '#3b2b46' : '#f6f1e6';
  const edge = dark ? '#241a2d' : '#d8cdb4';
  const COUNT = 6;
  for (let i = 0; i < COUNT; i++) {
    const t = i / (COUNT - 1);
    const angle = .30 + t * .95;          // from just above horizontal to steeply raised
    const reach = .26 + t * .10;           // where along the shoulder the quill is rooted
    const length = 1.18 - t * .42;         // outer quills are shorter, so the fan tapers
    const mid = reach + length / 2;
    const quill = slab(wing,
      Math.cos(angle) * mid, Math.sin(angle) * mid, -.05 - t * .07,
      length, dark ? .13 : .17, .04,
      i % 2 ? shade : edge, dark ? .95 : 1);
    quill.rotation.z = angle;
    quill.rotation.y = -.30 - t * .18;     // rake the fan backwards, away from the body
  }
  // The membrane on the dark wing, a soft under-layer on the pale one.
  const web = slab(wing, .62, .52, -.11, 1.15, .78, .03, shade, dark ? .72 : .55);
  web.rotation.z = .72;
  web.rotation.y = -.38;
  return wing;
}

// The seal underfoot is a slow-turning ring rather than a real light, so it reads at night
// without adding another light to a scene that only has two. It also ignores depth: the
// mamak floor is a slab whose top sits above the road, and a depth-tested seal disappears
// inside it the moment the Game Master steps in off the street.
function buildSeal() {
  const seal = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 28),
    new THREE.MeshBasicMaterial({color: '#c9a6ff', transparent: true, opacity: .22, depthWrite: false, depthTest: false}),
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(.72, .92, 24),
    new THREE.MeshBasicMaterial({color: '#e6d2ff', transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false, depthTest: false}),
  );
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(.3, .38, 3),
    new THREE.MeshBasicMaterial({color: '#fff0c2', transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false, depthTest: false}),
  );
  for (const [mesh, y, order] of [[disc, .02, 3], [ring, .03, 4], [inner, .04, 5]] as const) {
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = y;
    // Depth is off, so the draw order is what keeps the ring above its own disc.
    mesh.renderOrder = order;
  }
  seal.add(disc, ring, inner);
  return {seal, ring, inner};
}

export function createGmAura() {
  const group = new THREE.Group();
  const left = buildWing(true), right = buildWing(false);
  left.scale.x = -1;                       // mirrored, so the two wings fan the same way
  left.position.set(-.16, 1.02, -.16); right.position.set(.16, 1.02, -.16);
  const {seal, ring, inner} = buildSeal();
  group.add(left, right, seal);

  return {
    group,
    update(seconds: number) {
      // A slow beat rather than a flap: the wings hold him up, they do not propel him.
      const beat = Math.sin(seconds * 1.6) * .12;
      left.rotation.z = beat; right.rotation.z = -beat;
      left.rotation.y = .1 + beat * .5; right.rotation.y = -.1 - beat * .5;
      // The seal turns the other way, so the two never look locked together, and it stays
      // on the ground while the body above it rises and falls.
      ring.rotation.z = seconds * .5;
      inner.rotation.z = -seconds * .8;
      seal.position.y = -gmHover(seconds) + .02;
    },
  };
}
