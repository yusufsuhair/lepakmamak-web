import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 90000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'chrome', headless: true, viewport: { width: 1280, height: 800 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
