import {guestName, session} from './auth';
import './geng.css';

export type GengMember = {id: string; name: string; leader: boolean};
export type GengPending = {id: string; name: string; requestedAt?: string};
export type GengListing = {id: string; name: string; leaderName?: string; memberCount: number; members?: GengMember[]; current: boolean; requested: boolean};
export type GengState = {
  balance: number;
  current: {id: string; name: string; leaderName?: string; leader: boolean; memberCount: number} | null;
  members: GengMember[];
  pending: GengPending[];
  guilds: GengListing[];
};
export type GengEvent = 'request-sent' | 'request-received' | 'accepted' | 'declined' | 'notifications-cleared';
export type LiveGengMember = {id: string; name: string; connected?: boolean; reconnecting?: boolean; reconnectUntil?: number; leader?: boolean};
export type LiveGengState = {id: string; leader: string; members: LiveGengMember[]};

export function setupGeng(endpoint: string, onState: (state: GengState | null) => void, release: () => void = () => {}, onLiveAction: (action: 'leave') => void = () => {}, onTopup: () => void = () => {}, onProfile: (id: string, name: string) => void = () => {}, onEvent: (event: GengEvent, unread: number) => void = () => {}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'game-geng'; dialog.setAttribute('aria-labelledby', 'game-geng-title');
  dialog.innerHTML = `<header><div><small>LEPAKMAMAK · SOCIAL</small><h2 id="game-geng-title">Geng</h2><p>Build your squad, one request at a time.</p></div><button type="button" aria-label="Close Geng">×</button></header>
    <div class="geng-balance"><span>YOUR SYILING</span><strong id="geng-balance">—</strong></div>
    <p id="geng-message" class="geng-message" role="status" aria-live="polite"></p>
    <section id="geng-live" class="geng-live" hidden aria-labelledby="geng-live-title"><div class="geng-section-head"><div><small>LIVE SOCIAL GROUP</small><h3 id="geng-live-title">Your Geng</h3></div><span id="geng-live-leader-badge" hidden>LEADER</span></div><p id="geng-live-meta"></p><ul id="geng-live-members"></ul><p class="geng-live-help">Only the Geng leader can invite members. Geng is optional for table games.</p><button type="button" id="geng-live-leave">Leave Geng</button></section>
    <section id="geng-current" hidden aria-labelledby="geng-current-title"><div class="geng-section-head"><div><small>YOUR GENG</small><h3 id="geng-current-title"></h3></div><span id="geng-leader-badge" hidden>LEADER</span></div><p id="geng-current-meta"></p><ul id="geng-members"></ul><div id="geng-pending-wrap" hidden><h4>Join requests</h4><ul id="geng-pending"></ul></div><div class="geng-actions"><button type="button" id="geng-leave">Leave Geng</button><button type="button" id="geng-disband" class="danger" hidden>Disband Geng</button></div></section>
    <section id="geng-create" hidden aria-labelledby="geng-create-title"><small>START A NEW SQUAD</small><h3 id="geng-create-title">Create a Geng</h3><p>It costs 1,000 Syiling. You become the leader and approve every member.</p><div id="geng-topup-prompt" class="geng-topup-prompt" hidden><div><small>SYILING TAK CUKUP</small><strong>Tambah Syiling untuk teruskan</strong><p id="geng-topup-copy"></p></div><button type="button" id="geng-topup" class="primary">Tambah Syiling</button></div><form id="geng-create-form"><label for="geng-create-name">Geng name<input id="geng-create-name" minlength="2" maxlength="24" autocomplete="off" required placeholder="e.g. Budak Mamak"></label><button type="submit" class="primary" id="geng-create-submit">Create Geng · 1,000 Syiling</button></form></section>
    <section aria-labelledby="geng-discover-title"><div class="geng-section-head"><div><small>FIND A SQUAD</small><h3 id="geng-discover-title">Open Gengs</h3></div><button type="button" id="geng-refresh" aria-label="Refresh Geng list">↻</button></div><ul id="geng-list"></ul></section>`;
  document.body.append(dialog);
  const roster = document.createElement('dialog');
  roster.id = 'geng-roster'; roster.setAttribute('aria-labelledby', 'geng-roster-title');
  roster.innerHTML = `<div class="geng-roster-shell"><header><div><small>GENG ROSTER</small><h2 id="geng-roster-title"></h2><p id="geng-roster-leader"></p></div><button type="button" id="geng-roster-close" aria-label="Close Geng roster">×</button></header><ul id="geng-roster-members"></ul></div>`;
  document.body.append(roster);

  const el = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  const balance = el('geng-balance'), message = el('geng-message');
  const currentSection = el('geng-current'), createSection = el('geng-create'), list = el('geng-list');
  const rosterTitle = roster.querySelector<HTMLElement>('#geng-roster-title')!;
  const rosterLeader = roster.querySelector<HTMLElement>('#geng-roster-leader')!;
  const rosterMembers = roster.querySelector<HTMLElement>('#geng-roster-members')!;
  const rosterClose = roster.querySelector<HTMLButtonElement>('#geng-roster-close')!;
  let currentState: GengState | null = null, liveState: LiveGengState | null = null, busy = false;
  const unreadPending = new Set<string>();
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

  function applyState(next: GengState | null, announce = true) {
    const previous = currentState;
    const events: GengEvent[] = [];
    const nextPending = new Set((next?.pending || []).map(request => request.id));
    const previousPending = new Set((previous?.pending || []).map(request => request.id));
    const nextMembers = new Set((next?.members || []).map(member => member.id));
    const previousRequested = new Set((previous?.guilds || []).filter(geng => geng.requested).map(geng => geng.id));
    const nextRequested = new Set((next?.guilds || []).filter(geng => geng.requested).map(geng => geng.id));
    const unreadBefore = unreadPending.size;
    if (!next) unreadPending.clear();
    if (announce && next) {
      let received = false;
      for (const id of nextPending) if (!previousPending.has(id)) {
        if (!dialog.open) unreadPending.add(id);
        received = true;
      }
      if (received) events.push('request-received');
      if (previous) {
        if ([...previousPending].some(id => nextMembers.has(id))) events.push('accepted');
        if ([...previousPending].some(id => !nextPending.has(id) && !nextMembers.has(id))) events.push('declined');
        if ([...previousRequested].some(id => next.current?.id === id)) events.push('accepted');
        if ([...previousRequested].some(id => !nextRequested.has(id) && next.current?.id !== id)) events.push('declined');
      }
      for (const id of [...unreadPending]) if (!nextPending.has(id)) unreadPending.delete(id);
    }
    currentState = next; onState(next); render();
    if (unreadBefore !== unreadPending.size && !events.length) events.push('notifications-cleared');
    const pendingCount = currentState?.pending.length || 0;
    for (const event of [...new Set(events)]) onEvent(event, pendingCount);
  }

  function viewMemberProfile(id: string, name: string) {
    if (roster.open) roster.close();
    onProfile(id, name);
  }

  function memberRow(member: GengMember) {
    const row = document.createElement('li');
    const button = document.createElement('button'); button.type = 'button'; button.className = 'geng-member-profile'; button.setAttribute('aria-label', `View profile of ${member.name}`);
    const avatar = document.createElement('span'); avatar.className = 'geng-member-avatar'; avatar.textContent = member.name.slice(0, 1).toUpperCase();
    const copy = document.createElement('span'); copy.className = 'geng-member-copy';
    const name = document.createElement('strong'); name.textContent = member.name;
    const role = document.createElement('small'); role.textContent = member.leader ? 'TEAM LEADER · VIEW PROFILE' : 'VIEW PROFILE';
    copy.append(name, role); button.append(avatar, copy);
    if (member.leader) { const badge = document.createElement('span'); badge.className = 'geng-member-leader'; badge.textContent = 'LEADER'; button.append(badge); }
    button.onclick = () => viewMemberProfile(member.id, member.name);
    row.append(button); return row;
  }

  function renderMemberList(container: HTMLElement, rosterMembers: GengMember[], emptyText: string) {
    container.replaceChildren();
    if (!rosterMembers.length) { const empty = document.createElement('li'); empty.className = 'geng-empty'; empty.textContent = emptyText; container.append(empty); return; }
    for (const member of rosterMembers) container.append(memberRow(member));
  }

  function renderMembers(state: GengState) {
    renderMemberList(el('geng-members'), state.members, 'No members yet.');
    const pendingWrap = el('geng-pending-wrap'), pending = el('geng-pending'); pending.replaceChildren();
    pendingWrap.hidden = !state.current?.leader || !state.pending.length;
    for (const applicant of state.pending) {
      const row = memberRow({id: applicant.id, name: applicant.name, leader: false});
      row.classList.add('geng-request');
      const actions = document.createElement('span'); actions.className = 'geng-request-actions';
      for (const [approved, label] of [[true, 'Approve'], [false, 'Decline']] as const) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.userId = applicant.id; button.dataset.approved = String(approved); button.disabled = busy;
        button.onclick = () => void decide(applicant.id, approved);
        actions.append(button);
      }
      row.append(actions); pending.append(row);
    }
  }

  function openRoster(geng: GengListing) {
    const members = geng.members || [];
    rosterTitle.textContent = geng.name;
    const leader = geng.leaderName || members.find(member => member.leader)?.name || 'Geng leader';
    rosterLeader.textContent = `Team leader · ${leader} · ${members.length} member${members.length === 1 ? '' : 's'}`;
    renderMemberList(rosterMembers, members, 'No members are listed yet.');
    if (!roster.open) roster.showModal();
    rosterClose.focus();
  }

  function renderLive() {
    const section = el('geng-live'); section.hidden = !liveState;
    if (!liveState) return;
    const onlineCount = liveState.members.filter(member => member.connected !== false && !member.reconnecting).length;
    const leader = liveState.members.find(member => member.leader)?.name || 'Geng leader';
    el('geng-live-title').textContent = `${leader}'s Geng`;
    el('geng-live-meta').textContent = `${onlineCount}/${liveState.members.length} online · ${leader} leads this Geng`;
    el('geng-live-leader-badge').hidden = !liveState.members.some(member => member.leader && member.connected !== false);
    const members = el('geng-live-members'); members.replaceChildren();
    for (const member of liveState.members) {
      const row = document.createElement('li'); row.className = member.reconnecting ? 'geng-live-reconnecting' : '';
      const name = document.createElement('strong'); name.textContent = member.name; row.append(name);
      const status = document.createElement('span');
      status.textContent = member.reconnecting ? 'RECONNECTING · 30s grace' : member.connected === false ? 'OFFLINE' : member.leader ? 'LEADER · ONLINE' : 'ONLINE';
      row.append(status); members.append(row);
    }
  }

  function render() {
    const state = currentState;
    renderLive();
    balance.textContent = state ? `${Number(state.balance || 0).toLocaleString('en-MY')} Syiling` : '—';
    const hasCurrent = !!state?.current;
    currentSection.hidden = !hasCurrent;
    createSection.hidden = hasCurrent || !state;
    const insufficient = !!state && !hasCurrent && Number(state.balance || 0) < 1000;
    const topupPrompt = el('geng-topup-prompt');
    topupPrompt.hidden = !insufficient;
    if (insufficient) el('geng-topup-copy').textContent = `You have ${Number(state.balance || 0).toLocaleString('en-MY')} Syiling. You need 1,000 Syiling to create a Geng.`;
    el<HTMLButtonElement>('geng-topup').disabled = busy;
    el<HTMLButtonElement>('geng-create-submit').disabled = busy || !state || state.balance < 1000;
    if (state?.current) {
      el('geng-current-title').textContent = state.current.name;
      const leader = state.current.leaderName || state.members.find(member => member.leader)?.name || 'Geng leader';
      el('geng-current-meta').textContent = `Team leader · ${leader} · ${state.current.memberCount} member${state.current.memberCount === 1 ? '' : 's'} · ${state.current.leader ? 'You approve new members.' : 'Requests go to the leader.'}`;
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
      const info = document.createElement('button'); info.type = 'button'; info.className = 'geng-listing-info'; info.setAttribute('aria-label', `View ${guild.name} roster`);
      const copy = document.createElement('span'), name = document.createElement('strong'), meta = document.createElement('small');
      const leader = guild.leaderName || guild.members?.find(member => member.leader)?.name || 'Geng leader';
      name.textContent = guild.name; meta.textContent = `${guild.memberCount} member${guild.memberCount === 1 ? '' : 's'} · Leader: ${leader}`; copy.append(name, meta); info.append(copy);
      info.onclick = () => openRoster(guild);
      const button = document.createElement('button'); button.type = 'button'; button.disabled = busy || guild.current || guild.requested;
      button.textContent = guild.current ? 'Your Geng' : guild.requested ? 'Requested' : 'Request to join';
      button.onclick = () => void join(guild.id);
      row.append(info, button); list.append(row);
    }
    if (!state.guilds.length) { const empty = document.createElement('li'); empty.className = 'geng-empty'; empty.textContent = 'No Gengs yet. Create the first one.'; list.append(empty); }
  }

  async function refresh(announce = true) {
    if (busy) return;
    if (!loggedIn()) { applyState(null); message.textContent = 'Log in to create or join a Geng.'; return; }
    busy = true; render(); message.textContent = 'Loading Gengs…';
    try { const data = await request('state'); applyState(data.state, announce); message.textContent = ''; }
    catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not load Gengs.'; }
    finally { busy = false; render(); }
  }

  async function mutate(path: string, body: unknown | undefined, success = '', event?: GengEvent) {
    if (busy) return;
    busy = true; render(); message.textContent = 'Updating Geng…';
    try {
      const data = await request(path, body, 'POST'); applyState(data.state, false); message.textContent = success;
      const id = typeof body === 'object' && body && 'userId' in body && typeof body.userId === 'string' ? body.userId : '';
      if (path === 'approve' && id) unreadPending.delete(id);
      if (event) onEvent(event, currentState?.pending.length || 0);
    }
    catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not update Geng.'; }
    finally { busy = false; render(); }
  }
  async function join(id: string) { await mutate('request', {gengId: id}, 'Request sent to the Geng leader.', 'request-sent'); }
  async function decide(userId: string, approved: boolean) { await mutate('approve', {userId, approved}, approved ? 'Member approved.' : 'Request declined.', approved ? 'accepted' : 'declined'); }

  el<HTMLFormElement>('geng-create-form').onsubmit = event => {
    event.preventDefault(); const input = el<HTMLInputElement>('geng-create-name');
    if (input.value.trim().length < 2) { input.setCustomValidity('Use at least 2 characters.'); input.reportValidity(); return; }
    input.setCustomValidity(''); void mutate('create', {name: input.value.trim()}, 'Geng created.');
  };
  el('geng-leave').onclick = () => void mutate('leave', undefined, 'You left the Geng.');
  el('geng-disband').onclick = () => void mutate('disband', undefined, 'Geng disbanded.');
  el('geng-refresh').onclick = () => void refresh();
  el('geng-live-leave').onclick = () => onLiveAction('leave');
  el('geng-topup').onclick = () => onTopup();
  rosterClose.onclick = () => roster.close();
  roster.addEventListener('keydown', event => event.stopPropagation());
  roster.addEventListener('cancel', event => { event.preventDefault(); roster.close(); });
  dialog.querySelector('header button')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => { if (roster.open) roster.close(); release(); });
  render();

  return {
    open() {
      if (unreadPending.size) unreadPending.clear();
      release(); if (!dialog.open) dialog.showModal(); void refresh(false);
    },
    close() { if (dialog.open) dialog.close(); },
    refresh,
    state: applyState,
    live(value: LiveGengState | null) { liveState = value; renderLive(); },
    get opened() { return dialog.open; },
  };
}
