import {createClient} from '@supabase/supabase-js';
import crypto from 'node:crypto';

// Friends, handles and messages all read and write through one of these. Production uses
// Supabase; dev has no database, so an in-memory store stands in and resets on restart.
// tests/social-store.spec.ts runs one contract against both so they cannot drift apart.

export function cleanDisplayName(value) {
  const clean = typeof value === 'string'
    ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 18)
    : '';
  return clean.length >= 2 ? clean : 'Player';
}

// Matches the generated game_messages.pair column: uuid order is bytewise, which is the
// same as ordering the lowercase hex strings.
export const pairOf = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

const UNIQUE_VIOLATION = '23505';
const failed = () => new Error('Database operation failed');
const check = result => { if (result?.error) throw failed(); return result.data; };
const escapeLike = prefix => `${prefix.replace(/[\\%_]/g, character => `\\${character}`)}%`;
const messageFrom = row => ({id: row.id, senderId: row.sender_user_id, recipientId: row.recipient_user_id, body: row.body, clientId: row.client_id, sentAt: row.sent_at, readAt: row.read_at});
const tally = rows => {
  const threads = new Map();
  for (const row of rows) {
    const thread = threads.get(row.senderId) || {senderId: row.senderId, unread: 0, lastAt: row.sentAt};
    thread.unread += 1;
    threads.set(row.senderId, thread);
  }
  return [...threads.values()];
};

export function createSocialStore(env = process.env) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return createSupabaseSocialStore(createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}}));
  }
  // Half-configured Supabase is still Supabase: the feature stays unavailable rather than
  // handing out stand-in accounts on anything that looks like production.
  if (env.SUPABASE_URL || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY) return null;
  return createMemorySocialStore();
}

export function createSupabaseSocialStore(db) {
  async function account(id) {
    const result = await db.auth.admin.getUserById(id);
    const user = result?.data?.user;
    return result?.error || !user || user.is_anonymous ? null : {id, name: cleanDisplayName(user.user_metadata?.display_name)};
  }
  async function handleFor(userId) {
    const rows = check(await db.from('player_handles').select('handle').eq('user_id', userId).limit(1));
    return rows?.[0]?.handle || null;
  }
  return {
    persistent: true,
    async userForToken(token) {
      const {data, error} = await db.auth.getUser(token);
      if (error || !data?.user || data.user.is_anonymous) return null;
      return {id: data.user.id, name: cleanDisplayName(data.user.user_metadata?.display_name)};
    },
    account,
    // ponytail: one admin read per offline name, at most 20 per search. A profile table with
    // display names would make this one query if search traffic ever warrants it.
    async names(ids) {
      const found = await Promise.all([...new Set(ids)].map(async id => [id, (await account(id).catch(() => null))?.name]));
      return new Map(found.filter(([, name]) => name));
    },
    handleFor,
    async handlesFor(ids) {
      const wanted = [...new Set(ids)];
      if (!wanted.length) return new Map();
      const rows = check(await db.from('player_handles').select('user_id,handle').in('user_id', wanted));
      return new Map((rows || []).map(row => [row.user_id, row.handle]));
    },
    async ownerOf(handle) {
      const rows = check(await db.from('player_handles').select('user_id').eq('handle', handle).limit(1));
      return rows?.[0]?.user_id || null;
    },
    async claimHandle(userId, handle) {
      const result = await db.from('player_handles').insert({user_id: userId, handle});
      if (!result?.error) return 'ok';
      if (result.error.code !== UNIQUE_VIOLATION) throw failed();
      // Either key can clash: this account already holds a handle, or someone else holds this one.
      return (await handleFor(userId)) ? 'claimed' : 'taken';
    },
    async searchHandles(prefix, limit) {
      const rows = check(await db.from('player_handles').select('user_id,handle').like('handle', escapeLike(prefix)).order('handle', {ascending: true}).limit(limit));
      return (rows || []).map(row => ({userId: row.user_id, handle: row.handle}));
    },
    async insertMessage({senderId, recipientId, body, clientId}) {
      const inserted = await db.from('game_messages').insert({sender_user_id: senderId, recipient_user_id: recipientId, body, client_id: clientId}).select('*').single();
      if (!inserted?.error) return {message: messageFrom(inserted.data), created: true};
      if (inserted.error.code !== UNIQUE_VIOLATION) throw failed();
      // A retry of something already stored: hand back the original.
      const rows = check(await db.from('game_messages').select('*').eq('sender_user_id', senderId).eq('client_id', clientId).limit(1));
      if (!rows?.[0]) throw failed();
      return {message: messageFrom(rows[0]), created: false};
    },
    // ponytail: the page cursor is sent_at alone, so two messages in one conversation with an
    // identical timestamp at a page boundary could hide one. Add id to the cursor if it shows up.
    async conversation(a, b, {before = null, limit = 30} = {}) {
      let query = db.from('game_messages').select('*').eq('pair', pairOf(a, b));
      if (before) query = query.lt('sent_at', before);
      const rows = check(await query.order('sent_at', {ascending: false}).order('id', {ascending: false}).limit(limit));
      return (rows || []).map(messageFrom);
    },
    async markRead(recipientId, senderId) {
      check(await db.from('game_messages').update({read_at: new Date().toISOString()}).eq('recipient_user_id', recipientId).eq('sender_user_id', senderId).is('read_at', null));
    },
    // ponytail: counts the newest 1000 unread rows; an inbox past that shows 1000 until read.
    async unread(recipientId) {
      const rows = check(await db.from('game_messages').select('sender_user_id,sent_at').eq('recipient_user_id', recipientId).is('read_at', null).order('sent_at', {ascending: false}).limit(1000));
      return tally((rows || []).map(row => ({senderId: row.sender_user_id, sentAt: row.sent_at})));
    },
    async block(blocker, blocked) {
      check(await db.from('player_blocks').upsert({blocker_user_id: blocker, blocked_user_id: blocked}, {onConflict: 'blocker_user_id,blocked_user_id', ignoreDuplicates: true}));
    },
    async unblock(blocker, blocked) {
      check(await db.from('player_blocks').delete().eq('blocker_user_id', blocker).eq('blocked_user_id', blocked));
    },
    async isBlocked(blocker, blocked) {
      const rows = check(await db.from('player_blocks').select('blocker_user_id').eq('blocker_user_id', blocker).eq('blocked_user_id', blocked).limit(1));
      return !!rows?.length;
    },
    async blocks(blocker) {
      const rows = check(await db.from('player_blocks').select('blocked_user_id').eq('blocker_user_id', blocker));
      return (rows || []).map(row => row.blocked_user_id);
    },
    async friendships(userId) {
      const columns = 'user_id,friend_id,requested_by,user_name,friend_name,status,requested_at,accepted_at';
      const [mine, theirs] = await Promise.all([
        db.from('game_friendships').select(columns).eq('user_id', userId).order('requested_at', {ascending: false}),
        db.from('game_friendships').select(columns).eq('friend_id', userId).order('requested_at', {ascending: false}),
      ]);
      return [...(check(mine) || []), ...(check(theirs) || [])];
    },
    friendRequest: async ({userId, friendId, userName, friendName}) => check(await db.rpc('game_friend_request', {p_user_id: userId, p_friend_id: friendId, p_user_name: userName, p_friend_name: friendName})),
    friendRespond: async ({userId, friendId, userName, approved}) => check(await db.rpc('game_friend_respond', {p_user_id: userId, p_friend_id: friendId, p_user_name: userName, p_approved: approved})),
    friendCancel: async ({userId, friendId}) => check(await db.rpc('game_friend_cancel', {p_user_id: userId, p_friend_id: friendId})),
    friendRemove: async ({userId, friendId}) => check(await db.rpc('game_friend_remove', {p_user_id: userId, p_friend_id: friendId})),
  };
}

// Dev only. Holds everything in this process and forgets it on restart, which the spec accepts.
export function createMemorySocialStore({now = Date.now} = {}) {
  const accounts = new Map();
  const tokens = new Map();
  const handles = new Map();
  const owners = new Map();
  const messages = [];
  const blocked = new Set();
  const friendships = new Map();
  const iso = () => new Date(now()).toISOString();
  const copy = row => ({...row});

  return {
    persistent: false,
    issueStandIn(name) {
      const userId = crypto.randomUUID();
      const token = crypto.randomBytes(24).toString('base64url');
      accounts.set(userId, {id: userId, name: cleanDisplayName(name)});
      tokens.set(token, userId);
      return {userId, token};
    },
    resumeStandIn(token, name) {
      const userId = typeof token === 'string' ? tokens.get(token) : undefined;
      if (!userId) return null;
      accounts.get(userId).name = cleanDisplayName(name);
      return {userId, token};
    },
    async userForToken(token) { const userId = tokens.get(token); return userId ? copy(accounts.get(userId)) : null; },
    async account(id) { return accounts.has(id) ? copy(accounts.get(id)) : null; },
    async names(ids) { return new Map(ids.filter(id => accounts.has(id)).map(id => [id, accounts.get(id).name])); },
    async handleFor(userId) { return handles.get(userId) || null; },
    async handlesFor(ids) { return new Map(ids.filter(id => handles.has(id)).map(id => [id, handles.get(id)])); },
    async ownerOf(handle) { return owners.get(handle.toLowerCase()) || null; },
    async claimHandle(userId, handle) {
      if (handles.has(userId)) return 'claimed';
      if (owners.has(handle.toLowerCase())) return 'taken';
      handles.set(userId, handle);
      owners.set(handle.toLowerCase(), userId);
      return 'ok';
    },
    async searchHandles(prefix, limit) {
      return [...owners.entries()]
        .filter(([handle]) => handle.startsWith(prefix))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .slice(0, limit)
        .map(([handle, userId]) => ({userId, handle}));
    },
    async insertMessage({senderId, recipientId, body, clientId}) {
      const existing = messages.find(message => message.senderId === senderId && message.clientId === clientId);
      if (existing) return {message: copy(existing), created: false};
      // Strictly increasing, so the sent_at page cursor never meets a tie here.
      const last = messages.at(-1);
      const at = Math.max(now(), last ? Date.parse(last.sentAt) + 1 : 0);
      const message = {id: crypto.randomUUID(), senderId, recipientId, body, clientId, sentAt: new Date(at).toISOString(), readAt: null};
      messages.push(message);
      return {message: copy(message), created: true};
    },
    async conversation(a, b, {before = null, limit = 30} = {}) {
      const pair = pairOf(a, b);
      return messages
        .filter(message => pairOf(message.senderId, message.recipientId) === pair && (!before || message.sentAt < before))
        .reverse().slice(0, limit).map(copy);
    },
    async markRead(recipientId, senderId) {
      const at = iso();
      for (const message of messages) if (message.recipientId === recipientId && message.senderId === senderId && !message.readAt) message.readAt = at;
    },
    async unread(recipientId) {
      return tally(messages.filter(message => message.recipientId === recipientId && !message.readAt).reverse());
    },
    async block(blocker, target) { blocked.add(`${blocker}:${target}`); },
    async unblock(blocker, target) { blocked.delete(`${blocker}:${target}`); },
    async isBlocked(blocker, target) { return blocked.has(`${blocker}:${target}`); },
    async blocks(blocker) { return [...blocked].filter(key => key.startsWith(`${blocker}:`)).map(key => key.slice(blocker.length + 1)); },
    async friendships(userId) {
      const rows = [...friendships.values()].map(copy);
      const newest = (a, b) => b.requested_at.localeCompare(a.requested_at);
      return [...rows.filter(row => row.user_id === userId).sort(newest), ...rows.filter(row => row.friend_id === userId).sort(newest)];
    },
    // The four transitions below are game_friend_* from 20260911110000_game_friends.sql.
    async friendRequest({userId, friendId, userName, friendName}) {
      if (userId === friendId) return {requested: false, reason: 'self'};
      const same = friendships.get(`${userId}:${friendId}`)?.status;
      const reverse = friendships.get(`${friendId}:${userId}`)?.status;
      if (same === 'accepted') return {requested: false, reason: 'already_friend'};
      if (same === 'pending') return {requested: false, reason: 'pending'};
      if (reverse === 'accepted') return {requested: false, reason: 'already_friend'};
      if (reverse === 'pending') return {requested: false, reason: 'incoming'};
      friendships.set(`${userId}:${friendId}`, {user_id: userId, friend_id: friendId, requested_by: userId, user_name: userName, friend_name: friendName, status: 'pending', requested_at: iso(), accepted_at: null});
      return {requested: true};
    },
    async friendRespond({userId, friendId, userName, approved}) {
      const request = friendships.get(`${friendId}:${userId}`);
      if (request?.status !== 'pending') return {responded: false, reason: 'not_pending'};
      if (!approved) { friendships.delete(`${friendId}:${userId}`); return {responded: false, declined: true}; }
      const at = iso();
      Object.assign(request, {status: 'accepted', accepted_at: at, friend_name: userName});
      friendships.set(`${userId}:${friendId}`, {user_id: userId, friend_id: friendId, requested_by: friendId, user_name: userName, friend_name: request.user_name, status: 'accepted', requested_at: at, accepted_at: at});
      return {responded: true, accepted: true};
    },
    async friendCancel({userId, friendId}) {
      const key = `${userId}:${friendId}`;
      if (friendships.get(key)?.status !== 'pending') return {cancelled: false, reason: 'not_pending'};
      friendships.delete(key);
      return {cancelled: true};
    },
    async friendRemove({userId, friendId}) {
      let removed = false;
      for (const key of [`${userId}:${friendId}`, `${friendId}:${userId}`]) {
        if (friendships.get(key)?.status === 'accepted') { friendships.delete(key); removed = true; }
      }
      return removed ? {removed: true} : {removed: false, reason: 'not_friend'};
    },
  };
}
