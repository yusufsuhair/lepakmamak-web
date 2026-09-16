import {test, expect} from '@playwright/test';
import {createModeration} from '../server/moderation.mjs';
import {createMessages} from '../server/messages.mjs';
import {createMemorySocialStore} from '../server/social-store.mjs';
import {listen} from './support/http';

const reportDb = () => {
  const inserted: any[] = [];
  return {inserted, db: {from: (table: string) => ({insert: async (row: any) => { inserted.push({table, row}); return {error: null}; }})}};
};

test('a report stores its evidence exactly as written, and older reports send no evidence key', async () => {
  const {db, inserted} = reportDb();
  const moderation = createModeration({db});
  const base = {reporterUserId: 'a', reporterName: 'Alya', reportedUserId: 'b', reportedName: 'Badrul', room: 'kampung', reason: 'harassment'};
  await moderation.report({...base, surface: 'dm', evidence: [{from: 'b', body: 'kau bodoh', sentAt: '2026-09-13T01:00:00.000Z'}]});
  await moderation.report({...base, surface: 'chat'});
  expect(inserted[0].row.evidence).toEqual([{from: 'b', body: 'kau bodoh', sentAt: '2026-09-13T01:00:00.000Z'}]);
  expect(inserted[0].row.surface).toBe('dm');
  expect('evidence' in inserted[1].row).toBe(false);
});

async function inbox() {
  const store = createMemorySocialStore();
  const alya = store.issueStandIn('Alya'), badrul = store.issueStandIn('Badrul'), chong = store.issueStandIn('Chong');
  for (const [account, handle] of [[alya, 'alya'], [badrul, 'badrul'], [chong, 'chong']] as const) await store.claimHandle(account.userId, handle);
  const online = new Set<string>(), live = new Set<string>(), pushed: any[] = [];
  const penalties = new Map<string, any>();
  let moderationDown = false, clock = Date.parse('2026-09-13T10:00:00.000Z');
  const moderation = {status: async (id: string) => { if (moderationDown) throw Error('down'); return penalties.get(id) || {banned: false, muted: false}; }};
  const messages = createMessages({
    store, moderation, now: () => clock,
    liveGame: (id: string) => live.has(id),
    playerFor: (id: string) => online.has(id) ? {name: 'Live'} : null,
    push: (id: string, payload: unknown) => { if (!online.has(id)) return false; pushed.push({id, payload}); return true; },
  });
  const http = await listen(messages.handle);
  const send = (from: {token: string}, to: {userId: string}, body: string, clientId = crypto.randomUUID()) => http.call(from.token, 'POST', '/messages', {to: to.userId, body, clientId});
  return {
    store, messages, alya, badrul, chong, online, live, pushed, penalties, http, send,
    advance: (ms: number) => { clock += ms; },
    down: () => { moderationDown = true; },
  };
}

test('messages refuse anyone without an account', async () => {
  const box = await inbox();
  try {
    expect((await box.http.call(null, 'POST', '/messages', {to: box.badrul.userId, body: 'hai', clientId: 'x'})).status).toBe(401);
    expect((await box.http.call('forged', 'GET', '/messages/unread')).status).toBe(401);
    expect((await box.http.call(null, 'POST', '/blocks', {userId: box.alya.userId})).status).toBe(401);
  } finally { await box.http.close(); }
});

test('a message to someone online in any room is stored, then pushed', async () => {
  const box = await inbox();
  box.online.add(box.badrul.userId);
  try {
    const sent = await box.send(box.alya, box.badrul, 'jumpa kat klcc', 'c-1');
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({online: true, message: {id: expect.any(String), from: box.alya.userId, to: box.badrul.userId, body: 'jumpa kat klcc', clientId: 'c-1', sentAt: expect.any(String)}});
    expect(box.pushed).toEqual([{id: box.badrul.userId, payload: {type: 'dm-new', message: sent.body.message, from: {userId: box.alya.userId, handle: 'alya', name: 'Alya'}}}]);
    expect(await box.store.conversation(box.alya.userId, box.badrul.userId)).toHaveLength(1);
  } finally { await box.http.close(); }
});

test('a message to someone offline waits as unread for their next login, and reading clears it', async () => {
  const box = await inbox();
  try {
    const sent = await box.send(box.alya, box.badrul, 'esok?');
    expect(sent.body.online).toBe(false);
    expect(box.pushed).toEqual([]);
    expect((await box.http.call(box.badrul.token, 'GET', '/messages/unread')).body).toEqual({threads: [{userId: box.alya.userId, handle: 'alya', name: 'Alya', unread: 1, lastAt: sent.body.message.sentAt}]});
    expect((await box.http.call(box.badrul.token, 'POST', `/messages/${box.alya.userId}/read`, {})).body).toEqual({});
    expect((await box.http.call(box.badrul.token, 'GET', '/messages/unread')).body).toEqual({threads: []});
  } finally { await box.http.close(); }
});

test('a conversation pages 30 at a time, oldest first within a page', async () => {
  const box = await inbox();
  try {
    for (let n = 0; n < 35; n++) {
      expect((await box.send(n % 2 ? box.badrul : box.alya, n % 2 ? box.alya : box.badrul, `m${n}`)).status).toBe(200);
      box.advance(2500);
    }
    const first = (await box.http.call(box.alya.token, 'GET', `/messages/${box.badrul.userId}`)).body;
    expect(first.more).toBe(true);
    expect(first.messages.map((m: any) => m.body)).toEqual(Array.from({length: 30}, (_, n) => `m${n + 5}`));
    const older = (await box.http.call(box.alya.token, 'GET', `/messages/${box.badrul.userId}?before=${encodeURIComponent(first.messages[0].sentAt)}`)).body;
    expect(older).toEqual({more: false, messages: expect.any(Array)});
    expect(older.messages.map((m: any) => m.body)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
    expect((await box.http.call(box.alya.token, 'GET', `/messages/${box.badrul.userId}?before=yesterday`)).status).toBe(400);
  } finally { await box.http.close(); }
});

test('each gate refuses in order: banned, muted, live game, blocked, rate limited', async () => {
  const box = await inbox();
  const {alya, badrul} = box;
  try {
    box.penalties.set(alya.userId, {banned: true, muted: false});
    box.live.add(alya.userId);
    await box.store.block(badrul.userId, alya.userId);
    expect(await box.send(alya, badrul, 'hai')).toEqual({status: 403, body: {error: 'Your account is suspended from LepakMamak.'}});
    box.penalties.set(alya.userId, {banned: false, muted: true});
    expect(await box.send(alya, badrul, 'hai')).toEqual({status: 403, body: {error: 'You are muted, so this did not send.'}});
    box.penalties.delete(alya.userId);
    expect(await box.send(alya, badrul, 'hai')).toEqual({status: 403, body: {error: 'Party dan DM ditutup masa main. Guna chat meja.'}});
    box.live.delete(alya.userId);
    expect(await box.send(alya, badrul, 'hai')).toEqual({status: 403, body: {error: "You can't message this player."}});
    await box.store.unblock(badrul.userId, alya.userId);
    for (let n = 0; n < 5; n++) expect((await box.send(alya, badrul, `hai ${n}`)).status).toBe(200);
    const limited = await box.send(alya, badrul, 'hai lagi');
    expect(limited.status).toBe(429);
    expect(limited.body.retryAfter).toBeGreaterThan(0);
    expect(await box.store.conversation(alya.userId, badrul.userId)).toHaveLength(5);
  } finally { await box.http.close(); }
});

test('no more than 20 messages a minute across every recipient', async () => {
  const box = await inbox();
  try {
    for (let n = 0; n < 20; n++) {
      expect((await box.send(box.alya, n % 2 ? box.badrul : box.chong, `m${n}`)).status).toBe(200);
      box.advance(2100);
    }
    const limited = await box.send(box.alya, box.badrul, 'one too many');
    expect(limited.status).toBe(429);
    expect(limited.body.retryAfter).toBeGreaterThan(0);
    box.advance(60000);
    expect((await box.send(box.alya, box.badrul, 'later')).status).toBe(200);
  } finally { await box.http.close(); }
});

test('an unknown player looks the same as a block, and a handle-less account cannot be messaged', async () => {
  const box = await inbox();
  const stranger = box.store.issueStandIn('No Handle');
  try {
    expect(await box.send(box.alya, stranger, 'hai')).toEqual({status: 403, body: {error: "You can't message this player."}});
    expect(await box.send(box.alya, {userId: '00000000-0000-4000-8000-000000000009'}, 'hai')).toEqual({status: 403, body: {error: "You can't message this player."}});
    expect((await box.send(box.alya, box.alya, 'me')).status).toBe(400);
    expect((await box.send(box.alya, box.badrul, '   ')).status).toBe(400);
    expect((await box.send(box.alya, box.badrul, 'x'.repeat(501))).status).toBe(400);
    expect((await box.send(box.alya, box.badrul, 'x'.repeat(500))).status).toBe(200);
  } finally { await box.http.close(); }
});

test('the moderation lookup failing refuses the send with 503 and stores nothing', async () => {
  const box = await inbox();
  box.down();
  try {
    expect((await box.send(box.alya, box.badrul, 'hai')).status).toBe(503);
    expect(await box.store.conversation(box.alya.userId, box.badrul.userId)).toEqual([]);
  } finally { await box.http.close(); }
});

test('a retry with the same client id is stored once and pushed once', async () => {
  const box = await inbox();
  box.online.add(box.badrul.userId);
  try {
    const first = await box.send(box.alya, box.badrul, 'hai', 'retry-1');
    const second = await box.send(box.alya, box.badrul, 'hai', 'retry-1');
    expect(second.body.message.id).toBe(first.body.message.id);
    expect(await box.store.conversation(box.alya.userId, box.badrul.userId)).toHaveLength(1);
    expect(box.pushed).toHaveLength(1);
  } finally { await box.http.close(); }
});

test('the body is stored raw, shown filtered, and reported raw', async () => {
  const box = await inbox();
  box.online.add(box.badrul.userId);
  try {
    const sent = await box.send(box.alya, box.badrul, 'kau bodoh');
    expect(sent.body.message.body).toBe('***');
    expect(box.pushed[0].payload.message.body).toBe('***');
    expect((await box.store.conversation(box.alya.userId, box.badrul.userId))[0].body).toBe('kau bodoh');
    expect((await box.http.call(box.badrul.token, 'GET', `/messages/${box.alya.userId}`)).body.messages[0].body).toBe('***');
    const report = await box.messages.reportFor(box.badrul.userId, box.alya.userId);
    expect(report).toEqual({name: 'Alya', evidence: [{from: box.alya.userId, body: 'kau bodoh', sentAt: sent.body.message.sentAt}]});
  } finally { await box.http.close(); }
});

test('malformed percent-encoding in a player id is a 400, not a server error', async () => {
  const box = await inbox();
  try {
    expect((await box.http.call(box.alya.token, 'GET', '/messages/%E0%A4%A')).status).toBe(400);
    expect((await box.http.call(box.alya.token, 'POST', '/messages/%E0%A4%A/read', {})).status).toBe(400);
    expect((await box.http.call(box.alya.token, 'DELETE', '/blocks/%E0%A4%A')).status).toBe(400);
  } finally { await box.http.close(); }
});

test('blocking hides that sender from unread, and unblocking works', async () => {
  const box = await inbox();
  try {
    await box.send(box.alya, box.badrul, 'hai');
    await box.send(box.chong, box.badrul, 'yo');
    expect((await box.http.call(box.badrul.token, 'POST', '/blocks', {userId: box.alya.userId})).status).toBe(200);
    expect((await box.http.call(box.badrul.token, 'GET', '/messages/unread')).body.threads.map((t: any) => t.handle)).toEqual(['chong']);
    expect((await box.http.call(box.badrul.token, 'POST', '/blocks', {userId: 'nope'})).status).toBe(400);
    expect((await box.http.call(box.badrul.token, 'DELETE', `/blocks/${box.alya.userId}`)).status).toBe(200);
    expect(await box.store.isBlocked(box.badrul.userId, box.alya.userId)).toBe(false);
  } finally { await box.http.close(); }
});

// Wraps a real store so isBlocked/handleFor/insertMessage each cross a real tick before
// resolving, the way a network round trip to Supabase would. The rate limit used to be a
// separate check() then note() with two such awaits in between, so a burst of concurrent
// requests all read "under the limit" before any of them recorded a send.
function delayed(store: any, ms: number) {
  const wait = () => new Promise(resolve => setTimeout(resolve, ms));
  return new Proxy(store, {
    get(target, prop: string) {
      const value = target[prop];
      if ((prop === 'isBlocked' || prop === 'handleFor' || prop === 'insertMessage') && typeof value === 'function') {
        return async (...args: unknown[]) => { await wait(); return value.apply(target, args); };
      }
      return value;
    },
  });
}

test('a slow store cannot be raced past the per-recipient rate limit', async () => {
  const store = createMemorySocialStore();
  const alya = store.issueStandIn('Alya'), badrul = store.issueStandIn('Badrul');
  await store.claimHandle(alya.userId, 'alya');
  await store.claimHandle(badrul.userId, 'badrul');
  const moderation = {status: async () => ({banned: false, muted: false})};
  const messages = createMessages({store: delayed(store, 10), moderation});
  const http = await listen(messages.handle);
  try {
    const results = await Promise.all(Array.from({length: 12}, (_, n) =>
      http.call(alya.token, 'POST', '/messages', {to: badrul.userId, body: `m${n}`, clientId: `c-${n}`})));
    expect(results.filter(r => r.status === 200)).toHaveLength(5);
    expect(results.filter(r => r.status === 429)).toHaveLength(7);
    expect(await store.conversation(alya.userId, badrul.userId)).toHaveLength(5);
  } finally { await http.close(); }
});

test('a slow store cannot be raced past the per-minute rate limit either', async () => {
  const store = createMemorySocialStore();
  const alya = store.issueStandIn('Alya');
  await store.claimHandle(alya.userId, 'alya');
  const recipients = Array.from({length: 6}, (_, n) => store.issueStandIn(`R${n}`));
  await Promise.all(recipients.map((r, n) => store.claimHandle(r.userId, `r${n}`)));
  const moderation = {status: async () => ({banned: false, muted: false})};
  const messages = createMessages({store: delayed(store, 10), moderation});
  const http = await listen(messages.handle);
  try {
    // 24 sends round-robined over 6 recipients: 4 each, well under the 5-per-recipient cap,
    // so only the 20-per-minute total cap can bind.
    const results = await Promise.all(Array.from({length: 24}, (_, n) =>
      http.call(alya.token, 'POST', '/messages', {to: recipients[n % 6].userId, body: `m${n}`, clientId: `c-${n}`})));
    expect(results.filter(r => r.status === 200)).toHaveLength(20);
    expect(results.filter(r => r.status === 429)).toHaveLength(4);
    const counts = await Promise.all(recipients.map(r => store.conversation(alya.userId, r.userId)));
    expect(counts.reduce((total, rows) => total + rows.length, 0)).toBe(20);
  } finally { await http.close(); }
});
