import { defineConfig, loadEnv } from 'vite';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const buildId = randomUUID();
// scripts/cdn.mjs serves these from R2; public/ keeps the originals for the dev server only.
const cdn = JSON.parse(readFileSync(new URL('./src/cdn-manifest.json', import.meta.url), 'utf8'));
let outDir = 'dist';
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const cdnBase = env.VITE_CDN_BASE_URL?.trim();
  const endpoint = env.VITE_MULTIPLAYER_URL?.trim();
  const multiplayer = endpoint ? new URL(endpoint) : null;
  const cdnOrigin = cdnBase ? new URL(cdnBase) : null;
  if (multiplayer && (!['ws:', 'wss:'].includes(multiplayer.protocol) || multiplayer.username || multiplayer.password)) throw new Error('VITE_MULTIPLAYER_URL must be a ws:// or wss:// URL without credentials.');
  if (cdnOrigin && (!['http:', 'https:'].includes(cdnOrigin.protocol) || cdnOrigin.username || cdnOrigin.password || cdnOrigin.search || cdnOrigin.hash)) throw new Error('VITE_CDN_BASE_URL must be an HTTP(S) URL without credentials, query or fragment.');
  return ({
  // The fleet review page is available on dev for phone-based visual review.
  build: mode === 'dev' ? {rolldownOptions: {input: {main: 'index.html', vehicles: 'vehicles-preview.html'}}} : undefined,
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [{
    name: 'release-manifest',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({
        buildId,
        minClientVersion: process.env.MIN_CLIENT_VERSION || '0.0.0',
        assets: cdn.version,
      }) });
    },
    closeBundle() {
      if (cdnBase) for (const file of Object.keys(cdn.files)) rmSync(resolve(outDir, file), { force: true });
      const headers = readFileSync('public/_headers', 'utf8')
        .replaceAll('__CDN_ORIGIN__', cdnOrigin?.origin || '')
        .replace('__MULTIPLAYER_ORIGINS__', multiplayer ? `${multiplayer.origin} ${multiplayer.origin.replace(/^ws/, 'http')}` : '');
      writeFileSync(resolve(outDir, '_headers'), headers);
    },
  }],
});
});
