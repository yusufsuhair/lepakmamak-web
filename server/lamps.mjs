// The whole city shares one street-light switch. `null` means "follow the KL clock", which
// is how a room starts; a boolean is a deliberate flip that stands until somebody flips it
// back. Kept in a WeakMap keyed by the players Map because roomFor() hands back a fresh
// object every call, so anything stored on that object is lost immediately.
export function createLamps(send, broadcast, now = Date.now) {
  const states = new WeakMap(), lastFlip = new WeakMap();
  return {
    sync(players, ws) { send(ws, { type: 'lamps', on: states.has(players) ? states.get(players) : null }); },
    handle(players, player, message) {
      if (message.type !== 'lamps') return false;
      if (typeof message.on !== 'boolean' && message.on !== null) return true;
      // One flip a second per player, so nobody can strobe the whole city.
      if (lastFlip.has(player) && now() - lastFlip.get(player) < 1000) return true;
      lastFlip.set(player, now());
      if (message.on === null) states.delete(players); else states.set(players, message.on);
      broadcast(players, { type: 'lamps', on: message.on, name: player.name });
      return true;
    },
  };
}
