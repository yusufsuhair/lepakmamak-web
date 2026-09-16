import { session } from './auth';
import catalog from '../shared/shop.json';
import currencyPacks from '../shared/currency-packs.json';
import {skeleton, settled} from './skeleton';
import {defaultAppearance, type Appearance} from './appearance';
import {createAvatarPreview} from './avatar-preview';
import {applyAccessories} from './world';

type InventoryItem = { sku: string; equipped: boolean };
type ShopState = { items?: InventoryItem[]; balance?: number; dailyAvailable?: boolean; nextDailyAt?: string | null };

export function setupShop(onEquip: (items: string[]) => void, endpoint?: string, look: () => Appearance = () => defaultAppearance) {
  const dialog = document.createElement('dialog'); dialog.id = 'item-shop'; dialog.setAttribute('aria-labelledby', 'shop-title');
  dialog.innerHTML = `<header><div><h2 id="shop-title">Kedai Lepak.</h2><p>Skins, pets, aksesori dan Syiling Lepak</p></div><button type="button" id="shop-close" aria-label="Close shop">Close ×</button></header><section class="shop-wallet" aria-label="Syiling Lepak balance"><div><small>BAKI ANDA</small><strong id="shop-balance">🪙 —</strong></div><button type="button" id="shop-daily">Tuntut harian · +100</button></section><section class="coin-topup" aria-labelledby="coin-topup-title"><div><small>STRIPE CHECKOUT</small><h3 id="coin-topup-title">Tambah Syiling Lepak</h3><p>Pembayaran sekali sahaja · kredit masuk ke akaun ini.</p></div><div id="coin-packs"></div></section><p>Beli sekali, simpan dalam akaun dan item anda akan terus muncul di sini.</p><section class="shop-try" aria-labelledby="shop-try-name" hidden><canvas width="280" height="360" aria-label="Pratonton 3D character anda. Seret untuk pusing"></canvas><div><small>CUBA DULU · HANYA ANDA NAMPAK</small><h3 id="shop-try-name"></h3><p>Pratonton sahaja: tidak dipakai, tidak disimpan dan pemain lain tidak nampak.</p><button type="button" class="primary" id="shop-try-buy"></button><button type="button" id="shop-try-end">Tamat cuba</button></div></section><nav id="shop-filters" aria-label="Shop categories"><button type="button" data-category="all">All items</button><button type="button" data-category="pets">🐱 Pets & decorations</button></nav><p id="pet-guide" hidden>Buy a cat, then choose Pakai to bring them along. Switch cats or ribbons here anytime. Your equipped cat follows you automatically.</p><div id="shop-items"></div><p id="shop-message" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const message = dialog.querySelector<HTMLElement>('#shop-message')!;
  const balanceLabel = dialog.querySelector<HTMLElement>('#shop-balance')!;
  const daily = dialog.querySelector<HTMLButtonElement>('#shop-daily')!;
  const base = (endpoint || import.meta.env.VITE_MULTIPLAYER_URL || '').replace(/^ws/, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '');
  let owned: InventoryItem[] = [], balance = 0, dailyAvailable = false, nextDailyAt: string | null = null, available = false, paymentsAvailable = false, busy = false;
  // busy is true for a purchase too, when the numbers on screen are real and should stay put.
  // Only the first load has nothing true to show, and that is the one that gets placeholders.
  let ready = false, category = 'all';
  for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-category]')) button.onclick = () => { category = button.dataset.category!; endTry(); draw(); };

  async function request(path: string, body?: unknown) {
    if (!base) throw Error('The shop needs an online connection.');
    const result = await fetch(`${base}/shop/${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await result.json(); if (!result.ok) throw Object.assign(Error(data.error || 'Please try again.'), { state: data }); return data;
  }
  const equipped = () => owned.filter(item => item.equipped).map(item => item.sku);
  function applyState(state: ShopState) {
    if (state.items) owned = state.items;
    if (Number.isFinite(state.balance)) balance = state.balance!;
    if (typeof state.dailyAvailable === 'boolean') dailyAvailable = state.dailyAvailable;
    if ('nextDailyAt' in state) nextDailyAt = state.nextDailyAt || null;
    onEquip(equipped());
  }
  function rewardLabel() {
    if (dailyAvailable) return 'Tuntut harian · +100';
    if (!nextDailyAt) return 'Ganjaran dituntut';
    const hours = Math.max(1, Math.ceil((Date.parse(nextDailyAt) - Date.now()) / 3600000));
    return `Lagi ${hours} jam`;
  }
  // Cuba dresses a copy of the character inside this dialog, never the one in the city. Nothing
  // is equipped, saved or sent, so ending a try has nothing to undo: it only hides the copy.
  const tryPanel = dialog.querySelector<HTMLElement>('.shop-try')!, tryCanvas = tryPanel.querySelector('canvas')!, tryBuy = dialog.querySelector<HTMLButtonElement>('#shop-try-buy')!;
  let trying = '', fitting: ReturnType<typeof createAvatarPreview> | null = null;
  const isSkin = (sku: string) => catalog.find(item => item.id === sku)?.type === 'skin';
  function tryOn(sku: string) {
    // Skins replace each other, as equipping one does on the server.
    const items = [...equipped().filter(id => !(isSkin(sku) && isSkin(id))), sku];
    fitting ||= createAvatarPreview(tryCanvas);
    fitting.setLook(look()); applyAccessories(fitting.avatar, items); tryCanvas.dataset.accessories = items.join(',');
    trying = sku; tryPanel.hidden = false; fitting.start(); draw(); tryPanel.scrollIntoView({block: 'nearest'});
  }
  function endTry() { trying = ''; tryPanel.hidden = true; fitting?.stop(); }
  function draw() {
    // A guest has no wallet and no checkout: show the rack and the try-on, not disabled money.
    dialog.querySelector<HTMLElement>('.shop-wallet')!.hidden = !session;
    dialog.querySelector<HTMLElement>('.coin-topup')!.hidden = !session;
    const loading = busy && !ready, unknown = !busy && !ready;
    // Bought, it is theirs to Pakai; there is nothing left to try.
    if (owned.some(entry => entry.sku === trying)) endTry();
    // A balance of zero is a fact about the account, not a stand-in for one nobody has fetched.
    if (loading) skeleton(balanceLabel, 'Memuatkan baki', '104px', '26px');
    else settled(balanceLabel, unknown ? '🪙 —' : `🪙 ${balance.toLocaleString('en-MY')}`);
    if (loading) skeleton(daily, 'Memuatkan ganjaran harian', '116px');
    // rewardLabel() reads "Ganjaran dituntut" from an unset nextDailyAt, which told logged-out
    // players they had already claimed a reward they had never been offered.
    else settled(daily, ready ? rewardLabel() : 'Tuntut harian · +100');
    daily.disabled = busy || !available || !session || !dailyAvailable;
    const packs = dialog.querySelector('#coin-packs')!; packs.replaceChildren();
    for (const pack of currencyPacks) {
      const button = document.createElement('button'); button.type = 'button'; button.disabled = busy || !available || !paymentsAvailable || !session;
      button.innerHTML = `<span>${pack.badge}</span><strong>🪙 ${pack.credits.toLocaleString('en-MY')}</strong><small>RM ${(pack.amount / 100).toFixed(2)}</small>`;
      button.onclick = async () => {
        if (busy) return; busy = true; draw(); message.textContent = 'Membuka Stripe Checkout…';
        try { const data = await request('checkout', { packId: pack.id }); if (!data.url) throw Error('Checkout tidak tersedia.'); window.location.assign(data.url); }
        catch (error) { message.textContent = (error as Error).message; busy = false; draw(); }
      };
      packs.append(button);
    }
    const list = dialog.querySelector('#shop-items')!; list.replaceChildren();
    dialog.querySelector<HTMLElement>('#pet-guide')!.hidden = category !== 'pets';
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-category]')) button.setAttribute('aria-pressed', String(category === button.dataset.category));
    for (const item of catalog.filter(item => category !== 'pets' || item.type.startsWith('pet'))) {
      const record = owned.find(entry => entry.sku === item.id), card = document.createElement('article');
      card.dataset.type = item.type;
      const preview = document.createElement('div'); preview.className = `shop-art ${item.id}`; preview.setAttribute('aria-hidden', 'true'); preview.innerHTML = item.id === 'spectacles' ? '<i></i><i></i>' : '<i></i>';
      if (item.type.startsWith('pet')) {
        const color = item.id === 'pet-ginger' ? '#e6a34e' : item.id === 'pet-cream' ? '#f0e8d8' : item.id === 'pet-collar-red' ? '#df655e' : '#51b8ab';
        preview.innerHTML = `<svg width="76" height="76" viewBox="0 0 64 64" fill="${color}" stroke="#263f35" stroke-width="2" aria-hidden="true">${item.type === 'pet' ? '<path d="M12 27 10 8l16 11h12L54 8l-2 19a23 23 0 1 1-40 0Z"/><path d="M23 33h1m16 0h1M29 42l3 3 3-3M7 39l13 3M5 48l15-2m37-7-13 3m15 6-15-2" fill="none" stroke-linecap="round"/>' : '<path d="M29 28 9 17v30l20-11m6-8 20-11v30L35 36Z"/><circle cx="32" cy="32" r="6"/>'}</svg>`;
      }
      const kind = document.createElement('small'); kind.className = 'shop-kind'; kind.textContent = item.type.toUpperCase().replace('-', ' ');
      const title = document.createElement('h3'); title.textContent = item.name;
      const description = document.createElement('p'); description.textContent = item.description;
      const button = document.createElement('button'); button.className = 'primary shop-item-action'; button.type = 'button'; button.disabled = busy || !available || !session;
      // Beli or Pakai turns on whether this is already owned, so before the inventory lands
      // every card claimed the player did not own it.
      if (loading) skeleton(button, `${item.name} · memuatkan`, '100%');
      else settled(button, record ? (record.equipped ? 'Tanggalkan' : 'Pakai') : `Beli · 🪙 ${item.price}`);
      button.onclick = async () => {
        if (busy) return; busy = true; draw(); message.textContent = record ? 'Mengemas kini character…' : `Membeli ${item.name}…`;
        try {
          const data = record ? await request('equip', { sku: item.id, equipped: !record.equipped }) : await request('buy', { sku: item.id });
          applyState(data); message.textContent = record ? 'Character dikemas kini.' : `${item.name} kini milik anda.`;
        } catch (error) {
          const failure = error as Error & { state?: ShopState }; if (failure.state) applyState(failure.state);
          message.textContent = failure.message || 'Please try again.';
        } finally { busy = false; draw(); }
      };
      const actions = document.createElement('div'); actions.className = 'shop-item-actions';
      // Cuba needs no account, wallet or connection, because it never leaves this dialog.
      if (!loading && !record && !item.type.startsWith('pet')) {
        const tryButton = document.createElement('button'); tryButton.type = 'button'; tryButton.className = 'shop-try-toggle'; tryButton.textContent = 'Cuba';
        tryButton.setAttribute('aria-label', `Cuba ${item.name}`); tryButton.setAttribute('aria-pressed', String(trying === item.id));
        tryButton.onclick = () => { if (trying === item.id) { endTry(); draw(); } else tryOn(item.id); };
        actions.append(tryButton);
      }
      // The try-on's Beli is this card's Beli: same handler, same checks, same request.
      if (item.id === trying) { dialog.querySelector('#shop-try-name')!.textContent = item.name; tryBuy.textContent = button.textContent; tryBuy.disabled = button.disabled; tryBuy.onclick = button.onclick; }
      actions.append(button); card.append(preview, kind, title, description, actions); list.append(card);
    }
  }
  async function refresh() {
    if (busy) return; busy = true;
    if (!ready) message.textContent = 'Memuatkan kedai…';
    draw();
    try {
      const data = await request('catalog'); available = data.available; paymentsAvailable = !!data.paymentsAvailable;
      // Only an account that actually answered has a balance. Logged out, or with the shop
      // down, the number is not zero — it is nobody's, and the wallet says so.
      if (session && available) { applyState(await request('inventory')); ready = true; }
      const params = new URLSearchParams(location.search), sessionId = params.get('session_id');
      if (session && params.get('coins') === 'success' && sessionId) {
        const paid = await request('checkout-status', { sessionId }); applyState(paid);
        message.textContent = paid.pending ? 'Bayaran sedang diproses. Buka semula Kedai sebentar lagi.' : 'Pembayaran berjaya — Syiling Lepak sudah masuk!';
        if (!paid.pending) { params.delete('coins'); params.delete('session_id'); history.replaceState({}, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`); }
      } else if (params.get('coins') === 'cancelled') {
        message.textContent = 'Pembayaran dibatalkan. Tiada caj dibuat.'; params.delete('coins'); history.replaceState({}, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
      } else message.textContent = !session ? 'Log masuk untuk simpan Syiling Lepak dan item.' : available ? '500 syiling permulaan diberi kepada setiap akaun.' : 'Kedai belum tersedia.';
    } catch { available = false; message.textContent = 'Tidak dapat sambung ke kedai. Cuba lagi.'; }
    finally { busy = false; draw(); }
  }
  daily.onclick = async () => {
    if (busy || !dailyAvailable) return; busy = true; draw(); message.textContent = 'Menuntut ganjaran harian…';
    try { applyState(await request('daily', {})); message.textContent = '🪙 100 Syiling Lepak diterima!'; }
    catch (error) { const failure = error as Error & { state?: ShopState }; if (failure.state) applyState(failure.state); message.textContent = failure.message; }
    finally { busy = false; draw(); }
  };
  dialog.querySelector('#shop-close')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('#shop-try-end')!.addEventListener('click', () => { endTry(); draw(); });
  // However Kedai closes (the button, Escape, logging out) a try ends with it.
  dialog.addEventListener('close', endTry);
  dialog.addEventListener('keydown', event => event.stopPropagation());
  return { async inventory(){const data=await request('inventory');applyState(data);return {items:[...owned],balance};},async equip(sku:string,value:boolean){const data=await request('equip',{sku,equipped:value});applyState(data);return {items:[...owned],balance};}, open(filter = 'all') { category = filter; endTry(); draw(); if (!dialog.open) dialog.showModal(); void refresh(); }, enter: refresh, close() { dialog.close(); owned = []; balance = 0; ready = false; onEquip([]); } };
}
