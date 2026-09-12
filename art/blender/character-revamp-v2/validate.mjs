import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve('art/blender/tools/package.json'));
const {validateBytes}=require('gltf-validator');
const root=resolve('art/blender/generated/character-revamp-v2');const results=[];
for(const folder of ['exports'])for(const file of readdirSync(`${root}/${folder}`).filter(x=>x.endsWith('.glb'))){
 const bytes=readFileSync(`${root}/${folder}/${file}`);const d=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));const result=await validateBytes(new Uint8Array(bytes),{uri:file});
 const triangles=(d.meshes||[]).reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+(p.indices!==undefined?d.accessors[p.indices].count:d.accessors[p.attributes.POSITION].count)/3,0),0);
 results.push({file:`${folder}/${file}`,bytes:bytes.length,triangles,meshes:d.meshes?.length||0,materials:d.materials?.length||0,errors:result.issues.numErrors,warnings:result.issues.numWarnings,messages:result.issues.messages});
}
writeFileSync(`${root}/validation.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results.filter(x=>x.file.startsWith('exports/')).map(({messages,...x})=>x),null,2));
if(results.some(x=>x.errors))process.exitCode=1;
