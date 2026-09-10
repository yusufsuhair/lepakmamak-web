// Network heartbeats do not count as activity. Only real input keeps a seat occupied.
export function createIdleGuard(active: () => boolean, leave: () => void, now = Date.now) {
  let last = now(), wasActive = false;
  const warning = document.createElement('div');
  warning.id = 'idle-warning'; warning.hidden = true; warning.setAttribute('role', 'alert');
  document.body.append(warning);
  return {
    activity() { last = now(); warning.hidden = true; },
    tick() {
      const enabled = active();
      if (!enabled || !wasActive) last = now();
      wasActive = enabled;
      const remaining = Math.ceil((300000 - (now() - last)) / 1000);
      const host = document.querySelector('dialog[open]') || document.body;
      if (warning.parentElement !== host) host.append(warning);
      warning.hidden = !enabled || remaining > 30;
      if (!warning.hidden) warning.textContent = `Still here? Move or tap to keep your seat · ${remaining}s`;
      if (enabled && remaining <= 0) { last = now(); wasActive = false; warning.hidden = true; leave(); }
    },
  };
}
