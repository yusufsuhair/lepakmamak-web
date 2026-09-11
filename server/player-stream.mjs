// A baseline advances only after a frame is queued to that socket. A slow client gets a
// fresh full snapshot, never a delta based on a frame that was skipped for backpressure.
export function createPlayerStream() {
  const rooms = new WeakMap(), cursors = new WeakMap();
  return {
    reset(ws) { cursors.delete(ws); },
    frame(room, players) {
      const previous = rooms.get(room) || {revision: 0, rows: new Map()};
      const rows = new Map(players.map(p => [p.id, p]));
      const changes = [], removed = [];
      for (const [id, p] of rows) {
        const before = previous.rows.get(id);
        if (!before) { changes.push(p); continue; }
        const patch = {id};
        for (const key of new Set([...Object.keys(before), ...Object.keys(p)])) {
          if (JSON.stringify(before[key]) !== JSON.stringify(p[key])) patch[key] = p[key] === undefined ? null : p[key];
        }
        if (Object.keys(patch).length > 1) changes.push(patch);
      }
      for (const id of previous.rows.keys()) if (!rows.has(id)) removed.push(id);
      // Freeze copies: gameplay mutates appearance/accessory arrays and player objects.
      const revision = previous.revision + 1;
      rooms.set(room, {revision, rows: new Map(players.map(p => [p.id, structuredClone(p)]))});
      const full = {type:'players', revision, players};
      const delta = {type:'players-delta', base:previous.revision, revision, changes, removed};
      return {full, delta, changed:!!(changes.length || removed.length),
        forSocket(ws) { return cursors.get(ws) === previous.revision ? delta : full; },
        sent(ws) { cursors.set(ws, revision); },
      };
    },
  };
}
