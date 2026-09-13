import {test, expect} from '@playwright/test';
import {createServer} from 'node:http';
import {createFriends} from '../server/friends.mjs';
import {createMemorySocialStore} from '../server/social-store.mjs';

const ALICE = '00000000-0000-4000-8000-000000000011';
const BOB = '00000000-0000-4000-8000-000000000012';
const BOB_PLAYER = 'socket-bob';

function fakeDatabase() {
  const users = new Map([
    ['alice-token', {id: ALICE, user_metadata: {display_name: 'Alice'}}],
    ['bob-token', {id: BOB, user_metadata: {display_name: 'Bob Verified'}}],
  ]);
  const rows: any[] = [];
  const query = (table: string) => {
    if (table !== 'game_friendships') throw Error(`Unexpected table ${table}`);
    let result = [...rows];
    const chain: any = {
      select: () => chain,
      eq: (key: string, value: unknown) => { result = result.filter(row => row[key] === value); return chain; },
      order: (key: string, options: {ascending?: boolean}) => { result.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (options?.ascending === false ? -1 : 1)); return chain; },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve({data: result.map(row => ({...row})), error: null}).then(resolve, reject),
    };
    return chain;
  };
  const rpc = async (name: string, args: any) => {
    if (name === 'game_friend_request') {
      if (args.p_user_id === args.p_friend_id) return {data: {requested: false, reason: 'self'}, error: null};
      if (rows.some(row => row.status === 'accepted' && ((row.user_id === args.p_user_id && row.friend_id === args.p_friend_id) || (row.user_id === args.p_friend_id && row.friend_id === args.p_user_id)))) return {data: {requested: false, reason: 'already_friend'}, error: null};
      const same = rows.find(row => row.user_id === args.p_user_id && row.friend_id === args.p_friend_id);
      if (same) return {data: {requested: false, reason: same.status === 'pending' ? 'pending' : 'already_friend'}, error: null};
      const reverse = rows.find(row => row.user_id === args.p_friend_id && row.friend_id === args.p_user_id);
      if (reverse) return {data: {requested: false, reason: reverse.status === 'pending' ? 'incoming' : 'already_friend'}, error: null};
      rows.push({user_id: args.p_user_id, friend_id: args.p_friend_id, requested_by: args.p_user_id, user_name: args.p_user_name, friend_name: args.p_friend_name, status: 'pending', requested_at: new Date().toISOString(), accepted_at: null});
      return {data: {requested: true}, error: null};
    }
    if (name === 'game_friend_respond') {
      const row = rows.find(item => item.user_id === args.p_friend_id && item.friend_id === args.p_user_id && item.status === 'pending');
      if (!row) return {data: {responded: false, reason: 'not_pending'}, error: null};
      if (!args.p_approved) { rows.splice(rows.indexOf(row), 1); return {data: {responded: false, declined: true}, error: null}; }
      row.status = 'accepted'; row.accepted_at = new Date().toISOString(); row.friend_name = args.p_user_name;
      rows.push({user_id: args.p_user_id, friend_id: args.p_friend_id, requested_by: args.p_friend_id, user_name: args.p_user_name, friend_name: row.user_name, status: 'accepted', requested_at: row.requested_at, accepted_at: row.accepted_at});
      return {data: {responded: true, accepted: true}, error: null};
    }
    if (name === 'game_friend_cancel') {
      const index = rows.findIndex(row => row.user_id === args.p_user_id && row.friend_id === args.p_friend_id && row.status === 'pending');
      if (index < 0) return {data: {cancelled: false, reason: 'not_pending'}, error: null};
      rows.splice(index, 1); return {data: {cancelled: true}, error: null};
    }
    if (name === 'game_friend_remove') {
      const before = rows.length;
      for (let index = rows.length - 1; index >= 0; index--) {
        const row = rows[index];
        if (row.status === 'accepted' && ((row.user_id === args.p_user_id && row.friend_id === args.p_friend_id) || (row.user_id === args.p_friend_id && row.friend_id === args.p_user_id))) rows.splice(index, 1);
      }
      return {data: rows.length === before ? {removed: false, reason: 'not_friend'} : {removed: true}, error: null};
    }
    throw Error(`Unexpected RPC ${name}`);
  };
  return {
    auth: {
      getUser: async (token: string) => users.has(token) ? {data: {user: users.get(token)}, error: null} : {data: {user: null}, error: Error('invalid')},
      admin: {getUserById: async (id: string) => { const user = [...users.values()].find(item => item.id === id); return user ? {data: {user}, error: null} : {data: {user: null}, error: Error('missing')}; }},
    },
    from: query,
    rpc,
  };
}

test('friends are persistent, authenticated, and address the live player rather than trusting a name', async () => {
  const db = fakeDatabase();
  const live = {id: BOB_PLAYER, userId: BOB, name: 'Bob Verified', guest: false};
  const module = createFriends({db, resolvePlayer: (id: string) => id === BOB_PLAYER ? live : null, playerFor: (id: string) => id === BOB ? live : null});
  const server = createServer((request, response) => { void module.handle(request, response); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/friends`;
  const call = (path: string, token: string, method = 'GET', body?: unknown) => fetch(`${base}${path}`, {method, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  try {
    expect((await call('/state', 'unknown')).status).toBe(401);
    const requested = await call('/request', 'alice-token', 'POST', {playerId: BOB_PLAYER, name: '<img src=x onerror=alert(1)>'});
    expect(requested.status).toBe(200);
    const alicePending = await (await call('/state', 'alice-token')).json();
    expect(alicePending.state.outgoing).toEqual([expect.objectContaining({id: BOB, name: 'Bob Verified', playerId: BOB_PLAYER})]);
    const bobPending = await (await call('/state', 'bob-token')).json();
    expect(bobPending.state.incoming).toEqual([expect.objectContaining({id: ALICE, name: 'Alice'})]);
    expect((await call('/request', 'alice-token', 'POST', {playerId: BOB_PLAYER})).status).toBe(409);
    expect((await call('/respond', 'bob-token', 'POST', {id: ALICE, approved: true})).status).toBe(200);
    const aliceFriends = await (await call('/state', 'alice-token')).json();
    expect(aliceFriends.state.friends).toEqual([{id: BOB, name: 'Bob Verified', online: true, playerId: BOB_PLAYER}]);
    expect((await call('/remove', 'alice-token', 'POST', {id: BOB})).status).toBe(200);
    expect((await (await call('/state', 'alice-token')).json()).state.friends).toEqual([]);
  } finally { server.close(); }
});

test('on dev, friends work against the in-memory store with stand-in accounts', async () => {
  const store = createMemorySocialStore();
  const alya = store.issueStandIn('Alya'), badrul = store.issueStandIn('Badrul');
  const module = createFriends({store});
  const server = createServer((request, response) => { void module.handle(request, response); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/friends`;
  const call = (path: string, token: string, method = 'GET', body?: unknown) => fetch(`${base}${path}`, {method, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  try {
    expect((await call('/request', alya.token, 'POST', {id: badrul.userId})).status).toBe(200);
    expect((await (await call('/state', badrul.token)).json()).state.incoming).toEqual([expect.objectContaining({id: alya.userId, name: 'Alya'})]);
    expect((await call('/respond', badrul.token, 'POST', {id: alya.userId, approved: true})).status).toBe(200);
    expect((await (await call('/state', alya.token)).json()).state.friends).toEqual([{id: badrul.userId, name: 'Badrul', online: false, playerId: null}]);
    expect((await call('/state', 'forged')).status).toBe(401);
  } finally { server.close(); }
});

test('friends are unavailable, not faked, when Supabase is only half configured', async () => {
  const module = createFriends({store: null});
  const server = createServer((request, response) => { void module.handle(request, response); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/friends/state`, {headers: {Authorization: 'Bearer x'}});
    expect(response.status).toBe(503);
  } finally { server.close(); }
});

test('Friend List renders safely, opens Message for online friends, and fits a phone', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType: 'application/javascript', body: `export const session={access_token:'test',user:{id:'me',user_metadata:{display_name:'Tester'}}};export let guestName='';` }));
  await page.route('**/friends/state', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({state: {friends: [{id: 'friend-id', name: '<b>Safe name</b>', online: true, playerId: 'player-2'}], incoming: [{id: 'incoming-id', name: 'Incoming'}], outgoing: []}})}));
  let accountRequest: unknown = null;
  await page.route('**/friends/request', async route => {
    accountRequest = route.request().postDataJSON();
    await route.fulfill({json: {state: {friends: [{id: 'friend-id', name: '<b>Safe name</b>', online: true, playerId: 'player-2'}], incoming: [{id: 'incoming-id', name: 'Incoming'}], outgoing: [{id: 'account-3', name: 'Offline friend'}]}}});
  });
  await page.route('**/friends-harness', route => route.fulfill({contentType: 'text/html', body: `<main><script type="module">import {setupFriends} from '/src/friends.ts';window.friendMessages=[];window.friendApi=setupFriends('http://friends.test',()=>{},()=>{},(id,name)=>window.friendMessages.push({id,name}));window.friendApi.open();</script></main>`}));
  await page.goto('/friends-harness');
  await expect(page.getByRole('dialog', {name: 'Friends'})).toBeVisible();
  await expect(page.getByText('<b>Safe name</b>', {exact: true})).toBeVisible();
  await expect(page.locator('#game-friends img')).toHaveCount(0);
  await page.getByRole('button', {name: 'Message'}).click();
  await expect.poll(() => page.evaluate(() => JSON.stringify((window as any).friendMessages))).toBe(JSON.stringify([{id: 'player-2', name: '<b>Safe name</b>'}]));
  expect(await page.evaluate(() => (window as any).friendApi.relationship('friend-id'))).toBe('friend');
  await page.evaluate(() => (window as any).friendApi.addAccount('account-3', 'Offline friend'));
  expect(accountRequest).toEqual({id: 'account-3'});
  await expect(page.getByRole('button', {name: 'Accept'})).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('Friend List uses game skeletons while its state is loading', async ({page}) => {
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType: 'application/javascript', body: `export const session={access_token:'test'};export let guestName='';`}));
  await page.route('**/friends/state', async route => {
    await new Promise(resolve => setTimeout(resolve, 450));
    await route.fulfill({json: {state: {friends: [], incoming: [], outgoing: []}}});
  });
  await page.route('**/friends-loading-harness', route => route.fulfill({contentType: 'text/html', body: `<main><script type="module">import {setupFriends} from '/src/friends.ts';setupFriends(location.origin,()=>{}).open();</script></main>`}));
  await page.goto('/friends-loading-harness');
  await expect(page.locator('#game-friends')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#game-friends .social-skeleton-row')).toHaveCount(7);
  await expect(page.locator('#friends-message')).not.toContainText('Loading');
  await expect(page.locator('#game-friends .social-skeleton-row')).toHaveCount(0);
  await expect(page.locator('#game-friends')).toHaveAttribute('aria-busy', 'false');
});

test('Friend List announces new requests and confirms friend removal', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType: 'application/javascript', body: `export const session={access_token:'test',user:{id:'me',user_metadata:{display_name:'Tester'}}};export let guestName='';` }));
  let state = {friends: [{id: 'friend-id', name: 'Aina', online: false, playerId: null}], incoming: [], outgoing: []};
  await page.route('**/friends/state', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({state})}));
  await page.route('**/friends/remove', route => {
    state = {friends: [], incoming: [], outgoing: []};
    return route.fulfill({contentType: 'application/json', body: JSON.stringify({result: {removed: true}, state})});
  });
  await page.route('**/friends-harness-events', route => route.fulfill({contentType: 'text/html', body: `<main><script type="module">import {setupFriends} from '/src/friends.ts';window.friendEvents=[];window.friendApi=setupFriends('http://friends.test',()=>{},()=>{},()=>{},(event,unread)=>window.friendEvents.push({event,unread}));window.friendApi.open();</script></main>`}));
  await page.goto('/friends-harness-events');

  await expect(page.getByRole('button', {name: 'Remove', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Remove', exact: true}).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Remove Aina?'})).toBeVisible();
  await page.getByRole('button', {name: 'Keep friend'}).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await page.getByRole('button', {name: 'Remove', exact: true}).click();
  await page.getByRole('button', {name: 'Remove friend'}).click();
  await expect(page.getByText('No friends yet. Add someone from the city.')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).friendEvents.map((item: any) => item.event))).toContain('removed');

  await page.evaluate(() => (window as any).friendApi.close());
  await page.evaluate(() => (window as any).friendApi.state({friends: [], incoming: [{id: 'request-id', name: 'Farah'}], outgoing: []}));
  await expect.poll(() => page.evaluate(() => JSON.stringify((window as any).friendEvents))).toContain('request-received');
  await expect.poll(() => page.evaluate(() => (window as any).friendEvents.at(-1))).toEqual({event: 'request-received', unread: 1});
});
