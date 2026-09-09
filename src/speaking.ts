import './speaking.css';

// Voice already tells us who we are hearing, packet by packet, so "who is talking" needs
// nothing from the server: anyone whose audio arrived recently is speaking, and silence
// takes them off the list on its own.
export function createSpeakingList(hud: HTMLElement, holdMs = 550) {
  const root = document.createElement('div');
  root.id = 'speaking'; root.setAttribute('aria-label', 'Who is speaking'); root.setAttribute('role', 'status');
  hud.append(root);
  const rows = new Map<string, {row: HTMLElement; until: number}>();
  let sweeping = 0;

  function sweep() {
    const now = performance.now();
    for (const [id, entry] of rows) {
      if (entry.until > now) continue;
      entry.row.remove(); rows.delete(id);
    }
    if (rows.size) return;
    window.clearInterval(sweeping); sweeping = 0;
  }

  return {
    root,
    heard(id: string, name: string) {
      const existing = rows.get(id);
      if (existing) { existing.until = performance.now() + holdMs; return; }
      const row = document.createElement('div'); row.className = 'speaker';
      const face = document.createElement('span'); face.className = 'speaker-face';
      face.textContent = (name || '?').slice(0, 1).toUpperCase();
      const label = document.createElement('b'); label.textContent = name;
      row.append(face, label);
      root.append(row);
      rows.set(id, {row, until: performance.now() + holdMs});
      // The sweeper only runs while somebody is talking.
      if (!sweeping) sweeping = window.setInterval(sweep, Math.max(60, holdMs / 4));
    },
  };
}
