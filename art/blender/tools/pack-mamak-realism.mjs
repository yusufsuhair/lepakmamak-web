/** Khronos validation followed by lossless meshopt with independent decode verification. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import validator from 'gltf-validator';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
const root=new URL('../../../',import.meta.url);
const file=new URL('public/assets/models/environment/LM_ENV_MamakMaju_Realism.glb',root);
const raw=await fs.readFile(file),jsonSize=raw.readUInt32LE(12);
const doc=JSON.parse(raw.subarray(20,20+jsonSize));
assert.ok(!doc.extensionsRequired?.includes('EXT_meshopt_compression'),'Re-export the source before packing');
const report=await validator.validateBytes(new Uint8Array(raw),{uri:'LM_ENV_MamakMaju_Realism.glb'});
await fs.writeFile(new URL('assets/mamak-realism/reports/gltf-validation.json',root),JSON.stringify(report,null,2)+'\n');
assert.equal(report.issues.numErrors,0);assert.equal(report.issues.numWarnings,0);
const triangles=doc.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+doc.accessors[p.indices].count/3,0);
const draws=doc.meshes.reduce((sum,m)=>sum+m.primitives.length,0);
assert.ok(triangles<250000,`${triangles} triangles`);assert.ok(draws<=24,`${draws} draws`);
assert.ok(doc.nodes.some(n=>n.name==='LM_ENV_MamakMaju_Festoon'));
assert.ok(doc.nodes.some(n=>n.extras?.lm_realism_version===2));
const site=doc.nodes.find(n=>n.name==='LM_ENV_MamakMaju');
assert.ok(doc.meshes[site.mesh].primitives.every(p=>p.attributes.COLOR_0!==undefined),'Portable baked AO must survive export');
assert.ok(doc.images.length>=6);assert.ok(doc.images.every(i=>i.bufferView!==undefined&&!i.uri));
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const bin=raw.subarray(28+jsonSize),pieces=[];let offset=0,fallbackOffset=0,streams=0;
const append=data=>{const start=offset;pieces.push(Buffer.from(data));offset+=data.length;const pad=(4-offset%4)%4;if(pad){pieces.push(Buffer.alloc(pad));offset+=pad;}return start;};
const widths={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
for(let i=0;i<doc.bufferViews.length;i++){
  const v=doc.bufferViews[i],source=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
  const a=doc.accessors.find(a=>a.bufferView===i);
  if(!a||![34962,34963].includes(v.target)){v.buffer=0;v.byteOffset=append(source);continue;}
  const stride=v.byteStride??widths[a.componentType]*components[a.type],count=v.byteLength/stride,mode=v.target===34963?'INDICES':'ATTRIBUTES';
  assert.ok(Number.isInteger(count));
  const compressed=MeshoptEncoder.encodeGltfBuffer(source,count,stride,mode,0),decoded=new Uint8Array(source.length);
  MeshoptDecoder.decodeGltfBuffer(decoded,count,stride,compressed,mode);assert.ok(source.equals(Buffer.from(decoded)),`Stream ${i}`);
  v.extensions={EXT_meshopt_compression:{buffer:0,byteOffset:append(compressed),byteLength:compressed.length,byteStride:stride,count,mode,filter:'NONE'}};
  v.buffer=1;v.byteOffset=fallbackOffset;fallbackOffset=(fallbackOffset+v.byteLength+3)&~3;streams++;
}
doc.extensionsUsed=[...new Set([...(doc.extensionsUsed||[]),'EXT_meshopt_compression'])];doc.extensionsRequired=[...(doc.extensionsRequired||[]),'EXT_meshopt_compression'];
doc.buffers=[{byteLength:offset},{byteLength:fallbackOffset,extensions:{EXT_meshopt_compression:{fallback:true}}}];
const encoded=Buffer.from(JSON.stringify(doc)),json=Buffer.concat([encoded,Buffer.alloc((4-encoded.length%4)%4,0x20)]),binary=Buffer.concat(pieces),head=Buffer.alloc(20),bh=Buffer.alloc(8);
head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+binary.length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([head,json,bh,binary]);console.log({triangles,draws,webBytes:result.length});assert.ok(result.length<7_000_000,'Web download exceeds budget');await fs.writeFile(file,result);
const budget={triangles,draws,textures:doc.images.length,rawBytes:raw.length,webBytes:result.length,streams,losslessDecode:'PASS',khronosErrors:0,khronosWarnings:0};
await fs.writeFile(new URL('assets/mamak-realism/reports/web-budget.json',root),JSON.stringify(budget,null,2)+'\n');console.log(budget);
