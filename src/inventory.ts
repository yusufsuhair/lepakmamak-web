import catalog from '../shared/shop.json';
import {appearanceOptions, type Appearance} from './appearance';
import {createAvatarPreview} from './avatar-preview';
import {CLOTHING, lookLabel, savedLook, saveLook} from './wardrobe';
import {bar, skeleton, settled} from './skeleton';
import './inventory.css';

type State = {items: {sku: string; equipped: boolean}[]; balance: number};
type Filter = 'all' | 'accessory' | 'skin' | 'shirt' | 'trousers';

const ICONS: Record<string, string> = {spectacles: '👓', cap: '🧢', batik: '👔', harimau: '👕'};
const FILTERS: {key: Filter; label: string}[] = [
  {key: 'all', label: 'All'}, {key: 'accessory', label: 'Accessories'}, {key: 'skin', label: 'Skins'},
  {key: 'shirt', label: 'Tops'}, {key: 'trousers', label: 'Bottoms'},
];

// One character screen: what you own, what you are wearing and the clothes underneath, all
// in the same panel. There is no second dialog to open — picking a top applies it there and
// then, the way equipping an item already did.
export function setupInventory(
  api: {inventory: () => Promise<State>; equip: (sku: string, value: boolean) => Promise<State>},
  release: () => void,
  onLook: (look: Appearance) => void = () => {},
) {
  const dialog = document.createElement('dialog');
  dialog.id = 'inventory'; dialog.setAttribute('aria-labelledby', 'inventory-title');
  dialog.innerHTML = `<header><div><small>LEPAKMAMAK · CHARACTER</small><h2 id="inventory-title">Character</h2></div><button type="button" aria-label="Close inventory">×</button></header>
    <div class="inventory-summary"><span>Your collection</span><strong class="inventory-balance">— Syiling</strong></div>
    <div class="inventory-layout">
      <aside><h3>Equipped</h3><div class="equipment-slots"></div><h3>Wearing</h3><div class="outfit-slots"></div></aside>
      <div class="inventory-stage"><canvas width="280" height="360" aria-label="Live 3D character preview"></canvas><div class="inventory-look"><small>CURRENT LOOK</small><strong class="inventory-look-name"></strong></div><button type="button" class="inventory-random">Surprise me</button></div>
      <section><nav aria-label="Inventory filters"></nav><div class="inventory-grid" role="group"></div><div class="inventory-details"></div></section>
    </div>
    <p class="inventory-status" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);

  const status = dialog.querySelector<HTMLElement>('.inventory-status')!;
  const canvas = dialog.querySelector('canvas')!;
  const avatarPreview = createAvatarPreview(canvas);
  const filterBar = dialog.querySelector<HTMLElement>('nav')!;
  let state: State = {items: [], balance: 0};
  let selected = '', filter: Filter = 'all', busy = false, epoch = 0;
  // busy also covers equipping, when the collection on screen is real. Only a load that has
  // never landed has nothing honest to show.
  let ready = false;
  const loading = () => busy && !ready;
  let look = savedLook();

  for (const {key, label} of FILTERS) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.filter = key; button.textContent = label;
    button.onclick = () => { filter = key; selected = ''; render(); };
    filterBar.append(button);
  }

  // Clothes apply the moment you pick them, so there is no Save button to hunt for. The
  // world hears about it through onLook; storage keeps it for the next time you log in.
  async function wear(next: Appearance) {
    look = next; onLook(look); render();
    status.textContent = 'Saving your look…';
    try { await saveLook(look); status.textContent = 'Outfit saved.'; }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not save your outfit.'; }
  }

  function renderEquipped() {
    const slots = dialog.querySelector<HTMLElement>('.equipment-slots')!;
    slots.replaceChildren();
    for (const [title, ids] of [['Head', ['cap']], ['Face', ['spectacles']], ['Outfit', ['batik', 'harimau']]] as const) {
      const item = state.items.find(owned => ids.some(id => id === owned.sku) && owned.equipped);
      const slot = document.createElement('button');
      slot.type = 'button'; slot.disabled = !item || busy;
      // "Empty" is a finding, not a default. Until the collection arrives the slot says only
      // which slot it is.
      if (loading()) {
        slot.replaceChildren(document.createTextNode(`◇  ${title} · `), bar('68px', '11px'));
        slot.setAttribute('aria-label', `${title} slot, loading`);
      } else settled(slot, `${item ? ICONS[item.sku] : '◇'}  ${title} · ${item ? catalog.find(entry => entry.id === item.sku)?.name : 'Empty'}`);
      slot.onclick = () => { selected = item!.sku; filter = 'all'; render(); };
      slots.append(slot);
    }
  }

  function renderOutfit() {
    const outfit = dialog.querySelector<HTMLElement>('.outfit-slots')!;
    outfit.replaceChildren();
    for (const {key, title} of CLOTHING) {
      const slot = document.createElement('button');
      slot.type = 'button'; slot.className = 'outfit-slot'; slot.disabled = busy;
      slot.style.setProperty('--worn', look[key]);
      slot.innerHTML = '<i aria-hidden="true"></i>';
      slot.append(document.createTextNode(`${title} · ${lookLabel(key, look[key])}`));
      slot.onclick = () => { filter = key; render(); };
      outfit.append(slot);
    }
  }

  function renderGrid() {
    const grid = dialog.querySelector<HTMLElement>('.inventory-grid')!;
    grid.replaceChildren();
    const clothing = CLOTHING.find(entry => entry.key === filter);
    if (clothing) {
      grid.setAttribute('aria-label', `${clothing.title} you can wear`);
      grid.setAttribute('role', 'radiogroup');
      for (const [label, colour] of Object.entries(appearanceOptions[clothing.key])) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'inventory-item inventory-cloth';
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', String(look[clothing.key] === colour));
        button.setAttribute('aria-label', `${label} ${clothing.key}`);
        button.disabled = busy;
        button.style.setProperty('--cloth', colour);
        const swatch = document.createElement('span'); swatch.className = 'inventory-art inventory-swatch';
        const name = document.createElement('strong'); name.textContent = label;
        const badge = document.createElement('small'); badge.textContent = look[clothing.key] === colour ? 'WEARING' : clothing.title.toUpperCase();
        button.append(swatch, name, badge);
        button.onclick = () => void wear({...look, [clothing.key]: colour});
        grid.append(button);
      }
      return;
    }
    grid.setAttribute('aria-label', 'Items you own');
    grid.setAttribute('role', 'group');
    if (loading()) {
      // One row, because the grid is three across: enough to say something is coming without
      // promising how much. The real count arrives with the data.
      for (let slot = 0; slot < 3; slot++) {
        const tile = document.createElement('div');
        tile.className = 'inventory-item'; tile.setAttribute('aria-hidden', 'true');
        tile.append(bar('46px', '46px'), bar('64px', '12px'), bar('34px', '9px'));
        grid.append(tile);
      }
      return;
    }
    const items = catalog.filter(entry => state.items.some(owned => owned.sku === entry.id) && (filter === 'all' || entry.type === filter));
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'inventory-item'; button.disabled = busy;
      button.setAttribute('aria-pressed', String(selected === item.id));
      const art = document.createElement('span'); art.className = 'inventory-art'; art.textContent = ICONS[item.id] || '◇';
      const title = document.createElement('strong'); title.textContent = item.name;
      const badge = document.createElement('small');
      badge.textContent = state.items.find(owned => owned.sku === item.id)?.equipped ? 'EQUIPPED' : item.type.toUpperCase();
      button.append(art, title, badge);
      button.onclick = () => { selected = item.id; render(); };
      grid.append(button);
    }
    if (!items.length) {
      const empty = document.createElement('p'); empty.className = 'inventory-empty';
      empty.textContent = ready ? 'No items here yet. Visit Kedai to grow your collection.' : 'Could not load your collection.';
      grid.append(empty);
    }
  }

  function renderDetails() {
    const detail = dialog.querySelector<HTMLElement>('.inventory-details')!;
    detail.replaceChildren();
    const item = catalog.find(entry => entry.id === selected), owned = state.items.find(entry => entry.sku === selected);
    if (!item || !owned) return;
    const title = document.createElement('h3'); title.textContent = item.name;
    const description = document.createElement('p'); description.textContent = item.description;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'primary'; button.disabled = busy;
    button.textContent = owned.equipped ? 'Unequip' : 'Equip';
    button.onclick = async () => {
      busy = true; render(); status.textContent = 'Updating equipment…';
      const ticket = epoch;
      try { const data = await api.equip(item.id, !owned.equipped); if (ticket === epoch) { state = data; status.textContent = 'Equipment updated.'; } }
      catch (error) { if (ticket === epoch) status.textContent = (error as Error).message; }
      finally { if (ticket === epoch) { busy = false; render(); } }
    };
    detail.append(title, description, button);
  }

  function render() {
    const balanceLabel = dialog.querySelector<HTMLElement>('.inventory-balance')!;
    if (loading()) skeleton(balanceLabel, 'Loading balance', '82px', '14px');
    else settled(balanceLabel, ready ? `${state.balance.toLocaleString()} Syiling` : '— Syiling');
    dialog.querySelector('.inventory-look-name')!.textContent = `${lookLabel('shirt', look.shirt)} top · ${lookLabel('trousers', look.trousers)} bottoms`;
    avatarPreview.setLook(look);
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    dialog.querySelector<HTMLButtonElement>('.inventory-random')!.disabled = busy;
    renderEquipped(); renderOutfit(); renderGrid(); renderDetails();
  }

  dialog.querySelector<HTMLButtonElement>('.inventory-random')!.onclick = () => {
    const pick = (key: 'shirt' | 'trousers') => { const values = Object.values(appearanceOptions[key]); return values[Math.floor(Math.random() * values.length)]; };
    void wear({...look, shirt: pick('shirt'), trousers: pick('trousers')});
  };
  dialog.querySelector('header button')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => { epoch++; busy = false; avatarPreview.stop(); });

  async function load() {
    const ticket = ++epoch;
    busy = true; ready = false; state = {items: [], balance: 0}; status.textContent = 'Loading inventory…'; render();
    try { const data = await api.inventory(); if (ticket === epoch) { state = data; ready = true; status.textContent = `${data.items.length} owned items`; } }
    catch (error) { if (ticket === epoch) status.textContent = `Unable to load inventory. ${(error as Error).message}`; }
    finally { if (ticket === epoch) { busy = false; render(); } }
  }

  return {
    open() {
      release();
      // The account may have changed clothes on another device since this was last open.
      look = savedLook();
      if (!dialog.open) dialog.showModal();
      avatarPreview.start();
      void load();
    },
    close() { dialog.close(); },
    get opened() { return dialog.open; },
  };
}
