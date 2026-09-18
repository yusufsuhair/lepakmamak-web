// Where new players are lost, counted by step (see server/funnel.mjs). The id is a random
// number this browser makes for itself so that tomorrow's visit can be told from a new
// visitor. It is not an account, it describes nothing about the device, and no other player
// ever receives it. A browser that asks not to be tracked is not counted at all.
// ponytail: honours Do Not Track and Global Privacy Control, nothing more. An EU launch needs
// a consent prompt before this id is stored; add it with the rest of the i18n work.
export type FunnelStep = 'page_load' | 'play_tapped' | 'auth_shown' | 'account_created';

const KEY = 'lepak-device';
const optedOut = navigator.doNotTrack === '1' || (navigator as Navigator & {globalPrivacyControl?: boolean}).globalPrivacyControl === true;
let memory = '';

export function deviceId(): string {
  if (optedOut) return '';
  try { const saved = localStorage.getItem(KEY); if (saved) return saved; } catch { /* Storage is optional. */ }
  memory ||= crypto.randomUUID();
  try { localStorage.setItem(KEY, memory); } catch { /* Counted for this page only. */ }
  return memory;
}

export function track(apiBase: string, step: FunnelStep): void {
  const device = deviceId();
  if (!apiBase || !device) return;
  // A string body goes out as text/plain, which needs no preflight, and a beacon survives
  // the page being closed mid-request.
  try { navigator.sendBeacon(`${apiBase}/event`, JSON.stringify({device, event: step})); } catch { /* Counting is never worth an error. */ }
}
