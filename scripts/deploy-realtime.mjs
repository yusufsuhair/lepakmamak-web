import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';

import './deploy-env.mjs';

// Ship committed main from a clean temporary checkout, never an accidental worktree.
const dev = process.argv.includes('--dev');
const target = {
  project: process.env.RAILWAY_PROJECT_ID,
  service: process.env[dev ? 'RAILWAY_DEV_SERVICE_ID' : 'RAILWAY_SERVICE_ID'],
  environment: process.env[dev ? 'RAILWAY_DEV_ENVIRONMENT' : 'RAILWAY_ENVIRONMENT'] || (dev ? 'development' : 'production'),
  branch: 'main',
};
if (!target.project || !target.service) throw new Error('Set RAILWAY_PROJECT_ID and the target RAILWAY_SERVICE_ID / RAILWAY_DEV_SERVICE_ID in .env.deploy.local.');
// --dry-run says what would ship without shipping it, which is also how this file is tested.
const dryRun = process.argv.includes('--dry-run');
const git = (...args) => execFileSync('git', args, {encoding: 'utf8'}).trim();

const root = dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir'));
const commit = git('rev-parse', target.branch);
// From the commit, not the working file: they can differ, and the commit is what ships.
const version = JSON.parse(git('show', `${commit}:package.json`)).version;
const head = git('rev-parse', 'HEAD');

console.log(`Deploying ${target.branch} (${commit.slice(0, 8)}) to ${target.project}/${target.service}/${target.environment} — v${version}`);
if (head !== commit) {
  // Not an error: main is what production runs. But nobody should think their branch shipped.
  const unmerged = git('log', '--oneline', `${commit}..HEAD`);
  console.log(`Your HEAD is ${head.slice(0, 8)}, not main.`);
  if (unmerged) console.log(`These commits are NOT being deployed:\n${unmerged.split('\n').map(line => `  ${line}`).join('\n')}`);
}

if (dryRun) { console.log('--dry-run: nothing deployed.'); process.exit(0); }

const checkout = mkdtempSync(join(root, '.railway-deploy-'));
try {
  // Detached: main itself is checked out at the root, and a branch cannot be in two places.
  git('worktree', 'add', '--detach', checkout, commit);
  execFileSync('railway', ['up', '--project', target.project, '--service', target.service, '--environment', target.environment, '--detach', '--yes'], {cwd: checkout, stdio: 'inherit'});
} finally {
  try { git('worktree', 'remove', '--force', checkout); } catch { rmSync(checkout, {recursive: true, force: true}); }
}
