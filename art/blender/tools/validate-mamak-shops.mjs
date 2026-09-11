import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import validator from 'gltf-validator';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const root = path.resolve(process.argv[2] ?? 'art/blender/generated/mamak-shops');
const shops = JSON.parse(await fs.readFile(new URL('../../../shared/mamak-shops.json',import.meta.url),'utf8'));
const profile = JSON.parse(await fs.readFile(new URL('../shop-profile.json',import.meta.url),'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(root,'reports/manifest.json'),'utf8'));
const authorReport = JSON.parse(await fs.readFile(path.join(root,'reports/validation.json'),'utf8'));
assert.deepEqual(Object.keys(manifest.assets).sort(), shops.map(s => s.asset).sort());
const reports = [];
for (const shop of shops) {
  const name = shop.asset, bytes = await fs.readFile(path.join(root,'exports',`${name}.glb`));
  const source = await fs.readFile(path.join(root,'source',`${name}.blend`));
  assert.equal(createHash('sha256').update(source).digest('hex'),authorReport[name].source_sha256,`${name}: preserved source`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256,manifest.assets[name]);
  assert.ok(bytes.length <= profile.budgets.max_glb_bytes);
  const validation = await validator.validateBytes(new Uint8Array(bytes),{uri:`${name}.glb`});
  assert.equal(validation.issues.numErrors,0,name);
  assert.equal(validation.issues.numWarnings,0,name);
  const doc = JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.deepEqual(doc.nodes.map(n => n.name),[name]);
  assert.deepEqual(doc.nodes[0].extras.lm_world_position,[shop.x,0,shop.z]);
  assert.deepEqual(doc.nodes[0].extras.lm_body_size_m,[shop.width,11,shop.depth]);
  for (const key of ['cameras','animations','textures','images','skins']) assert.equal(doc[key]?.length ?? 0,0);
  assert.ok(!doc.extensionsUsed?.includes('KHR_lights_punctual'));
  assert.ok(doc.buffers.every(buffer => !buffer.uri));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  assert.ok(Math.abs(bounds.min.y) < 1e-5,`${name}: ground origin`);
  assert.ok(Math.abs(bounds.max.y-11.76) < 1e-4,`${name}: roof height`);
  assert.ok(bounds.getSize(new THREE.Vector3()).z < 15,`${name}: facade depth`);
  let primitives=0, triangles=0, signVertices=0;
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    primitives++;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count)/3;
    assert.ok(object.material.isMeshStandardMaterial);
    assert.equal(object.material.side,THREE.FrontSide);
    assert.equal(object.material.transparent,false);
    const {position,normal,uv} = object.geometry.attributes;
    assert.ok(uv && normal);
    for (let i=0;i<position.count;i++) {
      if (object.material.name==='LM_Shop_White' && Math.abs(position.getZ(i)-6.35)<1e-4 && position.getY(i)>4.5 && position.getY(i)<5.6) {
        assert.ok(normal.getZ(i)>.99,`${name}: sign must face the street`);
        signVertices++;
      }
    }
  });
  assert.ok(signVertices>30,`${name}: baked name geometry present`);
  assert.ok(primitives<=profile.budgets.max_draw_calls && triangles<=profile.budgets.max_triangles);
  assert.ok(doc.materials.length<=profile.budgets.max_materials);
  // Test actual body surfaces, not only author-provided metadata. Decorations are below this ray height.
  for (const [origin,direction,axis,expected] of [
    [[0,10,20],[0,0,-1],'z',6],[[0,10,-20],[0,0,1],'z',-6],
    [[50,10,0],[-1,0,0],'x',shop.width/2],[[-50,10,0],[1,0,0],'x',-shop.width/2],
  ]) {
    const hit = new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction)).intersectObject(gltf.scene,true)[0];
    assert.ok(hit && Math.abs(hit.point[axis]-expected)<1e-4,`${name}: body ${axis} footprint`);
  }
  reports.push({name,bytes:bytes.length,triangles,primitives,signVertices,sha256,
    bounds_m:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    khronos:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings}});
}
await fs.writeFile(path.join(root,'reports/three-validation.json'),JSON.stringify({passed:true,assets:reports},null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
