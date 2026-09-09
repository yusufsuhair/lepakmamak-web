export const ANNOUNCE_PREFIX = '/gm ';

// The Game Master announces by typing in chat, so there is no separate box to build and
// nothing extra to authorise: the same trusted gameMaster flag decides who is obeyed.
// Returns null for ordinary chat, and reports `allowed` separately from the text so the
// caller can tell an impostor why nothing happened instead of leaking it to the room.
export function gmAnnouncement(player, text) {
  if (typeof text !== 'string' || !text.startsWith(ANNOUNCE_PREFIX)) return null;
  const body = text.slice(ANNOUNCE_PREFIX.length).trim();
  if (!body) return null;
  return {allowed: player?.gameMaster === true, text: body};
}
