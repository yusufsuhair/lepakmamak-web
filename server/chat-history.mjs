import { createClient } from '@supabase/supabase-js';

const LIMIT = 50;

export function createChatHistory(services = {}) {
  const db = services.db || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null);

  return {
    get available() { return !!db; },
    async recent(room) {
      if (!db) return [];
      const { data, error } = await db.from('chat_messages')
        .select('player_id,player_name,message,created_at,game_master')
        .eq('room', room)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(LIMIT);
      if (error) throw new Error('Could not load chat history');
      return data.reverse().map(row => ({
        id: row.player_id,
        name: row.player_name,
        text: row.message,
        sentAt: row.created_at,
        gameMaster: !!row.game_master,
      }));
    },
    async save(room, player, text, sentAt) {
      if (!db) return;
      const { error } = await db.from('chat_messages').insert({
        room,
        player_id: player.id,
        user_id: player.userId || null,
        player_name: player.name,
        message: text,
        created_at: sentAt,
        game_master: !!player.gameMaster,
      });
      if (error) throw new Error('Could not save chat message');
    },
  };
}
