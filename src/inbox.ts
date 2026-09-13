import {accountToken} from './account-token';

// Stored private messages. The chat owns the strip and the log; this owns the HTTP side:
// loading and paging, marking read, sending with a retry that keeps its client id, and the
// Block and Report actions in a conversation's header.

export type StoredMessage = {id: string; from: string; to: string; body: string; clientId: string; sentAt: string};
export type Peer = {userId: string; handle: string | null; name: string};
type Entry = {key: string; name: string; text: string; sentAt?: string};
export type PmChat = {
  open(userId: string, label: string): void;
  add(userId: string, label: string, entries: Entry[], options?: {mode?: 'append' | 'prepend' | 'replace'; notify?: boolean}): void;
  note(userId: string, text: string, action?: {label: string; run: (row: HTMLElement) => void}): HTMLElement | null;
  unread(userId: string, label: string, count: number): void;
  active(userId: string): boolean;
  close(userId: string): void;
};
type Conversation = Peer & {more: boolean; oldest: string | null; loading: boolean; offlineNoted: boolean};
type Failure = Error & {status?: number; data?: {retryAfter?: number}};

export function setupInbox(endpoint: string, chat: PmChat, options: {me: () => string; toast: (title: string, body: string) => void; report: (peer: Peer) => void}) {
  const base = endpoint.replace(/^ws/i, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '');
  const conversations = new Map<string, Conversation>();
  const label = (peer: Peer) => peer.handle ? `@${peer.handle}` : peer.name;

  async function api(path: string, init: RequestInit = {}) {
    const token = accountToken();
    if (!base || !token) throw Object.assign(Error('Log in to use private messages.'), {status: 401});
    const response = await fetch(`${base}${path}`, {...init, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(Error(data.error || 'Please try again.'), {status: response.status, data});
    return data;
  }

  function conversation(peer: Peer) {
    const known = conversations.get(peer.userId);
    if (known) {
      if (peer.handle) known.handle = peer.handle;
      if (peer.name && peer.name !== 'Player') known.name = peer.name;
      return known;
    }
    const fresh: Conversation = {...peer, more: false, oldest: null, loading: false, offlineNoted: false};
    conversations.set(peer.userId, fresh);
    return fresh;
  }

  const entry = (message: StoredMessage, peer: Conversation): Entry => ({key: message.id, name: message.from === peer.userId ? label(peer) : options.me(), text: message.body, sentAt: message.sentAt});

  async function load(peer: Conversation, older: boolean) {
    if (peer.loading || (older && (!peer.more || !peer.oldest))) return;
    peer.loading = true;
    try {
      const query = older ? `?before=${encodeURIComponent(peer.oldest!)}` : '';
      const data = await api(`/messages/${encodeURIComponent(peer.userId)}${query}`);
      const page: StoredMessage[] = Array.isArray(data.messages) ? data.messages : [];
      if (page.length) peer.oldest = page[0].sentAt;
      peer.more = !!data.more;
      chat.add(peer.userId, label(peer), page.map(message => entry(message, peer)), {mode: older ? 'prepend' : 'replace'});
    } catch (error) {
      chat.note(peer.userId, (error as Error).message || 'Could not load this conversation.');
    } finally { peer.loading = false; }
  }

  async function markRead(userId: string) {
    try { await api(`/messages/${encodeURIComponent(userId)}/read`, {method: 'POST', body: '{}'}); }
    catch { /* The next open marks it again. */ }
  }

  async function deliver(peer: Conversation, text: string, clientId: string) {
    try {
      const data = await api('/messages', {method: 'POST', body: JSON.stringify({to: peer.userId, body: text, clientId})});
      chat.add(peer.userId, label(peer), [entry(data.message, peer)]);
      if (!data.online && !peer.offlineNoted) { peer.offlineNoted = true; chat.note(peer.userId, "They'll see this when they're back online."); }
    } catch (error) {
      const failure = error as Failure;
      const retry = {label: 'Retry', run: (row: HTMLElement) => { row.remove(); void deliver(peer, text, clientId); }};
      if (failure.status === 429) chat.note(peer.userId, `Slow down. Try again in ${failure.data?.retryAfter || 10}s.`, retry);
      else if (failure.status && failure.status < 500) chat.note(peer.userId, failure.message);
      // No status means it never arrived, and a 5xx may not have stored it. Either way the retry
      // reuses the client id, so the server keeps the message once.
      else chat.note(peer.userId, `Not sent: “${text}”`, retry);
    }
  }

  return {
    open(peer: Peer) { const known = conversation(peer); chat.open(known.userId, label(known)); },
    // ponytail: every open reloads the newest page instead of tracking what the log still holds.
    // One request per chip tap; worth caching only if people flick between many conversations.
    async opened(userId: string) {
      const peer = conversations.get(userId);
      if (!peer) return;
      await load(peer, false);
      await markRead(userId);
    },
    older(userId: string) { const peer = conversations.get(userId); if (peer) void load(peer, true); },
    receive(message: StoredMessage, from?: Peer | null) {
      const peer = conversation(from && from.userId === message.from ? from : {userId: message.from, handle: null, name: 'Player'});
      chat.add(peer.userId, label(peer), [entry(message, peer)], {notify: true});
      if (chat.active(peer.userId)) void markRead(peer.userId);
    },
    send(userId: string, text: string) {
      const peer = conversations.get(userId);
      if (!peer) return false;
      void deliver(peer, text, crypto.randomUUID());
      return true;
    },
    async login() {
      try {
        const data = await api('/messages/unread');
        for (const thread of Array.isArray(data.threads) ? data.threads : []) {
          const peer = conversation({userId: thread.userId, handle: thread.handle, name: thread.name});
          chat.unread(peer.userId, label(peer), Number(thread.unread) || 0);
        }
      } catch { /* The chips come back at the next login. */ }
    },
    async block(userId: string) {
      const peer = conversations.get(userId);
      if (!peer || !confirm(`Block ${label(peer)}? They won't be able to message you.`)) return;
      try {
        await api('/blocks', {method: 'POST', body: JSON.stringify({userId})});
        chat.close(userId);
        conversations.delete(userId);
        options.toast('Blocked', `${label(peer)} can't message you any more.`);
      } catch (error) { chat.note(userId, (error as Error).message); }
    },
    report(userId: string) {
      const peer = conversations.get(userId);
      if (peer) options.report({userId: peer.userId, handle: peer.handle, name: peer.name});
    },
    reset() { for (const userId of [...conversations.keys()]) chat.close(userId); conversations.clear(); },
  };
}
