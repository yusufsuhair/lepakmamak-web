import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = JSON.parse(await fs.readFile(path.join(root, 'mamak-profile.json'), 'utf8'));
const input = path.resolve(process.argv[2] ?? path.join(root, 'generated/mamak-maju-v7/exports/LM_ENV_MamakMaju.glb'));
const bytes = await fs.readFile(input);
const reportDir = path.resolve(process.argv[3] ?? path.join(root, 'generated/mamak-maju-v7/reports'));
await fs.mkdir(reportDir, { recursive: true });
const khronos = await validator.validateBytes(new Uint8Array(bytes), { uri: path.basename(input), maxIssues: 1000 });
await fs.writeFile(path.join(reportDir, 'gltf-validator.json'), JSON.stringify(khronos, null, 2) + '\n');
assert.equal(khronos.issues.numErrors, 0);
assert.equal(khronos.issues.numWarnings, 0);
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
assert.deepEqual(json.nodes.map(node => node.name).sort(), ['LM_ENV_MamakMaju', 'LM_ENV_MamakMaju_Counter', 'LM_ENV_MamakMaju_Festoon']);
assert.equal(json.nodes[0].extras.lm_sign_text, 'MAMAK MAJU');
assert.equal(json.nodes[0].extras.lm_version, profile.version);
for (const field of ['cameras', 'animations', 'skins']) assert.equal(json[field]?.length ?? 0, 0, field);
assert.ok(!json.extensionsUsed?.includes('KHR_lights_punctual'));
assert.ok(json.buffers.every(buffer => !buffer.uri));
assert.equal(json.images.length, 2);
assert.equal(json.textures.length, 2);
const counterMaterial = json.materials.find(m => m.name === profile.counter_material);
assert.ok(counterMaterial.normalTexture && counterMaterial.occlusionTexture);
assert.ok(!counterMaterial.pbrMetallicRoughness.baseColorTexture, 'no baked direct lighting in base colour');
assert.ok(!counterMaterial.emissiveTexture && !counterMaterial.emissiveFactor, 'steel must not glow at night');
const binStart = 20 + bytes.readUInt32LE(12) + 8;
const textureReport = json.images.map(image => {
  assert.equal(image.mimeType, 'image/png');
  assert.ok(!image.uri);
  const view = json.bufferViews[image.bufferView];
  const png = bytes.subarray(binStart + (view.byteOffset ?? 0), binStart + (view.byteOffset ?? 0) + view.byteLength);
  assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), profile.bake.resolution);
  assert.equal(png.readUInt32BE(20), profile.bake.resolution);
  return {name:image.name,width:png.readUInt32BE(16),height:png.readUInt32BE(20),bytes:png.length};
});
// Node lacks a browser image decoder. Inspect real texture wiring above, then raycast
// the unchanged geometry through GLTFLoader; browser validation decodes the actual GLB.
const geometryDocument = structuredClone(json);
delete geometryDocument.images; delete geometryDocument.textures; delete geometryDocument.samplers;
for (const material of geometryDocument.materials) { delete material.normalTexture; delete material.occlusionTexture; }
const geometryJson = Buffer.from(JSON.stringify(geometryDocument));
const jsonPadding = Buffer.alloc((4 - geometryJson.length % 4) % 4, 0x20);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(geometryJson.length + jsonPadding.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const geometryBytes = Buffer.concat([bytes.subarray(0,12),jsonHeader,geometryJson,jsonPadding,bytes.subarray(binStart-8)]);
geometryBytes.writeUInt32LE(geometryBytes.length,8);
const gltf = await new GLTFLoader().parseAsync(geometryBytes.buffer.slice(geometryBytes.byteOffset,geometryBytes.byteOffset+geometryBytes.byteLength), '');
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
  if (object.material.name !== profile.counter_material && profile.version >= 7) {
    const colors=object.geometry.attributes.color;
    assert.ok(colors, 'portable baked vertex occlusion must survive GLB');
    assert.ok(object.material.vertexColors, 'Three.js must use baked vertex colours');
    assert.ok(object.material.color.r < .999, 'authored palette factor must survive vertex-colour export');
    for(let i=0;i<colors.count;i++) for(const value of [colors.getX(i),colors.getY(i),colors.getZ(i)])
      assert.ok(Number.isFinite(value) && value >= .579 && value <= 1.001,'bounded linear vertex AO');
  }
  if (object.material.name === profile.counter_material) {
    assert.ok(object.geometry.attributes.tangent, 'baked tangent basis must survive export');
    const uv=object.geometry.attributes.uv;
    for (let i=0;i<uv.count;i++) assert.ok(uv.getX(i)>=0 && uv.getX(i)<=1 && uv.getY(i)>=0 && uv.getY(i)<=1, 'counter UVs must fit atlas');
  }
  if (object.material.name === 'LM_Wall_Cream') {
    const positions = object.geometry.attributes.position;
    const normals = object.geometry.attributes.normal;
    for (let i = 0; i < positions.count; i += 1) {
      if (Math.abs(positions.getZ(i) - 12.50) > 1e-4 || positions.getY(i) < 3) continue;
      signVertices += 1;
      assert.ok(positions.getY(i) > 3.78 && positions.getY(i) < 4.68, 'lettering within board');
      assert.ok(normals.getZ(i) > .99, 'lettering must face the service front');
    }
  }
});
assert.ok(triangles <= profile.budgets.max_triangles, 'complete site triangle budget');
assert.ok(bytes.length <= profile.budgets.max_glb_bytes, 'complete site byte budget');
assert.ok(signVertices > 100, 'baked sign lettering is present');
assert.equal(primitives, 9);
assert.deepEqual([...materials].sort(), ['LM_Counter_Steel', 'LM_Leaf_Green', 'LM_Metal_Dark', 'LM_Plastic_Red', 'LM_Roof_Red', 'LM_Wall_Cream', 'LM_Wood_Warm']);
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
if(profile.version>=7){
  const tabletop=JSON.parse(await fs.readFile(path.join(gameRoot,'shared/mamak-tabletop.json'),'utf8'));
  for(const table of tables)for(const [dx,dz] of tabletop.cups){
    const yaw=tabletop.rotations[table.id];
    ray.set(new THREE.Vector3(table.x+29+dx*Math.cos(yaw)+dz*Math.sin(yaw),tabletop.steamHeight,table.z-30-dx*Math.sin(yaw)+dz*Math.cos(yaw)),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(gltf.scene,true)[0];
    assert.ok(hit,`${table.id}: steam must originate over an exported drink`);
    near(hit.point.y,1.421,`${table.id}: exported tea surface under steam`);
    assert.equal(hit.object.material.name,'LM_Wood_Warm');
  }
}
ray.set(new THREE.Vector3(0, 7, 0), new THREE.Vector3(0, 0, 1));
assert.equal(ray.intersectObject(gltf.scene, true).filter(h => h.distance < 4.5).length, 0, 'building faces must not face inward');
const report = {
  passed: true, asset: path.basename(input), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
  triangles, primitives, signVertices, signText: json.nodes[0].extras.lm_sign_text, materials: [...materials].sort(),
  tables: tables.length, playableChairs: chairs.length, seatGeometryAndFacing: 'passed',
  bounds_three_m: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() },
  khronos: { errors: khronos.issues.numErrors, warnings: khronos.issues.numWarnings, infos: khronos.issues.numInfos },
  textures: textureReport, textureDecoding: 'separate browser check required',
};
await fs.writeFile(path.join(reportDir, 'three-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
