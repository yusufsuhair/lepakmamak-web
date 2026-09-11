import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import validator from 'gltf-validator';

const root=path.resolve(import.meta.dirname,'../../..');
const input=path.resolve(process.argv[2]??path.join(root,'assets/mamak-facade/v1/LM_ENV_MamakFacade.glb'));
const bytes=await fs.readFile(input);
const report=await validator.validateBytes(new Uint8Array(bytes),{uri:path.basename(input),maxIssues:1000});
assert.equal(report.issues.numErrors,0);assert.equal(report.issues.numWarnings,0);
assert.ok(bytes.length<700000);
const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
assert.equal(doc.nodes.length,5);assert.equal(doc.meshes.length,5);assert.equal(doc.materials.length,4);
assert.equal(doc.images?.length??0,0);assert.equal(doc.animations?.length??0,0);
assert.ok(!doc.extensionsUsed?.includes('KHR_lights_punctual'));
for(const node of doc.nodes){
  assert.match(node.name,/^LM_ENV_MamakFacade_/);
  assert.deepEqual(node.extras.lm_origin_world,[-29,3.555,30]);
  assert.equal(node.extras.lm_version,1);
}
let triangles=0;
for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
  triangles+=doc.accessors[primitive.indices].count/3;
  assert.ok(doc.accessors[primitive.attributes.POSITION].min[1]>-.0001);
}
assert.ok(triangles<=12000);
const result={passed:true,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,
  triangles,draws:5,textures:0,khronos:report.issues};
await fs.writeFile(path.join(path.dirname(input),'gltf-validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
