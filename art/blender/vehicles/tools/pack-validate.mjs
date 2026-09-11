import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import validator from 'gltf-validator';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const source = path.resolve(process.argv[2]);
const staging = path.join(source, 'packed');
await fs.mkdir(staging, {recursive:true});
const manifest = JSON.parse(await fs.readFile(path.join(source, 'reports/manifest.json')));
assert.deepEqual(manifest.map(i=>i.style).sort(), ['axia','myvi','emas','avanza','vellfire','suv','sport','ferrari','lamborghini','model-y','cybertruck','police','f1'].sort(), 'Wait for the complete 13-model Blender build');
const results=[];
for (const item of manifest) {
  const input=path.join(source,'exports',`${item.style}.glb`), output=path.join(staging,`${item.style}.glb`);
  // Named wheel pivots stay externally animatable. Tight geometric error preserves silhouettes.
  execFileSync(process.execPath,[path.join(here,'node_modules/gltfpack/cli.js'),'-i',input,'-o',output,'-cc','-ce','ext','-kn','-km','-ke','-si','0.7','-se','0.0008','-gt']);
  const bytes=await fs.readFile(output);
  const report=await validator.validateBytes(bytes,{uri:`${item.style}.glb`,maxIssues:100});
  await fs.writeFile(path.join(source,'reports',`${item.style}-gltf.json`),JSON.stringify(report,null,2)+'\n');
  assert.equal(report.issues.numErrors,0,`${item.style}: ${JSON.stringify(report.issues.messages)}`);
  assert.equal(report.issues.numWarnings,0,`${item.style}: ${JSON.stringify(report.issues.messages)}`);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok(!gltf.cameras?.length && !gltf.animations?.length && !gltf.skins?.length);
  assert.ok(!gltf.extensionsUsed?.includes('KHR_lights_punctual'));
  assert.ok(gltf.nodes.every(n=>!/^SOURCE|PREVIEW|Key|Rim|Front$/.test(n.name||'')));
  for (const name of ['wheel_FL','wheel_FR','wheel_RL','wheel_RR']) assert.equal(gltf.nodes.filter(n=>n.name===name).length,1,`${item.style}: ${name}`);
  assert.ok(!gltf.images?.some(i=>i.uri),'Textures must be embedded');
  const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
  assert.ok(triangles<45000,`${item.style} triangle budget`);
  assert.ok(bytes.length<650000,`${item.style} transfer budget`);
  results.push({...item,sourceBytes:item.bytes,bytes:bytes.length,triangles,sha256:createHash('sha256').update(bytes).digest('hex'),errors:0,warnings:0});
}
// Copy only after the entire fleet passes validation.
const destination=path.join(root,'public/assets/models/vehicles');
await fs.mkdir(destination,{recursive:true});
for (const item of results) await fs.copyFile(path.join(staging,`${item.style}.glb`),path.join(destination,`${item.style}.glb`));
await fs.writeFile(path.join(source,'reports/runtime-manifest.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({models:results.length,bytes:results.reduce((n,i)=>n+i.bytes,0),triangles:results.reduce((n,i)=>n+i.triangles,0),results},null,2));
