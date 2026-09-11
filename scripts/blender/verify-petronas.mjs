/** Validate the Blender export before meshopt compression. */
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../art/blender/tools/package.json',import.meta.url));
const validator=require('gltf-validator');
const file=new URL('../../public/assets/models/environment/LM_ENV_Petronas.glb',import.meta.url);
const bytes=await fs.readFile(file);
const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
if(doc.extensionsRequired?.includes('EXT_meshopt_compression'))throw new Error('Validate the raw Blender export before compression.');
const report=await validator.validateBytes(new Uint8Array(bytes),{uri:'public/assets/models/environment/LM_ENV_Petronas.glb'});
await fs.writeFile(new URL('../../assets/petronas/gltf-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(report.issues);
if(report.issues.numErrors||report.issues.numWarnings)process.exitCode=1;
