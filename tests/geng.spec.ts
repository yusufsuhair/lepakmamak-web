import {test, expect} from '@playwright/test';
import {createServer} from 'node:http';
import {createGengs, sanitizeGengName} from '../server/geng.mjs';

const LEADER = '00000000-0000-4000-8000-000000000001';
const MEMBER = '00000000-0000-4000-8000-000000000002';
const GENG = '00000000-0000-4000-8000-000000000101';

function fakeDatabase() {
  const users = new Map([
    ['leader-token', {id: LEADER, user_metadata: {display_name: 'Yusuf'}}],
    ['member-token', {id: MEMBER, user_metadata: {display_name: 'Aina'}}],
  ]);
  const wallets = new Map([[LEADER, 1500], [MEMBER, 500]]);
  const guilds: any[] = [];
  const members: any[] = [];
  const rows = (table: string) => table === 'game_gengs' ? guilds : members;
  const query = (table: string) => {
    let result = [...rows(table)];
    const chain: any = {
      select: () => chain,
      eq: (key: string, value: unknown) => { result = result.filter(row => row[key] === value); return chain; },
      in: (key: string, values: unknown[]) => { result = result.filter(row => values.includes(row[key])); return chain; },
      order: (key: string, options: {ascending?: boolean}) => {
        result.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (options?.ascending === false ? -1 : 1)); return chain;
      },
      limit: (count: number) => { result = result.slice(0, count); return chain; },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve({data: result.map(row => ({...row})), error: null}).then(resolve, reject),
    };
    return chain;
  };
  const rpc = async (name: string, args: any) => {
    if (name === 'game_wallet_get') return {data: {balance: wallets.get(args.p_user_id) ?? 500}, error: null};
    if (name === 'game_geng_create') {
      if (members.some(row => row.user_id === args.p_user_id && row.status === 'member')) return {data: {created: false, reason: 'already_in_geng', balance: wallets.get(args.p_user_id)}, error: null};
      const balance = wallets.get(args.p_user_id) ?? 500;
      if (balance < 1000) return {data: {created: false, reason: 'insufficient', balance}, error: null};
      if (guilds.some(row => row.name.toLowerCase() === args.p_name.toLowerCase())) return {data: {created: false, reason: 'name_taken', balance}, error: null};
      guilds.push({id: GENG, name: args.p_name, leader_id: args.p_user_id, created_at: new Date().toISOString()});
      members.push({geng_id: GENG, user_id: args.p_user_id, display_name: args.p_display_name, status: 'member', requested_at: new Date().toISOString(), joined_at: new Date().toISOString()});
      wallets.set(args.p_user_id, balance - 1000);
      return {data: {created: true, balance: balance - 1000, geng: {id: GENG, name: args.p_name, leader: true, memberCount: 1}}, error: null};
    }
    if (name === 'game_geng_request') {
      if (!guilds.some(row => row.id === args.p_geng_id)) return {data: {requested: false, reason: 'not_found'}, error: null};
      if (members.some(row => row.user_id === args.p_user_id && row.status === 'member')) return {data: {requested: false, reason: 'already_in_geng'}, error: null};
      const existing = members.find(row => row.geng_id === args.p_geng_id && row.user_id === args.p_user_id);
      if (existing) return {data: {requested: false, reason: existing.status}, error: null};
      members.push({geng_id: args.p_geng_id, user_id: args.p_user_id, display_name: args.p_display_name, status: 'pending', requested_at: new Date().toISOString(), joined_at: null});
      return {data: {requested: true}, error: null};
    }
    if (name === 'game_geng_approve') {
      const guild = guilds.find(row => row.leader_id === args.p_leader_id);
      if (!guild) return {data: {approved: false, reason: 'not_leader'}, error: null};
      const applicant = members.find(row => row.geng_id === guild.id && row.user_id === args.p_user_id);
      if (!applicant) return {data: {approved: false, reason: 'not_pending'}, error: null};
      if (!args.p_approved) { members.splice(members.indexOf(applicant), 1); return {data: {approved: false, rejected: true}, error: null}; }
      applicant.status = 'member'; applicant.joined_at = new Date().toISOString();
      return {data: {approved: true}, error: null};
    }
    if (name === 'game_geng_leave') {
      const applicant = members.find(row => row.user_id === args.p_user_id && row.status === 'member');
      if (!applicant) return {data: {left: false, reason: 'not_member'}, error: null};
      const guild = guilds.find(row => row.id === applicant.geng_id);
      if (guild.leader_id === args.p_user_id && members.some(row => row.geng_id === guild.id && row.status === 'member' && row.user_id !== args.p_user_id)) return {data: {left: false, reason: 'leader_has_members'}, error: null};
      if (guild.leader_id === args.p_user_id) guilds.splice(guilds.indexOf(guild), 1);
      else members.splice(members.indexOf(applicant), 1);
      return {data: {left: true}, error: null};
    }
    if (name === 'game_geng_disband') {
      const guild = guilds.find(row => row.leader_id === args.p_leader_id);
      if (!guild) return {data: {disbanded: false, reason: 'not_leader'}, error: null};
      guilds.splice(guilds.indexOf(guild), 1);
      return {data: {disbanded: true}, error: null};
    }
    throw new Error(`Unexpected RPC ${name}`);
  };
  return {
    auth: {getUser: async (token: string) => users.has(token) ? {data: {user: users.get(token)}, error: null} : {data: {user: null}, error: Error('invalid')}},
    from: query,
    rpc,
  };
}

test('Geng names are normalized before they reach the database', () => {
  expect(sanitizeGengName('  Budak\tMamak  ')).toBe('Budak Mamak');
  expect(sanitizeGengName('<script>alert(1)</script>')).toBe('<script>alert(1)</script'.slice(0, 24));
  expect(sanitizeGengName('x')).toBeNull();
});

test('Geng creation charges 1,000 Syiling and leader approval controls membership', async () => {
  const db = fakeDatabase();
  const serverModule = createGengs({db});
  const server = createServer((request, response) => { void serverModule.handle(request, response); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/geng`;
  const call = (path: string, token: string, method = 'GET', body?: unknown) => fetch(`${base}${path}`, {method, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  try {
    expect((await call('/state', 'leader-token')).status).toBe(200);
    const created = await call('/create', 'leader-token', 'POST', {name: 'Budak Mamak'});
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({result: {created: true, balance: 500}, state: {current: {name: 'Budak Mamak', leader: true, memberCount: 1}}});

    const listing = await (await call('/state', 'member-token')).json();
    expect(listing.state.guilds).toEqual([{id: GENG, name: 'Budak Mamak', leaderName: 'Yusuf', memberCount: 1, members: [{id: LEADER, name: 'Yusuf', leader: true}], current: false, requested: false}]);
    expect((await call('/request', 'member-token', 'POST', {gengId: GENG})).status).toBe(200);
    const pending = await (await call('/state', 'leader-token')).json();
    expect(pending.state.pending).toEqual([expect.objectContaining({id: MEMBER, name: 'Aina'})]);

    expect((await call('/approve', 'member-token', 'POST', {userId: LEADER, approved: true})).status).toBe(409);
    expect((await call('/approve', 'leader-token', 'POST', {userId: MEMBER, approved: true})).status).toBe(200);
    const joined = await (await call('/state', 'member-token')).json();
    expect(joined.state.current).toMatchObject({id: GENG, name: 'Budak Mamak', leaderName: 'Yusuf', leader: false, memberCount: 2});
    expect(joined.state.members).toEqual(expect.arrayContaining([{id: LEADER, name: 'Yusuf', leader: true}, {id: MEMBER, name: 'Aina', leader: false}]));

    expect((await call('/leave', 'leader-token', 'POST', {})).status).toBe(409);
    expect((await call('/leave', 'member-token', 'POST', {})).status).toBe(200);
    expect((await call('/disband', 'leader-token', 'POST', {})).status).toBe(200);
    expect((await call('/state', 'leader-token')).json()).resolves.toMatchObject({state: {current: null}});
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('the Geng leader badge redraws only when its value or leadership changes', async ({page}) => {
  await page.route('**/geng-harness', route => route.fulfill({contentType: 'text/html', body: '<div id="hud"></div>'}));
  await page.goto('/geng-harness');
  const result = await page.evaluate(async () => {
    const {nameTag, updateNameTagGeng} = await import('/src/social.ts');
    const label = nameTag('Ali'); let draws = 0; const real = label.userData.drawVoice;
    label.userData.drawVoice = (...args: any[]) => { draws++; return real(...args); };
    updateNameTagGeng(label, 'Budak Mamak', true); const first = draws;
    updateNameTagGeng(label, 'Budak Mamak', true); updateNameTagGeng(label, 'Budak Mamak', false); updateNameTagGeng(label, '');
    return {first, draws, stored: label.userData.geng, leader: label.userData.gengLeader};
  });
  expect(result).toEqual({first: 1, draws: 3, stored: '', leader: false});
});

test('remote voice, Geng and player name occupy separate name-tag rows', async ({page}) => {
  await page.route('**/geng-tag-harness', route => route.fulfill({contentType: 'text/html', body: '<main></main>'}));
  await page.goto('/geng-tag-harness');
  const layout = await page.evaluate(async () => (await import('/src/social.ts')).NAME_TAG_LAYOUT);
  expect(layout.voice.bottom).toBeLessThan(layout.geng.top);
  expect(layout.geng.bottom).toBeLessThan(layout.name.top);
});

test('an underfunded Geng creation shows a top-up action', async ({page}) => {
  await page.route('**/src/auth.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'export const session={access_token:"test"}; export const guestName="";',
  }));
  await page.route('**/geng-harness', route => route.fulfill({contentType: 'text/html', body: '<main></main>'}));
  await page.route('**/geng/state', route => route.fulfill({
    json: {state: {balance: 500, current: null, members: [], pending: [], guilds: []}},
  }));
  await page.goto('/geng-harness');
  await page.evaluate(async () => {
    const {setupGeng} = await import('/src/geng.ts');
    (window as any).geng = setupGeng(location.origin, () => {}, () => {}, () => {}, () => { document.body.dataset.topup = 'opened'; });
    (window as any).geng.open();
  });

  await expect(page.locator('#geng-topup-prompt')).toBeVisible();
  await expect(page.locator('#geng-topup-copy')).toHaveText('You have 500 Syiling. You need 1,000 Syiling to create a Geng.');
  await expect(page.locator('#geng-create-submit')).toBeDisabled();
  await page.getByRole('button', {name: 'Tambah Syiling'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-topup', 'opened');
});

test('Open Gengs show their leader, open a clickable roster, and notify leaders about requests', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType: 'application/javascript', body: 'export const session={access_token:"test"}; export const guestName="";' }));
  const roster = [
    {id: LEADER, name: 'Yusuf', leader: true},
    {id: MEMBER, name: 'Aina', leader: false},
  ];
  const state = {balance: 500, current: null, members: [], pending: [], guilds: [{id: GENG, name: 'Budak Mamak', leaderName: 'Yusuf', memberCount: 2, members: roster, current: false, requested: false}]};
  await page.route('**/geng/state', route => route.fulfill({json: {state}}));
  await page.route('**/geng-roster-harness', route => route.fulfill({contentType: 'text/html', body: '<main></main>'}));
  await page.goto('/geng-roster-harness');
  await page.evaluate(async () => {
    const {setupGeng} = await import('/src/geng.ts');
    (window as any).geng = setupGeng(location.origin, () => {}, () => {}, () => {}, () => {}, (id: string, name: string) => { document.body.dataset.profile = `${id}|${name}`; }, (event: string, unread: number) => { document.body.dataset.gengEvent = `${event}:${unread}`; });
    (window as any).geng.open();
  });

  await expect(page.locator('.geng-listing-info')).toContainText('Leader: Yusuf');
  await page.getByRole('button', {name: 'View Budak Mamak roster'}).click();
  await expect(page.getByRole('dialog', {name: 'Budak Mamak'})).toBeVisible();
  await expect(page.locator('#geng-roster-leader')).toHaveText('Team leader · Yusuf · 2 members');
  await page.getByRole('button', {name: 'View profile of Aina'}).click();
  await expect(page.locator('#geng-roster')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-profile', `${MEMBER}|Aina`);

  await page.evaluate(() => {
    (window as any).geng.state({balance: 500, current: {id: '00000000-0000-4000-8000-000000000101', name: 'Budak Mamak', leaderName: 'Yusuf', leader: true, memberCount: 2}, members: [{id: '00000000-0000-4000-8000-000000000001', name: 'Yusuf', leader: true}, {id: '00000000-0000-4000-8000-000000000002', name: 'Aina', leader: false}], pending: [{id: '00000000-0000-4000-8000-000000000003', name: 'Farah'}], guilds: []});
  });
  await expect(page.locator('body')).toHaveAttribute('data-geng-event', 'request-received:1');
  await page.getByRole('button', {name: 'View profile of Farah'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-profile', '00000000-0000-4000-8000-000000000003|Farah');
});
