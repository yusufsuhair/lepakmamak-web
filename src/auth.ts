import { createClient, type Session } from '@supabase/supabase-js';

import { appearance, appearanceOptions, defaultAppearance } from './appearance';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const auth = url && key ? createClient(url, key) : null;
export let session: Session | null = null;
export let guestName = '';
export function clearGuest() { guestName = ''; }
export const displayName = () => guestName || String(session?.user.user_metadata?.display_name || 'Player').slice(0, 18);

export async function setupAuth(onEnter: () => void, onLeave: () => void) {
  // Development builds allow guests, and so does any build that asks for it explicitly —
  // the dev deployment has no Supabase project of its own, so accounts cannot work there
  // and guest entry is the only way in. Production sets neither, so it stays account-only.
  const guestEnabled = import.meta.env.DEV || import.meta.env.VITE_ALLOW_GUESTS === 'true';
  const overlay = document.createElement('section');
  overlay.id = 'auth-panel'; overlay.hidden = true;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'auth-title');
  overlay.innerHTML = `<form class="auth-card"><div class="eyebrow">Your city. Your friends.</div><h2 id="auth-title">Join the lepak.</h2><p>Create an account or log in to enter the city.</p><button type="button" class="secondary" id="auth-google"><span aria-hidden="true">G</span> Continue with Google</button>${guestEnabled?'<button type="button" class="secondary" id="auth-guest">Play as guest · Name only</button>':''}<label id="name-field">Display name<input id="auth-name" autocomplete="nickname" minlength="2" maxlength="18" required></label><fieldset id="avatar-fields"><legend>Your character</legend><canvas id="avatar-preview" width="180" height="200" aria-label="Character colour preview"></canvas><div id="avatar-choices"></div></fieldset><label>Email<input id="auth-email" type="email" autocomplete="email" required></label><label>Password<input id="auth-password" type="password" autocomplete="new-password" minlength="8" required></label><p id="auth-message" role="status" aria-live="polite"></p><button class="primary" id="auth-submit">Create account</button><button type="button" class="secondary" id="auth-mode">Already registered? Log in</button><button type="button" class="secondary" id="auth-forgot" hidden>Forgot password?</button><button type="button" class="secondary" id="auth-back">Back</button></form>`;
  document.getElementById('app')!.append(overlay);
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const password = el<HTMLInputElement>('auth-password');
  const email = el<HTMLInputElement>('auth-email');
  const name = el<HTMLInputElement>('auth-name');
  const submit = el<HTMLButtonElement>('auth-submit');
  const message = el('auth-message');
  if(guestEnabled){
    const guestDialog = document.createElement('dialog'); guestDialog.id = 'guest-entry';
    guestDialog.innerHTML = `<form class="auth-card"><h2>Just lepak.</h2><p>Join with a name. The shop is for registered accounts.</p><label>Guest name<input id="guest-name" minlength="2" maxlength="18" required autocomplete="nickname" /></label><button class="primary" type="submit">Enter as guest</button><button class="secondary" type="button" id="guest-back">Back</button></form>`;
    document.getElementById('app')!.append(guestDialog);
    el('auth-guest').onclick = () => { overlay.hidden = true; guestDialog.showModal(); el('guest-name').focus(); };
    el('guest-back').onclick = () => { guestDialog.close(); overlay.hidden = false; };
    guestDialog.addEventListener('keydown', event => event.stopPropagation());
    guestDialog.querySelector('form')!.onsubmit = event => {
      event.preventDefault();
      const input = el<HTMLInputElement>('guest-name');
      const value = input.value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim();
      if (value.length < 2) { input.setCustomValidity('Enter at least two characters.'); input.reportValidity(); return; }
      input.setCustomValidity(''); guestName = value.slice(0,18); guestDialog.close(); onEnter();
    };
    el('guest-name').oninput = () => el<HTMLInputElement>('guest-name').setCustomValidity('');
  }

  const labels = { gender: 'Gender', hairstyle: 'Hair style', hair: 'Hair colour', skin: 'Skin tone', shirt: 'Shirt colour', trousers: 'Trouser colour' };
  const choices = el('avatar-choices');
  for (const [key, values] of Object.entries(appearanceOptions)) {
    const label = document.createElement('label'); label.textContent = labels[key as keyof typeof labels];
    const select = document.createElement('select'); select.id = `avatar-${key}`; select.setAttribute('aria-label', labels[key as keyof typeof labels]);
    for (const [name, value] of Object.entries(values)) select.add(new Option(name, value));
    select.value = defaultAppearance[key as keyof typeof defaultAppearance]; label.append(select); choices.append(label);
  }
  const selectedAppearance = () => appearance(Object.fromEntries(Object.keys(appearanceOptions).map(key => [key, el<HTMLSelectElement>(`avatar-${key}`).value])));
  function preview() {
    const look = selectedAppearance(), ctx = el<HTMLCanvasElement>('avatar-preview').getContext('2d')!;
    ctx.clearRect(0, 0, 180, 200); ctx.fillStyle = '#d9e2cc'; ctx.fillRect(0, 0, 180, 200);
    ctx.fillStyle = look.trousers; ctx.fillRect(66, 125, 21, 57); ctx.fillRect(93, 125, 21, 57);
    ctx.fillStyle = look.shirt; ctx.fillRect(look.gender === 'female' ? 67 : 62, 72, look.gender === 'female' ? 46 : 56, 57); ctx.fillRect(46, 76, 17, 34); ctx.fillRect(117, 76, 17, 34);
    ctx.fillStyle = look.skin; ctx.fillRect(46, 110, 17, 22); ctx.fillRect(117, 110, 17, 22); ctx.fillRect(82, 62, 16, 14); ctx.beginPath(); ctx.ellipse(90, 43, 25, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(90, 23, 26, 13, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(65, 21, 50, 12);
    if (look.hairstyle === 'bob') { ctx.fillRect(63, 26, 8, 46); ctx.fillRect(109, 26, 8, 46); }
    if (look.hairstyle === 'ponytail') ctx.fillRect(112, 26, 12, 44);
    ctx.fillStyle = '#253a40'; ctx.fillRect(78, 40, 4, 4); ctx.fillRect(98, 40, 4, 4); ctx.fillRect(66, 182, 21, 8); ctx.fillRect(93, 182, 21, 8);
  }
  choices.addEventListener('change', preview); preview();
  // 'username' is the step a Google account lands on: signed in, but with no name of its
  // own yet. Google's own name is never read — you pick what the city calls you.
  let mode: 'register' | 'login' | 'recovery' | 'username' = 'register';
  const named = (value: Session | null) => String(value?.user.user_metadata?.display_name || '').trim().length >= 2;
  let busy = false;
  const submitLabel = () => mode === 'register' ? 'Create account' : mode === 'login' ? 'Log in & enter' : mode === 'username' ? 'Enter the city' : 'Save password';
  function render() {
    const picking = mode === 'register' || mode === 'username';
    el('avatar-fields').hidden = !picking;
    el('name-field').hidden = !picking; name.required = picking;
    // A Google account is already signed in: it needs a name, not credentials.
    email.parentElement!.hidden = mode === 'recovery' || mode === 'username'; email.required = mode === 'register' || mode === 'login';
    password.parentElement!.hidden = mode === 'username'; password.required = mode !== 'username';
    el('auth-google').hidden = mode === 'recovery' || mode === 'username';
    const guestButton = document.getElementById('auth-guest');
    if (guestButton) guestButton.hidden = mode === 'recovery' || mode === 'username';
    password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    password.minLength = mode === 'login' ? 1 : 8;
    el('auth-title').textContent = mode === 'register' ? 'Join the lepak.' : mode === 'login' ? 'Welcome back.' : mode === 'username' ? 'Pick your name.' : 'New password.';
    overlay.querySelector('.auth-card > p')!.textContent = mode === 'username'
      ? 'You are signed in. Choose the name the city knows you by — it does not have to be your Google name.'
      : 'Create an account or log in to enter the city.';
    submit.textContent = submitLabel();
    el('auth-mode').hidden = mode === 'recovery' || mode === 'username';
    el('auth-mode').textContent = mode === 'register' ? 'Already registered? Log in' : 'New here? Create account';
    el('auth-forgot').hidden = mode !== 'login';
    el('auth-back').hidden = mode === 'username';
    message.textContent = '';
  }
  el('auth-mode').onclick = () => { if (!busy) { mode = mode === 'register' ? 'login' : 'register'; render(); } };
  el('auth-back').onclick = () => { if (!busy) overlay.hidden = true; };
  el('auth-google').onclick = async () => {
    if (!auth || busy) return;
    busy = true; message.textContent = 'Opening Google…';
    try {
      // Back to this origin, where the restored session finds itself without a name and
      // is asked for one.
      const {error} = await auth.auth.signInWithOAuth({provider: 'google', options: {redirectTo: location.origin}});
      if (error) throw error;
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Could not reach Google. Please try again.';
      busy = false;
    }
  };
  el('auth-forgot').onclick = async () => {
    if (!auth || busy || !email.reportValidity()) return;
    busy = true;
    try {
      const { error } = await auth.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin });
      message.textContent = error ? error.message : 'If this account exists, check your email for a reset link.';
    } catch { message.textContent = 'Could not reach the account service. Please try again.'; }
    finally { busy = false; }
  };
  overlay.querySelector('form')!.onsubmit = async event => {
    event.preventDefault(); if (!auth || busy) return;
    if (mode === 'register' && name.value.trim().length < 2) { message.textContent = 'Enter a name with at least 2 characters.'; return; }
    busy = true; submit.disabled = true; submit.dataset.loading = 'true'; submit.setAttribute('aria-busy','true');
    submit.textContent = mode === 'register' ? 'Creating account…' : mode === 'login' ? 'Signing in…' : mode === 'username' ? 'Saving your name…' : 'Saving password…'; message.textContent = 'One moment…';
    try {
      if (mode === 'username') {
        // The name and the look are the player's own; nothing is copied from the provider.
        const { data, error } = await auth.auth.updateUser({ data: { display_name: name.value.trim(), appearance: selectedAppearance() } });
        if (error) throw error;
        if (data.user) session = { ...(session as Session), user: data.user };
      } else if (mode === 'recovery') {
        const { error } = await auth.auth.updateUser({ password: password.value });
        if (error) throw error;
      } else {
        const credentials = { email: email.value.trim(), password: password.value };
        const { data, error } = mode === 'register'
          ? await auth.auth.signUp({ ...credentials, options: { data: { display_name: name.value.trim(), appearance: selectedAppearance() }, emailRedirectTo: location.origin } })
          : await auth.auth.signInWithPassword(credentials);
        if (error) throw error;
        session = data.session;
        if (!session) { message.textContent = 'Check your inbox to confirm your email, then log in here.'; return; }
      }
      password.value = ''; overlay.hidden = true; onEnter();
    } catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not sign in. Please try again.'; }
    finally { busy = false; submit.disabled = false; delete submit.dataset.loading; submit.setAttribute('aria-busy','false'); submit.textContent = submitLabel(); }
  };
  overlay.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !busy) overlay.hidden = true;
    if (event.key === 'Tab') {
      const items = [...overlay.querySelectorAll<HTMLElement>('input, select, button')].filter(e => e.getClientRects().length && !(e as HTMLButtonElement).disabled);
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)!.focus(); }
      if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
  });
  if (auth) {
    auth.auth.onAuthStateChange((event, next) => {
      session = next;
      if (event === 'SIGNED_OUT') onLeave();
      if (event === 'SIGNED_IN' && !named(next)) { mode = 'username'; render(); overlay.hidden = false; name.focus(); }
      if (event === 'PASSWORD_RECOVERY') { mode = 'recovery'; render(); overlay.hidden = false; password.focus(); }
    });
    try { session = (await auth.auth.getSession()).data.session; } catch { session = null; }
  }
  return () => {
    if (!auth) {
      overlay.hidden = false; submit.disabled = true;
      message.textContent = 'Registration is being connected. Please try again shortly.';
      return;
    }
    // A Google account arrives named by Google. It does not get to keep that name here,
    // and it does not get into the city until it has chosen one.
    if (session && !named(session)) { mode = 'username'; render(); overlay.hidden = false; name.focus(); return; }
    if (session && mode !== 'recovery') { onEnter(); return; }
    render(); overlay.hidden = false; (mode === 'register' ? name : email).focus();
  };
}
