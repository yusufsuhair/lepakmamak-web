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
assert.equal(json.nodes[0].extras.lm_sign_text, 'MAMAK MAJU');
assert.equal(json.nodes[0].extras.lm_version, 2);
for (const field of ['cameras', 'animations', 'skins', 'images', 'textures']) assert.equal(json[field]?.length ?? 0, 0, field);
assert.ok(!json.extensionsUsed?.includes('KHR_lights_punctual'));
assert.ok(json.buffers.every(buffer => !buffer.uri));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
gltf.scene.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(gltf.scene);
const size = bounds.getSize(new THREE.Vector3());
const near = (value, expected, label) => assert.ok(Math.abs(value - expected) < 1e-4, `${label}: ${value} !== ${expected}`);
near(bounds.min.y, 0, 'base'); near(size.x, 37, 'width'); near(size.y, 9.95, 'height');
near(size.z, 40.7, 'depth including nine-seat courtyard');
let triangles = 0, primitives = 0, signVertices = 0; const materials = new Set();
gltf.scene.traverse(object => {
  if (!object.isMesh) return;
  primitives += 1;
  triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  materials.add(object.material.name);
  assert.ok(object.material.isMeshStandardMaterial);
  assert.equal(object.material.transparent, false);
  assert.equal(object.material.side, 0);
  if (object.material.name === 'LM_Wall_Cream') {
    const positions = object.geometry.attributes.position;
    const normals = object.geometry.attributes.normal;
    for (let i = 0; i < positions.count; i += 1) {
      if (Math.abs(positions.getZ(i) - 12.50) > 1e-4) continue;
      signVertices += 1;
      assert.ok(positions.getY(i) > 3.78 && positions.getY(i) < 4.68, 'lettering within board');
      assert.ok(normals.getZ(i) > .99, 'lettering must face the service front');
    }
  }
});
assert.ok(triangles <= 12000, 'complete site triangle budget');
assert.ok(bytes.length <= 786432, 'complete site byte budget');
assert.ok(signVertices > 100, 'baked sign lettering is present');
assert.equal(primitives, 6);
assert.deepEqual([...materials].sort(), ['LM_Leaf_Green', 'LM_Metal_Dark', 'LM_Plastic_Red', 'LM_Roof_Red', 'LM_Wall_Cream', 'LM_Wood_Warm']);
const gameRoot = path.resolve(root, '../..');
const tableIds = new Set(['meja-1', 'meja-2', 'meja-3', 'meja-4', 'meja-9']);
const tables = JSON.parse(await fs.readFile(path.join(gameRoot, 'shared/tables.json'), 'utf8')).filter(t => tableIds.has(t.id));
const chairs = JSON.parse(await fs.readFile(path.join(gameRoot, 'shared/chairs.json'), 'utf8')).filter(c => tableIds.has(c.tableId));
assert.deepEqual(JSON.parse(json.nodes[0].extras.lm_tables_json), tables.map(({id,x,z}) => ({id,x,z})));
assert.deepEqual(JSON.parse(json.nodes[0].extras.lm_chairs_json), chairs.map(({id,x,z,yaw,tableId}) => ({id,x,z,yaw,tableId})));
// Raycast actual exported geometry: metadata alone cannot prove furniture alignment.
const ray = new THREE.Raycaster();
for (const chair of chairs) {
  ray.set(new THREE.Vector3(chair.x + 29, 2, chair.z - 30), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(gltf.scene, true)[0];
  assert.ok(hit, `${chair.id}: missing physical seat`);
  near(hit.point.y, .66, `${chair.id}: seat height`);
  assert.equal(hit.object.material.name, 'LM_Plastic_Red');
  ray.set(new THREE.Vector3(chair.x + 29, 1.06, chair.z - 30), new THREE.Vector3(-Math.sin(chair.yaw), 0, -Math.cos(chair.yaw)));
  const back = ray.intersectObject(gltf.scene, true)[0];
  assert.ok(back && back.distance > .27 && back.distance < .38, `${chair.id}: backrest must be behind seated avatar`);
}
for (const table of tables) {
  ray.set(new THREE.Vector3(table.x + 29, 3, table.z - 30), new THREE.Vector3(0, -1, 0));
  near(ray.intersectObject(gltf.scene, true)[0].point.y, 1.1425, `${table.id}: table top`);
}
ray.set(new THREE.Vector3(0, 7, 0), new THREE.Vector3(0, 0, 1));
assert.equal(ray.intersectObject(gltf.scene, true).filter(h => h.distance < 4.5).length, 0, 'building faces must not face inward');
const report = {
  passed: true, asset: path.basename(input), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
  triangles, primitives, signVertices, signText: json.nodes[0].extras.lm_sign_text, materials: [...materials].sort(),
  tables: tables.length, playableChairs: chairs.length, seatGeometryAndFacing: 'passed',
  bounds_three_m: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() },
  khronos: { errors: khronos.issues.numErrors, warnings: khronos.issues.numWarnings, infos: khronos.issues.numInfos },
};
await fs.writeFile(path.join(reportDir, 'three-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
