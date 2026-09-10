import {execFileSync} from 'node:child_process';

// Pin the development destination even on a checkout without an untracked .env.dev.
const env = {...process.env,
  VITE_MULTIPLAYER_URL: 'wss://lepak-city-realtime-dev-development.up.railway.app',
  VITE_ALLOW_GUESTS: 'true',
  VITE_DEV_TOOLS: 'true',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_PUBLISHABLE_KEY: '',
};
execFileSync('npx', ['tsc', '--noEmit'], {stdio:'inherit', env});
execFileSync('npx', ['vite', 'build', '--mode', 'dev'], {stdio:'inherit', env});
execFileSync('npx', ['wrangler', 'pages', 'deploy', 'dist', '--project-name', 'lepakmamak-dev', '--branch', 'main'], {stdio:'inherit', env});
