import {test, expect} from '@playwright/test';
import {createMemorySocialStore, createSocialStore, createSupabaseSocialStore} from '../server/social-store.mjs';
import {fakeSupabase} from './support/fake-supabase';

type Harness = {store: any; account: (name: string) => {userId: string; token: string}};
const harnesses: [string, () => Harness][] = [
  ['in-memory store', () => {
    const store = createMemorySocialStore();
    return {store, account: name => store.issueStandIn(name)};
  }],
  ['Supabase store', () => {
    const fake = fakeSupabase();
    return {store: createSupabaseSocialStore(fake.db), account: name => { const user = fake.addUser({name}); return {userId: user.id, token: user.token}; }};
  }],
];

// One contract, both stores: dev must not quietly drift from production.
for (const [label, make] of harnesses) {
  test.describe(label, () => {
    test('tokens resolve to named accounts', async () => {
      const {store, account} = make();
      const alya = account('Alya');
      expect(await store.userForToken(alya.token)).toEqual({id: alya.userId, name: 'Alya'});
      expect(await store.userForToken('nope')).toBeNull();
      expect(await store.account(alya.userId)).toEqual({id: alya.userId, name: 'Alya'});
      expect(await store.account('00000000-0000-4000-8000-000000000000')).toBeNull();
      expect(await store.names([alya.userId])).toEqual(new Map([[alya.userId, 'Alya']]));
    });

    test('a handle is claimed once, by one account, for good', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul');
      expect(await store.claimHandle(alya.userId, 'alya')).toBe('ok');
      expect(await store.claimHandle(badrul.userId, 'alya')).toBe('taken');
      expect(await store.claimHandle(alya.userId, 'alya_two')).toBe('claimed');
      expect(await store.handleFor(alya.userId)).toBe('alya');
      expect(await store.handleFor(badrul.userId)).toBeNull();
      expect(await store.ownerOf('alya')).toBe(alya.userId);
      expect(await store.ownerOf('nobody')).toBeNull();
      expect(await store.handlesFor([alya.userId, badrul.userId])).toEqual(new Map([[alya.userId, 'alya']]));
    });

    test('two accounts racing for one handle: exactly one wins', async () => {
      const {store, account} = make();
      const one = account('One'), two = account('Two');
      const results = await Promise.all([store.claimHandle(one.userId, 'ali'), store.claimHandle(two.userId, 'ali')]);
      expect(results.sort()).toEqual(['ok', 'taken']);
    });

    test('search is a prefix match on handles, limited and in order, with _ taken literally', async () => {
      const {store, account} = make();
      for (const handle of ['kaki3', 'kaki1', 'kaki2', 'kakitangan', 'ka_ki', 'kabc']) await store.claimHandle(account(handle).userId, handle);
      expect((await store.searchHandles('kaki', 3)).map((row: any) => row.handle)).toEqual(['kaki1', 'kaki2', 'kaki3']);
      expect((await store.searchHandles('ka_', 10)).map((row: any) => row.handle)).toEqual(['ka_ki']);
      expect(await store.searchHandles('zz', 10)).toEqual([]);
    });

    test('messages: stored once per client id, paged newest first in both directions', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul'), chong = account('Chong');
      const first = await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'hai', clientId: 'c-1'});
      expect(first.created).toBe(true);
      expect(first.message).toMatchObject({senderId: alya.userId, recipientId: badrul.userId, body: 'hai', clientId: 'c-1', readAt: null});
      const retry = await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'hai', clientId: 'c-1'});
      expect(retry).toEqual({message: first.message, created: false});
      await store.insertMessage({senderId: badrul.userId, recipientId: alya.userId, body: 'hello', clientId: 'c-1'});
      await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'jom', clientId: 'c-2'});
      await store.insertMessage({senderId: alya.userId, recipientId: chong.userId, body: 'other thread', clientId: 'c-3'});
      const page = await store.conversation(badrul.userId, alya.userId, {limit: 2});
      expect(page.map((m: any) => m.body)).toEqual(['jom', 'hello']);
      const older = await store.conversation(alya.userId, badrul.userId, {before: page[1].sentAt, limit: 2});
      expect(older.map((m: any) => m.body)).toEqual(['hai']);
    });

    test('unread is counted per sender until that conversation is read', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul'), chong = account('Chong');
      await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'one', clientId: 'a1'});
      await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'two', clientId: 'a2'});
      const last = await store.insertMessage({senderId: chong.userId, recipientId: badrul.userId, body: 'yo', clientId: 'c1'});
      const threads = await store.unread(badrul.userId);
      expect(threads).toHaveLength(2);
      expect(threads).toContainEqual({senderId: alya.userId, unread: 2, lastAt: expect.any(String)});
      expect(threads).toContainEqual({senderId: chong.userId, unread: 1, lastAt: last.message.sentAt});
      await store.markRead(badrul.userId, alya.userId);
      expect(await store.unread(badrul.userId)).toEqual([{senderId: chong.userId, unread: 1, lastAt: last.message.sentAt}]);
      expect(await store.unread(alya.userId)).toEqual([]);
    });

    test('blocks are one-directional and idempotent', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul');
      await store.block(badrul.userId, alya.userId);
      await store.block(badrul.userId, alya.userId);
      expect(await store.isBlocked(badrul.userId, alya.userId)).toBe(true);
      expect(await store.isBlocked(alya.userId, badrul.userId)).toBe(false);
      expect(await store.blocks(badrul.userId)).toEqual([alya.userId]);
      await store.unblock(badrul.userId, alya.userId);
      expect(await store.isBlocked(badrul.userId, alya.userId)).toBe(false);
    });

    test('friendships follow the same transitions as the SQL functions', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul');
      const ask = {userId: alya.userId, friendId: badrul.userId, userName: 'Alya', friendName: 'Badrul'};
      expect(await store.friendRequest(ask)).toEqual({requested: true});
      expect(await store.friendRequest(ask)).toEqual({requested: false, reason: 'pending'});
      expect(await store.friendRequest({userId: badrul.userId, friendId: alya.userId, userName: 'Badrul', friendName: 'Alya'})).toEqual({requested: false, reason: 'incoming'});
      expect((await store.friendships(badrul.userId)).map((row: any) => [row.user_id, row.status])).toEqual([[alya.userId, 'pending']]);
      expect(await store.friendCancel({userId: badrul.userId, friendId: alya.userId})).toEqual({cancelled: false, reason: 'not_pending'});
      expect(await store.friendRespond({userId: badrul.userId, friendId: alya.userId, userName: 'Badrul', approved: true})).toEqual({responded: true, accepted: true});
      expect((await store.friendships(alya.userId)).map((row: any) => row.status)).toEqual(['accepted', 'accepted']);
      expect(await store.friendRequest(ask)).toEqual({requested: false, reason: 'already_friend'});
      expect(await store.friendRemove({userId: badrul.userId, friendId: alya.userId})).toEqual({removed: true});
      expect(await store.friendRemove({userId: badrul.userId, friendId: alya.userId})).toEqual({removed: false, reason: 'not_friend'});
    });
  });
}

test('anonymous Supabase users are not accounts', async () => {
  const fake = fakeSupabase();
  const anon = fake.addUser({name: 'Anon', anonymous: true});
  expect(await createSupabaseSocialStore(fake.db).userForToken(anon.token)).toBeNull();
});

test('the in-memory store and stand-ins exist only when no Supabase setting is present', async () => {
  const blank = {SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_PUBLISHABLE_KEY: ''};
  expect(createSocialStore(blank)?.persistent).toBe(false);
  expect(createSocialStore({...blank, SUPABASE_URL: 'http://127.0.0.1:1'})).toBeNull();
  expect(createSocialStore({...blank, SUPABASE_PUBLISHABLE_KEY: 'x'})).toBeNull();
  expect(createSocialStore({...blank, SUPABASE_SERVICE_ROLE_KEY: 'x'})).toBeNull();
  const production = createSocialStore({SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'x'});
  expect(production?.persistent).toBe(true);
  expect('issueStandIn' in (production as object)).toBe(false);
  const memory = createMemorySocialStore();
  const standIn = memory.issueStandIn('Alya');
  expect(memory.resumeStandIn(standIn.token, 'Alya Baru')).toEqual(standIn);
  expect((await memory.userForToken(standIn.token))?.name).toBe('Alya Baru');
  expect(memory.resumeStandIn('forged', 'Alya')).toBeNull();
});
