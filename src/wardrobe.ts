import { auth, session } from './auth';
import { appearance, appearanceOptions, type Appearance } from './appearance';

type ClothingKey = 'shirt' | 'trousers';

export function savedLook(): Appearance {
  if (session) return appearance(session.user.user_metadata?.appearance);
  try { return appearance(JSON.parse(localStorage.getItem('lepak-wardrobe') || 'null')); } catch { return appearance(null); }
}

export function setupWardrobe(onSave: (look: Appearance) => void) {
  const dialog = document.createElement('dialog'); dialog.id = 'wardrobe'; dialog.setAttribute('aria-labelledby', 'wardrobe-title');
  dialog.innerHTML = `<form>
    <header class="wardrobe-header"><div><span>CHARACTER STUDIO</span><h2 id="wardrobe-title">Your wardrobe.</h2><p>Build a look for your next lepak.</p></div><button class="wardrobe-close" type="button" aria-label="Close wardrobe">×</button></header>
    <div class="wardrobe-shell">
      <section class="wardrobe-stage" aria-label="Character preview">
        <i class="wardrobe-plumbob" aria-hidden="true"></i>
        <canvas width="280" height="360" aria-label="Live outfit preview"></canvas>
        <div class="wardrobe-look-name"><small>CURRENT LOOK</small><strong id="wardrobe-look-label"></strong></div>
        <button class="wardrobe-random" type="button">Surprise me</button>
      </section>
      <section class="wardrobe-customise">
        <div class="wardrobe-tabs" role="tablist" aria-label="Clothing category">
          <button type="button" role="tab" data-category="shirt">Tops</button>
          <button type="button" role="tab" data-category="trousers">Bottoms</button>
        </div>
        <div class="wardrobe-choice-head"><small id="wardrobe-step">01 / TOPS</small><h3 id="wardrobe-choice-title">Choose a top</h3><p>Tap a style to preview it instantly.</p></div>
        <div class="wardrobe-options" role="radiogroup" aria-labelledby="wardrobe-choice-title"></div>
      </section>
    </div>
    <footer class="wardrobe-actions"><p role="status" aria-live="polite"></p><div><button class="secondary wardrobe-cancel" type="button">Cancel</button><button class="primary wardrobe-save" type="submit">Save outfit</button></div></footer>
  </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form')!, canvas = dialog.querySelector('canvas')!;
  const status = dialog.querySelector<HTMLElement>('[role="status"]')!, options = dialog.querySelector<HTMLElement>('.wardrobe-options')!;
  const save = dialog.querySelector<HTMLButtonElement>('.wardrobe-save')!, cancel = dialog.querySelector<HTMLButtonElement>('.wardrobe-cancel')!, close = dialog.querySelector<HTMLButtonElement>('.wardrobe-close')!;
  const random = dialog.querySelector<HTMLButtonElement>('.wardrobe-random')!, tabs = [...dialog.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  let look = savedLook(), active: ClothingKey = 'shirt', busy = false;

  const entries = (key: ClothingKey) => Object.entries(appearanceOptions[key]);
  const labelFor = (key: ClothingKey, value: string) => entries(key).find(([, colour]) => colour === value)?.[0] || 'Custom';
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  }
  function draw() {
    const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(0, 4);
    ctx.fillStyle = '#17352c22'; ctx.beginPath(); ctx.ellipse(140, 337, 68, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#203832'; roundRect(ctx, 78, 311, 53, 16, 7); roundRect(ctx, 149, 311, 53, 16, 7);
    ctx.fillStyle = look.trousers; roundRect(ctx, 89, 225, 43, 91, 12); roundRect(ctx, 148, 225, 43, 91, 12);
    ctx.fillStyle = '#ffffff20'; roundRect(ctx, 95, 232, 8, 70, 4); roundRect(ctx, 154, 232, 8, 70, 4);
    ctx.fillStyle = look.skin; roundRect(ctx, 124, 91, 32, 30, 8); roundRect(ctx, 48, 183, 28, 48, 13); roundRect(ctx, 204, 183, 28, 48, 13);
    ctx.fillStyle = look.shirt;
    ctx.beginPath(); ctx.moveTo(101, 109); ctx.quadraticCurveTo(140, 128, 179, 109); ctx.lineTo(207, 132); ctx.lineTo(188, 178); ctx.lineTo(184, 235); ctx.lineTo(96, 235); ctx.lineTo(92, 178); ctx.lineTo(73, 132); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff25'; ctx.beginPath(); ctx.moveTo(101, 112); ctx.lineTo(114, 116); ctx.lineTo(107, 222); ctx.lineTo(98, 222); ctx.closePath(); ctx.fill();
    ctx.fillStyle = look.skin; roundRect(ctx, 56, 139, 27, 60, 13); roundRect(ctx, 197, 139, 27, 60, 13);
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.ellipse(140, 67, 43, 48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = look.hair;
    if (look.hairstyle === 'bob') { ctx.beginPath(); ctx.ellipse(140, 57, 49, 51, 0, Math.PI, Math.PI * 2); ctx.fill(); roundRect(ctx, 93, 49, 17, 62, 8); roundRect(ctx, 170, 49, 17, 62, 8); }
    else if (look.hairstyle === 'ponytail') { ctx.beginPath(); ctx.ellipse(140, 47, 44, 35, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(185, 54, 15, 29, -.35, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(140, 43, 44, 31, 0, Math.PI, Math.PI * 2); ctx.fill(); roundRect(ctx, 99, 37, 82, 18, 7); }
    ctx.fillStyle = '#22362f'; ctx.beginPath(); ctx.arc(124, 68, 3, 0, Math.PI * 2); ctx.arc(156, 68, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7c4d3f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(140, 79, 10, .18, Math.PI - .18); ctx.stroke();
    ctx.restore();
    dialog.querySelector('#wardrobe-look-label')!.textContent = `${labelFor('shirt', look.shirt)} top · ${labelFor('trousers', look.trousers)} bottoms`;
  }
  function renderOptions() {
    const top = active === 'shirt';
    dialog.querySelector('#wardrobe-step')!.textContent = top ? '01 / TOPS' : '02 / BOTTOMS';
    dialog.querySelector('#wardrobe-choice-title')!.textContent = top ? 'Choose a top' : 'Choose bottoms';
    for (const tab of tabs) { const selected = tab.dataset.category === active; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; }
    options.replaceChildren();
    for (const [label, value] of entries(active)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'wardrobe-option'; button.style.setProperty('--cloth-colour', value);
      button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(look[active] === value)); button.setAttribute('aria-label', `${label} ${active}`); button.disabled = busy;
      button.innerHTML = `<i class="wardrobe-garment ${active}" aria-hidden="true"></i><span>${label}</span><b aria-hidden="true">✓</b>`;
      button.onclick = () => { look = { ...look, [active]: value }; draw(); renderOptions(); };
      options.append(button);
    }
  }
  function setBusy(value: boolean) { busy = value; save.disabled = cancel.disabled = close.disabled = random.disabled = value; tabs.forEach(tab => tab.disabled = value); renderOptions(); }
  for (const tab of tabs) tab.onclick = () => { active = tab.dataset.category as ClothingKey; renderOptions(); options.querySelector<HTMLButtonElement>('button')?.focus(); };
  random.onclick = () => { const shirts = entries('shirt'), trousers = entries('trousers'); look = { ...look, shirt: shirts[Math.floor(Math.random() * shirts.length)][1], trousers: trousers[Math.floor(Math.random() * trousers.length)][1] }; draw(); renderOptions(); };
  const dismiss = () => { if (!busy) dialog.close(); }; cancel.onclick = close.onclick = dismiss;
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  form.onsubmit = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); status.textContent = 'Saving your look…';
    try {
      const accountId = session?.user.id;
      if (auth) {
        if (!accountId) throw new Error('Please log in again to save your outfit.');
        const { error } = await auth.auth.updateUser({ data: { appearance: look } }); if (error) throw error;
        if (session?.user.id !== accountId) throw new Error('Your session changed. Please open Wardrobe again.');
      } else localStorage.setItem('lepak-wardrobe', JSON.stringify(look));
      onSave(look); dialog.close();
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not save. Please try again.'; }
    finally { setBusy(false); }
  };
  return () => { look = savedLook(); active = 'shirt'; status.textContent = ''; draw(); renderOptions(); dialog.showModal(); tabs[0].focus(); };
}
