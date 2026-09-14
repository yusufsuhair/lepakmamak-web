// Release assets too heavy for Pages are served from R2 at https://assets.lepakmamak.my.
// Every key carries a hash of its content, so a key is written once and a released URL never
// changes under an old client. Nothing here overwrites or deletes an object: rollback is just
// an older build, whose manifest still names objects that are still there.
// Sources stay in public/ so the dev server keeps serving them; vite.config.ts strips them
// from dist and src/cdn.ts resolves them through src/cdn-manifest.json.
//
//   node scripts/cdn.mjs          upload what is missing, verify everything, rewrite the manifest
//   node scripts/cdn.mjs --check  verify only; every deploy script runs this before touching Pages
//
// Bucket CORS is scripts/cdn-cors.json:
//   npx wrangler r2 bucket cors set lepakmamak-assets --file scripts/cdn-cors.json
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, extname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {brotliCompressSync, constants} from 'node:zlib';

const BUCKET = 'lepakmamak-assets', BASE = 'https://assets.lepakmamak.my/', ORIGIN = 'https://dev.lepakmamak.my';
const CACHE = 'public, max-age=31536000, immutable', MANIFEST = 'src/cdn-manifest.json';
const TYPES = {'.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary'};
const FOLDERS = {'.mp3': 'audio', '.glb': 'models'};
// Stored pre-compressed: meshopt geometry roughly halves again under brotli, and the edge does
// not compress model/gltf-binary on its own. Audio is already entropy-coded.
const ENCODINGS = {'.glb': 'br'};
/** Paths under public/. Only assets the game still loads belong here. */
export const FILES = ['busking.mp3', 'arrahman.mp3', 'background-short.mp3', 'lofi1.mp3', 'lofi2.mp3',
  'assets/models/environment/LM_ENV_MamakMaju_Realism.glb', 'assets/models/environment/LM_ENV_Petronas.glb', 'assets/models/environment/LM_ENV_Rembayung.glb',
  'assets/models/environment/LM_ENV_Beach.glb', 'assets/models/environment/LM_ENV_KLCC.glb',
  'assets/models/environment/LM_ENV_Masjid.glb', 'assets/models/environment/LM_ENV_Furniture.glb',
  'assets/models/environment/LM_ENV_Shoplots.glb'];

const md5 = body => createHash('md5').update(body).digest('hex');
const sha256 = body => createHash('sha256').update(body).digest('hex');

/** Immutable object key for a source file: its content and stored encoding decide the name. */
export function keyFor(file) {
  const ext = extname(file), hash = createHash('sha256').update(readFileSync(join('public', file))).update(ENCODINGS[ext] ?? '').digest('hex');
  return `${FOLDERS[ext]}/${basename(file, ext)}.${hash.slice(0, 12)}${ext}`;
}

function bodyFor(file) {
  const source = readFileSync(join('public', file));
  return ENCODINGS[extname(file)] === 'br' ? brotliCompressSync(source, {params: {[constants.BROTLI_PARAM_QUALITY]: 11}}) : source;
}

// A fresh query string skips the edge cache, so this reads what R2 actually holds.
const head = key => fetch(`${BASE}${key}?verify=${Date.now()}`, {method: 'HEAD', headers: {Origin: ORIGIN, 'Accept-Encoding': 'br, gzip'}});

/** Everything a browser relies on: bytes, MIME, immutable caching, CORS, and ranges for audio. */
async function verify(file, entry) {
  const ext = extname(file), problems = [], res = await head(entry.key);
  const want = {status: 200, etag: entry.etag, 'content-type': TYPES[ext], 'cache-control': CACHE,
    'content-encoding': entry.encoding ?? null, 'access-control-allow-origin': ORIGIN};
  const got = {status: res.status, etag: res.headers.get('etag')?.replace(/^W\/|"/g, '') ?? null};
  for (const name of ['content-type', 'cache-control', 'content-encoding', 'access-control-allow-origin']) got[name] = res.headers.get(name);
  for (const [name, value] of Object.entries(want)) if (got[name] !== value) problems.push(`${name} is ${got[name]}, want ${value}`);
  if (!entry.encoding) {
    // The public URL, exactly as a player's <audio> asks for it, possibly from the edge cache.
    const range = await fetch(BASE + entry.key, {headers: {Origin: ORIGIN, Range: 'bytes=0-1'}});
    await range.arrayBuffer();
    if (range.status !== 206 || range.headers.get('content-range') !== `bytes 0-1/${entry.bytes}`) problems.push(`range answered ${range.status} ${range.headers.get('content-range')}`);
    if (range.headers.get('access-control-allow-origin') !== ORIGIN) problems.push(`cached CORS is ${range.headers.get('access-control-allow-origin')}`);
  } else {
    // What a browser gets at the public URL must decode to exactly the public/ original.
    const res = await fetch(BASE + entry.key, {headers: {Origin: ORIGIN}}), decoded = Buffer.from(await res.arrayBuffer());
    if (sha256(decoded) !== sha256(readFileSync(join('public', file)))) problems.push(`decoded ${decoded.length} bytes differ from public/${file}`);
    if (res.headers.get('access-control-allow-origin') !== ORIGIN) problems.push(`cached CORS is ${res.headers.get('access-control-allow-origin')}`);
  }
  return problems;
}

async function main() {
  const check = process.argv.includes('--check');
  const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {files: {}};
  const files = {};
  let failed = false;
  for (const file of FILES) {
    const key = keyFor(file), encoding = ENCODINGS[extname(file)];
    let entry = old.files[file]?.key === key ? old.files[file] : undefined;
    if (!entry) {
      if (check) { console.error(`✗ ${file}: public/ no longer matches the manifest — run node scripts/cdn.mjs`); failed = true; continue; }
      const res = await head(key);
      if (res.status === 200) {
        // Same key means same source; adopt what is there rather than overwrite it.
        entry = {key, bytes: Number(res.headers.get('content-length')), etag: res.headers.get('etag').replace(/^W\/|"/g, '')};
      } else if (res.status === 404) {
        const body = bodyFor(file), path = join(mkdtempSync(join(tmpdir(), 'cdn-')), basename(key));
        writeFileSync(path, body);
        execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', path, '--remote',
          '--content-type', TYPES[extname(file)], '--cache-control', CACHE, ...(encoding ? ['--content-encoding', encoding] : [])], {stdio: 'inherit'});
        entry = {key, bytes: body.length, etag: md5(body)};
      } else throw new Error(`${file}: probing ${key} answered ${res.status}`);
      if (encoding) entry.encoding = encoding;
    }
    const problems = await verify(file, entry);
    console.log(problems.length ? `✗ ${file} → ${entry.key}\n    ${problems.join('\n    ')}` : `✓ ${file} → ${entry.key}`);
    failed ||= problems.length > 0;
    files[file] = entry;
  }
  if (failed) process.exit(1);
  if (!check) {
    const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
    writeFileSync(MANIFEST, JSON.stringify({base: BASE, version, files}, null, 2) + '\n');
    console.log(`manifest ${version} written to ${MANIFEST}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
