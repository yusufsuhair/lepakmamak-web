import {auth, session} from './auth';
import catalog from '../shared/shop.json';
import {createPetPreview} from './pet-preview';
import {petBreedList, type PetBreedId} from './animals';
import {bar} from './skeleton';
import './pet-studio.css';

type InventoryItem = {sku: string; equipped: boolean};
type ShopState = {items: InventoryItem[]; balance: number};
type PetItem = (typeof catalog)[number];
type PetStudioApi = {inventory: () => Promise<ShopState>; equip: (sku: string, value: boolean) => Promise<ShopState>};
type PetStudioOptions = {release?: () => void; openShop?: () => void; onName?: (name: string) => void | Promise<void>; onBreed?: (breed: PetBreedId) => void | Promise<void>};

const cleanName = (value: unknown) => String(typeof value === 'string' ? value : '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 18);

export function setupPetStudio(api: PetStudioApi, options: PetStudioOptions = {}) {
  const dialog = document.createElement('dialog'); dialog.id = 'pet-studio'; dialog.setAttribute('aria-labelledby', 'pet-studio-title');
  dialog.innerHTML = `<header><div><small>LEPAKMAMAK · COMPANION</small><h2 id="pet-studio-title">Pet Studio</h2><p>Your pet is a character of its own.</p></div><button type="button" id="pet-studio-close" aria-label="Close pet studio">×</button></header><div class="pet-studio-layout"><section class="pet-studio-stage"><canvas width="300" height="300" aria-label="Live 3D pet preview. Drag or swipe to rotate"></canvas><small>DRAG TO ROTATE · SWIPE ON MOBILE</small><strong class="pet-studio-preview-name"></strong></section><section class="pet-studio-controls"><div class="pet-studio-choice"><h3>Companion</h3><div class="pet-studio-cats"></div></div><div class="pet-studio-choice"><h3>Breed &amp; colour</h3><div class="pet-studio-breeds"></div></div><div class="pet-studio-choice"><h3>Ribbon</h3><div class="pet-studio-ribbons"></div></div><form id="pet-name-form"><label>Pet name<input id="pet-name" maxlength="18" autocomplete="nickname" placeholder="Give your pet a name"></label><button type="submit" class="primary">Save pet name</button></form><button type="button" id="pet-open-shop">Visit Shop</button><p id="pet-studio-status" role="status" aria-live="polite"></p></section></div>`;
  document.body.append(dialog);
  const canvas = dialog.querySelector<HTMLCanvasElement>('canvas')!;
  const preview = createPetPreview(canvas);
  const cats = dialog.querySelector<HTMLElement>('.pet-studio-cats')!;
  const breeds = dialog.querySelector<HTMLElement>('.pet-studio-breeds')!;
  const ribbons = dialog.querySelector<HTMLElement>('.pet-studio-ribbons')!;
  const stage = dialog.querySelector<HTMLElement>('.pet-studio-stage')!;
  const layout = dialog.querySelector<HTMLElement>('.pet-studio-layout')!;
  const nameForm = dialog.querySelector<HTMLFormElement>('#pet-name-form')!;
  const nameInput = dialog.querySelector<HTMLInputElement>('#pet-name')!;
  const previewName = dialog.querySelector<HTMLElement>('.pet-studio-preview-name')!;
  const status = dialog.querySelector<HTMLElement>('#pet-studio-status')!;
  const openShop = dialog.querySelector<HTMLButtonElement>('#pet-open-shop')!;
  let state: ShopState = {items: [], balance: 0}, selectedCat: PetKind, selectedBreed: PetBreedId, selectedRibbon = '', petName = cleanName(session?.user.user_metadata?.pet_name || ''), busy = false, ready = false, loadError = '';
  type PetKind = 'pet-ginger' | 'pet-cream';
  const catItems = () => catalog.filter(item => item.type === 'pet' && state.items.some(entry => entry.sku === item.id)) as PetItem[];
  const ribbonItems = () => catalog.filter(item => item.type === 'pet-decoration' && state.items.some(entry => entry.sku === item.id)) as PetItem[];
  const equipped = (sku: string) => !!state.items.find(item => item.sku === sku)?.equipped;
  const currentCat = () => catItems().find(item => equipped(item.id))?.id as PetKind | undefined;
  const currentRibbon = () => ribbonItems().find(item => equipped(item.id))?.id || '';
  const currentBreed = () => {
    const saved = String(session?.user.user_metadata?.pet_breed || '');
    const active = petBreedList.find(item => item.id === saved && item.base === selectedCat);
    return active?.id || (selectedCat === 'pet-ginger' ? 'ginger-tabby' : 'cream-shorthair');
  };
  const labelFor = (item: PetItem) => item.name;
  function draw() {
    const catsOwned = catItems(), ribbonsOwned = ribbonItems(), activeCat = currentCat() || catsOwned[0]?.id as PetKind | undefined;
    selectedCat = activeCat || 'pet-ginger'; selectedBreed = currentBreed(); selectedRibbon = currentRibbon();
    const hasPet = catsOwned.length > 0, loading = busy && !ready;
    dialog.setAttribute('aria-busy', String(loading));
    layout.hidden = false; stage.hidden = loading || !hasPet; nameForm.hidden = loading || !hasPet;
    openShop.hidden = false; openShop.disabled = loading || busy;
    if (loading) {
      cats.replaceChildren(bar('100%', '44px'), bar('100%', '44px'));
      breeds.replaceChildren(bar('100%', '44px'), bar('100%', '44px'));
      ribbons.replaceChildren(bar('100%', '44px'));
      status.textContent = 'Loading your companions…';
      return;
    }
    if (!hasPet) {
      cats.innerHTML = '<p class="pet-studio-empty">No pet yet. Adopt one in the shop.</p>'; breeds.replaceChildren(); ribbons.replaceChildren();
      status.textContent = loadError || 'Your pets appear here after you buy one from the shop.'; return;
    }
    cats.replaceChildren();
    for (const item of catsOwned) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = labelFor(item); button.setAttribute('aria-pressed', String(equipped(item.id))); button.disabled = busy;
      button.onclick = () => void toggle(item.id, !equipped(item.id)); cats.append(button);
    }
    breeds.replaceChildren();
    for (const breed of petBreedList.filter(item => item.base === selectedCat)) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = breed.name; button.setAttribute('aria-pressed', String(selectedBreed === breed.id)); button.disabled = busy;
      button.onclick = () => void chooseBreed(breed.id); breeds.append(button);
    }
    ribbons.replaceChildren();
    const none = document.createElement('button'); none.type = 'button'; none.textContent = 'No ribbon'; none.setAttribute('aria-pressed', String(!selectedRibbon)); none.disabled = busy; none.onclick = () => void clearRibbon(); ribbons.append(none);
    for (const item of ribbonsOwned) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = labelFor(item); button.setAttribute('aria-pressed', String(equipped(item.id))); button.disabled = busy;
      button.onclick = () => void toggle(item.id, !equipped(item.id)); ribbons.append(button);
    }
    preview.setPet(selectedCat, selectedRibbon, selectedBreed); previewName.textContent = petName || (catsOwned.find(item => item.id === selectedCat)?.name || 'Pet'); nameInput.value = petName;
  }
  async function apply(result: Promise<ShopState>, message: string) {
    if (busy) return; busy = true; status.textContent = 'Updating companion…'; draw();
    try { state = await result; status.textContent = message; }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not update pet.'; }
    finally { busy = false; draw(); }
  }
  async function toggle(sku: string, value: boolean) {
    const isCat = sku === 'pet-ginger' || sku === 'pet-cream';
    const isRibbon = sku.startsWith('pet-collar-');
    if (isCat && !value) { await apply(api.equip(sku, false), 'Pet hidden.'); return; }
    if (isCat || isRibbon) await apply(api.equip(sku, value), value ? 'Companion updated.' : 'Ribbon removed.');
  }
  async function chooseBreed(value: PetBreedId) {
    if (!petBreedList.some(item => item.id === value && item.base === selectedCat) || busy) return;
    busy = true; status.textContent = 'Saving cat style…'; draw();
    try {
      if (auth && session?.user.id) {
        const {data, error} = await auth.auth.updateUser({data: {pet_breed: value}}); if (error) throw error;
        if (data.user?.user_metadata) Object.assign(session!.user.user_metadata, data.user.user_metadata);
      }
      selectedBreed = value; await options.onBreed?.(value); status.textContent = 'Cat style saved.';
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not save cat style.'; }
    finally { busy = false; draw(); }
  }
  async function clearRibbon() {
    const active = currentRibbon(); if (active) await apply(api.equip(active, false), 'Ribbon removed.');
  }
  nameForm.onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    const value = cleanName(nameInput.value), accountId = session?.user.id;
    if (auth && accountId) {
      busy = true; status.textContent = 'Saving pet name…'; nameInput.disabled = true;
      try {
        const {data, error} = await auth.auth.updateUser({data: {pet_name: value}}); if (error) throw error;
        if (data.user?.id !== accountId || session?.user.id !== accountId) throw Error('Your session changed. Please try again.');
        if (data.user?.user_metadata) Object.assign(session!.user.user_metadata, data.user.user_metadata);
        petName = value; await options.onName?.(value); status.textContent = 'Pet name saved.';
      } catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not save pet name.'; }
      finally { busy = false; nameInput.disabled = false; draw(); }
    } else {
      petName = value; await options.onName?.(value); status.textContent = value ? 'Pet name saved on this device.' : 'Pet name cleared.'; draw();
    }
  };
  async function load() {
    busy = true; ready = false; loadError = ''; status.textContent = 'Loading your companions…'; draw();
    try { state = await api.inventory(); status.textContent = ''; }
    catch { state = {items: [], balance: 0}; loadError = 'Could not load your companions. Sign in and buy a pet from the shop to start your companion collection.'; }
    finally { ready = true; busy = false; draw(); }
  }
  dialog.querySelector<HTMLButtonElement>('#pet-studio-close')!.onclick = () => dialog.close();
  openShop.onclick = () => { dialog.close(); options.openShop?.(); };
  dialog.addEventListener('close', () => preview.stop()); dialog.addEventListener('keydown', event => event.stopPropagation());
  return {
    open() { options.release?.(); if (!petName) petName = cleanName(session?.user.user_metadata?.pet_name || ''); if (!dialog.open) dialog.showModal(); preview.start(); void load(); },
    close() { if (dialog.open) dialog.close(); },
    get opened() { return dialog.open; },
  };
}
