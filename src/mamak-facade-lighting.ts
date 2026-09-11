import * as THREE from 'three';

/** A local, warm sign wash aligned to the four Blender fixtures.
 * Static world-space surfaces only: no new lights, textures or draw calls.
 * This is an art-directed approximation, not shadow-casting/physical lighting.
 */
export function createFacadeWash() {
  const amount = {value: 0};
  const patched = new WeakSet<THREE.Material>();
  let materialCount = 0;
  function attach(root: THREE.Group) {
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh ||
        object instanceof THREE.SkinnedMesh || object.name === 'LM_ENV_MamakFacade_Lamps') return;
      const box = new THREE.Box3().setFromObject(object);
      // Excludes tables, chairs, windows, counter and all unrelated city objects.
      if (box.max.y < 3.48 || box.min.y > 5.13 || box.max.z < 42.25 || box.min.z > 43) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || patched.has(material)) continue;
        const previousCompile = material.onBeforeCompile;
        const previousKey = material.customProgramCacheKey();
        material.onBeforeCompile = function(shader, renderer) {
          // Preserve existing Mamak V7 baked colour and canopy-pool hooks.
          previousCompile.call(this, shader, renderer);
          shader.uniforms.lmFacadeWash = amount;
          shader.vertexShader = 'varying vec3 lmFacadeWorld;\nvarying vec3 lmFacadeNormal;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            lmFacadeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
            lmFacadeNormal = normalize(mat3(modelMatrix) * normal);`);
          shader.fragmentShader = 'uniform float lmFacadeWash;\nvarying vec3 lmFacadeWorld;\nvarying vec3 lmFacadeNormal;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
            if (lmFacadeWash > 0.0 && lmFacadeWorld.y > 3.48 && lmFacadeWorld.y < 5.13
              && lmFacadeWorld.z > 42.25 && lmFacadeWorld.z < 43.0) {
              float facadePools = 0.0;
              for (int i = 0; i < 4; i++) {
                float lampX = i == 0 ? -41.65 : i == 1 ? -34.0 : i == 2 ? -24.0 : -16.35;
                vec2 offset = vec2((lmFacadeWorld.x - lampX) / 3.5, (lmFacadeWorld.y - 5.105) / 1.55);
                facadePools += exp(-dot(offset, offset) * 0.65);
              }
              float facadeBand = smoothstep(3.48, 3.75, lmFacadeWorld.y)
                * (1.0 - smoothstep(4.93, 5.13, lmFacadeWorld.y));
              float facadeSlab = smoothstep(42.25, 42.42, lmFacadeWorld.z)
                * (1.0 - smoothstep(42.80, 43.0, lmFacadeWorld.z));
              float facadeFacing = smoothstep(0.35, 0.8, normalize(lmFacadeNormal).z);
              outgoingLight += diffuseColor.rgb * vec3(1.0, 0.78, 0.52)
                * min(facadePools, 1.3) * facadeBand * facadeSlab * facadeFacing * lmFacadeWash;
            }
            #include <opaque_fragment>`);
        };
        material.customProgramCacheKey = () => previousKey + '|lm-facade-wash-v1';
        material.needsUpdate = true;
        patched.add(material);
        materialCount++;
      }
    });
  }
  return {attach, setActive(active: boolean) { amount.value = active ? 2 : 0; },
    get intensity() { return amount.value; }, get materialCount() { return materialCount; }};
}
