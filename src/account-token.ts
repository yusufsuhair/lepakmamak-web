import {guestName, session} from './auth';

// Dev has no accounts, so the realtime server hands a guest a stand-in token for handles,
// friends and stored messages. Production never sends one, so there this is the session token.
let standIn = '';
const storageKey = () => `lepak-stand-in:${guestName}`;

export function setStandInToken(token: string) {
  standIn = token;
  try { sessionStorage.setItem(storageKey(), token); } catch { /* A reload simply starts a new stand-in. */ }
}

// Per tab and per guest name, so a reload or a quick relog keeps the same stand-in inbox.
export function standInTokenFor() {
  try { return sessionStorage.getItem(storageKey()) || ''; } catch { return ''; }
}

export function clearStandIn() { standIn = ''; }

export function accountToken() {
  if (session && !guestName) return session.access_token;
  return guestName ? standIn : '';
}
