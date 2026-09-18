import {createClient} from '@supabase/supabase-js';
import {origins} from '../shared/origins.mjs';
import {clientKey, createRateLimiter} from './limits.mjs';

// The funnel, in the order a new player meets it. The browser is trusted with the steps
// that happen before there is a socket and nothing else; the rest are written by the
// server at the moment it makes them true, so no client can claim to have sat down.
export const CLIENT_EVENTS = new Set(['page_load', 'play_tapped', 'auth_shown', 'account_created']);
export const SERVER_EVENTS = new Set(['entered_city', 'first_sit', 'first_game']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 512;
// Long enough to compare one Ramadan or school holiday with the next, and no longer.
const KEEP_MS = 396 * 86400000;

export function createFunnel(services = {}) {
  const db = 'db' in services ? services.db : (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}})
    : null);
  const allow = createRateLimiter({limit: services.limit || 60, windowMs: 60000});
  // The per-address key is the leftmost X-Forwarded-For entry, which a caller can forge (see
  // limits.mjs), so on its own it is no ceiling at all. This one takes no key from the
  // request: it is what stops a stranger filling the table.
  // ponytail: 600 a minute is ~150 real arrivals a minute. Raise it when a launch gets there.
  const allowAny = createRateLimiter({limit: services.total || 600, windowMs: 60000});
  const now = services.now || Date.now;
  // Kept beside the player rather than on it: the player object is what `snapshot` broadcasts
  // to the room, and a device id has no business reaching anybody else's browser.
  const visits = new WeakMap();

  // Counting is never worth a player's evening. Every failure ends here.
  async function record(row) {
    if (!db) return;
    try { const {error} = await db.from('funnel_events').insert(row); if (error) console.warn('[funnel] insert refused:', error.message); }
    catch (error) { console.warn('[funnel] insert failed:', error instanceof Error ? error.message : error); }
  }

  function attach(player, device) {
    if (typeof device === 'string' && UUID.test(device)) visits.set(player, {device: device.toLowerCase(), seen: new Set()});
  }

  async function once(player, event) {
    const visit = visits.get(player);
    if (!visit || !SERVER_EVENTS.has(event) || visit.seen.has(event)) return;
    visit.seen.add(event);
    await record({device_id: visit.device, user_id: player.userId || null, guest: !!player.guest, event});
  }

  async function handle(request, response) {
    if (new URL(request.url, 'http://localhost').pathname !== '/event') return false;
    const reply = code => { response.writeHead(code); response.end(); return true; };
    const origin = request.headers.origin;
    // sendBeacon posts text/plain, so there is no preflight to answer; the Origin header is
    // the whole check. No CORS headers go back because the browser never reads the reply.
    if (!origin || !origins.has(origin)) return reply(403);
    if (request.method !== 'POST') return reply(405);
    if (!allow(clientKey(request)) || !allowAny('all')) return reply(429);
    let size = 0; const chunks = [];
    for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY) return reply(413); chunks.push(chunk); }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { return reply(400); }
    if (!body || typeof body.device !== 'string' || !UUID.test(body.device) || !CLIENT_EVENTS.has(body.event)) return reply(400);
    await record({device_id: body.device.toLowerCase(), user_id: null, guest: false, event: body.event});
    return reply(204);
  }

  // The privacy policy says these counts are kept thirteen months. This is what makes it true.
  async function purge() {
    if (!db) return;
    try { await db.from('funnel_events').delete().lt('at', new Date(now() - KEEP_MS).toISOString()); }
    catch (error) { console.warn('[funnel] purge failed:', error instanceof Error ? error.message : error); }
  }

  return {attach, once, handle, purge};
}
