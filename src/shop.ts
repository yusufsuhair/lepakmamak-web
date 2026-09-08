import { session } from './auth';
import catalog from '../shared/shop.json';

type InventoryItem = { sku: string; equipped: boolean };
type ShopState = { items?: InventoryItem[]; balance?: number; dailyAvailable?: boolean; nextDailyAt?: string | null };

export function setupShop(onEquip: (items: string[]) => void, endpoint?: string) {
  const dialog = document.createElement('dialog'); dialog.id = 'item-shop'; dialog.setAttribute('aria-labelledby', 'shop-title');
  dialog.innerHTML = `<header><div><h2 id="shop-title">Kedai Lepak.</h2><p>Skins dan aksesori · tiada bayaran sebenar</p></div><button type="button" id="shop-close" aria-label="Close shop">Close ×</button></header><section class="shop-wallet" aria-label="Syiling Lepak balance"><div><small>BAKI ANDA</small><strong id="shop-balance">🪙 —</strong></div><button type="button" id="shop-daily">Tuntut harian · +100</button></section><p>Beli sekali, simpan dalam akaun dan pakai bila-bila masa.</p><div id="shop-items"></div><p id="shop-message" role="status" aria-live="polite"></p><button type="button" id="shop-refresh" class="secondary">Refresh kedai</button>`;
  document.body.append(dialog);
  const message = dialog.querySelector<HTMLElement>('#shop-message')!;
  const balanceLabel = dialog.querySelector<HTMLElement>('#shop-balance')!;
  const daily = dialog.querySelector<HTMLButtonElement>('#shop-daily')!;
  const base = (endpoint || import.meta.env.VITE_MULTIPLAYER_URL || '').replace(/^ws/, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '');
  let owned: InventoryItem[] = [], balance = 0, dailyAvailable = false, nextDailyAt: string | null = null, available = false, busy = false;

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
  function draw() {
    balanceLabel.textContent = `🪙 ${balance.toLocaleString('en-MY')}`;
    daily.textContent = rewardLabel(); daily.disabled = busy || !available || !session || !dailyAvailable;
    const list = dialog.querySelector('#shop-items')!; list.replaceChildren();
    for (const item of catalog) {
      const record = owned.find(entry => entry.sku === item.id), card = document.createElement('article');
      card.dataset.type = item.type;
      const preview = document.createElement('div'); preview.className = `shop-art ${item.id}`; preview.setAttribute('aria-hidden', 'true'); preview.innerHTML = item.id === 'spectacles' ? '<i></i><i></i>' : '<i></i>';
      const kind = document.createElement('small'); kind.className = 'shop-kind'; kind.textContent = item.type === 'skin' ? 'SKIN' : 'ACCESSORY';
      const title = document.createElement('h3'); title.textContent = item.name;
      const description = document.createElement('p'); description.textContent = item.description;
      const button = document.createElement('button'); button.className = 'primary'; button.type = 'button'; button.disabled = busy || !available || !session;
      button.textContent = record ? (record.equipped ? 'Tanggalkan' : 'Pakai') : `Beli · 🪙 ${item.price}`;
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
      card.append(preview, kind, title, description, button); list.append(card);
    }
  }
  async function refresh() {
    if (busy) return; busy = true; draw();
    try {
      const data = await request('catalog'); available = data.available;
      if (session && available) applyState(await request('inventory'));
      message.textContent = !session ? 'Log masuk untuk simpan Syiling Lepak dan item.' : available ? '500 syiling permulaan diberi kepada setiap akaun.' : 'Kedai belum tersedia.';
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
  dialog.querySelector('#shop-refresh')!.addEventListener('click', () => void refresh());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  return { open() { dialog.showModal(); void refresh(); }, enter: refresh, close() { dialog.close(); owned = []; balance = 0; onEquip([]); } };
}
