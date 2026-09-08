import { auth, session } from './auth';
import { appearance, appearanceOptions, type Appearance } from './appearance';

export function savedLook(): Appearance {
  if (session) return appearance(session.user.user_metadata?.appearance);
  try { return appearance(JSON.parse(localStorage.getItem('lepak-wardrobe') || 'null')); } catch { return appearance(null); }
}

export function setupWardrobe(onSave: (look: Appearance) => void) {
  const dialog = document.createElement('dialog'); dialog.id = 'wardrobe';
  dialog.setAttribute('aria-labelledby', 'wardrobe-title');
  dialog.innerHTML = `<form><h2 id="wardrobe-title">Your wardrobe.</h2><p>Pick your colours. Make yourself at home.</p><canvas width="160" height="190" aria-label="Outfit preview"></canvas><label>Shirt colour<select name="shirt" aria-label="Shirt colour"></select></label><label>Trousers colour<select name="trousers" aria-label="Trousers colour"></select></label><p role="status" aria-live="polite"></p><button class="primary" type="submit">Save outfit</button><button class="secondary" type="button">Cancel</button></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form')!;
  const status = dialog.querySelector<HTMLElement>('[role="status"]')!;
  const save = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const cancel = form.querySelector<HTMLButtonElement>('[type="button"]')!;
  let look = savedLook(), busy = false;
  const selects = [...form.querySelectorAll('select')];
  for (const select of selects) {
    const key = select.name as 'shirt' | 'trousers';
    for (const [label, value] of Object.entries(appearanceOptions[key])) select.add(new Option(label, value));
    select.onchange = () => { look = { ...look, [key]: select.value }; draw(); };
  }
  function draw() {
    const ctx = dialog.querySelector('canvas')!.getContext('2d')!;
    ctx.clearRect(0, 0, 160, 190);
    ctx.fillStyle = look.trousers; ctx.fillRect(52, 115, 23, 57); ctx.fillRect(85, 115, 23, 57);
    ctx.fillStyle = look.shirt; ctx.fillRect(47, 65, 66, 59); ctx.fillRect(28, 67, 22, 35); ctx.fillRect(110, 67, 22, 35);
    ctx.fillStyle = look.skin; ctx.fillRect(31, 102, 16, 22); ctx.fillRect(113, 102, 16, 22); ctx.fillRect(59, 26, 42, 38);
    ctx.fillStyle = look.hair; ctx.fillRect(55, 18, 50, 19);
    ctx.fillStyle = '#20382e'; ctx.fillRect(49, 168, 28, 9); ctx.fillRect(83, 168, 28, 9);
  }
  cancel.onclick = () => dialog.close();
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  form.onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    busy = true; save.disabled = cancel.disabled = true; selects.forEach(s => s.disabled = true); status.textContent = 'Saving…';
    try {
      const accountId = session?.user.id;
      if (auth) {
        if (!accountId) throw new Error('Please log in again to save your outfit.');
        const { error } = await auth.auth.updateUser({ data: { appearance: look } });
        if (error) throw error;
        if (session?.user.id !== accountId) throw new Error('Your session changed. Please open Wardrobe again.');
      } else localStorage.setItem('lepak-wardrobe', JSON.stringify(look));
      onSave(look); dialog.close();
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not save. Please try again.'; }
    finally { busy = false; save.disabled = cancel.disabled = false; selects.forEach(s => s.disabled = false); }
  };
  return () => { look = savedLook(); for (const select of selects) select.value = look[select.name as 'shirt' | 'trousers']; status.textContent = ''; draw(); dialog.showModal(); selects[0].focus(); };
}
