import {createClient} from '@supabase/supabase-js';

// Kuala Lumpur is UTC+8 all year, so the week turns at midnight Monday MYT with no DST to
// reason about. Returned as YYYY-MM-DD because that is what the week_start column holds.
export const KL_OFFSET_MS = 8 * 3600000;
export function weekStart(at = Date.now()) {
  const local = new Date(Number(at) + KL_OFFSET_MS);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - sinceMonday);
  return local.toISOString().slice(0, 10);
}

// Only two of the six counters are on the board. `punches` is player-versus-player and a
// public ranking of it rewards exactly the behaviour it counts; `recalls`, `dances` and
// `sessions` are farmable alone in a corner with no skill in them at all. Leaving them out
// of the table, rather than out of the query, keeps them off the board by construction.
export const BOARDS = ['basketball_points', 'tables_sat'];
const TOP = 5;
const origins = new Set(['https://lepakmamak.my', 'https://lepakmamak.pages.dev', 'https://lepak-city.pages.dev', 'http://localhost:5173', 'http://localhost:4173']);

export function createLeaderboard(services = {}) {
  const db = services.db || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}})
    : null);
  const now = services.now || Date.now;

  // Called with the same deltas the lifetime counters just took, so nothing new is counted.
  async function record(userId, displayName, values) {
    const gained = Object.fromEntries(BOARDS.filter(board => values?.[board] > 0).map(board => [board, values[board]]));
    if (!db || !userId || !Object.keys(gained).length) return;
    const week = weekStart(now());
    const found = await db.from('player_weekly_stats').select('*').eq('user_id', userId).eq('week_start', week).maybeSingle();
    if (found.data) {
      const updates = {display_name: displayName};
      for (const [board, amount] of Object.entries(gained)) updates[board] = Number(found.data[board] || 0) + amount;
      await db.from('player_weekly_stats').update(updates).eq('user_id', userId).eq('week_start', week);
    } else {
      await db.from('player_weekly_stats').insert({user_id: userId, week_start: week, display_name: displayName, ...gained});
    }
  }

  async function board(week, field) {
    const {data} = await db.from('player_weekly_stats').select('display_name,' + field)
      .eq('week_start', week).gt(field, 0).order(field, {ascending: false}).limit(TOP);
    return (data || []).map(row => ({name: row.display_name, value: Number(row[field] || 0)}));
  }

  async function handle(request, response) {
    if (new URL(request.url, 'http://localhost').pathname !== '/leaderboard') return false;
    const origin = request.headers.origin;
    if (origin && origins.has(origin)) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    if (origin && !origins.has(origin)) { response.writeHead(403); response.end(JSON.stringify({error: 'Origin not allowed'})); return true; }
    const week = weekStart(now());
    // Read-time only: a board that pushed updates would cost bandwidth per frame per
    // client, and the number nobody is looking at does not need to be live.
    const boards = db ? Object.fromEntries(await Promise.all(BOARDS.map(async field => [field, await board(week, field)]))) : {};
    response.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60'});
    response.end(JSON.stringify({weekStart: week, boards}));
    return true;
  }

  return {record, handle, weekStart: () => weekStart(now())};
}
