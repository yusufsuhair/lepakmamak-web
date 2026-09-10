import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';

// `railway up` uploads whatever directory it is run from, so a session deploying out of its
// own `claude/*` worktree ships an unmerged branch to production. Three deploys overwrote
// each other that way in one afternoon. This deploys `main`, wherever it is run from.
//
// The checkout has to live inside the repository root: the Railway CLI finds its project by
// walking up parent directories, and a temp directory anywhere else is not linked to one.
const SERVICE = '9a776d22-a5d8-4151-8059-300149fce72c';
// --dry-run says what would ship without shipping it, which is also how this file is tested.
const dryRun = process.argv.includes('--dry-run');
const git = (...args) => execFileSync('git', args, {encoding: 'utf8'}).trim();

const root = dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir'));
const target = git('rev-parse', 'main');
// From the commit, not the working file: they can differ, and the commit is what ships.
const version = JSON.parse(git('show', `${target}:package.json`)).version;
const head = git('rev-parse', 'HEAD');

console.log(`Deploying main (${target.slice(0, 8)}) — v${version}`);
if (head !== target) {
  // Not an error: main is what production runs. But nobody should think their branch shipped.
  const unmerged = git('log', '--oneline', `${target}..HEAD`);
  console.log(`Your HEAD is ${head.slice(0, 8)}, not main.`);
  if (unmerged) console.log(`These commits are NOT being deployed:\n${unmerged.split('\n').map(line => `  ${line}`).join('\n')}`);
}

if (dryRun) { console.log('--dry-run: nothing deployed.'); process.exit(0); }

const checkout = mkdtempSync(join(root, '.railway-deploy-'));
try {
  // Detached: main itself is checked out at the root, and a branch cannot be in two places.
  git('worktree', 'add', '--detach', checkout, target);
  execFileSync('railway', ['up', '--service', SERVICE, '--detach', '--yes'], {cwd: checkout, stdio: 'inherit'});
} finally {
  try { git('worktree', 'remove', '--force', checkout); } catch { rmSync(checkout, {recursive: true, force: true}); }
}
