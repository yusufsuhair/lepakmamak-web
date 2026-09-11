import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.resolve(process.argv[2] ?? path.join(root, 'generated/mamak-maju/exports/LM_ENV_MamakMaju.glb'));
const bytes = await fs.readFile(input);
const reportDir = path.resolve(process.argv[3] ?? path.join(root, 'generated/mamak-maju/reports'));
await fs.mkdir(reportDir, { recursive: true });
const khronos = await validator.validateBytes(new Uint8Array(bytes), { uri: path.basename(input), maxIssues: 1000 });
await fs.writeFile(path.join(reportDir, 'gltf-validator.json'), JSON.stringify(khronos, null, 2) + '\n');
assert.equal(khronos.issues.numErrors, 0);
assert.equal(khronos.issues.numWarnings, 0);
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
assert.deepEqual(json.nodes.map(node => node.name), ['LM_ENV_MamakMaju']);
for (const field of ['cameras', 'animations', 'skins', 'images', 'textures']) assert.equal(json[field]?.length ?? 0, 0, field);
assert.ok(!json.extensionsUsed?.includes('KHR_lights_punctual'));
assert.ok(json.buffers.every(buffer => !buffer.uri));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
gltf.scene.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(gltf.scene);
const size = bounds.getSize(new THREE.Vector3());
const near = (value, expected, label) => assert.ok(Math.abs(value - expected) < 1e-4, `${label}: ${value} !== ${expected}`);
near(bounds.min.y, 0, 'base'); near(size.x, 31.2, 'width'); near(size.y, 9.95, 'height');
assert.ok(size.z > 15 && size.z < 16, `depth: ${size.z}`);
let triangles = 0, primitives = 0; const materials = new Set();
gltf.scene.traverse(object => {
  if (!object.isMesh) return;
  primitives += 1;
  triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  materials.add(object.material.name);
  assert.ok(object.material.isMeshStandardMaterial);
  assert.equal(object.material.transparent, false);
  assert.equal(object.material.side, 0);
});
assert.equal(triangles, 912);
assert.equal(primitives, 4);
assert.deepEqual([...materials].sort(), ['LM_Metal_Dark', 'LM_Roof_Red', 'LM_Wall_Cream', 'LM_Wood_Warm']);
const report = {
  passed: true, asset: path.basename(input), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
  triangles, primitives, materials: [...materials].sort(),
  bounds_three_m: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() },
  khronos: { errors: khronos.issues.numErrors, warnings: khronos.issues.numWarnings, infos: khronos.issues.numInfos },
};
await fs.writeFile(path.join(reportDir, 'three-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
