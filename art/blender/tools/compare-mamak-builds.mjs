import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

assert.ok(process.argv[2] && process.argv[3], 'Pass two generated Mamak directories');
const [first,second]=process.argv.slice(2,4).map(p=>path.resolve(p));
const artifacts=['exports/LM_ENV_MamakMaju.glb',
  'textures/LM_TEX_Counter_AO.png','textures/LM_TEX_Counter_Normal.png',
  ...['iso','front','right','top'].map(a=>`previews/LM_ENV_MamakMaju_${a}.png`),
  'previews/counter-close.png'];
const results=[];
for (const artifact of artifacts) {
  const hashes=await Promise.all([first,second].map(async root=>createHash('sha256').update(await fs.readFile(path.join(root,artifact))).digest('hex')));
  assert.equal(hashes[0],hashes[1],`Rebuild changed ${artifact}`);
  results.push({artifact,sha256:hashes[0],identical:true});
}
const report={passed:true,first,second,artifacts:results,
  note:'Same Blender build/config/CPU baker. Packed source .blend files are preserved but not required to be byte-identical.'};
await fs.mkdir(path.join(first,'reports'),{recursive:true});
await fs.writeFile(path.join(first,'reports/reproducibility.json'),JSON.stringify(report,null,2)+'\n');
console.log(`PASS: ${results.length} artifacts byte-identical`);
