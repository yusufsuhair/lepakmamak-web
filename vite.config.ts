import { defineConfig } from 'vite';
import { randomUUID } from 'node:crypto';

const buildId = randomUUID();
export default defineConfig(({mode}) => ({
  // The fleet review page is available on dev for phone-based visual review.
  build: mode === 'dev' ? {rolldownOptions: {input: {main: 'index.html', vehicles: 'vehicles-preview.html'}}} : undefined,
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [{
    name: 'release-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({
        buildId,
        minClientVersion: process.env.MIN_CLIENT_VERSION || '0.0.0',
      }) });
    },
  }],
}));
