import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FILES,keyFor} from '../scripts/cdn.mjs';

const manifest=JSON.parse(readFileSync('src/cdn-manifest.json','utf8'));

test('every CDN asset is pinned to a key named by its current content',()=>{
  expect(Object.keys(manifest.files).sort()).toEqual([...FILES].sort());
  for(const file of FILES)expect(manifest.files[file].key,`${file} changed: run node scripts/cdn.mjs`).toBe(keyFor(file));
});

test('a production build ships no CDN asset and is pinned to the manifest version',()=>{
  const out=mkdtempSync(join(tmpdir(),'lepak-cdn-'));
  execFileSync('npx',['vite','build','--outDir',out,'--emptyOutDir','--logLevel','error']);
  for(const file of FILES)expect(existsSync(join(out,file)),file).toBe(false);
  const bundle=readdirSync(join(out,'assets')).filter(f=>f.endsWith('.js')).map(f=>readFileSync(join(out,'assets',f),'utf8')).join('');
  expect(bundle).toContain(manifest.base);
  for(const file of FILES)expect(bundle,file).toContain(manifest.files[file].key);
  expect(JSON.parse(readFileSync(join(out,'release.json'),'utf8')).assets).toBe(manifest.version);
});
