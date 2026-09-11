import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import validator from 'gltf-validator';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const root=path.resolve(process.argv[2]??'art/blender/generated/tree-revamp-v1');
const assets=[
  ['rain-tree','LM_TREE_RainTree','urban-rain-tree',500],
  ['coconut-palm','LM_TREE_CoconutPalm','tropical-coconut-palm',1800],
  ['mamak-palm','LM_PROP_PalmMamak','mamak-courtyard-palm',1800],
];
const reports=[];
for(const [directory,name,family,maxTriangles] of assets){
  const report=JSON.parse(await fs.readFile(path.join(root,directory,'reports/validation.json'),'utf8'))[name];
  assert.equal(report.passed,true);
  const file=path.join(root,directory,'exports',`${name}.glb`);
  const bytes=await fs.readFile(file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),report.glb.sha256);
  const validation=await validator.validateBytes(new Uint8Array(bytes),{uri:`${name}.glb`});
  assert.equal(validation.issues.numErrors,0,`${name}: Khronos errors`);
  assert.equal(validation.issues.numWarnings,0,`${name}: Khronos warnings`);
  const document=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.deepEqual(document.nodes.map(node=>node.name),[name]);
  assert.equal(document.nodes[0].extras.lm_foliage_version,4);
  assert.equal(document.nodes[0].extras.lm_family,family);
  for(const key of ['cameras','animations','textures','images','skins'])assert.equal(document[key]?.length??0,0);
  assert.ok(!document.extensionsUsed?.includes('KHR_lights_punctual'));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bounds=new THREE.Box3().setFromObject(gltf.scene);
  assert.ok(Math.abs(bounds.min.y)<1e-5,`${name}: base must rest at zero`);
  let triangles=0,draws=0;
  gltf.scene.traverse(object=>{
    if(!object.isMesh)return;
    triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
    draws++;
    assert.equal(object.material.transparent,false);
    if(object.material.name==='LM_Leaf_Green'&&name.includes('Palm'))assert.equal(object.material.side,THREE.DoubleSide);
  });
  assert.ok(triangles<=maxTriangles,`${name}: triangle budget`);
  assert.ok(draws<=3,`${name}: draw budget`);
  reports.push({name,bytes:bytes.length,triangles,draws,
    bounds_m:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    sha256:report.glb.sha256,khronos:{errors:0,warnings:0,infos:validation.issues.numInfos}});
}
await fs.writeFile(path.join(root,'validation-summary.json'),JSON.stringify({passed:true,assets:reports},null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
