import { defineConfig } from '@playwright/test';
// Worktrees share this machine, so a sibling checkout's dev server can be sitting on the
// default port. PLAYWRIGHT_PORT gives a run its own server, and its own source, to test.
const port = Number(process.env.PLAYWRIGHT_PORT || 5173);
export default defineConfig({
  testDir: './tests', timeout: 90000, fullyParallel: false, workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'chrome', headless: true, viewport: { width: 1280, height: 800 }, trace: 'retain-on-failure' },
  webServer: { command: `npm run dev -- --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: true },
});
