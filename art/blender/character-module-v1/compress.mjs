/** Compression pass for the character exports, run after build.py.
 *
 * build.py records each asset's size at export time, which is before compression, so the
 * manifest would otherwise report bytes the game never transfers. This applies the shared
 * lossless EXT_meshopt_compression path to all 38 GLBs and then refreshes the manifest to
 * the sizes that actually ship. Safe to re-run: compress-glb.mjs skips a compressed file.
 *
 * usage: node art/blender/character-module-v1/compress.mjs
 */
import {readdirSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const root = 'public/assets/models/characters';
const manifestPath = `${root}/manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

for (const file of readdirSync(root).filter(name => name.endsWith('.glb')).sort()) {
  console.log(execFileSync('node', ['scripts/blender/compress-glb.mjs', `${root}/${file}`], {encoding: 'utf8'}).trim());
}
for (const [key, asset] of Object.entries(manifest.assets)) asset.bytes = statSync(`${root}/${asset.file}`).size;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({assets: Object.keys(manifest.assets).length,
  totalBytes: Object.values(manifest.assets).reduce((n, a) => n + a.bytes, 0)}));
