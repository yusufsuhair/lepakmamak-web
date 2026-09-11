import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { Box3, Vector3, Matrix3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
const input = path.resolve(process.argv[2] ?? path.join(root, `generated/exports/${config.asset_name}.glb`));
const reportDir = path.resolve(process.argv[3] ?? path.join(path.dirname(input), '../reports'));
const bytes = await fs.readFile(input);
const khronos = await validator.validateBytes(new Uint8Array(bytes), { uri: path.basename(input), maxIssues: 1000 });
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'gltf-validator.json'), JSON.stringify(khronos, null, 2) + '\n');
assert.equal(khronos.issues.numErrors, 0, 'Khronos glTF errors');
assert.equal(khronos.issues.numWarnings, 0, 'Khronos glTF warnings');
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
assert.deepEqual(json.nodes.map(n => n.name), [config.asset_name], 'Preview/guide nodes leaked');
for (const field of ['cameras', 'animations', 'skins', 'images', 'textures']) assert.equal(json[field]?.length ?? 0, 0, field);
assert.ok(!json.extensionsUsed?.includes('KHR_lights_punctual'));
assert.ok(json.buffers.every(buffer => !buffer.uri), 'External resource dependency');
assert.ok(bytes.length <= config.budgets.max_glb_bytes);

const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
gltf.scene.updateMatrixWorld(true);
const bounds = new Box3().setFromObject(gltf.scene);
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-5, `${message}: ${actual} != ${expected}`);
bounds.min.toArray().forEach((v, i) => near(v, [-.5, 0, -.5][i], 'glTF minimum'));
bounds.max.toArray().forEach((v, i) => near(v, [.5, 1, .5][i], 'glTF maximum'));
const rootObject = gltf.scene.getObjectByName(config.asset_name);
assert.ok(rootObject);
rootObject.getWorldPosition(new Vector3()).toArray().forEach(v => near(v, 0, 'Base origin'));
let triangles = 0, vertices = 0, primitives = 0;
const materials = new Set();
const markerNormals = {};
gltf.scene.traverse(object => {
  if (!object.isMesh) return;
  primitives++;
  const geometry = object.geometry;
  triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
  vertices += geometry.attributes.position.count;
  assert.ok(object.material.isMeshStandardMaterial, 'Expected Three.js PBR material');
  assert.equal(object.material.transparent, false);
  assert.equal(object.material.side, 0, 'Expected single-sided material');
  materials.add(object.material.name);
  const expected = { LM_Plastic_Red: [1, 0, 0], LM_Leaf_Green: [0, 0, 1] }[object.material.name];
  if (expected) {
    const used = new Set(geometry.index ? Array.from(geometry.index.array) : Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
    for (const index of used) {
      const normal = new Vector3().fromBufferAttribute(geometry.attributes.normal, index)
        .applyNormalMatrix(new Matrix3().getNormalMatrix(object.matrixWorld));
      normal.toArray().forEach((v, i) => near(v, expected[i], `${object.material.name} world normal`));
    }
    markerNormals[object.material.name] = expected;
  }
});
assert.equal(triangles, 12);
assert.equal(primitives, 3);
assert.equal(materials.size, 3);
assert.deepEqual(Object.keys(markerNormals).sort(), ['LM_Leaf_Green', 'LM_Plastic_Red']);
assert.ok(triangles <= config.budgets.max_triangles);
const report = {
  passed: true, asset: path.basename(input), sha256: createHash('sha256').update(bytes).digest('hex'),
  bytes: bytes.length, triangles, vertices, primitives, materials: [...materials].sort(),
  bounds_three_m: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new Vector3()).toArray() },
  markerNormals, origin: [0, 0, 0],
  khronos: { errors: khronos.issues.numErrors, warnings: khronos.issues.numWarnings, infos: khronos.issues.numInfos },
};
await fs.writeFile(path.join(reportDir, 'three-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
