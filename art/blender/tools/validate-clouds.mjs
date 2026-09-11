import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import validator from 'gltf-validator';
const root=path.resolve(process.argv[2]??'art/blender/generated/clouds-v1');
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await fs.readFile(path.join(root,'exports/LM_SKY_Cumulus.glb'));
const result=await validator.validateBytes(new Uint8Array(bytes));
assert.equal(result.issues.numErrors,0);assert.equal(result.issues.numWarnings,0);
const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
assert.deepEqual(doc.nodes.map(n=>n.name),['LM_SKY_Cumulus']);
assert.equal(doc.meshes.length,1);assert.equal(doc.materials.length,1);
assert.ok(!doc.images && !doc.cameras && !doc.animations && !doc.skins);
assert.equal(doc.meshes[0].primitives.length,1);
const primitive=doc.meshes[0].primitives[0];
assert.ok(primitive.attributes.NORMAL!==undefined);
const triangles=doc.accessors[primitive.indices].count/3;
assert.ok(triangles<=1500);assert.ok(bytes.length<=131072);
const png=await fs.readFile(path.join(root,'textures/LM_SKY_Cumulus.png'));
assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),256);assert.equal(png[25],6);
assert.ok(png.length<200000,'cloud atlas download budget');
const manifest=JSON.parse(await fs.readFile(path.join(root,'reports/manifest.json')));
assert.equal(manifest.card_sha256,hash(png));assert.equal(manifest.glb_sha256,hash(bytes));
assert.equal(manifest.source_sha256,hash(await fs.readFile(path.join(root,'source/LM_SKY_Cumulus.blend'))));
const report={passed:true,proxy:{bytes:bytes.length,triangles},atlas:{bytes:png.length,width:512,height:256,rgba:true},
  khronos:result.issues,reproducibility:[]};
if(process.argv[3]) {
  for(const relative of ['exports/LM_SKY_Cumulus.glb','textures/LM_SKY_Cumulus.png',
    ...['iso','front','right','top'].map(a=>`previews/LM_SKY_Cumulus_${a}.png`)]) {
    const first=hash(await fs.readFile(path.join(root,relative))),second=hash(await fs.readFile(path.join(process.argv[3],relative)));
    assert.equal(first,second,relative);report.reproducibility.push({file:relative,sha256:first,identical:true});
  }
}
await fs.writeFile(path.join(root,'reports/cloud-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
