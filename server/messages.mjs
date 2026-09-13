import {filterChat} from './chat-filter.mjs';
import {createModeration} from './moderation.mjs';
import {HttpError, UUID, readJson, serveJson} from './social-http.mjs';
import {cleanDisplayName} from './social-store.mjs';

const PAGE = 30;
const BODY_MAX = 500;
const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,6})?(Z|[+-]\d\d:\d\d)$/;
const REFUSED = "You can't message this player.";

// Control characters become spaces and nothing else changes: the body is stored raw so a
// report still holds the words that were sent. filterChat runs only on the way out.
export const cleanBody = value => typeof value === 'string' ? value.replace(/\p{Cc}/gu, ' ').trim() : '';

// ponytail: per-process windows, like server/limits.mjs. A shared store only matters if the
// realtime service ever runs more than one instance.
//
// check and note used to be two separate calls, straddling two `await`s (the handle lookup
// and the insert) in send() below. Every request in a parallel burst read the same "not yet
// over the limit" state before any of them recorded a send, so a burst sailed straight through
// both windows. take() collapses them into one synchronous call: the record happens in the
// same tick as the decision, so nothing can interleave between "allowed" and "recorded".
export function createSendLimit({now = Date.now} = {}) {
  const sent = new Map();
  return {
    take(sender, recipient) {
      const at = now();
      if (sent.size > 5000) for (const [key, entries] of sent) if (!entries.length || at - entries.at(-1).at >= 60000) sent.delete(key);
      const recent = (sent.get(sender) || []).filter(entry => at - entry.at < 60000);
      sent.set(sender, recent);
      if (recent.length >= 20) return Math.max(1, Math.ceil((recent[recent.length - 20].at + 60000 - at) / 1000));
      const toThem = recent.filter(entry => entry.to === recipient && at - entry.at < 10000);
      if (toThem.length >= 5) return Math.max(1, Math.ceil((toThem[toThem.length - 5].at + 10000 - at) / 1000));
      recent.push({at, to: recipient});
      return 0;
    },
  };
}

export function createMessages({store = null, moderation = createModeration(), liveGame = () => false, push = () => false, playerFor = () => null, now = Date.now} = {}) {
  const limit = createSendLimit({now});
  const serve = serveJson({store, methods: 'GET, POST, DELETE, OPTIONS', unavailable: 'Messages are not available yet.', failure: 'Could not reach your messages. Please try again.'});
  const shown = message => ({id: message.id, from: message.senderId, to: message.recipientId, body: filterChat(message.body), clientId: message.clientId, sentAt: message.sentAt});
  const otherId = value => {
    const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return UUID.test(id) ? id : '';
  };

  async function send(user, input) {
    const to = otherId(input?.to);
    const body = cleanBody(input?.body);
    const clientId = typeof input?.clientId === 'string' ? input.clientId : '';
    if (!to || to === user.id) throw new HttpError(400, 'Choose another player.');
    if (!body || body.length > BODY_MAX) throw new HttpError(400, `A message is 1 to ${BODY_MAX} characters.`);
    if (!CLIENT_ID.test(clientId)) throw new HttpError(400, 'Invalid message.');

    // 1. Ban, then mute. Mutes live in the socket's MUTED set, which never sees HTTP, so this
    // is the only mute a private message meets. Copied from server/wall.mjs, and it fails
    // closed for the Wall's reason: a blip costs one refused message, not an open channel.
    let penalty;
    try { penalty = await moderation.status(user.id); }
    catch { throw new HttpError(503, 'Could not check your account right now. Please try again in a moment.'); }
    if (penalty.banned) throw new HttpError(403, 'Your account is suspended from LepakMamak.');
    if (penalty.muted) throw new HttpError(403, 'You are muted, so this did not send.');
    // 2. The Werewolf and Lukis rule from the socket's chat gate. Not in the city means no game.
    if (liveGame(user.id)) throw new HttpError(403, 'Geng dan DM ditutup masa main. Guna chat meja.');
    // 3. A block reads exactly like an unknown player: no fake delivery, no hint of the block.
    if (await store.isBlocked(to, user.id)) throw new HttpError(403, REFUSED);
    // 4. A refused recipient (unknown, or no handle) must not spend rate-limit budget, so this
    // runs before the limit.
    if (!(await store.handleFor(to))) throw new HttpError(403, REFUSED);
    // 5. Per sender account. Synchronous and records the send in the same tick as the decision
    // — see the comment on createSendLimit for why that matters under concurrent requests.
    const retryAfter = limit.take(user.id, to);
    if (retryAfter) throw new HttpError(429, 'Slow down.', {retryAfter});

    const {message, created} = await store.insertMessage({senderId: user.id, recipientId: to, body, clientId});
    const out = shown(message);
    if (!created) return {message: out, online: !!playerFor(to)};
    // Written first, pushed second: a socket that closed in between loses nothing.
    let online = false;
    try { online = !!push(to, {type: 'dm-new', message: out, from: {userId: user.id, handle: await store.handleFor(user.id), name: user.name}}); }
    catch { online = false; }
    return {message: out, online};
  }

  async function page(user, id, before) {
    if (!id || id === user.id) throw new HttpError(400, 'Choose another player.');
    if (before && !TIMESTAMP.test(before)) throw new HttpError(400, 'Invalid page.');
    const rows = await store.conversation(user.id, id, {before: before || null, limit: PAGE + 1});
    return {messages: rows.slice(0, PAGE).reverse().map(shown), more: rows.length > PAGE};
  }

  async function unread(user) {
    const [threads, blocked] = await Promise.all([store.unread(user.id), store.blocks(user.id)]);
    const visible = threads.filter(thread => !blocked.includes(thread.senderId));
    const ids = visible.map(thread => thread.senderId);
    const [handles, names] = await Promise.all([store.handlesFor(ids), store.names(ids.filter(id => !playerFor(id)))]);
    return {threads: visible.map(thread => ({
      userId: thread.senderId,
      handle: handles.get(thread.senderId) || null,
      name: cleanDisplayName(playerFor(thread.senderId)?.name || names.get(thread.senderId)),
      unread: thread.unread,
      lastAt: thread.lastAt,
    }))};
  }

  async function route(user, request, url) {
    const path = url.pathname;
    if (path === '/messages' && request.method === 'POST') return send(user, await readJson(request, 4096));
    if (path === '/messages/unread' && request.method === 'GET') return unread(user);
    const read = path.match(/^\/messages\/([^/]+)\/read$/);
    if (read && request.method === 'POST') {
      const id = otherId(read[1]);
      if (!id) throw new HttpError(400, 'Choose another player.');
      await store.markRead(user.id, id);
      return {};
    }
    const thread = path.match(/^\/messages\/([^/]+)$/);
    if (thread && request.method === 'GET') return page(user, otherId(thread[1]), url.searchParams.get('before'));
    if (path === '/blocks' && request.method === 'POST') {
      const id = otherId((await readJson(request, 4096))?.userId);
      if (!id || id === user.id) throw new HttpError(400, 'Choose another player.');
      await store.block(user.id, id);
      return {};
    }
    const unblock = path.match(/^\/blocks\/([^/]+)$/);
    if (unblock && request.method === 'DELETE') {
      const id = otherId(unblock[1]);
      if (!id) throw new HttpError(400, 'Choose another player.');
      await store.unblock(user.id, id);
      return {};
    }
    throw new HttpError(404, 'Not found');
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    if (path !== '/messages' && !path.startsWith('/messages/') && path !== '/blocks' && !path.startsWith('/blocks/')) return false;
    await serve(request, response, user => route(user, request, url));
    return true;
  }

  // What a moderator reads: the recent conversation, both sides, in the words actually sent.
  // Never passed through filterChat.
  async function reportFor(reporterId, reportedId) {
    const [rows, handle, names] = await Promise.all([
      store.conversation(reporterId, reportedId, {limit: 20}),
      store.handleFor(reportedId),
      store.names([reportedId]),
    ]);
    return {
      name: String(names.get(reportedId) || handle || 'Player').slice(0, 18),
      evidence: rows.reverse().map(row => ({from: row.senderId, body: row.body, sentAt: row.sentAt})),
    };
  }

  return {handle, reportFor};
}
