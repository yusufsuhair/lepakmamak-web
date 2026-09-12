import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const {validateBytes}=createRequire(resolve('art/blender/tools/package.json'))('gltf-validator');
const root=resolve('public/assets/models/characters');
const catalog=JSON.parse(readFileSync('shared/character-styles.json'));const manifest=JSON.parse(readFileSync(`${root}/manifest.json`));
const keys=['base-male','base-female',...catalog.styles.map(s=>`${s.kind}-${s.id}`)];
assert.equal(new Set(keys).size,38);assert.deepEqual(Object.keys(manifest.assets).sort(),keys.sort());
const reports=[];const seen=new Map();
for(const key of keys){
 const bytes=readFileSync(`${root}/${key}.glb`);const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));const result=await validateBytes(new Uint8Array(bytes),{uri:key+'.glb'});
 assert.equal(result.issues.numErrors,0,key);assert.equal(result.issues.numWarnings,0,key);
 assert.ok(manifest.assets[key].triangles<=(key.startsWith('base-')?12000:2400),key+' triangles');
 assert.ok(bytes.length<=(key.startsWith('base-')?350000:85000),key+' transfer');
 assert.ok(!doc.buffers.some(b=>b.uri));
 const positions=(doc.meshes||[]).flatMap(m=>m.primitives.map(p=>doc.accessors[p.attributes.POSITION]));
 for(const a of positions)assert.ok([...a.min,...a.max].every(Number.isFinite));
 if(!key.startsWith('base-')){
  assert.ok(existsSync(`public/assets/characters/thumbs/${key}.png`),key+' thumbnail');
  // Compare geometry buffers, not filenames, to catch accidentally duplicated style exports.
  const jsonEnd=20+bytes.readUInt32LE(12);const hash=createHash('sha256').update(bytes.subarray(jsonEnd+8)).digest('hex');
  assert.ok(!seen.has(hash),`${key} duplicates ${seen.get(hash)}`);seen.set(hash,key);
 }
 reports.push({key,...manifest.assets[key],errors:result.issues.numErrors,warnings:result.issues.numWarnings});
}
writeFileSync('art/blender/generated/character-module-v1/validation.json',JSON.stringify(reports,null,2));
console.log(JSON.stringify({assets:reports.length,bytes:reports.reduce((n,r)=>n+r.bytes,0),maxBaseTriangles:Math.max(...reports.filter(r=>r.key.startsWith('base-')).map(r=>r.triangles)),maxStyleTriangles:Math.max(...reports.filter(r=>!r.key.startsWith('base-')).map(r=>r.triangles)),errors:0,warnings:0},null,2));
