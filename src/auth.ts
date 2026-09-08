import { createClient, type Session } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const auth = url && key ? createClient(url, key) : null;
export let session: Session | null = null;
export const displayName = () => String(session?.user.user_metadata?.display_name || 'Player').slice(0, 18);

export async function setupAuth(onEnter: () => void, onLeave: () => void) {
  const overlay = document.createElement('section');
  overlay.id = 'auth-panel'; overlay.hidden = true;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'auth-title');
  overlay.innerHTML = `<form class="auth-card"><div class="eyebrow">Your city. Your friends.</div><h2 id="auth-title">Join the lepak.</h2><p>Pick a name your friends will see above your character.</p><label id="name-field">Display name<input id="auth-name" autocomplete="nickname" minlength="2" maxlength="18" required></label><label>Email<input id="auth-email" type="email" autocomplete="email" required></label><label>Password<input id="auth-password" type="password" autocomplete="new-password" minlength="8" required></label><p id="auth-message" role="status" aria-live="polite"></p><button class="primary" id="auth-submit">Create account</button><button type="button" class="secondary" id="auth-mode">Already registered? Log in</button><button type="button" class="secondary" id="auth-forgot" hidden>Forgot password?</button><button type="button" class="secondary" id="auth-back">Back</button></form>`;
  document.getElementById('app')!.append(overlay);
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const password = el<HTMLInputElement>('auth-password');
  const email = el<HTMLInputElement>('auth-email');
  const name = el<HTMLInputElement>('auth-name');
  const submit = el<HTMLButtonElement>('auth-submit');
  const message = el('auth-message');
  let mode: 'register' | 'login' | 'recovery' = 'register';
  let busy = false;
  function render() {
    el('name-field').hidden = mode !== 'register'; name.required = mode === 'register';
    email.parentElement!.hidden = mode === 'recovery'; email.required = mode !== 'recovery';
    password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    password.minLength = mode === 'login' ? 1 : 8;
    el('auth-title').textContent = mode === 'register' ? 'Join the lepak.' : mode === 'login' ? 'Welcome back.' : 'New password.';
    submit.textContent = mode === 'register' ? 'Create account' : mode === 'login' ? 'Log in & enter' : 'Save password';
    el('auth-mode').hidden = mode === 'recovery';
    el('auth-mode').textContent = mode === 'register' ? 'Already registered? Log in' : 'New here? Create account';
    el('auth-forgot').hidden = mode !== 'login';
    message.textContent = '';
  }
  el('auth-mode').onclick = () => { if (!busy) { mode = mode === 'register' ? 'login' : 'register'; render(); } };
  el('auth-back').onclick = () => { if (!busy) overlay.hidden = true; };
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
    busy = true; submit.disabled = true; message.textContent = 'One moment…';
    try {
      if (mode === 'recovery') {
        const { error } = await auth.auth.updateUser({ password: password.value });
        if (error) throw error;
      } else {
        const credentials = { email: email.value.trim(), password: password.value };
        const { data, error } = mode === 'register'
          ? await auth.auth.signUp({ ...credentials, options: { data: { display_name: name.value.trim() }, emailRedirectTo: location.origin } })
          : await auth.auth.signInWithPassword(credentials);
        if (error) throw error;
        session = data.session;
        if (!session) { message.textContent = 'Check your inbox to confirm your email, then log in here.'; return; }
      }
      password.value = ''; overlay.hidden = true; onEnter();
    } catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not sign in. Please try again.'; }
    finally { busy = false; submit.disabled = false; }
  };
  overlay.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !busy) overlay.hidden = true;
    if (event.key === 'Tab') {
      const items = [...overlay.querySelectorAll<HTMLElement>('input, button')].filter(e => e.getClientRects().length && !(e as HTMLButtonElement).disabled);
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)!.focus(); }
      if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
  });
  if (auth) {
    auth.auth.onAuthStateChange((event, next) => {
      session = next;
      if (event === 'SIGNED_OUT') onLeave();
      if (event === 'PASSWORD_RECOVERY') { mode = 'recovery'; render(); overlay.hidden = false; password.focus(); }
    });
    try { session = (await auth.auth.getSession()).data.session; } catch { session = null; }
  }
  return () => {
    if (!auth) {
      if (import.meta.env.DEV && !import.meta.env.VITE_MULTIPLAYER_URL) { onEnter(); return; }
      overlay.hidden = false; submit.disabled = true;
      message.textContent = 'Registration is being connected. Please try again shortly.';
      return;
    }
    if (session && mode !== 'recovery') { onEnter(); return; }
    render(); overlay.hidden = false; (mode === 'register' ? name : email).focus();
  };
}
