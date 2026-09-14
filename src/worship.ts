import * as THREE from 'three';

/** Night lighting, shared textures and joss smoke for LM_ENV_Church, LM_ENV_HinduTemple and
 * LM_ENV_ChineseTemple (scripts/blender/build_worship.py). The material names are the contract:
 *  - 'Night glow ...', 'Night lantern ...', 'Night pearl' and 'Night lamp flame' emit at night (flames a
 *    little by day too);
 *  - 'Night flood ...' take their own colour map as a warm floodlight on the gopuram and its stucco;
 *  - 'Night wash warm' planes become additive uplight, hidden by day so they cost nothing.
 * Night is a flag, so a temple that streams in after dark still lights up. */
const GLOW: Record<string, [day: number, night: number]> = {
  'Night glow stained glass': [0, 1.6], 'Night glow interior': [0, .9], 'Night glow lattice': [0, 1.5],
  'Night lantern': [0, 2.2], 'Night lantern red': [0, 1.1], 'Night pearl': [0, 1.2], 'Night lamp flame': [.9, 3],
};
const FLOOD: Record<string, number> = {'Night flood gopuram': .26, 'Night flood stucco': .16, 'Night flood trim': .2, 'Night flood vault': .24};
const glows: {material: THREE.MeshStandardMaterial; day: number; night: number}[] = [];
const floods: {material: THREE.MeshStandardMaterial; intensity: number}[] = [];
const washes: THREE.Mesh[] = [];
const textures = new Map<string, THREE.Texture>();
export const worshipStatus = {night: false, smoke: 0};

/** One GPU copy of a texture the three buildings (and their plazas) share. */
function share(texture: THREE.Texture | null) {
  if (!texture?.name) return texture;
  const key = `${texture.name}|${texture.colorSpace}`, known = textures.get(key);
  if (known && known !== texture) { texture.dispose(); return known; }
  textures.set(key, texture); return texture;
}

/** Soft joss smoke rising from the incense burner: one Points draw, animated in its own shader. */
function jossSmoke(anchor: THREE.Object3D) {
  const count = 36, positions = new Float32Array(count * 3), phase = new Float32Array(count);
  for (let i = 0; i < count; i++) { positions[i * 3] = (Math.sin(i * 12.9898) * .5) * .5; positions[i * 3 + 2] = (Math.sin(i * 78.233) * .5) * .5; phase[i] = i / count; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2.5, 0), 4);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: {time: {value: 0}, night: {value: 0}},
    vertexShader: `attribute float phase; uniform float time; varying float alpha;
      void main(){ float life = fract(time * .07 + phase); vec3 p = position;
        p.y += life * 4.2; p.x += sin(life * 5. + phase * 40.) * .35 * life + life * .6; p.z += cos(life * 4. + phase * 23.) * .25 * life;
        vec4 view = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((60. + 260. * life) / max(1., -view.z), 1., 90.); alpha = sin(life * 3.14159) * (.16 - life * .08); }`,
    fragmentShader: `uniform float night; varying float alpha;
      void main(){ float d = length(gl_PointCoord - vec2(.5)); float a = alpha * (1. - smoothstep(.15, .5, d));
        gl_FragColor = vec4(mix(vec3(.9, .9, .88), vec3(.55, .5, .52), night), a); }`,
  });
  const smoke = new THREE.Points(geometry, material); smoke.name = 'LM_Worship_JossSmoke'; smoke.renderOrder = 3;
  // Advance only when it is actually drawn, so a temple out of view costs nothing.
  smoke.onBeforeRender = () => { material.uniforms.time.value = performance.now() / 1000; material.uniforms.night.value = worshipStatus.night ? 1 : 0; };
  anchor.add(smoke); worshipStatus.smoke++;
}

export function lightWorship(model: THREE.Object3D) {
  model.traverse(object => {
    if (object.name === 'joss_smoke') { jossSmoke(object); return; }
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.map = share(material.map); material.normalMap = share(material.normalMap); material.emissiveMap = share(material.emissiveMap);
    if (material.name in GLOW) glows.push({material, day: GLOW[material.name][0], night: GLOW[material.name][1]});
    else if (material.name in FLOOD) {
      material.emissiveMap = material.map; material.emissive.set('#ffc890'); floods.push({material, intensity: FLOOD[material.name]});
    } else if (material.name.startsWith('Night wash')) {
      // Light, not paint: the wash texture moves to emission over a black base and is added on top.
      material.emissiveMap = material.map; material.map = null; material.color.setRGB(0, 0, 0);
      material.emissive.set('#ffb869'); material.emissiveIntensity = 1;
      Object.assign(material, {blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
      material.needsUpdate = true;
      mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = 2; washes.push(mesh);
    }
  });
  setWorshipNight(worshipStatus.night);
}

export function setWorshipNight(night: boolean) {
  worshipStatus.night = night;
  for (const glow of glows) glow.material.emissiveIntensity = night ? glow.night : glow.day;
  for (const flood of floods) flood.material.emissiveIntensity = night ? flood.intensity : 0;
  for (const wash of washes) wash.visible = night;
}
