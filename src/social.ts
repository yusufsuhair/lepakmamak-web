import * as THREE from 'three';

export function nameTag(name: string, interactiveVoice = false) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 164;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  label.scale.set(3.8, 1.22, 1); label.position.y = 3.15;
  label.userData.name = name;
  label.userData.drawVoice = (mic: boolean, speaker: boolean) => {
    label.userData.mic = mic; label.userData.speaker = speaker;
    ctx.clearRect(0, 0, 512, 164);
    ctx.font = label.userData.gameMaster ? '700 30px "Oxanium", sans-serif' : '600 36px "Oxanium", sans-serif';
    const shownName=String(label.userData.name||'Player').slice(0,18);
    const nameWidth = ctx.measureText(shownName).width;
    ctx.font = '700 16px "Oxanium", sans-serif';
    const titleWidth = label.userData.gameMaster ? ctx.measureText('✦  GAME MASTER  ✦').width : 0;
    const width = Math.min(496, Math.ceil(Math.max(nameWidth, titleWidth) + 40));
    const left = (512 - width) / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!label.userData.gameMaster) {
      ctx.fillStyle = '#173c3280'; ctx.beginPath(); ctx.roundRect(left, 76, width, 80, 20); ctx.fill();
    }
    ctx.font = '600 36px "Oxanium", sans-serif'; ctx.fillStyle = '#ddf69a';
    if (label.userData.gameMaster) {
      ctx.save();
      ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#30200f80'; ctx.strokeStyle = '#ffd978'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(left, 76, width, 80, 20); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = '700 16px "Oxanium", sans-serif'; ctx.fillStyle = '#ffe8a3';
      ctx.fillText('✦  GAME MASTER  ✦', 256, 94);
      ctx.font = '700 30px "Oxanium", sans-serif'; ctx.fillStyle = '#fff5d1';
      ctx.fillText(shownName, 256, 128, 440);
      ctx.beginPath(); ctx.roundRect(left + 2, 78, width - 4, 76, 18); ctx.clip();
      const x = left - 80 + (label.userData.shine || 0) * (width + 160);
      const shine = ctx.createLinearGradient(x - 70, 76, x + 70, 156);
      shine.addColorStop(0, '#ffffff00'); shine.addColorStop(.5, '#fff4ba66'); shine.addColorStop(1, '#ffffff00');
      ctx.fillStyle = shine; ctx.fillRect(left, 76, width, 80); ctx.restore();
    } else ctx.fillText(shownName, 256, 117, 460);
    for (const [x, on, kind] of [[218, mic, 'mic'], [294, speaker, 'speaker']] as const) {
      if (interactiveVoice) continue;
      ctx.save(); ctx.translate(x, 35);
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
  label.scale.set(enabled ? 4.3 : 3.8, enabled ? 1.38 : 1.22, 1);
  label.userData.drawVoice(!!label.userData.mic, !!label.userData.speaker);
}


type Member = {id: string; name: string};
type Thread = {key: string; label: string; channel: 'all' | 'party' | 'dm'; to?: string; name?: string; log: HTMLElement; unread: number; closable: boolean};

export function setupChat(send: (text: string, channel: 'all' | 'party' | 'dm', to?: string) => boolean, focus: () => void) {
  const panel = document.createElement('aside'); panel.id = 'city-chat';
  panel.innerHTML = `<button type="button" id="chat-heading" aria-controls="chat-body"><b>City chat</b><span id="chat-toggle-label"></span></button><button type="button" id="chat-expand"></button><span id="chat-unread-badge" aria-hidden="true" hidden></span><div id="chat-body"><div id="chat-logs"></div><button type="button" id="chat-compose" aria-label="Write a message"></button><form id="chat-form" hidden><span class="chat-channel-wrap"><button type="button" id="chat-channel" aria-haspopup="listbox" aria-expanded="false"></button><div id="chat-channel-menu" role="listbox" aria-label="Choose who sees your message" hidden></div></span><input id="chat-input" aria-label="Message to the city" placeholder="Say hello, lah…" maxlength="200" autocomplete="off"><button type="submit">Send</button></form><small id="chat-status" role="status">Connecting to the city…</small></div>`;
  document.getElementById('hud')!.append(panel);
  const el = <T extends HTMLElement>(id: string) => panel.querySelector<T>(`#${id}`)!;
  const input = el<HTMLInputElement>('chat-input'), status = el('chat-status');
  const heading = el<HTMLButtonElement>('chat-heading'), body = el('chat-body');
  const toggleLabel = el('chat-toggle-label'), unreadBadge = el('chat-unread-badge');
  const form = el<HTMLFormElement>('chat-form'), compose = el<HTMLButtonElement>('chat-compose');
  const logs = el('chat-logs'), expand = el<HTMLButtonElement>('chat-expand');
  const selector = el<HTMLButtonElement>('chat-channel'), menu = el('chat-channel-menu');
  const coarse = matchMedia('(any-pointer: coarse), (max-width: 600px)').matches;
  compose.textContent = coarse ? '' : 'Click or press enter to type';

  let collapsed = false, composing = false, expanded = false, menuOpen = false, active = 'all';
  const threads = new Map<string, Thread>();

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
  let party: Thread | null = null;

  function select(key: string) {
    if (!threads.has(key)) key = 'all';
    active = key;
    threads.get(key)!.unread = 0;
    if (collapsed) collapsed = false;
    closeMenu();
    render();
    threads.get(key)!.log.scrollTop = threads.get(key)!.log.scrollHeight;
  }

  function closeThread(key: string) {
    const thread = threads.get(key);
    if (!thread?.closable) return;
    thread.log.remove(); threads.delete(key);
    if (active === key) select('all'); else render();
  }

  const totalUnread = () => [...threads.values()].reduce((sum, thread) => sum + thread.unread, 0);
  function closeMenu() { menuOpen = false; menu.hidden = true; selector.setAttribute('aria-expanded', 'false'); }

  // The list drops upward out of the composer, so it never covers what you are reading.
  function renderMenu() {
    menu.replaceChildren();
    for (const thread of threads.values()) {
      const row = document.createElement('div'); row.className = 'chat-channel-row';
      const option = document.createElement('button');
      option.type = 'button'; option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(thread.key === active));
      option.textContent = thread.label;
      if (thread.unread) { const count = document.createElement('span'); count.className = 'opt-unread'; count.textContent = String(thread.unread); option.append(count); }
      option.onclick = () => select(thread.key);
      row.append(option);
      if (thread.closable) {
        const close = document.createElement('button');
        close.type = 'button'; close.className = 'chat-thread-close';
        close.setAttribute('aria-label', `Close chat with ${thread.name}`); close.textContent = '×';
        close.onclick = event => { event.stopPropagation(); closeThread(thread.key); };
        row.append(close);
      }
      menu.append(row);
    }
  }

  function render() {
    body.hidden = collapsed; panel.classList.toggle('chat-collapsed', collapsed);
    panel.classList.toggle('chat-expanded', expanded);
    form.hidden = !composing; compose.hidden = composing; panel.classList.toggle('chat-composing', composing);
    expand.textContent = expanded ? '⤡' : '⤢';
    expand.setAttribute('aria-label', expanded ? 'Shrink chat back' : 'Expand chat to a larger window');
    const unread = totalUnread();
    heading.setAttribute('aria-expanded', String(!collapsed));
    heading.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} city chat${unread ? `, ${unread} unread messages` : ''}`);
    toggleLabel.textContent = collapsed ? '＋' : '−';
    unreadBadge.hidden = !collapsed || !unread; unreadBadge.textContent = unread > 99 ? '99+' : String(unread);
    for (const thread of threads.values()) thread.log.hidden = thread.key !== active;
    const current = threads.get(active)!;
    selector.textContent = current.label;
    if (current.unread) { const count = document.createElement('span'); count.className = 'opt-unread'; count.textContent = String(current.unread); selector.append(count); }
    selector.setAttribute('aria-label', `Channel: ${current.label}. Choose who sees your message`);
    input.setAttribute('aria-label', active === 'all' ? 'Message to the city' : `Message to ${current.label}`);
    if (menuOpen) renderMenu();
  }

  selector.onclick = () => {
    menuOpen = !menuOpen; menu.hidden = !menuOpen;
    selector.setAttribute('aria-expanded', String(menuOpen));
    if (menuOpen) renderMenu();
  };
  selector.onkeydown = event => event.stopPropagation();
  menu.addEventListener('keydown', event => event.stopPropagation());
  expand.onclick = () => { expanded = !expanded; render(); };
  expand.onkeydown = event => event.stopPropagation();

  function expandPanel() { collapsed = false; render(); }
  // Enter (or a tap on the pill) is the only way in; sending or Escape is the way out.
  function openComposer() { if (collapsed) expandPanel(); composing = true; render(); input.focus(); }
  function closeComposer() { composing = false; closeMenu(); render(); input.blur(); }
  compose.onclick = openComposer;
  compose.onkeydown = event => event.stopPropagation();

  heading.onclick = () => {
    if (collapsed) { expandPanel(); threads.get(active)!.unread = 0; render(); }
    else { collapsed = true; composing = false; closeMenu(); input.blur(); render(); }
    try { localStorage.setItem('lepak-chat-collapsed', String(collapsed)); } catch { /* Keep working without storage. */ }
  };
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
    : active === 'party' ? 'Only your party sees this' : `Private to ${threads.get(active)?.name}`;

  function openDm(id: string, name: string) {
    const key = `dm:${id}`;
    if (!threads.has(key)) build(key, `@${name}`, 'dm', {to: id, name, closable: true});
    return threads.get(key)!;
  }

  return {
    open() { openComposer(); },
    openDm(id: string, name: string) { openDm(id, name); select(`dm:${id}`); },
    party(members: Member[] | null) {
      // The server deletes a party the moment it drops below two, so any list means a party.
      if (members?.length) party ??= build('party', 'PARTY', 'party');
      else if (party) { const key = party.key; party.log.remove(); threads.delete(key); party = null; if (active === key) active = 'all'; }
      render();
    },
    status(value: boolean) { online = value; status.textContent = statusText(); },
    history(history: {name: string; text: string; sentAt?: string; gameMaster?: boolean}[]) {
      all.log.replaceChildren(); all.unread = 0;
      for (const entry of history.slice(-50)) this.append(entry.name, entry.text, entry.sentAt, !!entry.gameMaster, false);
      all.unread = 0;
      render(); all.log.scrollTop = all.log.scrollHeight;
    },
    append(name: string, text: string, sentAt?: string, gameMaster = false, notify = true, channel: 'all' | 'party' | 'dm' = 'all', thread?: Member) {
      const target = channel === 'dm' && thread ? openDm(thread.id, thread.name) : channel === 'party' ? (party ??= build('party', 'PARTY', 'party')) : all;
      const parsed = sentAt ? new Date(sentAt) : new Date();
      const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
      const timestamp = document.createElement('time'); timestamp.dateTime = date.toISOString();
      timestamp.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
      timestamp.title = `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'medium' }).format(date)} MYT`;
      timestamp.setAttribute('aria-label', timestamp.title);
      const row = document.createElement('p'); const author = document.createElement('strong'); author.textContent = `${name}: `;
      if (gameMaster) { row.className = 'game-master-chat'; author.textContent = `✦ GM · ${name}: `; }
      row.append(timestamp, document.createTextNode(' '), author, document.createTextNode(text)); target.log.append(row);
      while (target.log.children.length > 50) target.log.firstElementChild!.remove();
      if (notify && (collapsed || target.key !== active)) target.unread++;
      render();
      if (!collapsed && target.key === active) target.log.scrollTop = target.log.scrollHeight;
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
