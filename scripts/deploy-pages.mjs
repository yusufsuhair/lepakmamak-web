import './deploy-env.mjs';
import {execFileSync} from 'node:child_process';
import {readdirSync, statSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadEnv} from 'vite';

const dev = process.argv.includes('--dev'), health = process.argv.includes('--health');
const name = health ? 'CF_PAGES_HEALTH_PROJECT' : dev ? 'CF_PAGES_DEV_PROJECT' : 'CF_PAGES_PROJECT';
const project = process.env[name];
if (!project) throw new Error(`Set ${name} in .env.deploy.local.`);
const mode = dev ? 'dev' : 'production';
const env = {...process.env, ...loadEnv(mode, process.cwd(), 'VITE_')};
if (process.argv.includes('--dry-run')) {
  console.log(`Pages project: ${project}; branch: main; ${health ? 'directory: health' : `build mode: ${mode}`}`);
  process.exit(0);
}
if (health) {
  const endpoint = new URL(JSON.parse(readFileSync('health/config.json', 'utf8')).endpoint);
  if (endpoint.protocol !== 'https:') throw new Error('Set health/config.json endpoint to your HTTPS /health/public URL.');
  if (!readFileSync('health/_headers', 'utf8').split(/[;\s]+/).includes(endpoint.origin)) throw new Error('Add the health endpoint origin to connect-src in health/_headers.');
} else {
  if (env.VITE_CDN_BASE_URL) execFileSync('node', ['scripts/cdn.mjs', '--check'], {stdio: 'inherit', env});
  execFileSync('npx', ['tsc', '--noEmit'], {stdio: 'inherit', env});
  execFileSync('npx', ['vite', 'build', '--mode', mode], {stdio: 'inherit', env});
}
const directory = health ? 'health' : 'dist';
for (const file of readdirSync(directory, {recursive: true})) {
  if (statSync(join(directory, file)).size > 25 * 1024 * 1024) throw new Error(`${file} exceeds the Pages 25 MiB limit. Configure R2 first (docs/DEPLOYMENT.md).`);
}
execFileSync('npx', ['wrangler', 'pages', 'deploy', directory, '--project-name', project, '--branch', 'main'], {stdio: 'inherit', env});
