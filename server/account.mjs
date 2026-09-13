import { createClient } from '@supabase/supabase-js';
import {origins} from '../shared/origins.mjs';

// Deleting an account needs the service role, which must never reach the browser, so it
// lives here rather than in the client's Supabase session. Changing a password does not:
// the browser already holds a session that can do it.

// Every table that is keyed to a person, with the column that names them. Rows are cleared
// before the account goes, so nothing is left pointing at a user id that no longer exists.
export const OWNED_ROWS = [
  ['social_post_likes', 'user_id'],
  ['social_post_replies', 'user_id'],
  ['social_posts', 'user_id'],
  ['profile_guestbook', 'author_user_id'],
  ['profile_guestbook', 'profile_user_id'],
  ['profile_activity', 'user_id'],
  ['player_achievements', 'user_id'],
  ['player_social_stats', 'user_id'],
  ['shop_inventory', 'user_id'],
  ['chat_messages', 'user_id'],
  // Sent messages go too, out of other players' inboxes: the spec chose that over orphans.
  ['player_handles', 'user_id'],
  ['game_messages', 'sender_user_id'],
  ['game_messages', 'recipient_user_id'],
  ['player_blocks', 'blocker_user_id'],
  ['player_blocks', 'blocked_user_id'],
];

export function createAccounts(services = {}) {
  const db = services.db || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}})
    : null);
  const now = services.now || Date.now;
  const onDeleted = services.onDeleted || (() => {});
  const lastAttempt = new Map();

  const reply = (response, status, data) => {
    response.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    response.end(JSON.stringify(data));
  };
  async function readBody(request) {
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 4096) throw Error('POST_TOO_LARGE'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/account/delete') return false;
    const origin = request.headers.origin;
    if (origin && origins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') { response.writeHead(origins.has(origin) ? 204 : 403); response.end(); return true; }
    if (origin && !origins.has(origin)) { reply(response, 403, {error: 'Origin not allowed'}); return true; }
    if (request.method !== 'POST') { reply(response, 405, {error: 'Use POST to delete an account.'}); return true; }
    if (!db) { reply(response, 503, {error: 'Account deletion is not available yet.'}); return true; }

    const token = request.headers.authorization?.replace(/^Bearer /, '');
    if (!token) { reply(response, 401, {error: 'Log in again to delete your account.'}); return true; }
    const {data, error} = await db.auth.getUser(token);
    const account = error || data?.user?.is_anonymous ? null : data?.user;
    if (!account) { reply(response, 401, {error: 'Log in again to delete your account.'}); return true; }

    // A deletion is final, so it is typed out in full rather than clicked by accident.
    let body; try { body = await readBody(request); } catch { reply(response, 400, {error: 'Send JSON.'}); return true; }
    if (body?.confirm !== 'DELETE') { reply(response, 400, {error: 'Type DELETE to confirm.'}); return true; }
    // has(), not `|| 0`: a first attempt early in the clock would otherwise limit itself.
    if (lastAttempt.has(account.id) && now() - lastAttempt.get(account.id) < 3000) { reply(response, 429, {error: 'Give it a moment and try again.'}); return true; }
    lastAttempt.set(account.id, now());

    // Rows first: an account that vanished before its rows would leave them orphaned with
    // no way left to identify their owner.
    for (const [table, column] of OWNED_ROWS) {
      const result = await db.from(table).delete().eq(column, account.id);
      if (result?.error) { reply(response, 502, {error: 'Could not clear your data. Nothing was deleted.'}); return true; }
    }
    const removal = await db.auth.admin.deleteUser(account.id);
    if (removal?.error) { reply(response, 502, {error: 'Could not delete the account. Please try again.'}); return true; }
    onDeleted(account.id);
    reply(response, 200, {deleted: true});
    return true;
  }

  return {handle};
}
