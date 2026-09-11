import { defineConfig } from 'vite';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const buildId = randomUUID();
// scripts/cdn.mjs serves these from R2; public/ keeps the originals for the dev server only.
const cdn = JSON.parse(readFileSync(new URL('./src/cdn-manifest.json', import.meta.url), 'utf8'));
let outDir = 'dist';
export default defineConfig(({mode}) => ({
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
    closeBundle() { for (const file of Object.keys(cdn.files)) rmSync(resolve(outDir, file), { force: true }); },
  }],
}));
