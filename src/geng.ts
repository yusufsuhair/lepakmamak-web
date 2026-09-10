import {guestName, session} from './auth';
import './geng.css';

export type GengMember = {id: string; name: string; leader: boolean};
export type GengPending = {id: string; name: string; requestedAt?: string};
export type GengListing = {id: string; name: string; memberCount: number; current: boolean; requested: boolean};
export type GengState = {
  balance: number;
  current: {id: string; name: string; leader: boolean; memberCount: number} | null;
  members: GengMember[];
  pending: GengPending[];
  guilds: GengListing[];
};

export function setupGeng(endpoint: string, onState: (state: GengState | null) => void, release: () => void = () => {}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'game-geng'; dialog.setAttribute('aria-labelledby', 'game-geng-title');
  dialog.innerHTML = `<header><div><small>LEPAKMAMAK · SOCIAL</small><h2 id="game-geng-title">Geng</h2><p>Build your squad, one request at a time.</p></div><button type="button" aria-label="Close Geng">×</button></header>
    <div class="geng-balance"><span>YOUR SYILING</span><strong id="geng-balance">—</strong></div>
    <p id="geng-message" class="geng-message" role="status" aria-live="polite"></p>
    <section id="geng-current" hidden aria-labelledby="geng-current-title"><div class="geng-section-head"><div><small>YOUR GENG</small><h3 id="geng-current-title"></h3></div><span id="geng-leader-badge" hidden>LEADER</span></div><p id="geng-current-meta"></p><ul id="geng-members"></ul><div id="geng-pending-wrap" hidden><h4>Join requests</h4><ul id="geng-pending"></ul></div><div class="geng-actions"><button type="button" id="geng-leave">Leave Geng</button><button type="button" id="geng-disband" class="danger" hidden>Disband Geng</button></div></section>
    <section id="geng-create" hidden aria-labelledby="geng-create-title"><small>START A NEW SQUAD</small><h3 id="geng-create-title">Create a Geng</h3><p>It costs 1,000 Syiling. You become the leader and approve every member.</p><form id="geng-create-form"><label for="geng-create-name">Geng name<input id="geng-create-name" minlength="2" maxlength="24" autocomplete="off" required placeholder="e.g. Budak Mamak"></label><button type="submit" class="primary" id="geng-create-submit">Create Geng · 1,000 Syiling</button></form></section>
    <section aria-labelledby="geng-discover-title"><div class="geng-section-head"><div><small>FIND A SQUAD</small><h3 id="geng-discover-title">Open Gengs</h3></div><button type="button" id="geng-refresh" aria-label="Refresh Geng list">↻</button></div><ul id="geng-list"></ul></section>`;
  document.body.append(dialog);

  const el = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  const balance = el('geng-balance'), message = el('geng-message');
  const currentSection = el('geng-current'), createSection = el('geng-create'), list = el('geng-list');
  let currentState: GengState | null = null, busy = false;
  const base = endpoint.replace(/^ws/, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '');
  const loggedIn = () => !!session && !guestName;

  async function request(path: string, body?: unknown, method?: 'GET' | 'POST') {
    if (!base || !loggedIn()) throw Error('Log in to use Geng.');
    const response = await fetch(`${base}/geng/${path}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}`},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.state) applyState(data.state);
      throw Error(data.error || 'Please try again.');
    }
    return data;
  }

  function applyState(next: GengState | null) {
    currentState = next; onState(next); render();
  }

  function renderMembers(state: GengState) {
    const members = el('geng-members'); members.replaceChildren();
    for (const member of state.members) {
      const row = document.createElement('li');
      const name = document.createElement('strong'); name.textContent = member.name;
      row.append(name);
      if (member.leader) { const badge = document.createElement('span'); badge.className = 'geng-member-leader'; badge.textContent = 'LEADER'; row.append(badge); }
      members.append(row);
    }
    const pendingWrap = el('geng-pending-wrap'), pending = el('geng-pending'); pending.replaceChildren();
    pendingWrap.hidden = !state.current?.leader || !state.pending.length;
    for (const applicant of state.pending) {
      const row = document.createElement('li');
      const name = document.createElement('strong'); name.textContent = applicant.name;
      const actions = document.createElement('span'); actions.className = 'geng-request-actions';
      for (const [approved, label] of [[true, 'Approve'], [false, 'Decline']] as const) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.userId = applicant.id; button.dataset.approved = String(approved); button.disabled = busy;
        button.onclick = () => void decide(applicant.id, approved);
        actions.append(button);
      }
      row.append(name, actions); pending.append(row);
    }
  }

  function render() {
    const state = currentState;
    balance.textContent = state ? `${Number(state.balance || 0).toLocaleString('en-MY')} Syiling` : '—';
    const hasCurrent = !!state?.current;
    currentSection.hidden = !hasCurrent;
    createSection.hidden = hasCurrent || !state;
    el<HTMLButtonElement>('geng-create-submit').disabled = busy || !state || state.balance < 1000;
    if (state?.current) {
      el('geng-current-title').textContent = state.current.name;
      el('geng-current-meta').textContent = `${state.current.memberCount} member${state.current.memberCount === 1 ? '' : 's'} · ${state.current.leader ? 'You approve new members.' : 'Requests go to the leader.'}`;
      el('geng-leader-badge').hidden = !state.current.leader;
      el('geng-leave').hidden = state.current.leader && state.current.memberCount > 1;
      el('geng-disband').hidden = !state.current.leader;
      el<HTMLButtonElement>('geng-leave').disabled = busy;
      el<HTMLButtonElement>('geng-disband').disabled = busy;
      renderMembers(state);
    }
    list.replaceChildren();
    if (!state) {
      const empty = document.createElement('li'); empty.className = 'geng-empty'; empty.textContent = loggedIn() ? 'Connect to see open Gengs.' : 'Log in to create or join a Geng.'; list.append(empty); return;
    }
    for (const guild of state.guilds) {
      const row = document.createElement('li'); row.className = 'geng-listing';
      const copy = document.createElement('span'), name = document.createElement('strong'), meta = document.createElement('small');
      name.textContent = guild.name; meta.textContent = `${guild.memberCount} member${guild.memberCount === 1 ? '' : 's'}`; copy.append(name, meta);
      const button = document.createElement('button'); button.type = 'button'; button.disabled = busy || guild.current || guild.requested;
      button.textContent = guild.current ? 'Your Geng' : guild.requested ? 'Requested' : 'Request to join';
      button.onclick = () => void join(guild.id);
      row.append(copy, button); list.append(row);
    }
    if (!state.guilds.length) { const empty = document.createElement('li'); empty.className = 'geng-empty'; empty.textContent = 'No Gengs yet. Create the first one.'; list.append(empty); }
  }

  async function refresh() {
    if (busy) return;
    if (!loggedIn()) { applyState(null); message.textContent = 'Log in to create or join a Geng.'; return; }
    busy = true; render(); message.textContent = 'Loading Gengs…';
    try { const data = await request('state'); applyState(data.state); message.textContent = ''; }
    catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not load Gengs.'; }
    finally { busy = false; render(); }
  }

  async function mutate(path: string, body?: unknown, success = '') {
    if (busy) return;
    busy = true; render(); message.textContent = 'Updating Geng…';
    try { const data = await request(path, body, 'POST'); applyState(data.state); message.textContent = success; }
    catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not update Geng.'; }
    finally { busy = false; render(); }
  }
  async function join(id: string) { await mutate('request', {gengId: id}, 'Request sent to the Geng leader.'); }
  async function decide(userId: string, approved: boolean) { await mutate('approve', {userId, approved}, approved ? 'Member approved.' : 'Request declined.'); }

  el<HTMLFormElement>('geng-create-form').onsubmit = event => {
    event.preventDefault(); const input = el<HTMLInputElement>('geng-create-name');
    if (input.value.trim().length < 2) { input.setCustomValidity('Use at least 2 characters.'); input.reportValidity(); return; }
    input.setCustomValidity(''); void mutate('create', {name: input.value.trim()}, 'Geng created.');
  };
  el('geng-leave').onclick = () => void mutate('leave', undefined, 'You left the Geng.');
  el('geng-disband').onclick = () => void mutate('disband', undefined, 'Geng disbanded.');
  el('geng-refresh').onclick = () => void refresh();
  dialog.querySelector('header button')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => release());
  render();

  return {
    open() { release(); if (!dialog.open) dialog.showModal(); void refresh(); },
    close() { dialog.close(); },
    state: applyState,
    get opened() { return dialog.open; },
  };
}
