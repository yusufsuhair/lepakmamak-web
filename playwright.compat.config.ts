import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests', testMatch: ['compat.spec.ts', 'table-social.spec.ts', 'profiles.spec.ts', 'stalls.spec.ts'], timeout: 60000, workers: 1,
 use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
 projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName: browserName as 'chromium'|'firefox'|'webkit', ...(browserName === 'chromium' ? { channel: 'chrome' } : {}) } })),
 webServer: { command: 'npm run dev -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
