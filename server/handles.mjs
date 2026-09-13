import crypto from 'node:crypto';
import {createRateLimiter} from './limits.mjs';
import {HttpError, readJson, serveJson} from './social-http.mjs';
import {cleanDisplayName} from './social-store.mjs';

export const HANDLE = /^[a-z0-9_]{3,18}$/;
const RESERVED = new Set(['mod', 'moderator', 'gm', 'support', 'system']);
// Refused as prefixes as well: these are the names worth impersonating.
const RESERVED_PREFIXES = ['admin', 'staff', 'official', 'lepakmamak'];

export const cleanHandle = value => typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';

export function handleProblem(handle) {
  if (typeof handle !== 'string') return 'invalid';
  if (RESERVED.has(handle) || RESERVED_PREFIXES.some(prefix => handle.startsWith(prefix))) return 'reserved';
  if (!HANDLE.test(handle)) return 'invalid';
  return null;
}

// A reserved prefix cannot be rescued by a suffix, so those names start again from "player".
export function handleBase(name) {
  const base = String(name || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18);
  return base && !RESERVED_PREFIXES.some(prefix => base.startsWith(prefix)) ? base : 'player';
}

export function suggestHandle(name, taken = new Set()) {
  const base = handleBase(name);
  if (!handleProblem(base) && !taken.has(base)) return base;
  for (let n = 2; n < 100000; n++) {
    const suffix = String(n);
    const candidate = base.slice(0, 18 - suffix.length) + suffix;
    if (!handleProblem(candidate) && !taken.has(candidate)) return candidate;
  }
  return `player${crypto.randomInt(100000, 999999999)}`;
}

export function createHandles({store = null, playerFor = () => null} = {}) {
  const checks = createRateLimiter({limit: 120, windowMs: 60000});
  const searches = createRateLimiter({limit: 60, windowMs: 60000});
  const serve = serveJson({store, methods: 'GET, POST, OPTIONS', unavailable: 'Handles are not available yet.', failure: 'Could not reach handles. Please try again.'});

  // Every candidate a suggestion can produce starts with the first 12 characters of its base,
  // so one prefix query answers them all.
  async function suggestFor(text) {
    const taken = new Set((await store.searchHandles(handleBase(text).slice(0, 12), 1000)).map(row => row.handle));
    return suggestHandle(text, taken);
  }

  async function required(userId, name) {
    if (!store || !userId || await store.handleFor(userId)) return null;
    return suggestFor(name);
  }

  async function search(user, url) {
    if (!searches(user.id)) throw new HttpError(429, 'Slow down.', {retryAfter: 60});
    const query = cleanHandle(url.searchParams.get('q'));
    if (!/^[a-z0-9_]{1,18}$/.test(query)) return {results: []};
    const found = (await store.searchHandles(query, 21)).filter(row => row.userId !== user.id).slice(0, 20);
    const offline = found.map(row => row.userId).filter(id => !playerFor(id));
    const [names, friendships] = await Promise.all([store.names(offline), store.friendships(user.id)]);
    const relations = new Map();
    for (const row of friendships) {
      const other = row.user_id === user.id ? row.friend_id : row.user_id;
      if (row.status === 'accepted') relations.set(other, 'friend');
      else if (relations.get(other) !== 'friend') relations.set(other, 'pending');
    }
    return {results: found.map(row => {
      const live = playerFor(row.userId);
      return {userId: row.userId, handle: row.handle, name: cleanDisplayName(live?.name || names.get(row.userId)), online: !!live, relation: relations.get(row.userId) || 'none'};
    })};
  }

  async function route(user, request, url) {
    if (url.pathname === '/handles/claim' && request.method === 'POST') {
      const input = await readJson(request, 4096);
      const handle = cleanHandle(input?.handle);
      const problem = handleProblem(handle);
      if (problem) {
        const message = problem === 'reserved' ? 'That handle is reserved.' : 'Handles are 3 to 18 letters, numbers or _.';
        throw new HttpError(422, message, {error: problem, message, suggestion: await suggestFor(handle || user.name)});
      }
      const result = await store.claimHandle(user.id, handle);
      if (result === 'claimed') throw new HttpError(409, 'Your handle is permanent.', {error: 'claimed', message: 'Your handle is permanent.', handle: await store.handleFor(user.id)});
      // Losing a race to the unique index lands here as well, with a fresh suggestion.
      if (result === 'taken') throw new HttpError(409, 'That handle is taken.', {error: 'taken', message: 'That handle is taken.', suggestion: await suggestFor(handle)});
      return {handle};
    }
    if (url.pathname === '/handles/check' && request.method === 'GET') {
      if (!checks(user.id)) throw new HttpError(429, 'Slow down.', {retryAfter: 60});
      const handle = cleanHandle(url.searchParams.get('h'));
      const problem = handleProblem(handle);
      if (problem) return {available: false, reason: problem};
      return {available: !(await store.ownerOf(handle))};
    }
    if (url.pathname === '/players/search' && request.method === 'GET') return search(user, url);
    throw new HttpError(404, 'Not found');
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith('/handles/') && url.pathname !== '/players/search') return false;
    await serve(request, response, user => route(user, request, url));
    return true;
  }

  // Dev stand-ins only. A stand-in identity resets every time the dev server restarts, so asking
  // a guest to deliberately claim a permanent handle for it is ceremony with no value, and the
  // undismissable claim screen would block every dev guest and every browser spec that drives the
  // dev server. So a stand-in gets the claim screen's own suggestion, claimed for it. Real accounts
  // (a persistent store) are never auto-assigned: they always go through the claim screen.
  async function autoClaim(userId, name) {
    if (!store || store.persistent || !userId) return null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await store.handleFor(userId);
      if (existing) return existing;
      // A lost race to the same handle simply asks for the next free suggestion.
      if (await store.claimHandle(userId, await suggestFor(name)) !== 'taken') return store.handleFor(userId);
    }
    return null;
  }

  return {handle, required, autoClaim, suggestFor};
}
