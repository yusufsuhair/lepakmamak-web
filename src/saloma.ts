import * as THREE from 'three';

/** The Blender Saloma Link (scripts/blender/build_saloma.py) after dark. The real bridge's diagrid
 * runs a colour-changing LED show; here the diagrid material itself is the show. Its shader adds an
 * emissive colour computed from the vertex position along the span and one time uniform, so the
 * night costs a uniform write per frame and no geometry. Reduced motion holds a still gradient.
 * The handrail, fascia and uplight LEDs ('Saloma deck glow') are lit at night only. */
export const salomaStatus = {night: false, dressed: false};
/** Shader uniforms, exported so tests can read the show's state. */
export const salomaShow = {night: {value: 0}, time: {value: 0}};
const glows: {material: THREE.MeshStandardMaterial; intensity: number}[] = [];
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function apply() {
  salomaShow.night.value = salomaStatus.night ? 1 : 0;
  for (const {material, intensity} of glows) material.emissiveIntensity = salomaStatus.night ? intensity : 0;
}

export function setSalomaNight(night: boolean): void { salomaStatus.night = night; apply(); }

export function dressSaloma(model: THREE.Object3D): void {
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const m = object.material as THREE.MeshStandardMaterial;
    for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = 8;
    if (m.name === 'Saloma deck glow') {
      object.castShadow = false;
      if (!glows.some(g => g.material === m)) glows.push({material: m, intensity: m.emissiveIntensity});
    }
    if (m.name !== 'Saloma diagrid') return;
    // Only drawn frames pay for the clock; a bridge out of view stops its show.
    object.onBeforeRender = () => { if (!still) salomaShow.time.value = performance.now() / 1000; };
    m.onBeforeCompile = shader => {
      shader.uniforms.salomaNight = salomaShow.night; shader.uniforms.salomaTime = salomaShow.time;
      // Positions are in the bridge's own frame (x along the 48 m span, y up, z across).
      shader.vertexShader = 'varying vec3 vSaloma;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vSaloma = transformed;');
      shader.fragmentShader = 'uniform float salomaNight;\nuniform float salomaTime;\nvarying vec3 vSaloma;\n'
        + 'vec3 salomaHue( float h ) { return clamp( abs( fract( h + vec3( 0., 2. / 3., 1. / 3. ) ) * 6. - 3. ) - 1., 0., 1. ); }\n'
        + shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float salomaUp = vSaloma.y - 4.4;
          // a rainbow rolling along the span, with chevrons pulsing out from mid-span
          vec3 salomaRoll = salomaHue( vSaloma.x * .018 - salomaTime * .05 + salomaUp * .03 )
            * ( .5 + .5 * sin( abs( vSaloma.x ) * .55 - salomaTime * 2.4 + salomaUp * .8 ) );
          // every half minute the canopy breathes a slow two-colour fade from the deck to the ridge instead
          vec3 salomaBreath = mix( salomaHue( salomaTime * .02 ), salomaHue( salomaTime * .02 + .38 ), clamp( salomaUp / 4.4, 0., 1. ) )
            * ( .55 + .45 * sin( salomaTime * 1.1 - salomaUp * .6 ) );
          float salomaMode = smoothstep( .35, .65, .5 + .5 * sin( salomaTime * .1 ) );
          totalEmissiveRadiance += salomaNight * mix( salomaRoll, salomaBreath, salomaMode ) * 1.6;`);
    };
    m.needsUpdate = true;
  });
  salomaStatus.dressed = true;
  apply();
}
