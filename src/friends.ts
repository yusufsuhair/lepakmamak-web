import {accountToken} from './account-token';
import {fillSocialSkeleton} from './social-skeleton';
import './friends.css';

export type Friend = {id: string; name: string; online: boolean; playerId: string | null};
export type FriendRequest = {id: string; name: string; requestedAt?: string; playerId?: string | null};
export type FriendState = {friends: Friend[]; incoming: FriendRequest[]; outgoing: FriendRequest[]};
export type FriendRelation = 'friend' | 'incoming' | 'outgoing' | 'none';
export type FriendEvent = 'request-sent' | 'request-received' | 'accepted' | 'declined' | 'cancelled' | 'removed' | 'notifications-cleared';
export type SearchResult = {userId: string; handle: string; name: string; online: boolean; relation: 'none' | 'pending' | 'friend'};

export function setupFriends(
  endpoint: string,
  onState: (state: FriendState | null) => void,
  release: () => void = () => {},
  messageFriend: (playerId: string, name: string) => void = () => {},
  onEvent: (event: FriendEvent, unread: number) => void = () => {},
  messageAccount: (userId: string, handle: string, name: string) => void = () => {},
  onProfile: (userId: string, name: string) => void = () => {},
) {
  const dialog = document.createElement('dialog');
  dialog.id = 'game-friends'; dialog.setAttribute('aria-labelledby', 'game-friends-title');
  dialog.innerHTML = `<div class="friends-shell">
    <header><div><small>LEPAKMAMAK · SOCIAL</small><h2 id="game-friends-title">Friends</h2><p>Keep your lepak crew close.</p></div><button type="button" aria-label="Close Friends">×</button></header>
    <p id="friends-message" class="friends-message" role="status" aria-live="polite"></p>
    <section id="friends-search-section" aria-labelledby="friends-search-title"><div class="friends-section-head"><div><small>FIND PLAYERS</small><h3 id="friends-search-title">Search by handle</h3></div></div><input id="friends-search" class="friends-search" type="search" placeholder="@handle" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="19" aria-label="Search players by handle"><ul id="friends-results"></ul></section>
    <section aria-labelledby="friends-list-title"><div class="friends-section-head"><div><small>YOUR CREW</small><h3 id="friends-list-title">Friend List</h3></div><span id="friends-count">0</span></div><ul id="friends-list"></ul></section>
    <section aria-labelledby="friends-incoming-title"><div class="friends-section-head"><div><small>WAITING FOR YOU</small><h3 id="friends-incoming-title">Friend requests</h3></div></div><ul id="friends-incoming"></ul></section>
    <section aria-labelledby="friends-outgoing-title"><div class="friends-section-head"><div><small>ON THE WAY</small><h3 id="friends-outgoing-title">Sent requests</h3></div></div><ul id="friends-outgoing"></ul></section>
    <p id="friends-login" class="friends-login" hidden>Log in to add friends and keep your list after reconnecting.</p>
    <div id="friends-remove-confirm" class="friends-confirm" role="alertdialog" aria-modal="true" aria-labelledby="friends-remove-title" hidden>
      <div class="friends-confirm-card"><small>REMOVE FRIEND</small><h3 id="friends-remove-title">Remove <span id="friends-remove-name"></span>?</h3><p>They will leave your Friend List. You can send a new request later.</p><div class="friends-confirm-actions"><button type="button" id="friends-remove-cancel">Keep friend</button><button type="button" id="friends-remove-approve" class="danger">Remove friend</button></div></div>
    </div>
  </div>`;
  document.body.append(dialog);

  const el = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  const message = el('friends-message');
  const confirmation = el('friends-remove-confirm');
  const confirmationName = el('friends-remove-name');
  const confirmationCancel = el<HTMLButtonElement>('friends-remove-cancel');
  const confirmationApprove = el<HTMLButtonElement>('friends-remove-approve');
  let currentState: FriendState | null = null;
  let busy = false;
  let loading = false;
  let pendingRemoval: {id: string; name: string} | null = null;
  const unreadIncoming = new Set<string>();
  const base = endpoint.replace(/^ws/i, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '');
  const loggedIn = () => !!accountToken();

  function empty(text: string) {
    const row = document.createElement('li'); row.className = 'friends-empty'; row.textContent = text; return row;
  }

  const searchSection = el('friends-search-section');
  const searchInput = el<HTMLInputElement>('friends-search');
  const results = el('friends-results');
  let found: SearchResult[] = [];
  let searchTimer = 0, searchSeq = 0;

  function renderResults() {
    results.replaceChildren();
    for (const result of found) {
      const row = document.createElement('li'); row.className = 'friend-row friend-result';
      const copy = document.createElement('span'); copy.className = 'friend-copy';
      const initial = document.createElement('i'); initial.className = 'friend-initial'; initial.setAttribute('aria-hidden', 'true');
      initial.textContent = (result.name || result.handle).slice(0, 1).toUpperCase();
      const names = document.createElement('span');
      const handle = document.createElement('strong'); handle.textContent = `@${result.handle}`;
      const name = document.createElement('small'); name.className = 'friend-name'; name.textContent = result.name;
      names.append(handle, name);
      const status = document.createElement('small'); status.className = result.online ? 'is-online' : 'is-offline'; status.textContent = result.online ? 'Online' : 'Offline';
      copy.append(initial, names, status);
      const actions = document.createElement('span'); actions.className = 'friend-actions';
      const chat = document.createElement('button'); chat.type = 'button'; chat.textContent = 'Message';
      chat.onclick = () => messageAccount(result.userId, result.handle, result.name);
      const add = document.createElement('button'); add.type = 'button'; add.dataset.uiSound = 'none';
      add.textContent = result.relation === 'friend' ? 'Friends' : result.relation === 'pending' ? 'Pending' : 'Add friend';
      if (result.relation === 'none') add.className = 'primary';
      add.disabled = result.relation !== 'none' || busy;
      // The same request flow as everywhere else; the result only mirrors what it did.
      add.onclick = async () => {
        await mutate('request', {id: result.userId}, 'Friend request sent.', 'request-sent');
        const relation = relationship(result.userId);
        if (relation !== 'none') result.relation = relation === 'friend' ? 'friend' : 'pending';
        renderResults();
      };
      actions.append(chat, add); row.append(copy, actions); results.append(row);
    }
  }

  async function search() {
    const query = searchInput.value.trim().replace(/^@/, '').toLowerCase();
    const mine = ++searchSeq;
    if (!query || !base || !loggedIn()) { found = []; renderResults(); return; }
    try {
      const response = await fetch(`${base}/players/search?q=${encodeURIComponent(query)}`, {headers: {Authorization: `Bearer ${accountToken()}`}});
      const data = await response.json().catch(() => ({}));
      if (mine !== searchSeq) return;
      if (!response.ok) throw Error(data.error || 'Search is not available right now.');
      found = Array.isArray(data.results) ? data.results : [];
      renderResults();
      if (!found.length) results.append(empty('No players with that handle.'));
    } catch (error) {
      if (mine !== searchSeq) return;
      found = []; renderResults();
      results.append(empty(error instanceof Error ? error.message : 'Search failed.'));
    }
  }
  searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = window.setTimeout(() => void search(), 250); });

  function render() {
    const state = currentState;
    searchSection.hidden = !loggedIn();
    const list = el('friends-list'); list.replaceChildren();
    const incoming = el('friends-incoming'); incoming.replaceChildren();
    const outgoing = el('friends-outgoing'); outgoing.replaceChildren();
    el('friends-login').hidden = loggedIn();
    el('friends-count').textContent = String(state?.friends.length || 0);
    dialog.setAttribute('aria-busy', String(loading || busy));
    if (loading) {
      fillSocialSkeleton(list, 3);
      fillSocialSkeleton(incoming, 2);
      fillSocialSkeleton(outgoing, 2);
      return;
    }
    if (!state) {
      list.append(empty(loggedIn() ? 'Connect to load your Friend List.' : 'Log in to see your friends.'));
      incoming.append(empty('No requests waiting.'));
      outgoing.append(empty('No sent requests.'));
      return;
    }
    for (const friend of state.friends) {
      const row = document.createElement('li'); row.className = 'friend-row';
      const copy = document.createElement('span'); copy.className = 'friend-copy';
      const name = document.createElement('button'); name.type = 'button'; name.className = 'friend-profile-link'; name.textContent = friend.name;
      name.setAttribute('aria-label', `View profile of ${friend.name}`); name.disabled = busy;
      name.onclick = () => { if (!busy) { if (dialog.open) dialog.close(); onProfile(friend.id, friend.name); } };
      const status = document.createElement('small'); status.className = friend.online ? 'is-online' : 'is-offline'; status.textContent = friend.online ? 'Online' : 'Offline';
      copy.append(name, status);
      const actions = document.createElement('span'); actions.className = 'friend-actions';
      const chat = document.createElement('button'); chat.type = 'button'; chat.textContent = 'Message'; chat.disabled = !friend.online || !friend.playerId || busy;
      chat.title = friend.online ? 'Open private chat' : 'Your friend is offline';
      chat.onclick = () => { if (friend.playerId) messageFriend(friend.playerId, friend.name); };
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = 'Remove'; remove.disabled = busy;
      remove.dataset.uiSound = 'none';
      remove.onclick = () => askRemove(friend.id, friend.name);
      actions.append(chat, remove); row.append(copy, actions); list.append(row);
    }
    if (!state.friends.length) list.append(empty('No friends yet. Add someone from the city.'));
    for (const request of state.incoming) {
      const row = document.createElement('li'); row.className = 'friend-row';
      const name = document.createElement('strong'); name.textContent = request.name;
      const actions = document.createElement('span'); actions.className = 'friend-actions';
      const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'primary'; accept.textContent = 'Accept'; accept.disabled = busy; accept.dataset.uiSound = 'none'; accept.onclick = () => void mutate('respond', {id: request.id, approved: true}, 'Friend added.', 'accepted');
      const decline = document.createElement('button'); decline.type = 'button'; decline.textContent = 'Decline'; decline.disabled = busy; decline.dataset.uiSound = 'none'; decline.onclick = () => void mutate('respond', {id: request.id, approved: false}, 'Request declined.', 'declined');
      actions.append(accept, decline); row.append(name, actions); incoming.append(row);
    }
    if (!state.incoming.length) incoming.append(empty('No incoming requests.'));
    for (const request of state.outgoing) {
      const row = document.createElement('li'); row.className = 'friend-row';
      const name = document.createElement('strong'); name.textContent = request.name;
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.disabled = busy;
      cancel.dataset.uiSound = 'none';
      cancel.onclick = () => void mutate('cancel', {id: request.id}, 'Request cancelled.', 'cancelled');
      row.append(name, cancel); outgoing.append(row);
    }
    if (!state.outgoing.length) outgoing.append(empty('No sent requests.'));
  }

  function askRemove(id: string, name: string) {
    if (busy) return;
    pendingRemoval = {id, name}; confirmationName.textContent = name;
    confirmation.hidden = false; confirmationCancel.focus();
  }

  function closeConfirmation() {
    pendingRemoval = null; confirmation.hidden = true; confirmationApprove.disabled = false;
  }

  async function request(path: string, body?: unknown) {
    if (!base || !loggedIn()) throw Error('Log in to use Friends.');
    const response = await fetch(`${base}/friends/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${accountToken()}`},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.state) applyState(data.state, false);
      throw Error(data.error || 'Please try again.');
    }
    return data;
  }

  function applyState(next: FriendState | null, announce = true) {
    const previous = currentState;
    const unreadBefore = unreadIncoming.size;
    const events: FriendEvent[] = [];
    const nextIncoming = new Set((next?.incoming || []).map(request => request.id));
    const nextFriends = new Set((next?.friends || []).map(friend => friend.id));
    const previousIncoming = new Set((previous?.incoming || []).map(request => request.id));
    const previousFriends = new Set((previous?.friends || []).map(friend => friend.id));
    const previousOutgoing = new Set((previous?.outgoing || []).map(request => request.id));
    const nextOutgoing = new Set((next?.outgoing || []).map(request => request.id));

    if (!next) unreadIncoming.clear();
    if (announce && next) {
      if (!previous) {
        // A background refresh can discover an old request before the player opens Friends.
        // It gets a badge, but opening the panel itself uses announce=false and clears it.
        if (!dialog.open) for (const id of nextIncoming) unreadIncoming.add(id);
        if (!dialog.open && nextIncoming.size) events.push('request-received');
      } else {
        let received = false;
        for (const id of nextIncoming) if (!previousIncoming.has(id)) { unreadIncoming.add(id); received = true; }
        if (received) events.push('request-received');
        if ([...previousIncoming].some(id => nextFriends.has(id)) || [...previousOutgoing].some(id => nextFriends.has(id))) events.push('accepted');
        if ([...previousIncoming].some(id => !nextIncoming.has(id) && !nextFriends.has(id)) || [...previousOutgoing].some(id => !nextOutgoing.has(id) && !nextFriends.has(id))) events.push('declined');
        if ([...previousFriends].some(id => !nextFriends.has(id))) events.push('removed');
      }
      for (const id of [...unreadIncoming]) if (!nextIncoming.has(id)) unreadIncoming.delete(id);
    }
    currentState = next; onState(next); render();
    if (unreadBefore !== unreadIncoming.size && !events.length) events.push('notifications-cleared');
    for (const event of [...new Set(events)]) onEvent(event, unreadIncoming.size);
  }

  async function refresh(announce = true) {
    if (busy) return;
    if (!loggedIn()) { applyState(null, false); message.textContent = 'Log in to add friends and keep your list.'; return; }
    if (!base) { applyState(null, false); message.textContent = 'Friends are not available in this build yet.'; return; }
    busy = true; loading = true; message.textContent = ''; render();
    try { const data = await request('state'); applyState(data.state, announce); message.textContent = ''; }
    catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not load Friends.'; }
    finally { loading = false; busy = false; render(); }
  }

  async function mutate(path: string, body: unknown, success: string, event: FriendEvent) {
    if (busy) return;
    busy = true; message.textContent = ''; render();
    try {
      const data = await request(path, body); applyState(data.state, false); message.textContent = success;
      const id = typeof body === 'object' && body && 'id' in body && typeof body.id === 'string' ? body.id : '';
      if (path === 'respond' && id) unreadIncoming.delete(id);
      onEvent(event, unreadIncoming.size);
    }
    catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not update Friends.'; }
    finally { busy = false; render(); }
  }

  async function add(playerId: string, _name = '') { await mutate('request', {playerId}, 'Friend request sent.', 'request-sent'); }
  async function addAccount(id: string, _name = '') { await mutate('request', {id}, 'Friend request sent.', 'request-sent'); }
  async function respond(id: string, approved: boolean) { await mutate('respond', {id, approved}, approved ? 'Friend added.' : 'Request declined.', approved ? 'accepted' : 'declined'); }
  async function cancel(id: string) { await mutate('cancel', {id}, 'Request cancelled.', 'cancelled'); }
  async function remove(id: string) { await mutate('remove', {id}, 'Friend removed.', 'removed'); }
  function relationship(playerId: string): FriendRelation {
    if (!currentState) return 'none';
    if (currentState.friends.some(friend => friend.id === playerId || friend.playerId === playerId)) return 'friend';
    if (currentState.incoming.some(request => request.id === playerId || request.playerId === playerId)) return 'incoming';
    if (currentState.outgoing.some(request => request.id === playerId || request.playerId === playerId)) return 'outgoing';
    return 'none';
  }
  function relationshipId(playerId: string) {
    const friend = currentState?.friends.find(item => item.id === playerId || item.playerId === playerId);
    if (friend) return friend.id;
    const incoming = currentState?.incoming.find(item => item.id === playerId || item.playerId === playerId);
    if (incoming) return incoming.id;
    const outgoing = currentState?.outgoing.find(item => item.id === playerId || item.playerId === playerId);
    return outgoing?.id || null;
  }

  confirmationCancel.dataset.uiSound = 'none'; confirmationApprove.dataset.uiSound = 'none';
  confirmationCancel.onclick = closeConfirmation;
  confirmationApprove.onclick = () => {
    const removal = pendingRemoval;
    if (!removal || busy) return;
    confirmationApprove.disabled = true; closeConfirmation();
    void mutate('remove', {id: removal.id}, 'Friend removed.', 'removed');
  };
  confirmation.onclick = event => { if (event.target === confirmation) closeConfirmation(); };
  dialog.querySelector('header button')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('cancel', event => { if (pendingRemoval) { event.preventDefault(); closeConfirmation(); } });
  dialog.addEventListener('close', () => { closeConfirmation(); release(); });
  render();

  return {
    open() {
      if (unreadIncoming.size) { unreadIncoming.clear(); onEvent('notifications-cleared', 0); }
      release(); if (!dialog.open) dialog.showModal(); void refresh(false);
      if (searchInput.value) void search();
    },
    close() { if (dialog.open) dialog.close(); },
    refresh,
    add,
    addAccount,
    respond,
    cancel,
    remove,
    relationship,
    relationshipId,
    state: applyState,
    get opened() { return dialog.open; },
  };
}
