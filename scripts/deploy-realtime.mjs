import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';

// `railway up` uploads whatever directory it is run from, so a session deploying out of its
// own `claude/*` worktree ships an unmerged branch to production. Three deploys overwrote
// each other that way in one afternoon. This deploys `main`, wherever it is run from.
//
// The project, service and environment are named explicitly on every deploy. A detached
// worktree has no Railway link metadata, so relying on the caller's linked directory can create
// a new project instead of updating the intended service.
const TARGETS = {
  production: {project: '67432d9c-9c19-4b62-8d36-dfaddcc4b19c', service: '9a776d22-a5d8-4151-8059-300149fce72c', environment: 'production', branch: 'main'},
  development: {project: '67432d9c-9c19-4b62-8d36-dfaddcc4b19c', service: '877d29ba-d243-41b5-a135-2a2287e17950', environment: 'development', branch: 'main'},
};
const target = process.argv.includes('--dev') ? TARGETS.development : TARGETS.production;
// --dry-run says what would ship without shipping it, which is also how this file is tested.
const dryRun = process.argv.includes('--dry-run');
const git = (...args) => execFileSync('git', args, {encoding: 'utf8'}).trim();

const root = dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir'));
const commit = git('rev-parse', target.branch);
// From the commit, not the working file: they can differ, and the commit is what ships.
const version = JSON.parse(git('show', `${commit}:package.json`)).version;
const head = git('rev-parse', 'HEAD');

console.log(`Deploying ${target.branch} (${commit.slice(0, 8)}) to ${target.environment} — v${version}`);
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
