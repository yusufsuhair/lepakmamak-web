import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
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
  execFileSync('npx',['vite','build','--outDir',out,'--emptyOutDir','--logLevel','error'], {env: {...process.env, VITE_CDN_BASE_URL:'https://assets.example.com/', VITE_MULTIPLAYER_URL:'wss://city.example.com/ws', VITE_SUPABASE_URL:'', VITE_SUPABASE_PUBLISHABLE_KEY:''}});
  for(const file of FILES)expect(existsSync(join(out,file)),file).toBe(false);
  const bundle=readdirSync(join(out,'assets')).filter(f=>f.endsWith('.js')).map(f=>readFileSync(join(out,'assets',f),'utf8')).join('');
  expect(bundle).toContain('https://assets.example.com/');
  const headers=readFileSync(join(out,'_headers'),'utf8');
  expect(headers).toContain('wss://city.example.com https://city.example.com');
  expect(headers).toContain('https://assets.example.com');
  expect(headers).not.toContain('__CDN_ORIGIN__');
  expect(headers).not.toContain('lepakmamak.my');
  for(const file of FILES)expect(bundle,file).toContain(manifest.files[file].key);
  expect(JSON.parse(readFileSync(join(out,'release.json'),'utf8')).assets).toBe(manifest.version);
  rmSync(out,{recursive:true,force:true});
});

test('a build with no CDN keeps local assets and does not contact the original deployment',()=>{
  const out=mkdtempSync(join(tmpdir(),'lepak-local-assets-'));
  try {
    execFileSync('npx',['vite','build','--outDir',out,'--emptyOutDir','--logLevel','error'], {env: {...process.env, VITE_CDN_BASE_URL:'', VITE_MULTIPLAYER_URL:'', VITE_SUPABASE_URL:'', VITE_SUPABASE_PUBLISHABLE_KEY:''}});
    for(const file of FILES)expect(existsSync(join(out,file)),file).toBe(true);
    const headers=readFileSync(join(out,'_headers'),'utf8');
    expect(headers).not.toContain('__MULTIPLAYER_ORIGINS__');
    expect(headers).not.toContain('lepakmamak.my');
    expect(headers).not.toContain('up.railway.app');
  } finally { rmSync(out,{recursive:true,force:true}); }
});
