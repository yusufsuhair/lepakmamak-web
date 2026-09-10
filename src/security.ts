import { auth, session } from './auth';
import './security.css';

// Password changes ride the session the browser already holds. Deleting an account needs
// the service role, which must never reach the browser, so that half is a server call.
export function setupSecurity(endpoint: string) {
  const dialog = document.createElement('dialog'); dialog.id = 'security';
  dialog.setAttribute('aria-labelledby', 'security-title');
  dialog.innerHTML = `<header><div><small>LEPAKMAMAK · ACCOUNT</small><h2 id="security-title">Security</h2></div><button type="button" aria-label="Close security">×</button></header>
    <form id="password-form" novalidate><h3>Change password</h3>
      <label>Current password<input id="current-password" type="password" autocomplete="current-password" required></label>
      <label>New password<input id="new-password" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>Repeat new password<input id="repeat-password" type="password" autocomplete="new-password" minlength="8" required></label>
      <button class="primary" type="submit">Update password</button>
      <p id="password-status" role="status" aria-live="polite"></p></form>
    <form id="password-reset-form" novalidate><h3>Forgot password?</h3>
      <p>Send a reset link to <strong id="reset-email">your account email</strong>. The link returns here so you can choose a new password.</p>
      <button class="secondary" id="send-reset" type="submit">Send reset email</button>
      <p id="reset-status" role="status" aria-live="polite"></p></form>
    <form id="delete-form" novalidate><h3>Delete account</h3>
      <p>This removes your account, your items, your posts and your messages. It cannot be undone.</p>
      <label>Type DELETE to confirm<input id="delete-confirm" autocomplete="off" placeholder="DELETE"></label>
      <button class="danger" type="submit">Delete my account</button>
      <p id="delete-status" role="status" aria-live="polite"></p></form>`;
  document.body.append(dialog);

  const el = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  const passwordForm = el<HTMLFormElement>('password-form'), resetForm = el<HTMLFormElement>('password-reset-form'), deleteForm = el<HTMLFormElement>('delete-form');
  const passwordStatus = el('password-status'), resetStatus = el('reset-status'), deleteStatus = el('delete-status');
  const resetEmail = el('reset-email');
  const confirmField = el<HTMLInputElement>('delete-confirm');
  const fields = () => [...dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')];
  let busy = false;
  const setBusy = (value: boolean) => { busy = value; for (const field of fields()) field.disabled = value; };

  dialog.querySelector('header button')!.addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('keydown', event => event.stopPropagation());

  passwordForm.onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    const current = el<HTMLInputElement>('current-password').value;
    const next = el<HTMLInputElement>('new-password').value;
    if (next !== el<HTMLInputElement>('repeat-password').value) { passwordStatus.textContent = 'The two new passwords do not match.'; return; }
    if (next.length < 8) { passwordStatus.textContent = 'Use at least 8 characters.'; return; }
    if (next === current) { passwordStatus.textContent = 'Choose a password you have not used here.'; return; }
    const email = session?.user.email;
    if (!auth || !email) { passwordStatus.textContent = 'Log in again to change your password.'; return; }
    setBusy(true); passwordStatus.textContent = 'Checking your current password…';
    try {
      // Proving the current password first means a borrowed, still-open browser cannot
      // lock the owner out of their own account.
      const check = await auth.auth.signInWithPassword({email, password: current});
      if (check.error) throw new Error('That is not your current password.');
      const {error} = await auth.auth.updateUser({password: next});
      if (error) throw error;
      passwordForm.reset();
      passwordStatus.textContent = 'Password updated. Use the new one next time you log in.';
    } catch (error) {
      passwordStatus.textContent = error instanceof Error ? error.message : 'Could not update your password.';
    } finally { setBusy(false); }
  };

  resetForm.onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    const email = session?.user.email?.trim();
    if (!auth || !email) { resetStatus.textContent = 'Log in again to reset your password.'; return; }
    setBusy(true); resetStatus.textContent = 'Sending reset email…';
    try {
      const {error} = await auth.auth.resetPasswordForEmail(email, {redirectTo: location.origin});
      if (error) throw error;
      resetStatus.textContent = 'If this account has a password, check your email for a reset link.';
    } catch (error) {
      resetStatus.textContent = error instanceof Error ? error.message : 'Could not send a reset email.';
    } finally { setBusy(false); }
  };

  deleteForm.onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    if (confirmField.value.trim() !== 'DELETE') { deleteStatus.textContent = 'Type DELETE, in capitals, to confirm.'; return; }
    const token = (await auth?.auth.getSession())?.data.session?.access_token;
    if (!token) { deleteStatus.textContent = 'Log in again to delete your account.'; return; }
    setBusy(true); deleteStatus.textContent = 'Deleting your account…';
    try {
      const response = await fetch(`${endpoint}/account/delete`, {
        method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({confirm: 'DELETE'}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not delete the account.');
      deleteStatus.textContent = 'Account deleted. Goodbye, lah.';
      // The account is already gone, so a failing sign-out must not hold up the reload.
      await auth?.auth.signOut().catch(() => {});
      location.reload();
    } catch (error) {
      deleteStatus.textContent = error instanceof Error ? error.message : 'Could not delete the account.';
      setBusy(false);
    }
  };

  return () => {
    passwordForm.reset(); deleteForm.reset();
    passwordStatus.textContent = ''; resetStatus.textContent = ''; deleteStatus.textContent = '';
    resetEmail.textContent = session?.user.email || 'your account email';
    setBusy(false); dialog.showModal();
    el<HTMLInputElement>('current-password').focus();
  };
}
