import './speaking.css';

// Voice already tells us who we are hearing, packet by packet, so "who is talking" needs
// nothing from the server: anyone whose audio arrived recently is speaking, and silence
// takes them off the list on its own.
export function createSpeakingList(hud: HTMLElement, holdMs = 550) {
  const root = document.createElement('div');
  root.id = 'speaking'; root.setAttribute('aria-label', 'Who is speaking'); root.setAttribute('role', 'status');
  hud.append(root);
  const presenceMs = Math.max(1200, holdMs * 3);
  const rows = new Map<string, {row: HTMLElement; until: number; presentUntil: number; level: number}>();
  let sweeping = 0;

  function render(entry: {row: HTMLElement; until: number; presentUntil: number; level: number}, now = performance.now()) {
    const active = entry.until > now && entry.level > .02;
    entry.row.classList.toggle('speaker-active', active);
    entry.row.classList.toggle('speaker-inactive', !active);
    entry.row.style.setProperty('--voice-level', entry.level.toFixed(3));
    entry.row.style.setProperty('--voice-alpha', (active ? .2 + entry.level * .65 : .08).toFixed(3));
    entry.row.style.setProperty('--voice-border-alpha', (active ? .3 + entry.level * .55 : .18).toFixed(3));
    entry.row.style.setProperty('--voice-glow', `${(active ? 7 + entry.level * 15 : 0).toFixed(1)}px`);
    entry.row.style.setProperty('--voice-face-glow', `${(active ? 3 + entry.level * 8 : 0).toFixed(1)}px`);
    entry.row.setAttribute('aria-label', `${entry.row.dataset.name || 'Player'}${active ? ' is speaking' : ' is nearby'}`);
  }

  function rowFor(id: string, name: string, now: number) {
    const existing = rows.get(id);
    if (existing) {
      existing.row.dataset.name = name;
      existing.presentUntil = now + presenceMs;
      return existing;
    }
    const row = document.createElement('div'); row.className = 'speaker speaker-inactive'; row.dataset.name = name;
    const face = document.createElement('span'); face.className = 'speaker-face';
    face.textContent = (name || '?').slice(0, 1).toUpperCase();
    const label = document.createElement('b'); label.textContent = name;
    row.append(face, label);
    const entry = {row, until: 0, presentUntil: now + presenceMs, level: 0};
    rows.set(id, entry); root.append(row); render(entry, now);
    return entry;
  }

  function sweep() {
    const now = performance.now();
    for (const [id, entry] of rows) {
      if (entry.presentUntil <= now) { entry.row.remove(); rows.delete(id); continue; }
      if (entry.until <= now && entry.level !== 0) { entry.level = 0; render(entry, now); }
    }
    if (rows.size) return;
    window.clearInterval(sweeping); sweeping = 0;
  }

  return {
    root,
    heard(id: string, name: string, level = 1) {
      const now = performance.now();
      const entry = rowFor(id, name, now);
      entry.level = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
      if (entry.level > .02) entry.until = now + holdMs;
      render(entry, now);
      if (!sweeping) sweeping = window.setInterval(sweep, Math.max(60, holdMs / 4));
    },
    nearby(id: string, name: string) {
      const now = performance.now();
      const entry = rowFor(id, name, now);
      entry.presentUntil = now + presenceMs;
      // A nearby microphone stays in the list after the last packet, but the row is dark
      // until another non-silent frame arrives through heard().
      if (entry.until <= now) { entry.level = 0; render(entry, now); }
      if (!sweeping) sweeping = window.setInterval(sweep, Math.max(60, holdMs / 4));
    },
    away(id: string) {
      const entry = rows.get(id);
      if (!entry) return;
      entry.row.remove(); rows.delete(id);
    },
  };
}
