import {test, expect} from '@playwright/test';
import {cleanHandle, createHandles, handleProblem, suggestHandle} from '../server/handles.mjs';
import {createMemorySocialStore, createSupabaseSocialStore} from '../server/social-store.mjs';
import {fakeSupabase} from './support/fake-supabase';
import {listen} from './support/http';

test('handles are 3 to 18 lowercase letters, digits or underscores', () => {
  expect(handleProblem('abc')).toBeNull();
  expect(handleProblem('a_1_b')).toBeNull();
  expect(handleProblem('abcdefghijklmnopqr')).toBeNull();
  expect(handleProblem('ab')).toBe('invalid');
  expect(handleProblem('abcdefghijklmnopqrs')).toBe('invalid');
  expect(handleProblem('Abc')).toBe('invalid');
  expect(handleProblem('ab-c')).toBe('invalid');
  expect(handleProblem('abç')).toBe('invalid');
  expect(cleanHandle('  @Yusuf ')).toBe('yusuf');
});

test('reserved names are refused exactly, and the impersonation ones as prefixes too', () => {
  for (const name of ['mod', 'moderator', 'gm', 'support', 'system']) expect(handleProblem(name)).toBe('reserved');
  for (const name of ['admin', 'admin_yusuf', 'staff1', 'official_x', 'lepakmamakhq']) expect(handleProblem(name)).toBe('reserved');
  for (const name of ['modi', 'gmail', 'supporter', 'systems', 'myadmin']) expect(handleProblem(name)).toBeNull();
});

test('a suggestion comes from the display name, with the lowest free suffix from 2', () => {
  expect(suggestHandle('Yusuf', new Set())).toBe('yusuf');
  expect(suggestHandle('Yusuf', new Set(['yusuf']))).toBe('yusuf2');
  expect(suggestHandle('Yusuf', new Set(['yusuf', 'yusuf2', 'yusuf4']))).toBe('yusuf3');
  expect(suggestHandle('Yusuf Suhair!', new Set())).toBe('yusufsuhair');
  expect(suggestHandle('José', new Set())).toBe('jose');
  expect(suggestHandle('Yu', new Set())).toBe('yu2');
  expect(suggestHandle('Mod', new Set())).toBe('mod2');
  expect(suggestHandle('Admin Yusuf', new Set())).toBe('player');
  expect(suggestHandle('李', new Set(['player']))).toBe('player2');
  expect(suggestHandle('abcdefghijklmnopqr', new Set(['abcdefghijklmnopqr']))).toBe('abcdefghijklmnopq2');
});

async function handlesServer(playerFor: (id: string) => any = () => null) {
  const store = createMemorySocialStore();
  const module = createHandles({store, playerFor});
  const http = await listen(module.handle);
  return {store, module, ...http};
}

test('handle routes refuse anyone without an account', async () => {
  const {call, close} = await handlesServer();
  try {
    expect((await call(null, 'POST', '/handles/claim', {handle: 'alya'})).status).toBe(401);
    expect((await call('forged', 'GET', '/players/search?q=al')).status).toBe(401);
    expect((await call('x', 'GET', '/handles/check?h=alya', undefined, {Origin: 'https://evil.example'})).status).toBe(403);
  } finally { await close(); }
  const fake = fakeSupabase();
  const anon = fake.addUser({name: 'Anon', anonymous: true});
  const anonymous = await listen(createHandles({store: createSupabaseSocialStore(fake.db)}).handle);
  try { expect((await anonymous.call(anon.token, 'GET', '/handles/check?h=alya')).status).toBe(401); }
  finally { await anonymous.close(); }
  const unavailable = await listen(createHandles({store: null}).handle);
  try { expect((await unavailable.call('x', 'GET', '/handles/check?h=alya')).status).toBe(503); }
  finally { await unavailable.close(); }
});

test('claiming: rules, case-insensitive uniqueness, permanence and suggestions', async () => {
  const {store, call, close} = await handlesServer();
  const yusuf = store.issueStandIn('Yusuf'), other = store.issueStandIn('Yusuf');
  try {
    expect(await call(yusuf.token, 'POST', '/handles/claim', {handle: 'ab'})).toEqual({status: 422, body: expect.objectContaining({error: 'invalid', suggestion: 'ab2'})});
    expect(await call(yusuf.token, 'POST', '/handles/claim', {handle: 'admin_yusuf'})).toEqual({status: 422, body: expect.objectContaining({error: 'reserved', suggestion: 'player'})});
    expect(await call(yusuf.token, 'POST', '/handles/claim', {handle: '@Yusuf'})).toEqual({status: 200, body: {handle: 'yusuf'}});
    expect(await call(other.token, 'POST', '/handles/claim', {handle: 'YUSUF'})).toEqual({status: 409, body: expect.objectContaining({error: 'taken', suggestion: 'yusuf2'})});
    expect(await call(yusuf.token, 'POST', '/handles/claim', {handle: 'yusuf_baru'})).toEqual({status: 409, body: expect.objectContaining({error: 'claimed', handle: 'yusuf'})});
    expect((await call(other.token, 'GET', '/handles/check?h=yusuf')).body).toEqual({available: false});
    expect((await call(other.token, 'GET', '/handles/check?h=yusuf2')).body).toEqual({available: true});
    expect((await call(other.token, 'GET', '/handles/check?h=gm')).body).toEqual({available: false, reason: 'reserved'});
    expect((await call(other.token, 'GET', '/handles/check?h=x')).body).toEqual({available: false, reason: 'invalid'});
  } finally { await close(); }
});

test('a claim that loses the race gets taken with a fresh suggestion', async () => {
  const {store, call, close} = await handlesServer();
  const one = store.issueStandIn('One'), two = store.issueStandIn('Two');
  try {
    const results = await Promise.all([call(one.token, 'POST', '/handles/claim', {handle: 'ali'}), call(two.token, 'POST', '/handles/claim', {handle: 'ali'})]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(results.find(result => result.status === 409)!.body).toEqual(expect.objectContaining({error: 'taken', suggestion: 'ali2'}));
  } finally { await close(); }
});

test('search matches handles only, at most 20, with online state and relation', async () => {
  const online = new Map<string, {name: string}>();
  const {store, call, close} = await handlesServer(id => online.get(id) || null);
  const me = store.issueStandIn('Searcher');
  await store.claimHandle(me.userId, 'kakime');
  const kaki = [];
  for (let n = 0; n < 25; n++) {
    const account = store.issueStandIn(`Budak ${n}`);
    await store.claimHandle(account.userId, `kaki${String(n).padStart(2, '0')}`);
    kaki.push(account);
  }
  online.set(kaki[0].userId, {name: 'Budak Live'});
  await store.friendRequest({userId: me.userId, friendId: kaki[1].userId, userName: 'Searcher', friendName: 'Budak 1'});
  await store.friendRequest({userId: kaki[2].userId, friendId: me.userId, userName: 'Budak 2', friendName: 'Searcher'});
  await store.friendRespond({userId: me.userId, friendId: kaki[2].userId, userName: 'Searcher', approved: true});
  try {
    const found = (await call(me.token, 'GET', '/players/search?q=%40KAKI')).body.results;
    expect(found).toHaveLength(20);
    expect(found.some((row: any) => row.userId === me.userId)).toBe(false);
    expect(found[0]).toEqual({userId: kaki[0].userId, handle: 'kaki00', name: 'Budak Live', online: true, relation: 'none'});
    expect(found[1]).toEqual({userId: kaki[1].userId, handle: 'kaki01', name: 'Budak 1', online: false, relation: 'pending'});
    expect(found[2]).toMatchObject({handle: 'kaki02', relation: 'friend'});
    expect((await call(me.token, 'GET', '/players/search?q=Budak')).body.results).toEqual([]);
    expect((await call(me.token, 'GET', '/players/search?q=')).body.results).toEqual([]);
  } finally { await close(); }
});

test('the handle-required nudge suggests from the name until a handle is claimed', async () => {
  const store = createMemorySocialStore();
  const module = createHandles({store});
  const taken = store.issueStandIn('Someone');
  await store.claimHandle(taken.userId, 'yusufsuhair');
  const yusuf = store.issueStandIn('Yusuf Suhair');
  expect(await module.required(yusuf.userId, 'Yusuf Suhair')).toBe('yusufsuhair2');
  await store.claimHandle(yusuf.userId, 'yusuf');
  expect(await module.required(yusuf.userId, 'Yusuf Suhair')).toBeNull();
  expect(await createHandles({store: null}).required(yusuf.userId, 'Yusuf')).toBeNull();
});

test('a dev stand-in is given the claim screen suggestion, passing every handle rule', async () => {
  const store = createMemorySocialStore();
  const module = createHandles({store});
  const first = store.issueStandIn('Yusuf'), second = store.issueStandIn('YUSUF'), gm = store.issueStandIn('GM'), admin = store.issueStandIn('Admin Boss');
  expect(await module.autoClaim(first.userId, 'Yusuf')).toBe('yusuf');
  expect(await module.autoClaim(second.userId, 'YUSUF')).toBe('yusuf2');
  expect(await module.autoClaim(gm.userId, 'GM')).toBe('gm2');
  expect(await module.autoClaim(admin.userId, 'Admin Boss')).toBe('player');
  // Idempotent: a returning stand-in keeps the handle it already has.
  expect(await module.autoClaim(first.userId, 'Someone Else')).toBe('yusuf');
  expect(await module.required(first.userId, 'Yusuf')).toBeNull();
});

test('two stand-ins with the same name racing both end up with distinct handles', async () => {
  const store = createMemorySocialStore();
  const module = createHandles({store});
  const a = store.issueStandIn('Ali'), b = store.issueStandIn('Ali');
  const handles = await Promise.all([module.autoClaim(a.userId, 'Ali'), module.autoClaim(b.userId, 'Ali')]);
  expect(handles.sort()).toEqual(['ali', 'ali2']);
});

test('a real account is never auto-assigned a handle', async () => {
  const fake = fakeSupabase();
  const account = fake.addUser({name: 'Yusuf'});
  const module = createHandles({store: createSupabaseSocialStore(fake.db)});
  expect(await module.autoClaim(account.id, 'Yusuf')).toBeNull();
  expect(fake.tables.player_handles).toEqual([]);
  expect(await module.required(account.id, 'Yusuf')).toBe('yusuf');
});
