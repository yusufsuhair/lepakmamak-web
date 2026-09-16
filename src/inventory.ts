import catalog from '../shared/shop.json';
import {appearanceOptions, hairStyles, characterThumbnail, tudungColour, type Appearance} from './appearance';
import {createAvatarPreview} from './avatar-preview';
import {CLOTHING, lookLabel, savedLook, saveLook} from './wardrobe';
import {bar, skeleton, settled} from './skeleton';
import './inventory.css';
import {session} from './auth';

type State = {items: {sku: string; equipped: boolean}[]; balance: number};
type Filter = 'all' | 'accessory' | 'owned-skin' | keyof Appearance;

const ICONS: Record<string, string> = {'pet-ginger': '🐈', 'pet-cream': '🐈', 'pet-collar-red': '🎀', 'pet-collar-teal': '🎀', spectacles: '👓', cap: '🧢', batik: '👔', harimau: '👕'};
const FILTERS: {key: Filter; label: string}[] = [
  {key: 'all', label: 'All'}, {key: 'accessory', label: 'Accessories'}, {key: 'owned-skin', label: 'Skins'},
  {key: 'gender', label: 'Body'}, {key: 'hairstyle', label: 'Hair'}, {key: 'hair', label: 'Hair colour'}, {key: 'skin', label: 'Skin tone'},
  {key: 'shirt', label: 'Tops'}, {key: 'trousers', label: 'Bottoms'}, {key: 'tudung', label: 'Tudung'},
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
    <div class="inventory-summary"><span>Your collection</span><strong class="inventory-balance">— Lepak Coin</strong></div>
    <div class="inventory-layout">
      <aside><h3>Equipped</h3><div class="equipment-slots"></div><h3>Wearing</h3><div class="outfit-slots"></div></aside>
      <div class="inventory-stage"><canvas width="280" height="360" aria-label="Live 3D character preview. Drag or swipe to rotate"></canvas><p class="inventory-model-status" role="status"></p><button type="button" class="inventory-model-retry" hidden>Retry model</button><small class="inventory-stage-hint">DRAG TO ROTATE · SWIPE ON MOBILE</small><div class="inventory-look"><small>CURRENT LOOK</small><strong class="inventory-look-name"></strong></div><button type="button" class="inventory-random">Surprise me</button></div>
      <section><nav aria-label="Inventory filters"></nav><div class="inventory-hair-filters" role="group" aria-label="Hair collections" hidden></div><div class="inventory-grid" role="group"></div><div class="inventory-details"></div></section>
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
  let hairCategory = look.gender;
  let saveRevision = 0;
  let saveQueue = Promise.resolve();
  canvas.addEventListener('avatarassetstate', () => {
    const assetState = canvas.dataset.assetState;
    dialog.querySelector('.inventory-model-status')!.textContent = assetState === 'loading' ? 'Loading character…' : assetState === 'fallback' ? 'Character model could not load.' : '';
    dialog.querySelector<HTMLButtonElement>('.inventory-model-retry')!.hidden = assetState !== 'fallback';
  });
  dialog.querySelector<HTMLButtonElement>('.inventory-model-retry')!.onclick = () => avatarPreview.setLook(look);

  for (const {key, label} of FILTERS) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.filter = key; button.textContent = label;
    button.onclick = () => { filter = key; selected = ''; render(); };
    filterBar.append(button);
  }

  // Clothes apply the moment you pick them, so there is no Save button to hunt for. The
  // world hears about it through onLook; storage keeps it for the next time you log in.
  async function wear(next: Appearance) {
    if (next.gender !== look.gender) hairCategory = next.gender;
    look = {...next}; onLook(look); render();
    const revision = ++saveRevision, ticket = epoch, account = session?.user.id;
    const snapshot = {...look};
    status.textContent = 'Saving your look…';
    // Serialize writes so quick swatch/style changes cannot save an older outfit last.
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      if (session?.user.id !== account) throw new Error('Your session changed. Open your character screen again.');
      await saveLook(snapshot);
    });
    try { await saveQueue; if (revision === saveRevision && ticket === epoch) status.textContent = 'Outfit saved.'; }
    catch (error) { if (revision === saveRevision && ticket === epoch) status.textContent = error instanceof Error ? error.message : 'Could not save your outfit.'; }
  }

  function swatchColor(key: keyof Appearance, value: string) {
    return key === 'tudung' ? tudungColour(value) : key === 'hairstyle' ? look.hair : key === 'gender' ? look.skin : value;
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
      slot.style.setProperty('--worn', swatchColor(key, look[key]));
      slot.innerHTML = '<i aria-hidden="true"></i>';
      slot.append(document.createTextNode(`${title} · ${lookLabel(key, look[key])}`));
      slot.onclick = () => { filter = key; render(); };
      outfit.append(slot);
    }
  }

  function renderGrid() {
    const grid = dialog.querySelector<HTMLElement>('.inventory-grid')!;
    grid.replaceChildren();
    const hairFilters = dialog.querySelector<HTMLElement>('.inventory-hair-filters')!;
    hairFilters.hidden = filter !== 'hairstyle'; hairFilters.replaceChildren();
    if (filter === 'hairstyle') for (const [id, label] of [['male', 'Lelaki'], ['female', 'Perempuan'], ['all', 'Semua']]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.setAttribute('aria-pressed', String(hairCategory === id));
      button.onclick = () => { hairCategory = id; renderGrid(); }; hairFilters.append(button);
    }
    const clothing = CLOTHING.find(entry => entry.key === filter);
    if (clothing) {
      grid.setAttribute('aria-label', `${clothing.title} you can wear`);
      grid.setAttribute('role', 'radiogroup');
    for (const [label, colour] of Object.entries(appearanceOptions[clothing.key])) {
      const button = document.createElement('button');
      if (clothing.key === 'hairstyle' && hairCategory !== 'all' && !hairStyles.some(style => style.id === colour && style.category === hairCategory)) continue;
      button.type = 'button'; button.className = 'inventory-item inventory-cloth'; button.dataset.availability = 'available'; button.dataset.style = colour;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(look[clothing.key] === colour));
      button.setAttribute('aria-label', `${label} ${clothing.key}`);
      button.disabled = busy;
      button.title = `Wear ${label}`;
      button.style.setProperty('--cloth', swatchColor(clothing.key, colour));
      const swatch = document.createElement('span'); swatch.className = 'inventory-art inventory-swatch';
      if (clothing.key === 'hairstyle' || clothing.key === 'tudung' && colour !== 'none') {
        const image = document.createElement('img'); image.src = characterThumbnail(clothing.key === 'hairstyle' ? 'hair' : 'tudung', colour);
        image.alt = ''; image.loading = 'lazy'; image.width = 96; image.height = 96;
        swatch.className = 'inventory-art inventory-style-preview'; swatch.append(image);
      }
      const name = document.createElement('strong'); name.textContent = label;
      const badge = document.createElement('small'); badge.textContent = look[clothing.key] === colour ? 'WEARING' : clothing.title.toUpperCase();
      button.append(swatch, name, badge);
      button.onclick = () => { void wear({...look, [clothing.key]: colour, ...(clothing.key === 'hairstyle' ? {tudung: 'none'} : {})}); };
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
    const items = catalog.filter(entry => state.items.some(owned => owned.sku === entry.id) && (filter === 'all' || entry.type === (filter === 'owned-skin' ? 'skin' : filter)));
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
      empty.textContent = ready ? 'No items here yet. Visit the shop to grow your collection.' : 'Could not load your collection.';
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
    else settled(balanceLabel, ready ? `${state.balance.toLocaleString()} Lepak Coin` : '— Lepak Coin');
    dialog.querySelector('.inventory-look-name')!.textContent = `${look.tudung === 'none' ? lookLabel('hairstyle', look.hairstyle) : lookLabel('tudung', look.tudung)} · ${lookLabel('shirt', look.shirt)} top · ${lookLabel('trousers', look.trousers)} bottoms`;
    avatarPreview.setLook(look);
    avatarPreview.setAccessories(state.items.filter(item => item.equipped).map(item => item.sku));
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    dialog.querySelector<HTMLButtonElement>('.inventory-random')!.disabled = busy;
    renderEquipped(); renderOutfit(); renderGrid(); renderDetails();
  }

  dialog.querySelector<HTMLButtonElement>('.inventory-random')!.onclick = () => {
    const pick = (key: keyof Appearance) => {
      const values = key === 'hairstyle' ? hairStyles.filter(style => style.category === look.gender).map(style => style.id) : Object.values(appearanceOptions[key]);
      return values[Math.floor(Math.random() * values.length)];
    };
    void wear({...look, hairstyle: pick('hairstyle'), hair: pick('hair'), shirt: pick('shirt'), trousers: pick('trousers'), tudung: Math.random() < .5 ? 'none' : pick('tudung')});
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
      look = savedLook(); hairCategory = look.gender;
      if (!dialog.open) dialog.showModal();
      avatarPreview.start();
      void load();
    },
    close() { dialog.close(); },
    get opened() { return dialog.open; },
  };
}
