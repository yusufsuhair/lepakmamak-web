import { defineConfig } from 'vite';
import { randomUUID } from 'node:crypto';

const buildId = randomUUID();
export default defineConfig({
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
});
