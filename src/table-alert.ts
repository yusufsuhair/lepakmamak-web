// In-session nudges for the four table games. A seat only exists while the socket
// is alive — close the tab and poker folds you, UNO drops you after 60s — so there
// is nothing left to deliver to a dead session.
// ponytail: page-level Notification, no service worker or VAPID. Add one only if
// seats ever outlive the connection (async invites, held seats).
const NIGHT_ROLES = ['werewolf', 'alpha', 'doctor', 'seer'];

export type Alert = {key: string; title: string; body: string};
export const NO_ALERT: Alert = {key: '', title: '', body: ''};

// Structural slices of each server payload — only the fields a nudge depends on.
type UnoState = {id: string; round: number; phase: string; self: string; turn: string | null; ends: number; unoTarget: string | null};
type PokerState = {hand: string; phase: string; ends: number; actions: {call: number; raise: boolean} | null; players: {id: string}[]};
type LukisState = {id: string; round: number; phase: string; self: string; drawer: string; scores: {id: string}[]};
type WerewolfState = {id: string; day: number; phase: string; self: string; role: string | null; selected: string | null; canJudge: boolean; players: {id: string; alive: boolean}[]};

export function unoAlert(g: UnoState | null): Alert {
 if (!g) return NO_ALERT;
 if (g.phase === 'playing' && g.turn === g.self) return {key: `turn:${g.ends}`, title: 'UNO Lepak', body: 'Giliran anda.'};
 if (g.unoTarget === g.self) return {key: `uno:${g.id}:${g.round}`, title: 'UNO Lepak', body: 'Tekan UNO! sebelum kena tangkap.'};
 if (g.phase === 'dealing') return {key: `deal:${g.id}:${g.round}`, title: 'UNO Lepak', body: 'Kad sedang dibahagi — jom main.'};
 return NO_ALERT;
}

export function pokerAlert(g: PokerState | null, self: string): Alert {
 if (!g || g.phase === 'finished' || !g.players.some(p => p.id === self)) return NO_ALERT;
 if (g.actions) return {key: `turn:${g.hand}:${g.ends}`, title: 'Poker Kampung', body: 'Giliran anda.'};
 return {key: `hand:${g.hand}`, title: 'Poker Kampung', body: 'Pusingan baharu bermula di meja anda.'};
}

export function lukisAlert(g: LukisState | null): Alert {
 if (!g || g.phase === 'finished' || !g.scores.some(p => p.id === g.self)) return NO_ALERT;
 if (g.drawer === g.self && g.phase === 'choosing') return {key: `pick:${g.id}:${g.round}`, title: 'Lukis Lah!', body: 'Pilih perkataan anda.'};
 if (g.drawer === g.self && g.phase === 'drawing') return {key: `draw:${g.id}:${g.round}`, title: 'Lukis Lah!', body: 'Giliran anda melukis.'};
 if (g.phase === 'drawing') return {key: `guess:${g.id}:${g.round}`, title: 'Lukis Lah!', body: 'Pusingan bermula — masa untuk meneka.'};
 return NO_ALERT;
}

export function werewolfAlert(g: WerewolfState | null): Alert {
 if (!g?.players.find(p => p.id === g.self)?.alive) return NO_ALERT;
 if (g.phase === 'night') {
  if (g.role && NIGHT_ROLES.includes(g.role) && !g.selected) return {key: `night:${g.day}`, title: 'Werewolf', body: 'Malam — pilih sasaran anda.'};
  return g.day === 1 ? {key: `start:${g.id}`, title: 'Werewolf', body: 'Permainan bermula — peranan telah dibahagi.'} : NO_ALERT;
 }
 if (g.phase === 'vote' && !g.selected) return {key: `vote:${g.day}`, title: 'Werewolf', body: 'Masa mengundi.'};
 if (g.phase === 'judgment' && g.canJudge && !g.selected) return {key: `judgment:${g.day}`, title: 'Werewolf', body: 'Beri penghakiman anda.'};
 return NO_ALERT;
}

export function createTableAlert(toast: (title: string, body: string) => void) {
 const last = new Map<string, string>();
 return {
  ask(): void {
   try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission().catch(() => {}); } catch {}
  },
  clear(): void { last.clear(); },
  // onScreen: the dialog is open on this game. Alert anyway if the tab is hidden.
  fire(game: string, alert: Alert, onScreen: boolean): void {
   if (last.get(game) === alert.key) return;
   last.set(game, alert.key);
   if (!alert.key) return;
   const hidden = typeof document !== 'undefined' && document.hidden;
   if (onScreen && !hidden) return;
   if (hidden) {
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { new Notification(alert.title, {body: alert.body, tag: game}); return; } } catch {}
   }
   toast(alert.title, alert.body);
  },
 };
}
