import { createClient } from '@supabase/supabase-js';

// A penalty with no expiry is permanent; one whose expiry has passed is already over and
// is treated as absent rather than being cleaned up, so nothing depends on a sweep job.
function live(row) {
  return !!row && (!row.expires_at || Date.parse(row.expires_at) > Date.now());
}

function verdict(row) {
  return { banned: row.kind === 'ban', muted: row.kind === 'mute', until: row.expires_at || null, reason: row.reason || '' };
}

const CLEAR = { banned: false, muted: false, until: null, reason: '' };

export function createModeration(services = {}) {
  const db = services.db || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null);

  return {
    get available() { return !!db; },

    // One account, asked at the door. Throws on a database failure so the caller decides
    // what an outage means for it — joining fails open, posting to the Wall fails closed.
    async status(userId) {
      if (!db || !userId) return CLEAR;
      const { data, error } = await db.from('player_bans')
        .select('kind,expires_at,reason')
        .eq('user_id', userId)
        .limit(1);
      if (error) throw new Error('Could not check moderation status');
      const row = data?.[0];
      return live(row) ? verdict(row) : CLEAR;
    },

    // Every connected account in one query, for the sweep that catches players who were
    // already in the city when the penalty landed. Accounts with no penalty are absent
    // from the result, so a missing key means "clear".
    async statuses(userIds) {
      const wanted = [...new Set(userIds.filter(Boolean))];
      if (!db || !wanted.length) return new Map();
      const { data, error } = await db.from('player_bans')
        .select('user_id,kind,expires_at,reason')
        .in('user_id', wanted);
      if (error) throw new Error('Could not check moderation status');
      return new Map((data || []).filter(live).map(row => [row.user_id, verdict(row)]));
    },

    async report(entry) {
      if (!db) throw new Error('Reporting is not available');
      const { error } = await db.from('player_reports').insert({
        reporter_user_id: entry.reporterUserId || null,
        reporter_name: entry.reporterName,
        reported_user_id: entry.reportedUserId || null,
        reported_name: entry.reportedName,
        room: entry.room,
        surface: entry.surface,
        reason: entry.reason,
        note: entry.note || '',
        witnesses: entry.witnesses || [],
      });
      if (error) throw new Error('Could not file the report');
    },
  };
}
