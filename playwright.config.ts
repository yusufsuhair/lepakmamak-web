import { defineConfig } from '@playwright/test';
// Worktrees share this machine, so a sibling checkout's dev server can be sitting on the
// default port. PLAYWRIGHT_PORT gives a run its own server, and its own source, to test.
const port = Number(process.env.PLAYWRIGHT_PORT || 5173);
export default defineConfig({
  // These specs drive a whole 3D city through a dev server that transforms every module on
  // demand; 90 seconds was not enough for the journey tests on a loaded machine.
  testDir: './tests', timeout: Number(process.env.PLAYWRIGHT_TIMEOUT || 180000), fullyParallel: false, workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'chrome', headless: true, viewport: { width: 1280, height: 800 }, trace: 'retain-on-failure',
    // Every spec starts with a clean profile, so the one-time Cara main card would open as a modal
    // on each entry and swallow clicks. Mark it seen on this server and on the Vite ports specs spawn
    // for themselves (browser.newContext inherits this too). 5183 is left out: tests/onboarding.spec.ts
    // asserts the card there.
    // ponytail: a fixed port list; a spec that spawns Vite outside 5173–5199 sees the card, extend the range.
    storageState: { cookies: [], origins: [...new Set([port, ...Array.from({ length: 27 }, (_, i) => 5173 + i)])].filter(p => p !== 5183)
      .map(p => ({ origin: `http://127.0.0.1:${p}`, localStorage: [{ name: 'lepakmamak-onboarded', value: '1' }] })) } },
  // The browser specs that fake a server with routeWebSocket need the client to actually
  // open a socket, and it only does that when VITE_MULTIPLAYER_URL is set at build time.
  // Without this the suite depended on an untracked .env.development.local, and six specs
  // failed on any machine that did not happen to have one. Nothing listens on this port —
  // routeWebSocket intercepts before it is dialled. Supabase is deliberately left unset, so
  // guests keep saving locally and account-only paths stay account-only.
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    // Blanked explicitly, not merely left out: an untracked .env.development.local is loaded
    // by vite whatever process.env says, and with it the client believes it has an account
    // backend. Guest-only paths (sitting on a chair offline, saving looks locally) then take
    // the account branch and quietly do nothing, which is how sitting went red on the machine
    // that had the file and stayed green on the one that did not.
    env: {...process.env, VITE_MULTIPLAYER_URL: 'ws://127.0.0.1:8199', VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: ''} as Record<string, string>,
  },
});
