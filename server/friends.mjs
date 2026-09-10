import {createClient} from '@supabase/supabase-js';
import {origins} from '../shared/origins.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanDisplayName(value) {
  const clean = typeof value === 'string'
    ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 18)
    : '';
  return clean.length >= 2 ? clean : 'Player';
}

class FriendsHttpError extends Error {
  constructor(status, message, data = {}) { super(message); this.status = status; this.data = data; }
}

export function createFriends(services = {}) {
  const db = services.db || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}})
    : null);
  const resolvePlayer = typeof services.resolvePlayer === 'function' ? services.resolvePlayer : () => null;
  const playerFor = typeof services.playerFor === 'function' ? services.playerFor : () => null;
  const isOnline = typeof services.isOnline === 'function' ? services.isOnline : id => !!playerFor(id);
  const onChanged = typeof services.onChanged === 'function' ? services.onChanged : async () => {};
  const check = result => { if (result?.error) throw Error('Database operation failed'); return result.data; };

  async function readBody(request) {
    const chunks = []; let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 16384) throw new FriendsHttpError(413, 'Request too large.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    catch { throw new FriendsHttpError(400, 'Send JSON.'); }
  }

  async function userFor(request) {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token || token.length > 3500 || !db) throw new FriendsHttpError(db ? 401 : 503, db ? 'Please log in again.' : 'Friends are not available yet.');
    const {data, error} = await db.auth.getUser(token);
    if (error || !data?.user || data.user.is_anonymous) throw new FriendsHttpError(401, 'Please log in again.');
    return data.user;
  }

  async function rows(query) {
    const result = await query;
    if (result?.error) throw Error('Database operation failed');
    return result.data || [];
  }

  function onlineInfo(userId) {
    const player = playerFor(userId);
    return {online: player ? true : !!isOnline(userId), playerId: player?.id || null};
  }

  function requestCopy(id, name, requestedAt) {
    return {id, name: cleanDisplayName(name), requestedAt, playerId: onlineInfo(id).playerId};
  }

  async function state(userId) {
    if (!db) throw new FriendsHttpError(503, 'Friends are not available yet.');
    const [outgoingAndAccepted, incomingAndAccepted] = await Promise.all([
      rows(db.from('game_friendships').select('user_id,friend_id,requested_by,user_name,friend_name,status,requested_at,accepted_at').eq('user_id', userId).order('requested_at', {ascending: false})),
      rows(db.from('game_friendships').select('user_id,friend_id,requested_by,user_name,friend_name,status,requested_at,accepted_at').eq('friend_id', userId).order('requested_at', {ascending: false})),
    ]);
    const friends = new Map();
    const incoming = new Map();
    const outgoing = new Map();
    for (const row of outgoingAndAccepted) {
      if (row.status === 'accepted') friends.set(row.friend_id, {id: row.friend_id, name: cleanDisplayName(row.friend_name), ...onlineInfo(row.friend_id)});
      else if (row.status === 'pending') outgoing.set(row.friend_id, requestCopy(row.friend_id, row.friend_name, row.requested_at));
    }
    for (const row of incomingAndAccepted) {
      if (row.status === 'accepted') friends.set(row.user_id, {id: row.user_id, name: cleanDisplayName(row.user_name), ...onlineInfo(row.user_id)});
      else if (row.status === 'pending') incoming.set(row.user_id, requestCopy(row.user_id, row.user_name, row.requested_at));
    }
    return {
      friends: [...friends.values()].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)),
      incoming: [...incoming.values()],
      outgoing: [...outgoing.values()],
    };
  }

  async function targetFor(user, input) {
    const playerId = typeof input?.playerId === 'string' ? input.playerId.trim() : '';
    if (playerId) {
      const player = await Promise.resolve(resolvePlayer(playerId));
      if (!player?.userId || player.userId === user.id || player.guest) throw new FriendsHttpError(404, 'That player cannot receive a friend request.');
      return {id: player.userId, name: cleanDisplayName(player.name), playerId: player.id};
    }
    const id = typeof input?.id === 'string' ? input.id.trim() : '';
    if (!UUID.test(id) || id === user.id) throw new FriendsHttpError(400, 'Choose another registered player.');
    if (!db.auth?.admin?.getUserById) throw new FriendsHttpError(503, 'Friends are not available yet.');
    const result = await db.auth.admin.getUserById(id);
    if (result?.error || !result?.data?.user || result.data.user.is_anonymous) throw new FriendsHttpError(404, 'That player could not be found.');
    return {id, name: cleanDisplayName(result.data.user.user_metadata?.display_name)};
  }

  function resultFailure(result) {
    if (!result || typeof result !== 'object') return null;
    const messages = {
      self: 'You cannot add yourself.',
      already_friend: 'You are already friends.',
      pending: 'Your friend request is already waiting.',
      incoming: 'They already sent you a request. Accept it in Friends.',
      not_pending: 'That friend request is no longer waiting.',
      not_friend: 'That player is not in your Friend List.',
    };
    return result.reason && messages[result.reason] ? {status: 409, message: messages[result.reason], data: result} : null;
  }

  async function mutation(user, pathname, input) {
    let result;
    let targetId = null;
    if (pathname === '/friends/request') {
      const target = await targetFor(user, input);
      targetId = target.id;
      result = check(await db.rpc('game_friend_request', {
        p_user_id: user.id, p_friend_id: target.id,
        p_user_name: cleanDisplayName(user.user_metadata?.display_name), p_friend_name: target.name,
      }));
    } else if (pathname === '/friends/respond') {
      targetId = typeof input?.id === 'string' ? input.id.trim() : '';
      if (!UUID.test(targetId) || typeof input?.approved !== 'boolean') throw new FriendsHttpError(400, 'Invalid friend request.');
      result = check(await db.rpc('game_friend_respond', {
        p_user_id: user.id, p_friend_id: targetId,
        p_user_name: cleanDisplayName(user.user_metadata?.display_name), p_approved: input.approved,
      }));
    } else if (pathname === '/friends/cancel') {
      targetId = typeof input?.id === 'string' ? input.id.trim() : '';
      if (!UUID.test(targetId)) throw new FriendsHttpError(400, 'Invalid friend request.');
      result = check(await db.rpc('game_friend_cancel', {p_user_id: user.id, p_friend_id: targetId}));
    } else if (pathname === '/friends/remove') {
      targetId = typeof input?.id === 'string' ? input.id.trim() : '';
      if (!UUID.test(targetId)) throw new FriendsHttpError(400, 'Invalid friend.');
      result = check(await db.rpc('game_friend_remove', {p_user_id: user.id, p_friend_id: targetId}));
    } else throw new FriendsHttpError(404, 'Not found');
    const failure = resultFailure(result);
    if (failure) throw new FriendsHttpError(failure.status, failure.message, failure.data);
    try { await onChanged([user.id, targetId].filter(Boolean)); } catch { /* The mutation still landed; the next refresh catches up. */ }
    return result;
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith('/friends')) return false;
    const requestOrigin = request.headers.origin;
    const reply = (status, data) => {
      response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      response.end(JSON.stringify(data));
    };
    if (requestOrigin && origins.has(requestOrigin)) {
      response.setHeader('Access-Control-Allow-Origin', requestOrigin); response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') { response.writeHead(origins.has(requestOrigin) ? 204 : 403); response.end(); return true; }
    if (requestOrigin && !origins.has(requestOrigin)) { reply(403, {error: 'Origin not allowed'}); return true; }
    if (!db) { reply(503, {error: 'Friends are not available yet.'}); return true; }
    try {
      const user = await userFor(request);
      if (url.pathname === '/friends/state' && request.method === 'GET') { reply(200, {state: await state(user.id)}); return true; }
      if (request.method !== 'POST') { reply(405, {error: 'Method not allowed'}); return true; }
      const result = await mutation(user, url.pathname, await readBody(request));
      reply(200, {result, state: await state(user.id)});
    } catch (error) {
      if (error instanceof FriendsHttpError) { reply(error.status, {error: error.message, ...error.data}); return true; }
      reply(500, {error: 'Could not update your Friend List. Please try again.'});
    }
    return true;
  }

  return {handle, state};
}
