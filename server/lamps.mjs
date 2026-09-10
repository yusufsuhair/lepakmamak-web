// Every street lamp carries its own state. Night is only the default: a lamp somebody
// walked up to and switched keeps its own answer, and everybody in the room sees it.
// Kept in a WeakMap keyed by the players Map because roomFor() hands back a fresh object
// every call, so anything stored on that object is lost immediately.
export const MAX_LAMPS = 400;

export function createLamps(send, broadcast, now = Date.now) {
  const states = new WeakMap(), lastFlip = new WeakMap();
  const stateFor = players => {
    if (!states.has(players)) states.set(players, new Map());
    return states.get(players);
  };

  return {
    sync(players, ws) {
      send(ws, {type: 'lamps', lamps: Object.fromEntries(states.get(players) || [])});
    },
    handle(players, player, message) {
      if (message.type !== 'lamp') return false;
      if (!Number.isInteger(message.index) || message.index < 0 || message.index >= MAX_LAMPS) return true;
      if (typeof message.on !== 'boolean') return true;
      // has(), not `|| 0`: a first flip early in the clock would otherwise limit itself.
      if (lastFlip.has(player) && now() - lastFlip.get(player) < 400) return true;
      lastFlip.set(player, now());
      stateFor(players).set(message.index, message.on);
      broadcast(players, {type: 'lamp', index: message.index, on: message.on, name: player.name});
      return true;
    },
  };
}
