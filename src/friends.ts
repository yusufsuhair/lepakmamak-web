import {guestName, session} from './auth';
import './friends.css';

export type Friend = {id: string; name: string; online: boolean; playerId: string | null};
export type FriendRequest = {id: string; name: string; requestedAt?: string; playerId?: string | null};
export type FriendState = {friends: Friend[]; incoming: FriendRequest[]; outgoing: FriendRequest[]};
export type FriendRelation = 'friend' | 'incoming' | 'outgoing' | 'none';

export function setupFriends(
  endpoint: string,
  onState: (state: FriendState | null) => void,
  release: () => void = () => {},
  messageFriend: (playerId: string, name: string) => void = () => {},
) {
  const dialog = document.createElement('dialog');
  dialog.id = 'game-friends'; dialog.setAttribute('aria-labelledby', 'game-friends-title');
  dialog.innerHTML = `<div class="friends-shell">
    <header><div><small>LEPAKMAMAK · SOCIAL</small><h2 id="game-friends-title">Friends</h2><p>Keep your lepak crew close.</p></div><button type="button" aria-label="Close Friends">×</button></header>
    <p id="friends-message" class="friends-message" role="status" aria-live="polite"></p>
    <section aria-labelledby="friends-list-title"><div class="friends-section-head"><div><small>YOUR CREW</small><h3 id="friends-list-title">Friend List</h3></div><span id="friends-count">0</span></div><ul id="friends-list"></ul></section>
    <section aria-labelledby="friends-incoming-title"><div class="friends-section-head"><div><small>WAITING FOR YOU</small><h3 id="friends-incoming-title">Friend requests</h3></div></div><ul id="friends-incoming"></ul></section>
    <section aria-labelledby="friends-outgoing-title"><div class="friends-section-head"><div><small>ON THE WAY</small><h3 id="friends-outgoing-title">Sent requests</h3></div></div><ul id="friends-outgoing"></ul></section>
    <p id="friends-login" class="friends-login" hidden>Log in to add friends and keep your list after reconnecting.</p>
  </div>`;
  document.body.append(dialog);

  const el = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  const message = el('friends-message');
  let currentState: FriendState | null = null;
  let busy = false;
  const base = endpoint.replace(/^ws/i, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '');
  const loggedIn = () => !!session && !guestName;

  function empty(text: string) {
    const row = document.createElement('li'); row.className = 'friends-empty'; row.textContent = text; return row;
  }

  function render() {
    const state = currentState;
    const list = el('friends-list'); list.replaceChildren();
    const incoming = el('friends-incoming'); incoming.replaceChildren();
    const outgoing = el('friends-outgoing'); outgoing.replaceChildren();
    el('friends-login').hidden = loggedIn();
    el('friends-count').textContent = String(state?.friends.length || 0);
    if (!state) {
      list.append(empty(loggedIn() ? 'Connect to load your Friend List.' : 'Log in to see your friends.'));
      incoming.append(empty('No requests waiting.'));
      outgoing.append(empty('No sent requests.'));
      return;
    }
    for (const friend of state.friends) {
      const row = document.createElement('li'); row.className = 'friend-row';
      const copy = document.createElement('span'); copy.className = 'friend-copy';
      const name = document.createElement('strong'); name.textContent = friend.name;
      const status = document.createElement('small'); status.className = friend.online ? 'is-online' : 'is-offline'; status.textContent = friend.online ? 'Online' : 'Offline';
      copy.append(name, status);
      const actions = document.createElement('span'); actions.className = 'friend-actions';
      const chat = document.createElement('button'); chat.type = 'button'; chat.textContent = 'Message'; chat.disabled = !friend.online || !friend.playerId || busy;
      chat.title = friend.online ? 'Open private chat' : 'Your friend is offline';
      chat.onclick = () => { if (friend.playerId) messageFriend(friend.playerId, friend.name); };
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = 'Remove'; remove.disabled = busy;
      remove.onclick = () => void mutate('remove', {id: friend.id}, 'Friend removed.');
      actions.append(chat, remove); row.append(copy, actions); list.append(row);
    }
    if (!state.friends.length) list.append(empty('No friends yet. Add someone from the city.'));
    for (const request of state.incoming) {
      const row = document.createElement('li'); row.className = 'friend-row';
      const name = document.createElement('strong'); name.textContent = request.name;
      const actions = document.createElement('span'); actions.className = 'friend-actions';
      const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'primary'; accept.textContent = 'Accept'; accept.disabled = busy; accept.onclick = () => void mutate('respond', {id: request.id, approved: true}, 'Friend added.');
      const decline = document.createElement('button'); decline.type = 'button'; decline.textContent = 'Decline'; decline.disabled = busy; decline.onclick = () => void mutate('respond', {id: request.id, approved: false}, 'Request declined.');
      actions.append(accept, decline); row.append(name, actions); incoming.append(row);
    }
    if (!state.incoming.length) incoming.append(empty('No incoming requests.'));
    for (const request of state.outgoing) {
      const row = document.createElement('li'); row.className = 'friend-row';
      const name = document.createElement('strong'); name.textContent = request.name;
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.disabled = busy; cancel.onclick = () => void mutate('cancel', {id: request.id}, 'Request cancelled.');
      row.append(name, cancel); outgoing.append(row);
    }
    if (!state.outgoing.length) outgoing.append(empty('No sent requests.'));
  }

  async function request(path: string, body?: unknown) {
    if (!base || !loggedIn()) throw Error('Log in to use Friends.');
    const response = await fetch(`${base}/friends/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
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

  function applyState(next: FriendState | null) {
    currentState = next; onState(next); render();
  }

  async function refresh() {
    if (busy) return;
    if (!loggedIn()) { applyState(null); message.textContent = 'Log in to add friends and keep your list.'; return; }
    if (!base) { applyState(null); message.textContent = 'Friends are not available in this build yet.'; return; }
    busy = true; render(); message.textContent = 'Loading Friend List…';
    try { const data = await request('state'); applyState(data.state); message.textContent = ''; }
    catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not load Friends.'; }
    finally { busy = false; render(); }
  }

  async function mutate(path: string, body: unknown, success: string) {
    if (busy) return;
    busy = true; render(); message.textContent = 'Updating Friends…';
    try { const data = await request(path, body); applyState(data.state); message.textContent = success; }
    catch (error) { message.textContent = error instanceof Error ? error.message : 'Could not update Friends.'; }
    finally { busy = false; render(); }
  }

  async function add(playerId: string, _name = '') { await mutate('request', {playerId}, 'Friend request sent.'); }
  async function respond(id: string, approved: boolean) { await mutate('respond', {id, approved}, approved ? 'Friend added.' : 'Request declined.'); }
  async function cancel(id: string) { await mutate('cancel', {id}, 'Request cancelled.'); }
  async function remove(id: string) { await mutate('remove', {id}, 'Friend removed.'); }
  function relationship(playerId: string): FriendRelation {
    if (!currentState) return 'none';
    if (currentState.friends.some(friend => friend.playerId === playerId)) return 'friend';
    if (currentState.incoming.some(request => request.playerId === playerId)) return 'incoming';
    if (currentState.outgoing.some(request => request.playerId === playerId)) return 'outgoing';
    return 'none';
  }
  function relationshipId(playerId: string) {
    const friend = currentState?.friends.find(item => item.playerId === playerId);
    if (friend) return friend.id;
    const incoming = currentState?.incoming.find(item => item.playerId === playerId);
    if (incoming) return incoming.id;
    const outgoing = currentState?.outgoing.find(item => item.playerId === playerId);
    return outgoing?.id || null;
  }

  dialog.querySelector('header button')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => release());
  render();

  return {
    open() { release(); if (!dialog.open) dialog.showModal(); void refresh(); },
    close() { if (dialog.open) dialog.close(); },
    refresh,
    add,
    respond,
    cancel,
    remove,
    relationship,
    relationshipId,
    state: applyState,
    get opened() { return dialog.open; },
  };
}
