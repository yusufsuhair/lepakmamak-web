export const ANNOUNCE_PREFIX = '/gm ';
export const ANNOUNCE_OFF = '/gmoff';

// The Game Master announces by typing in chat, so there is no separate box to build and
// nothing extra to authorise: the same trusted gameMaster flag decides who is obeyed.
// Returns null for ordinary chat, and reports `allowed` separately from the text so the
// caller can tell an impostor why nothing happened instead of leaking it to the room.
export function gmAnnouncement(player, text) {
  if (typeof text !== 'string') return null;
  const command = text.trim();
  if (command.toLowerCase() === ANNOUNCE_OFF) {
    return {allowed: player?.gameMaster === true, clear: true};
  }
  // Chat clients may normalise a space to a tab (or send an uppercase command), but
  // `/gmail` must remain ordinary chat. Require at least one whitespace character.
  const match = command.match(/^\/gm\s+([\s\S]+)$/i);
  if (!match) return null;
  const body = match[1].trim();
  if (!body) return null;
  const allowed = player?.gameMaster === true;
  // Every non-empty /gm body is announcement text. Only the separate /gmoff command
  // takes the standing banner down, so words such as "clear" can be announced normally.
  return {allowed, text: body};
}
