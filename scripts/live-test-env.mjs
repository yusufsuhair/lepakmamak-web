import {existsSync} from 'node:fs';
if (existsSync('.env.test.local')) process.loadEnvFile('.env.test.local');
for (const name of ['TEST_BASE_URL', 'VITE_MULTIPLAYER_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[name]) throw new Error(`Set ${name} in .env.test.local for an isolated test deployment.`);
}
export const env = process.env;
