import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {isGameMaster} from '../server/roles.mjs';
import {createShop} from '../server/shop.mjs';
import {origins} from '../shared/origins.mjs';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('GM IDs fail closed and cannot be granted by email or editable metadata', () => {
  const user = {id, email: 'gm@example.com', email_confirmed_at: '2026-01-01'};
  assert.equal(isGameMaster(user, ''), false);
  assert.equal(isGameMaster(user, ` ${id},bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb `), true);
  for (const value of [null, {}, {...user, is_anonymous: true}, {...user, email_confirmed_at: null}, {...user, id: 'other', user_metadata: {id, gameMaster: true}}]) {
    assert.equal(isGameMaster(value, id), false);
  }
});
test('origin configuration replaces defaults and rejects unsafe origins', () => {
  const code = "import {origins} from './shared/origins.mjs'; console.log(JSON.stringify([...origins]));";
  const run = value => spawnSync(process.execPath, ['--input-type=module', '-e', code], {encoding: 'utf8', env: {...process.env, ALLOWED_ORIGINS: value}});
  const allowed = run('https://game.example.com,capacitor://localhost');
  assert.equal(allowed.status, 0);
  assert.deepEqual(JSON.parse(allowed.stdout), ['https://game.example.com', 'capacitor://localhost']);
  for (const value of ['*', 'https://*.example.com', 'https://game.example.com/path', 'https://user:pass@example.com', 'javascript:alert(1)', 'capacitor://evil']) assert.notEqual(run(value).status, 0);
});
test('deploy commands refuse to guess account resources', () => {
  for (const [script, vars] of [['scripts/deploy-pages.mjs', ['CF_PAGES_PROJECT']], ['scripts/deploy-realtime.mjs', ['RAILWAY_PROJECT_ID', 'RAILWAY_SERVICE_ID']]]) {
    const env = {...process.env, ...Object.fromEntries(vars.map(name => [name, '']))};
    const result = spawnSync(process.execPath, [script, '--dry-run'], {env, encoding: 'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Set (CF_PAGES_PROJECT|RAILWAY_PROJECT_ID)/);
  }
});
test('Checkout without an Origin uses a configured web origin and refuses native-only configuration', async () => {
  let checkout, status, body;
  const shop = createShop(() => {}, {db: {auth: {getUser: async () => ({data: {user: {id}}, error: null})}}, stripe: {checkout: {sessions: {create: async input => {checkout = input; return {url: 'https://checkout.stripe.com/example'};}}}}});
  const request = () => ({url: '/shop/checkout', method: 'POST', headers: {authorization: 'Bearer test'}, async *[Symbol.asyncIterator]() {yield Buffer.from('{"packId":"lepak-500"}');}});
  const response = {setHeader() {}, writeHead(code) {status = code;}, end(value) {body = JSON.parse(value);}};
  const previous = [...origins];
  try {
    origins.clear(); origins.add('capacitor://localhost'); origins.add('https://game.example.com');
    await shop.handle(request(), response);
    assert.equal(status, 200); assert.match(checkout.success_url, /^https:\/\/game\.example\.com\//);
    origins.delete('https://game.example.com'); checkout = null;
    await shop.handle(request(), response);
    assert.equal(status, 503); assert.equal(checkout, null); assert.match(body.error, /origin/);
  } finally {origins.clear(); for (const origin of previous) origins.add(origin);}
});
test('the backend starts with local guests and no cloud credentials', async () => {
  const child = spawn(process.execPath, ['server/index.mjs'], {env: {...process.env, PORT: '0', ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', CF_SFU_APP_ID: '', CF_SFU_APP_SECRET: '', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', OPENAI_API_KEY: '', DEEPSEEK_API_KEY: '', HEARTBEAT_URL: '', ALERT_WEBHOOK_URL: ''}, stdio: ['ignore', 'pipe', 'pipe']});
  try {
    const output = await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(([code]) => {throw new Error(`Server exited: ${code}`);}), new Promise((_, reject) => {const timer=setTimeout(() => reject(new Error('Server startup timed out')), 10000); timer.unref();})]);
    assert.match(String(output[0]), /listening|realtime/i);
  } finally {child.kill(); await once(child, 'close');}
});
