import {test, expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const blank = {ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SERVICE_ROLE_KEY: ''};

function start(port: string, env: Record<string, string>) {
  const child = spawn(process.execPath, ['server/index.mjs'], {env: {...process.env, ...blank, PORT: port, ...env}, stdio: 'ignore'});
  const ready = () => expect.poll(async () => { try { return (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch { return false; } }, {timeout: 30000}).toBe(true);
  const call = async (token: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {method, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    return {status: response.status, body: await response.json().catch(() => null)};
  };
  const sockets: WebSocket[] = [];
  const join = (room: string, name: string, extra: object = {}) => new Promise<{ws: WebSocket; welcome: any; seen: any[]}>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const seen: any[] = [];
    sockets.push(ws);
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({type: 'join', room, guest: true, name, ...extra})));
    ws.on('message', raw => {
      const message = JSON.parse(String(raw));
      seen.push(message);
      if (message.type === 'welcome') resolve({ws, welcome: message, seen});
      if (message.type === 'error') reject(Error(message.message));
    });
  });
  const stop = () => { sockets.forEach(ws => ws.close()); child.kill(); };
  return {ready, call, join, stop};
}

test('on dev a guest gets a stand-in, claims a handle, and messages across rooms and reconnects', async () => {
  const server = start('8263', {});
  try {
    await server.ready();
    const alya = await server.join('kampung', 'Alya');
    const badrul = await server.join('klcc', 'Badrul');
    const A = alya.welcome.standIn, B = badrul.welcome.standIn;
    expect(A).toEqual({userId: expect.stringMatching(UUID), token: expect.any(String)});
    expect(B.userId).not.toBe(A.userId);
    expect(JSON.stringify(alya.welcome.players)).not.toContain(A.userId);
    await expect.poll(() => alya.seen.find(m => m.type === 'handle-required')?.suggestion).toBe('alya');

    expect((await server.call(A.token, 'POST', '/handles/claim', {handle: 'alya'})).body).toEqual({handle: 'alya'});
    expect((await server.call(B.token, 'POST', '/handles/claim', {handle: 'badrul'})).body).toEqual({handle: 'badrul'});
    expect((await server.call(A.token, 'GET', '/players/search?q=bad')).body.results).toEqual([{userId: B.userId, handle: 'badrul', name: 'Badrul', online: true, relation: 'none'}]);

    // Different rooms: the push still finds Badrul.
    const live = await server.call(A.token, 'POST', '/messages', {to: B.userId, body: 'jumpa kat klcc', clientId: 'm-1'});
    expect(live.body.online).toBe(true);
    await expect.poll(() => badrul.seen.find(m => m.type === 'dm-new')?.message.body).toBe('jumpa kat klcc');
    expect(badrul.seen.find(m => m.type === 'dm-new').from).toEqual({userId: A.userId, handle: 'alya', name: 'Alya'});

    badrul.ws.close();
    await expect.poll(async () => (await server.call(A.token, 'GET', '/players/search?q=badrul')).body.results[0]?.online).toBe(false);
    expect((await server.call(A.token, 'POST', '/messages', {to: B.userId, body: 'esok?', clientId: 'm-2'})).body.online).toBe(false);

    const back = await server.join('kampung', 'Badrul', {standInToken: B.token});
    expect(back.welcome.standIn).toEqual(B);
    const threads = (await server.call(B.token, 'GET', '/messages/unread')).body.threads;
    expect(threads).toEqual([expect.objectContaining({userId: A.userId, handle: 'alya', unread: 2})]);
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(back.seen.some(m => m.type === 'handle-required')).toBe(false);

    // Guests' in-room DMs are untouched.
    alya.ws.send(JSON.stringify({type: 'chat', channel: 'dm', to: back.welcome.id, text: 'hai dalam bilik'}));
    await expect.poll(() => back.seen.find(m => m.type === 'chat' && m.channel === 'dm')?.text).toBe('hai dalam bilik');

    // Friendships work on dev through the same store.
    expect((await server.call(A.token, 'POST', '/friends/request', {id: B.userId})).status).toBe(200);
    expect((await server.call(B.token, 'POST', '/friends/respond', {id: A.userId, approved: true})).status).toBe(200);
    expect((await server.call(A.token, 'GET', '/players/search?q=badrul')).body.results[0].relation).toBe('friend');

    // A DM report is accepted by account; on dev there is no report table, so it fails politely.
    // No conversation with Chong, so nothing to report.
    const chong = await server.join('kampung', 'Chong');
    back.ws.send(JSON.stringify({type: 'report', surface: 'dm', userId: chong.welcome.standIn.userId, reason: 'harassment', note: ''}));
    await expect.poll(() => back.seen.find(m => m.type === 'notice' && /conversation/.test(m.message))?.message).toBe('Open the conversation you want to report.');
    back.ws.send(JSON.stringify({type: 'report', surface: 'dm', userId: A.userId, reason: 'harassment', note: ''}));
    await expect.poll(() => back.seen.findLast(m => m.type === 'notice' && /report/i.test(m.message))?.message).toBe('Could not file that report. Please try again in a moment.');
  } finally { server.stop(); }
});

test('with Supabase configured, no stand-in is ever issued and messages stay unavailable', async () => {
  const server = start('8264', {SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_PUBLISHABLE_KEY: 'test'});
  try {
    await server.ready();
    const guest = await server.join('kampung', 'Guesty');
    expect('standIn' in guest.welcome).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(guest.seen.some(m => m.type === 'handle-required')).toBe(false);
    expect((await server.call('anything', 'GET', '/messages/unread')).status).toBe(503);
    expect((await server.call('anything', 'GET', '/players/search?q=a')).status).toBe(503);
  } finally { server.stop(); }
});
