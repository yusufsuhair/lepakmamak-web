import {accountToken} from './account-token';
import './friends.css';

const HANDLE = /^[a-z0-9_]{3,18}$/;

// Shown once, on the first login without a handle, and it cannot be dismissed: search only
// works if everyone has a handle, and a handle is permanent, so it deserves a real choice.
export function setupHandleClaim(endpoint: string, onClaimed: (handle: string) => void = () => {}) {
  const base = endpoint.replace(/^ws/i, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '');
  const dialog = document.createElement('dialog');
  dialog.id = 'handle-claim'; dialog.setAttribute('aria-labelledby', 'handle-claim-title');
  dialog.innerHTML = `<form class="handle-card" novalidate><small>LEPAKMAMAK · YOUR HANDLE</small><h2 id="handle-claim-title">Pick your @handle</h2><p>Friends find you by it. It is yours for good, so choose carefully.</p><label for="handle-input">Handle</label><div class="handle-field"><span aria-hidden="true">@</span><input id="handle-input" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="18" aria-describedby="handle-status"></div><p id="handle-status" role="status" aria-live="polite"></p><button type="submit" id="handle-submit">Claim handle</button></form>`;
  document.body.append(dialog);
  const input = dialog.querySelector<HTMLInputElement>('#handle-input')!;
  const status = dialog.querySelector<HTMLElement>('#handle-status')!;
  const submit = dialog.querySelector<HTMLButtonElement>('#handle-submit')!;
  let checkTimer = 0, checkSeq = 0, busy = false, required = false;
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18);

  async function call(path: string, init: RequestInit = {}) {
    const response = await fetch(`${base}${path}`, {...init, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${accountToken()}`}});
    return {response, data: await response.json().catch(() => ({}))};
  }

  async function check() {
    const handle = input.value, mine = ++checkSeq;
    if (!HANDLE.test(handle)) { status.textContent = '3 to 18 letters, numbers or _.'; submit.disabled = true; return; }
    status.textContent = 'Checking…';
    try {
      const {response, data} = await call(`/handles/check?h=${encodeURIComponent(handle)}`);
      if (mine !== checkSeq) return;
      if (!response.ok) throw Error(data.error);
      status.textContent = data.available ? `@${handle} is free.` : data.reason === 'reserved' ? 'That handle is reserved.' : `@${handle} is taken.`;
      submit.disabled = !data.available;
    } catch {
      // The claim itself is the real check, so a failed preview never blocks it.
      if (mine === checkSeq) { status.textContent = 'Could not check right now. You can still try.'; submit.disabled = false; }
    }
  }

  input.addEventListener('input', () => {
    const next = clean(input.value);
    if (next !== input.value) input.value = next;
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => void check(), 250);
  });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('cancel', event => event.preventDefault());
  // Chrome lets a repeated Escape close a modal whose cancel was refused; put it straight back.
  dialog.addEventListener('close', () => { if (required) dialog.showModal(); });

  dialog.querySelector('form')!.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !HANDLE.test(input.value)) return;
    busy = true; submit.disabled = true; status.textContent = 'Claiming…';
    try {
      const {response, data} = await call('/handles/claim', {method: 'POST', body: JSON.stringify({handle: input.value})});
      const handle = response.ok ? data.handle : data.error === 'claimed' ? data.handle : '';
      if (handle) { required = false; dialog.close(); onClaimed(handle); return; }
      if (data.suggestion) input.value = clean(data.suggestion);
      status.textContent = data.error === 'taken' ? `Taken. How about @${input.value}?`
        : data.error === 'reserved' ? `That one is reserved. Try @${input.value}.`
        : data.error === 'invalid' ? `3 to 18 letters, numbers or _. Try @${input.value}.`
        : data.message || data.error || 'Could not claim it. Try again.';
      submit.disabled = false;
    } catch {
      status.textContent = 'Could not reach the city. Try again.';
      submit.disabled = false;
    } finally { busy = false; }
  });

  return {
    require(suggestion: string) {
      required = true;
      input.value = clean(suggestion);
      if (!dialog.open) dialog.showModal();
      input.focus();
      void check();
    },
    get opened() { return dialog.open; },
  };
}
