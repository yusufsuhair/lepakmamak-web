import * as THREE from 'three';

export const NAME_TAG_LAYOUT = Object.freeze({
  voice: {top: 5, bottom: 67},
  geng: {top: 76, bottom: 108},
  name: {top: 120, bottom: 200},
});

export function nameTag(name: string, interactiveVoice = false) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 228;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  label.scale.set(3.8, 1.69, 1); label.position.y = 3.39;
  label.userData.name = name;
  label.userData.drawVoice = (mic: boolean, speaker: boolean) => {
    label.userData.mic = mic; label.userData.speaker = speaker;
    ctx.clearRect(0, 0, 512, 228);
    ctx.font = label.userData.gameMaster ? '700 30px "Oxanium", sans-serif' : '600 36px "Oxanium", sans-serif';
    const shownName=String(label.userData.name||'Player').slice(0,18);
    const nameWidth = ctx.measureText(shownName).width;
    ctx.font = '700 16px "Oxanium", sans-serif';
    const titleWidth = label.userData.gameMaster ? ctx.measureText('✦  GAME MASTER  ✦').width : 0;
    const width = Math.min(496, Math.ceil(Math.max(nameWidth, titleWidth) + 40));
    const left = (512 - width) / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!label.userData.gameMaster) {
      ctx.fillStyle = '#173c3280'; ctx.beginPath(); ctx.roundRect(left, 120, width, 80, 20); ctx.fill();
    }
    ctx.font = '600 36px "Oxanium", sans-serif'; ctx.fillStyle = '#ddf69a';
    if (label.userData.gameMaster) {
      ctx.save();
      ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#30200f80'; ctx.strokeStyle = '#ffd978'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(left, 120, width, 80, 20); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = '700 16px "Oxanium", sans-serif'; ctx.fillStyle = '#ffe8a3';
      ctx.fillText('✦  GAME MASTER  ✦', 256, 138);
      ctx.font = '700 30px "Oxanium", sans-serif'; ctx.fillStyle = '#fff5d1';
      ctx.fillText(shownName, 256, 172, 440);
      ctx.beginPath(); ctx.roundRect(left + 2, 122, width - 4, 76, 18); ctx.clip();
      const x = left - 80 + (label.userData.shine || 0) * (width + 160);
      const shine = ctx.createLinearGradient(x - 70, 120, x + 70, 200);
      shine.addColorStop(0, '#ffffff00'); shine.addColorStop(.5, '#fff4ba66'); shine.addColorStop(1, '#ffffff00');
      ctx.fillStyle = shine; ctx.fillRect(left, 120, width, 80); ctx.restore();
    } else ctx.fillText(shownName, 256, 161, 460);
    // The geng sits above the name, small and quiet: it says who you run with, it is not
    // your name. Drawn last so it is never clipped by the pill it sits over.
    const geng = String(label.userData.geng || '').slice(0, 18);
    if (geng) {
      ctx.font = '700 19px "Oxanium", sans-serif';
      const tagWidth = Math.min(420, Math.ceil(ctx.measureText(geng).width + 26));
      // Only the Geng leader gets the gold badge. Members keep the quieter shared tag.
      const leader = !!label.userData.gengLeader;
      ctx.fillStyle = leader ? '#b98235e8' : '#12312bb3';
      if (leader) { ctx.strokeStyle = '#ffe39a'; ctx.lineWidth = 2; }
      ctx.beginPath(); ctx.roundRect((512 - tagWidth) / 2, 76, tagWidth, 32, 10); ctx.fill();
      if (leader) ctx.stroke();
      ctx.fillStyle = leader ? '#fff3c4' : '#f0cf8e';
      ctx.fillText(geng, 256, 93, 400);
    }
    // With no Geng tag, the geng row (76-108) sits empty above the name — drop the mic/speaker
    // icons into the middle of that gap instead of leaving them floating high on their own.
    const voiceY = geng ? 35 : 56;
    for (const [x, on, kind] of [[218, mic, 'mic'], [294, speaker, 'speaker']] as const) {
      if (interactiveVoice) continue;
      ctx.save(); ctx.translate(x, voiceY);
      ctx.fillStyle = '#173c32ed'; ctx.beginPath(); ctx.roundRect(-32, -30, 64, 62, 16); ctx.fill();
      ctx.strokeStyle = on ? '#ddf69a' : '#f4a08f'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (kind === 'mic') {
        ctx.beginPath(); ctx.roundRect(-7, -19, 14, 26, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-13, -3); ctx.lineTo(-13, 2); ctx.arc(0, 2, 13, Math.PI, 0, true); ctx.lineTo(13, -3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(0, 22); ctx.moveTo(-7, 22); ctx.lineTo(7, 22); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-19, -7); ctx.lineTo(-11, -7); ctx.lineTo(0, -16); ctx.lineTo(0, 16); ctx.lineTo(-11, 7); ctx.lineTo(-19, 7); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 11, -.75, .75); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 20, -.75, .75); ctx.stroke();
      }
      if (!on) { ctx.beginPath(); ctx.moveTo(-22, 23); ctx.lineTo(22, -23); ctx.stroke(); }
      ctx.restore();
    }
    texture.needsUpdate = true;
  };
  updateNameTagVoice(label, false, false);
  return label;
}

export function updateNameTagName(label:THREE.Sprite,name:string){label.userData.name=name.slice(0,18);label.userData.drawVoice(!!label.userData.mic,!!label.userData.speaker);}
export function updateNameTagGeng(label:THREE.Sprite,geng:string,leader=false){
 const next=String(geng||'').slice(0,18);
 if(label.userData.geng===next&&!!label.userData.gengLeader===leader)return; // redrawing every frame is not free
 label.userData.geng=next;label.userData.gengLeader=leader;label.userData.drawVoice(!!label.userData.mic,!!label.userData.speaker);
}

export function updateNameTagVoice(label: THREE.Sprite, mic: boolean, speaker: boolean) {
  const state = `${mic}:${speaker}`;
  if (label.userData.voiceState === state) return;
  label.userData.voiceState = state;
  label.userData.drawVoice(mic, speaker);
}

export function updateGameMasterTag(label: THREE.Sprite, enabled: boolean, time: number, reducedMotion = false) {
  const frame = reducedMotion ? 0 : Math.floor(time * 10);
  if (label.userData.gameMaster === enabled && (!enabled || label.userData.shineFrame === frame)) return;
  label.userData.gameMaster = enabled; label.userData.shineFrame = frame;
  label.userData.shine = reducedMotion ? .5 : (time % 3) / 3;
  label.scale.set(enabled ? 4.3 : 3.8, enabled ? 1.91 : 1.69, 1);
  label.userData.drawVoice(!!label.userData.mic, !!label.userData.speaker);
}


import {createDmBar} from './dm';

type Member = {id: string; name: string};
type Thread = {key: string; label: string; channel: 'all' | 'party' | 'dm' | 'table' | 'pm'; to?: string; name?: string; log: HTMLElement; unread: number; closable: boolean};
// Stored conversations (channel 'pm', keyed by account) travel over HTTP through src/inbox.ts;
// the chat only draws them and reports what the player did.
export type PmHooks = {opened?: (userId: string) => void; older?: (userId: string) => void; block?: (userId: string) => void; report?: (userId: string) => void};
export type PmEntry = {key: string; name: string; text: string; sentAt?: string};

export function setupChat(send: (text: string, channel: Thread['channel'], to?: string) => boolean, focus: () => void, hooks: PmHooks = {}) {
  const panel = document.createElement('aside'); panel.id = 'city-chat';
  panel.innerHTML = `<span id="chat-controls"><button type="button" id="chat-min"></button><button type="button" id="chat-expand"></button></span><button type="button" id="chat-heading" aria-controls="chat-body"><b>City chat</b></button><span id="chat-unread-badge" aria-hidden="true" hidden></span><div id="chat-body"><div id="chat-logs"><button type="button" id="chat-jump" hidden aria-label="Jump to the latest messages">↓ Terkini</button></div><button type="button" id="chat-compose" aria-label="Write a message"></button><form id="chat-form" hidden><span class="chat-channel-wrap"><button type="button" id="chat-channel" aria-haspopup="listbox" aria-expanded="false"></button><div id="chat-channel-menu" role="listbox" aria-label="Choose who sees your message" hidden></div></span><input id="chat-input" aria-label="Message to the city" placeholder="Say hello, lah…" maxlength="200" autocomplete="off"><button type="submit">Send</button></form><small id="chat-status" role="status">Connecting to the city…</small></div>`;
  document.getElementById('hud')!.append(panel);
  const el = <T extends HTMLElement>(id: string) => panel.querySelector<T>(`#${id}`)!;
  const input = el<HTMLInputElement>('chat-input'), status = el('chat-status');
  const heading = el<HTMLButtonElement>('chat-heading'), body = el('chat-body');
  const unreadBadge = el('chat-unread-badge');
  const form = el<HTMLFormElement>('chat-form'), compose = el<HTMLButtonElement>('chat-compose');
  const logs = el('chat-logs'), expand = el<HTMLButtonElement>('chat-expand'), jump = el<HTMLButtonElement>('chat-jump');
  const minimise = el<HTMLButtonElement>('chat-min');
  const accountOf = (key: string) => threads.get(key)?.to || '';
  const dmBar = createDmBar({
    select: key => select(key), close: key => closeThread(key),
    block: key => { const id = accountOf(key); if (id) hooks.block?.(id); },
    report: key => { const id = accountOf(key); if (id) hooks.report?.(id); },
  });
  body.prepend(dmBar.root);
  const selector = el<HTMLButtonElement>('chat-channel'), menu = el('chat-channel-menu');
  const coarse = matchMedia('(any-pointer: coarse), (max-width: 600px)').matches;
  compose.textContent = coarse ? '' : 'Click or press enter to type';

  let collapsed = false, composing = false, expanded = false, menuOpen = false, active = 'all';
  const threads = new Map<string, Thread>();

  // Reading back through the log should not be yanked away by the next message. The log
  // only follows along while you are already at the bottom; otherwise the arrow offers it.
  const atBottom = (log: HTMLElement) => log.scrollHeight - log.scrollTop - log.clientHeight < 24;
  const toBottom = (log: HTMLElement) => { log.scrollTop = log.scrollHeight; };
  function renderJump() {
    const log = threads.get(active)?.log;
    jump.hidden = collapsed || !log || atBottom(log);
  }
  logs.addEventListener('scroll', renderJump, true);
  // A stored conversation pages older messages in as you reach the top of it.
  logs.addEventListener('scroll', event => {
    const thread = threads.get(active);
    if (thread?.channel === 'pm' && thread.to && event.target === thread.log && thread.log.scrollTop < 8) hooks.older?.(thread.to);
  }, true);
  jump.onclick = () => { const log = threads.get(active)!.log; toBottom(log); renderJump(); };
  jump.onkeydown = event => event.stopPropagation();

  function build(key: string, label: string, channel: Thread['channel'], options: {to?: string; name?: string; closable?: boolean} = {}) {
    const log = document.createElement('div'); log.className = 'chat-log'; log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-label', `${label} messages`);
    if (key === 'all') log.id = 'chat-messages';
    logs.append(log);
    const thread: Thread = {key, label, channel, to: options.to, name: options.name, log, unread: 0, closable: !!options.closable};
    threads.set(key, thread);
    return thread;
  }

  const all = build('all', 'ALL', 'all');
  let party: Thread | null = null, table: Thread | null = null;

  function select(key: string) {
    if (!threads.has(key)) key = 'all';
    active = key;
    threads.get(key)!.unread = 0;
    if (collapsed) collapsed = false;
    closeMenu();
    render();
    toBottom(threads.get(key)!.log);
    renderJump();
    const chosen = threads.get(key)!;
    if (chosen.channel === 'pm' && chosen.to) hooks.opened?.(chosen.to);
  }

  function closeThread(key: string) {
    const thread = threads.get(key);
    if (!thread?.closable) return;
    thread.log.remove(); threads.delete(key);
    if (active === key) {
      composing = false; input.value = ''; closeMenu(); input.blur(); select('all');
    } else render();
  }

  function closeDm(id: string) { closeThread(`dm:${id}`); }

  const totalUnread = () => [...threads.values()].reduce((sum, thread) => sum + thread.unread, 0);
  function closeMenu() { menuOpen = false; menu.hidden = true; selector.setAttribute('aria-expanded', 'false'); }

  // The list drops upward out of the composer, so it never covers what you are reading.
  function renderMenu() {
    menu.replaceChildren();
    for (const thread of threads.values()) {
      if (thread.channel === 'dm' || thread.channel === 'pm') continue;   // private threads have their own strip
      const row = document.createElement('div'); row.className = 'chat-channel-row';
      const option = document.createElement('button');
      option.type = 'button'; option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(thread.key === active));
      option.textContent = thread.label;
      if (thread.unread) { const count = document.createElement('span'); count.className = 'opt-unread'; count.textContent = String(thread.unread); option.append(count); }
      option.onclick = () => select(thread.key);
      row.append(option);
      menu.append(row);
    }
  }

  function render() {
    body.hidden = collapsed; panel.classList.toggle('chat-collapsed', collapsed);
    panel.classList.toggle('chat-expanded', expanded);
    form.hidden = !composing; compose.hidden = composing; panel.classList.toggle('chat-composing', composing);
    // A collapsed chat only needs one clear way back. Hiding fullscreen here avoids two
    // tiny controls on mobile that both appear to open the same closed panel.
    expand.hidden = collapsed;
    expand.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${expanded ? 'M4 9h5V4M9 9 3 3M20 15h-5v5M15 15l6 6' : 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7'}"/></svg>`;
    expand.setAttribute('aria-label', expanded ? 'Shrink chat back' : 'Expand chat to a larger window');
    heading.disabled = expanded;
    minimise.hidden = expanded;
    minimise.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${collapsed ? 'M5 5h14v14H5zM5 9h14' : 'M5 12h14'}"/></svg>`;
    minimise.setAttribute('aria-label', collapsed ? 'Restore city chat' : 'Minimise city chat');
    const unread = totalUnread();
    heading.setAttribute('aria-expanded', String(!collapsed));
    heading.setAttribute('aria-label', expanded ? 'City chat' : `${collapsed ? 'Expand' : 'Collapse'} city chat${unread ? `, ${unread} unread messages` : ''}`);
    unreadBadge.hidden = !collapsed || !unread; unreadBadge.textContent = unread > 99 ? '99+' : String(unread);
    for (const thread of threads.values()) thread.log.hidden = thread.key !== active;
    const current = threads.get(active)!;
    const private_ = current.channel === 'dm' || current.channel === 'pm';
    // In a private conversation the pill states the recipient and stops being a menu, so a
    // private line can never be handed to the whole city by a mis-tap.
    selector.textContent = private_ ? `→ ${current.label}` : current.label;
    selector.classList.toggle('dm-recipient', private_);
    selector.disabled = private_;
    if (private_) closeMenu();
    if (current.unread) { const count = document.createElement('span'); count.className = 'opt-unread'; count.textContent = String(current.unread); selector.append(count); }
    selector.setAttribute('aria-label', private_ ? `Private message to ${current.name}` : `Channel: ${current.label}. Choose who sees your message`);
    dmBar.render([...threads.values()].filter(thread => thread.channel === 'dm' || thread.channel === 'pm').map(thread => ({key: thread.key, name: thread.name || thread.label, unread: thread.unread, stored: thread.channel === 'pm'})), active);
    // Stored messages allow 500 characters, matching the Wall; live chat stays at 200.
    input.maxLength = current.channel === 'pm' ? 500 : 200;
    input.setAttribute('aria-label', active === 'all' ? 'Message to the city' : `Message to ${current.label}`);
    if (menuOpen) renderMenu();
    renderJump();
  }

  selector.onclick = () => {
    menuOpen = !menuOpen; menu.hidden = !menuOpen;
    selector.setAttribute('aria-expanded', String(menuOpen));
    if (menuOpen) renderMenu();
  };
  selector.onkeydown = event => event.stopPropagation();
  menu.addEventListener('keydown', event => event.stopPropagation());
  // Maximising a minimised panel would otherwise give you a full-screen window with its
  // body still hidden, so it un-minimises on the way up.
  expand.onclick = () => { expanded = !expanded; if (expanded) setCollapsed(false); else render(); };
  expand.onkeydown = event => event.stopPropagation();
  minimise.onclick = () => {
    setCollapsed(!collapsed);
  };
  minimise.onkeydown = event => event.stopPropagation();

  function expandPanel() { collapsed = false; render(); }
  // Enter (or a tap on the pill) is the only way in; sending or Escape is the way out.
  function openComposer() { if (collapsed) expandPanel(); composing = true; render(); input.focus(); }
  function closeComposer() { composing = false; closeMenu(); render(); input.blur(); }
  compose.onclick = openComposer;
  compose.onkeydown = event => event.stopPropagation();

  // The header and the minimise button are the same switch, so they persist the same way.
  function setCollapsed(next: boolean) {
    if (expanded && next) return;
    collapsed = next;
    if (collapsed) { composing = false; closeMenu(); input.blur(); }
    else threads.get(active)!.unread = 0;
    render();
    try { localStorage.setItem('lepak-chat-collapsed', String(collapsed)); } catch { /* Keep working without storage. */ }
  }
  heading.onclick = () => setCollapsed(!collapsed);
  heading.onkeydown = event => event.stopPropagation();
  try { const saved = localStorage.getItem('lepak-chat-collapsed'); if (saved !== null) collapsed = saved === 'true'; } catch { /* Preference storage is optional. */ }
  render();

  // Keep the keyboard and panel anchored until the tapped button receives its click.
  panel.addEventListener('pointerdown', event => {
    if (document.activeElement === input && event.target instanceof Element && event.target.closest('button')) event.preventDefault();
  });
  input.onfocus = focus;
  input.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') closeComposer(); };
  form.onsubmit = e => {
    e.preventDefault(); const text = input.value.trim();
    // An empty Enter dismisses the composer instead of sending nothing.
    if (!text) { closeComposer(); return; }
    const thread = threads.get(active)!;
    if (send(text, thread.channel, thread.to)) { input.value = ''; status.textContent = statusText(); closeComposer(); }
    else status.textContent = 'Reconnecting — your message was not sent. Try again when online.';
  };

  let online = false;
  const statusText = () => !online ? 'Connecting to the city…'
    : active === 'all' ? 'Visible to everyone in this city'
    : active === 'party' ? 'Only your Geng sees this'
    // The table thread has no `name` (it is not a person), which fell through to the DM case
    // below and read as "Private to undefined".
    : active === 'table' ? 'Visible to everyone at this table'
    : `Private to ${threads.get(active)?.name}`;

  function openDm(id: string, name: string) {
    const key = `dm:${id}`;
    if (!threads.has(key)) build(key, `@${name}`, 'dm', {to: id, name, closable: true});
    return threads.get(key)!;
  }

  function openPm(userId: string, label: string) {
    const key = `pm:${userId}`;
    const thread = threads.get(key) || build(key, label, 'pm', {to: userId, name: label, closable: true});
    thread.label = label; thread.name = label;
    return thread;
  }

  function line(name: string, text: string, sentAt?: string, gameMaster = false, area = '') {
    const parsed = sentAt ? new Date(sentAt) : new Date();
    const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
    const timestamp = document.createElement('time'); timestamp.dateTime = date.toISOString();
    timestamp.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
    timestamp.title = `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'medium' }).format(date)} MYT`;
    timestamp.setAttribute('aria-label', timestamp.title);
    const row = document.createElement('p');
    // Name on top, where they were standing underneath it. The area is stamped by the
    // server when the message is sent, so it is where they said it, not where they are now.
    const who = document.createElement('span'); who.className = 'chat-who';
    const author = document.createElement('strong'); author.textContent = gameMaster ? `✦ GM · ${name}:` : `${name}:`;
    who.append(author);
    if (area) { const place = document.createElement('small'); place.className = 'chat-area'; place.textContent = area; who.append(place); }
    if (gameMaster) row.className = 'game-master-chat';
    const said = document.createElement('span'); said.className = 'chat-said'; said.textContent = text;
    row.append(timestamp, document.createTextNode(' '), who, document.createTextNode(' '), said);
    return row;
  }

  return {
    open() { openComposer(); },
    openDm(id: string, name: string) { openDm(id, name); select(`dm:${id}`); },
    closeDm,
    pm: {
      open(userId: string, label: string) { openPm(userId, label); select(`pm:${userId}`); },
      // ponytail: no 50-row cap here, since older pages are prepended on purpose; a very long
      // scroll-back simply keeps its rows until the conversation is closed.
      add(userId: string, label: string, entries: PmEntry[], options: {mode?: 'append' | 'prepend' | 'replace'; notify?: boolean} = {}) {
        const thread = openPm(userId, label), log = thread.log, mode = options.mode || 'append';
        const follow = !collapsed && thread.key === active && atBottom(log);
        const height = log.scrollHeight;
        if (mode === 'replace') log.querySelectorAll('p[data-key]').forEach(row => row.remove());
        const rows = entries
          .filter(entry => !log.querySelector(`p[data-key="${CSS.escape(entry.key)}"]`))
          .map(entry => { const row = line(entry.name, entry.text, entry.sentAt); row.dataset.key = entry.key; return row; });
        if (mode === 'prepend') log.prepend(...rows); else log.append(...rows);
        if (options.notify && rows.length && (collapsed || thread.key !== active)) thread.unread += rows.length;
        render();
        if (mode === 'prepend') log.scrollTop += log.scrollHeight - height;
        else if (follow || mode === 'replace') toBottom(log);
        renderJump();
      },
      note(userId: string, text: string, action?: {label: string; run: (row: HTMLElement) => void}) {
        const thread = threads.get(`pm:${userId}`);
        if (!thread) return null;
        const row = document.createElement('p'); row.className = 'chat-note';
        const said = document.createElement('span'); said.textContent = text; row.append(said);
        if (action) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = action.label;
          button.onkeydown = event => event.stopPropagation();
          button.onclick = () => action.run(row);
          row.append(button);
        }
        const follow = atBottom(thread.log);
        thread.log.append(row);
        if (follow) toBottom(thread.log);
        renderJump();
        return row;
      },
      unread(userId: string, label: string, count: number) {
        const thread = openPm(userId, label);
        if (thread.key !== active) thread.unread = count;
        render();
      },
      active: (userId: string) => active === `pm:${userId}` && !collapsed,
      close(userId: string) { closeThread(`pm:${userId}`); },
    },
    online(ids: string[]) {
      const present = new Set(ids);
      for (const thread of [...threads.values()]) {
        if (thread.channel === 'dm' && thread.to && !present.has(thread.to)) closeThread(thread.key);
      }
    },
    // The table tab exists only while you are on a chair. Sitting down points the composer
    // at it, because that is who you are talking to; standing up hands you back to the city
    // rather than leaving you typing into a table you have left.
    seated(atTable: boolean) {
      if (atTable && !table) { table = build('table', 'MEJA', 'table'); select('table'); return; }
      if (!atTable && table) {
        const key = table.key; table.log.remove(); threads.delete(key); table = null;
        if (active === key) select('all'); else render();
      }
    },
    party(members: Member[] | null) {
      // The server deletes a party the moment it drops below two, so any list means a party.
      if (members?.length) party ??= build('party', 'GENG', 'party');
      else if (party) { const key = party.key; party.log.remove(); threads.delete(key); party = null; if (active === key) active = 'all'; }
      render();
    },
    status(value: boolean) { online = value; status.textContent = statusText(); },
    history(history: {name: string; text: string; sentAt?: string; gameMaster?: boolean; area?: string}[]) {
      all.log.replaceChildren(); all.unread = 0;
      for (const entry of history.slice(-50)) this.append(entry.name, entry.text, entry.sentAt, !!entry.gameMaster, false, 'all', undefined, entry.area || '');
      all.unread = 0;
      render(); toBottom(all.log); renderJump();
    },
    append(name: string, text: string, sentAt?: string, gameMaster = false, notify = true, channel: 'all' | 'party' | 'dm' | 'table' = 'all', thread?: Member, area = '') {
      const target = channel === 'dm' && thread ? openDm(thread.id, thread.name) : channel === 'party' ? (party ??= build('party', 'GENG', 'party')) : channel === 'table' ? (table ??= build('table', 'MEJA', 'table')) : all;
      const follow = !collapsed && target.key === active && atBottom(target.log);
      target.log.append(line(name, text, sentAt, gameMaster, area));
      while (target.log.children.length > 50) target.log.firstElementChild!.remove();
      if (notify && (collapsed || target.key !== active)) target.unread++;
      render();
      if (follow) toBottom(target.log);
      renderJump();
    },
  };
}

export function shoutTag(text: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '700 34px "Oxanium", sans-serif';
  const width = Math.min(500, Math.ceil(ctx.measureText(text).width + 44)), left = (512 - width) / 2;
  ctx.fillStyle = '#7c1d12e6'; ctx.strokeStyle = '#ff9c6b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(left, 30, width, 68, 18); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9d6';
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.9, .98, 1); sprite.position.y = 3.5;
  sprite.userData.text = text;
  return sprite;
}
