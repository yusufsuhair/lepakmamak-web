import {auth, session} from './auth';
import catalog from '../shared/shop.json';
import {createPetPreview} from './pet-preview';
import {petBreedList, type PetBreedId} from './animals';
import petCoats from '../shared/pet-coats.json';
import {petStyle} from '../shared/pet-style.mjs';
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
  dialog.querySelector('header p')!.textContent = 'One companion. Every breed and coat is yours.';
  dialog.querySelector('.pet-studio-breeds')!.parentElement!.querySelector('h3')!.textContent = 'Breed & style';
  dialog.querySelector('.pet-studio-breeds')!.insertAdjacentHTML('afterend', '<p class="pet-breed-description"></p>');
  dialog.querySelector('.pet-studio-breeds')!.parentElement!.insertAdjacentHTML('afterend', '<div class="pet-studio-choice"><h3>Coat colour <span class="pet-coat-name"></span></h3><div class="pet-studio-coats" role="group" aria-label="Coat colour"></div><p class="pet-studio-hint">All colours included. Mix with any breed.</p></div>');
  dialog.querySelector('.pet-studio-stage')!.insertAdjacentHTML('beforeend', '<div class="pet-preview-actions" role="group" aria-label="Preview animation"></div>');
  const canvas = dialog.querySelector<HTMLCanvasElement>('canvas')!;
  const preview = createPetPreview(canvas);
  const cats = dialog.querySelector<HTMLElement>('.pet-studio-cats')!;
  const breeds = dialog.querySelector<HTMLElement>('.pet-studio-breeds')!;
  const coats = dialog.querySelector<HTMLElement>('.pet-studio-coats')!;
  const description = dialog.querySelector<HTMLElement>('.pet-breed-description')!;
  const coatName = dialog.querySelector<HTMLElement>('.pet-coat-name')!;
  const actions = dialog.querySelector<HTMLElement>('.pet-preview-actions')!;
  for (const action of ['auto', 'idle', 'walk', 'lie', 'play', 'jump'] as const) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = {auto:'Auto',idle:'Stand',walk:'Walk',lie:'Rest',play:'Play',jump:'Jump'}[action];
    button.setAttribute('aria-pressed', String(action === 'auto'));
    button.onclick = () => { preview.setAction(action); for (const other of actions.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button)); };
    actions.append(button);
  }
  const ribbons = dialog.querySelector<HTMLElement>('.pet-studio-ribbons')!;
  const stage = dialog.querySelector<HTMLElement>('.pet-studio-stage')!;
  const layout = dialog.querySelector<HTMLElement>('.pet-studio-layout')!;
  const nameForm = dialog.querySelector<HTMLFormElement>('#pet-name-form')!;
  const nameInput = dialog.querySelector<HTMLInputElement>('#pet-name')!;
  const previewName = dialog.querySelector<HTMLElement>('.pet-studio-preview-name')!;
  const status = dialog.querySelector<HTMLElement>('#pet-studio-status')!;
  const openShop = dialog.querySelector<HTMLButtonElement>('#pet-open-shop')!;
  let state: ShopState = {items: [], balance: 0}, selectedCat: PetKind = 'pet-ginger', selectedBreed: PetBreedId = 'ginger-tabby', selectedRibbon = '', petName = cleanName(session?.user.user_metadata?.pet_name || ''), busy = false, ready = false, loadError = '';
  type PetKind = 'pet-ginger' | 'pet-cream';
  const companionSkus = ['pet-companion', 'pet-ginger', 'pet-cream'];
  const ownedPet = () => state.items.find(item => companionSkus.includes(item.sku));
  const ribbonItems = () => catalog.filter(item => item.type === 'pet-decoration' && state.items.some(entry => entry.sku === item.id)) as PetItem[];
  const equipped = (sku: string) => !!state.items.find(item => item.sku === sku)?.equipped;
  const currentRibbon = () => ribbonItems().find(item => equipped(item.id))?.id || '';
  const labelFor = (item: PetItem) => item.name;
  function draw() {
    const pet = ownedPet(), ribbonsOwned = ribbonItems();
    const style = petStyle(selectedBreed)!;
    selectedCat = style.base as PetKind; selectedRibbon = currentRibbon();
    const hasPet = !!pet, loading = busy && !ready;
    dialog.setAttribute('aria-busy', String(loading));
    layout.hidden = false; stage.hidden = loading || !hasPet; nameForm.hidden = loading || !hasPet;
    openShop.hidden = false; openShop.disabled = loading || busy;
    breeds.parentElement!.hidden = !loading && !hasPet; coats.parentElement!.hidden = loading || !hasPet;
    ribbons.parentElement!.hidden = !loading && !hasPet;
    nameInput.disabled = busy; nameForm.querySelector('button')!.disabled = busy;
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
    const companion = document.createElement('button'); companion.type = 'button'; companion.textContent = 'Lepak Cat Companion'; companion.setAttribute('aria-pressed', String(!!pet?.equipped)); companion.disabled = busy;
    companion.onclick = () => { if (pet) void toggle(pet.sku, !pet.equipped); }; cats.append(companion);
    breeds.replaceChildren();
    for (const breed of petBreedList) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = breed.name; button.setAttribute('aria-pressed', String(style.breedId === breed.id)); button.disabled = busy;
      button.dataset.breed = breed.id; button.onclick = () => void chooseBreed(`${breed.id}:${style.coatId}`); breeds.append(button);
    }
    description.textContent = style.description; coatName.textContent = petCoats.find(item => item.id === style.coatId)!.name;
    coats.replaceChildren();
    for (const coat of petCoats) {
      const button = document.createElement('button'); button.type = 'button'; button.title = coat.name; button.setAttribute('aria-label', coat.name); button.setAttribute('aria-pressed', String(style.coatId === coat.id)); button.disabled = busy;
      button.dataset.coat = coat.id;
      const swatch = document.createElement('span'); swatch.setAttribute('aria-hidden', 'true'); swatch.style.background = coat.pattern === 'solid' ? coat.fur : `repeating-linear-gradient(125deg,${coat.fur} 0 7px,${coat.stripe} 7px 11px,${coat.belly} 11px 15px)`;
      button.append(swatch); button.onclick = () => void chooseBreed(`${style.breedId}:${coat.id}`); coats.append(button);
    }
    ribbons.replaceChildren();
    const none = document.createElement('button'); none.type = 'button'; none.textContent = 'No ribbon'; none.setAttribute('aria-pressed', String(!selectedRibbon)); none.disabled = busy; none.onclick = () => void clearRibbon(); ribbons.append(none);
    for (const item of ribbonsOwned) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = labelFor(item); button.setAttribute('aria-pressed', String(equipped(item.id))); button.disabled = busy;
      button.onclick = () => void toggle(item.id, !equipped(item.id)); ribbons.append(button);
    }
    preview.setPet(selectedCat, selectedRibbon, selectedBreed); previewName.textContent = petName || 'Lepak Cat'; nameInput.value = petName;
  }
  async function apply(result: Promise<ShopState>, message: string) {
    if (busy) return; busy = true; status.textContent = 'Updating companion…'; draw();
    try { state = await result; status.textContent = message; }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not update pet.'; }
    finally { busy = false; draw(); }
  }
  async function toggle(sku: string, value: boolean) {
    const isCat = companionSkus.includes(sku);
    const isRibbon = sku.startsWith('pet-collar-');
    if (isCat && !value) { await apply(api.equip(sku, false), 'Pet hidden.'); return; }
    if (isCat || isRibbon) await apply(api.equip(sku, value), value ? 'Companion updated.' : 'Ribbon removed.');
  }
  async function chooseBreed(value: PetBreedId) {
    const style = petStyle(value);
    if (!style || busy) return;
    const focused = document.activeElement as HTMLElement | null;
    const focusSelector = focused?.dataset.breed ? `[data-breed="${focused.dataset.breed}"]` : focused?.dataset.coat ? `[data-coat="${focused.dataset.coat}"]` : '';
    busy = true; status.textContent = 'Saving cat style…'; draw();
    try {
      if (auth && session?.user.id) {
        const accountId = session.user.id;
        const {data, error} = await auth.auth.updateUser({data: {pet_breed: value}}); if (error) throw error;
        if (data.user?.id !== accountId || session?.user.id !== accountId) throw Error('Your session changed. Please try again.');
        if (data.user?.user_metadata) Object.assign(session!.user.user_metadata, data.user.user_metadata);
      }
      selectedBreed = value; selectedCat = style.base as PetKind; await options.onBreed?.(value); status.textContent = 'Cat style saved.';
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not save cat style.'; }
    finally { busy = false; draw(); if (focusSelector) dialog.querySelector<HTMLElement>(focusSelector)?.focus({preventScroll:true}); }
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
    open() { options.release?.(); if (!petName) petName = cleanName(session?.user.user_metadata?.pet_name || ''); const saved = petStyle(session?.user.user_metadata?.pet_breed); if (saved) selectedBreed = saved.id; if (!dialog.open) dialog.showModal(); preview.start(); void load(); },
    close() { if (dialog.open) dialog.close(); },
    get opened() { return dialog.open; },
  };
}
