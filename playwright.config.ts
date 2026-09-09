import { defineConfig } from '@playwright/test';
// Worktrees share this machine, so a sibling checkout's dev server can be sitting on the
// default port. PLAYWRIGHT_PORT gives a run its own server, and its own source, to test.
const port = Number(process.env.PLAYWRIGHT_PORT || 5173);
export default defineConfig({
  // These specs drive a whole 3D city through a dev server that transforms every module on
  // demand; 90 seconds was not enough for the journey tests on a loaded machine.
  testDir: './tests', timeout: Number(process.env.PLAYWRIGHT_TIMEOUT || 180000), fullyParallel: false, workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'chrome', headless: true, viewport: { width: 1280, height: 800 }, trace: 'retain-on-failure' },
  webServer: { command: `npm run dev -- --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: true },
});
