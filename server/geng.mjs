import {createClient} from '@supabase/supabase-js';
import {origins} from '../shared/origins.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeGengName(value) {
  if (typeof value !== 'string') return null;
  const clean = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
  return clean.length >= 2 ? clean : null;
}

function cleanDisplayName(value) {
  const clean = typeof value === 'string'
    ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 18)
    : '';
  return clean.length >= 2 ? clean : 'Player';
}

class GengHttpError extends Error {
  constructor(status, message, data = {}) {
    super(message); this.status = status; this.data = data;
  }
}

export function createGengs(services = {}) {
  const db = services.db || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}})
    : null);
  const onChanged = typeof services.onChanged === 'function' ? services.onChanged : async () => {};
  const check = result => { if (result?.error) throw Error('Database operation failed'); return result.data; };

  async function readBody(request) {
    const chunks = []; let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 16384) throw Error('Request too large');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    catch { throw new GengHttpError(400, 'Send JSON.'); }
  }

  async function userFor(request) {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token || token.length > 3500 || !db) throw new GengHttpError(db ? 401 : 503, db ? 'Please log in again.' : 'Geng is not available yet.');
    const {data, error} = await db.auth.getUser(token);
    if (error || !data?.user || data.user.is_anonymous) throw new GengHttpError(401, 'Please log in again.');
    return data.user;
  }

  async function rows(query) {
    const result = await query;
    if (result?.error) throw Error('Database operation failed');
    return result.data || [];
  }

  async function wallet(userId) {
    const result = check(await db.rpc('game_wallet_get', {p_user_id: userId}));
    return Number.isFinite(Number(result?.balance)) ? Number(result.balance) : 0;
  }

  async function state(userId) {
    if (!db) throw new GengHttpError(503, 'Geng is not available yet.');
    const [memberships, guilds, balance] = await Promise.all([
      rows(db.from('game_geng_members').select('geng_id,user_id,display_name,status,requested_at,joined_at').eq('user_id', userId)),
      rows(db.from('game_gengs').select('id,name,leader_id,created_at').order('name', {ascending: true}).limit(100)),
      wallet(userId),
    ]);
    const ids = guilds.map(geng => geng.id).filter(Boolean);
    const members = ids.length
      ? await rows(db.from('game_geng_members').select('geng_id,user_id,display_name,status,requested_at,joined_at').in('geng_id', ids))
      : [];
    const guildById = new Map(guilds.map(geng => [geng.id, geng]));
    const currentMembership = memberships.find(member => member.status === 'member' && guildById.has(member.geng_id));
    const currentGuild = currentMembership ? guildById.get(currentMembership.geng_id) : null;
    const leader = !!currentGuild && currentGuild.leader_id === userId;
    const pending = leader
      ? members.filter(member => member.geng_id === currentGuild.id && member.status === 'pending').map(member => ({id: member.user_id, name: cleanDisplayName(member.display_name), requestedAt: member.requested_at}))
      : [];
    const memberCounts = new Map();
    for (const member of members) if (member.status === 'member') memberCounts.set(member.geng_id, (memberCounts.get(member.geng_id) || 0) + 1);
    const membersByGeng = new Map();
    for (const member of members) if (member.status === 'member') {
      const roster = membersByGeng.get(member.geng_id) || [];
      roster.push({id: member.user_id, name: cleanDisplayName(member.display_name), leader: member.user_id === guildById.get(member.geng_id)?.leader_id});
      membersByGeng.set(member.geng_id, roster);
    }
    const currentRoster = currentGuild ? (membersByGeng.get(currentGuild.id) || []) : [];
    const leaderName = currentRoster.find(member => member.leader)?.name || 'Geng leader';
    const requested = new Set(memberships.filter(member => member.status === 'pending').map(member => member.geng_id));
    return {
      balance,
      current: currentGuild ? {id: currentGuild.id, name: currentGuild.name, leaderName, leader, memberCount: memberCounts.get(currentGuild.id) || 0} : null,
      members: currentRoster,
      pending,
      guilds: guilds.map(geng => {
        const roster = membersByGeng.get(geng.id) || [];
        return {id: geng.id, name: geng.name, leaderName: roster.find(member => member.leader)?.name || 'Geng leader', memberCount: memberCounts.get(geng.id) || 0, members: roster, current: geng.id === currentGuild?.id, requested: requested.has(geng.id)};
      }),
    };
  }

  async function forPlayer(userId) {
    if (!db || !userId) return null;
    const result = await state(userId);
    return result.current;
  }

  function resultFailure(result) {
    if (!result || typeof result !== 'object') return null;
    const messages = {
      insufficient: 'You need 1,000 Syiling to create a Geng.',
      name_taken: 'That Geng name is already taken.',
      already_in_geng: 'You already belong to a Geng.',
      member: 'You are already in this Geng.',
      pending: 'Your request is already waiting for the leader.',
      not_found: 'That Geng no longer exists.',
      not_leader: 'Only the Geng leader can do that.',
      not_pending: 'That request is no longer waiting.',
      leader_has_members: 'A leader must remove every member before leaving.',
      not_member: 'You are not in a Geng.',
    };
    return result.reason && messages[result.reason] ? {status: 409, message: messages[result.reason], data: result} : null;
  }

  async function mutation(user, pathname, input) {
    let result;
    if (pathname === '/geng/create') {
      const name = sanitizeGengName(input?.name);
      if (!name) throw new GengHttpError(400, 'Choose a Geng name between 2 and 24 characters.');
      result = check(await db.rpc('game_geng_create', {p_user_id: user.id, p_name: name, p_display_name: cleanDisplayName(user.user_metadata?.display_name)}));
    } else if (pathname === '/geng/request') {
      if (!UUID.test(String(input?.gengId || ''))) throw new GengHttpError(400, 'That Geng could not be found.');
      result = check(await db.rpc('game_geng_request', {p_user_id: user.id, p_geng_id: input.gengId, p_display_name: cleanDisplayName(user.user_metadata?.display_name)}));
    } else if (pathname === '/geng/approve') {
      if (!UUID.test(String(input?.userId || '')) || typeof input?.approved !== 'boolean') throw new GengHttpError(400, 'Invalid member request.');
      result = check(await db.rpc('game_geng_approve', {p_leader_id: user.id, p_user_id: input.userId, p_approved: input.approved}));
    } else if (pathname === '/geng/leave') {
      result = check(await db.rpc('game_geng_leave', {p_user_id: user.id}));
    } else if (pathname === '/geng/disband') {
      result = check(await db.rpc('game_geng_disband', {p_leader_id: user.id}));
    } else throw new GengHttpError(404, 'Not found');
    const failure = resultFailure(result);
    if (failure) throw new GengHttpError(failure.status, failure.message, failure.data);
    // A leader approving a request changes another player's badge. Let the realtime
    // server refresh connected accounts immediately so nobody has to reopen the panel.
    await onChanged({pathname, actorId: user.id, targetId: input?.userId || null, gengId: input?.gengId || null});
    return result;
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith('/geng')) return false;
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
    if (!db) { reply(503, {error: 'Geng is not available yet.'}); return true; }
    try {
      const user = await userFor(request);
      if (url.pathname === '/geng/state' && request.method === 'GET') { reply(200, {state: await state(user.id)}); return true; }
      if (request.method !== 'POST') { reply(405, {error: 'Method not allowed'}); return true; }
      const result = await mutation(user, url.pathname, await readBody(request));
      reply(url.pathname === '/geng/create' ? 201 : 200, {result, state: await state(user.id)});
    } catch (error) {
      if (error instanceof GengHttpError) { reply(error.status, {error: error.message, ...error.data}); return true; }
      reply(500, {error: 'Could not update your Geng. Please try again.'});
    }
    return true;
  }

  return {handle, state, forPlayer};
}
