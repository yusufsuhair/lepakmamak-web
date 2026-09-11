import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = path.resolve(process.argv[2] ?? 'art/blender/generated/street-props');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'reports/manifest.json'), 'utf8'));
const reports = [];
for (const [name, expectedHash] of Object.entries(manifest.assets)) {
  const bytes = await fs.readFile(path.join(root, 'exports', `${name}.glb`));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
  assert.ok(bytes.length <= 98304);
  const validation = await validator.validateBytes(new Uint8Array(bytes), {uri:`${name}.glb`});
  assert.equal(validation.issues.numErrors, 0, name);
  assert.equal(validation.issues.numWarnings, 0, name);
  const document = JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.deepEqual(document.nodes.map(n => n.name), [name]);
  for (const key of ['cameras','animations','textures','images','skins']) assert.equal(document[key]?.length ?? 0, 0);
  assert.ok(!document.extensionsUsed?.includes('KHR_lights_punctual'));
  assert.ok(document.buffers.every(buffer => !buffer.uri));
  if (name === 'LM_PROP_PalmMamak' || name === 'LM_PROP_PlanterMamak') {
    assert.equal(document.nodes[0].extras.lm_foliage_version, 3, `${name} foliage version`);
  }
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  assert.ok(Math.abs(bounds.min.y) < 1e-5, `${name} base must rest on zero`);
  let primitives=0, triangles=0;
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    primitives++;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count)/3;
    assert.ok(object.material.isMeshStandardMaterial);
    assert.equal(object.material.side, THREE.FrontSide);
    assert.equal(object.material.transparent, false);
  });
  assert.ok(primitives <= 3 && triangles <= 1200);
  if (name === 'LM_PROP_StreetLamp') {
    assert.deepEqual(document.nodes[0].extras.lm_head_anchor_m,[.85,5.3,0]);
    assert.ok(Math.abs(bounds.max.y-5.42) < 1e-4);
    const ray = new THREE.Raycaster(new THREE.Vector3(.85,4.5,0),new THREE.Vector3(0,1,0));
    const hit = ray.intersectObject(gltf.scene,true)[0];
    assert.equal(hit.object.material.name,'LM_Wall_Cream');
    assert.ok(Math.abs(hit.point.y-5.15)<1e-4,'diffuser matches existing bulb location');
  }
  if (name === 'LM_PROP_BenchMamak') {
    const ray = new THREE.Raycaster(new THREE.Vector3(0,2,0),new THREE.Vector3(0,-1,0));
    assert.ok(Math.abs(ray.intersectObject(gltf.scene,true)[0].point.y-.60)<1e-4);
    assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).x-2.4)<1e-4);
  }
  reports.push({name,bytes:bytes.length,triangles,primitives,sha256:expectedHash,
    bounds_m:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    khronos:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings,infos:validation.issues.numInfos}});
}
await fs.writeFile(path.join(root,'reports/three-validation.json'),JSON.stringify({passed:true,assets:reports},null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
