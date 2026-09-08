import * as THREE from 'three';

export function nameTag(name: string, interactiveVoice = false) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 164;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  label.scale.set(3.8, 1.22, 1); label.position.y = 3.15;
  label.userData.drawVoice = (mic: boolean, speaker: boolean) => {
    label.userData.mic = mic; label.userData.speaker = speaker;
    ctx.clearRect(0, 0, 512, 164);
    ctx.fillStyle = '#173c32ed'; ctx.beginPath(); ctx.roundRect(8, 76, 496, 80, 24); ctx.fill();
    ctx.font = '600 36px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ddf69a';
    if (label.userData.gameMaster) {
      ctx.save();
      ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#30200ff5'; ctx.strokeStyle = '#ffd978'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(8, 76, 496, 80, 24); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = '700 16px "DM Sans", sans-serif'; ctx.fillStyle = '#ffe8a3';
      ctx.fillText('✦  GAME MASTER  ✦', 256, 94);
      ctx.font = '700 30px "DM Sans", sans-serif'; ctx.fillStyle = '#fff5d1';
      ctx.fillText(name.slice(0, 18), 256, 128, 440);
      ctx.beginPath(); ctx.roundRect(10, 78, 492, 76, 22); ctx.clip();
      const x = (label.userData.shine || 0) * 650 - 100;
      const shine = ctx.createLinearGradient(x - 70, 76, x + 70, 156);
      shine.addColorStop(0, '#ffffff00'); shine.addColorStop(.5, '#fff4ba66'); shine.addColorStop(1, '#ffffff00');
      ctx.fillStyle = shine; ctx.fillRect(8, 76, 496, 80); ctx.restore();
    } else ctx.fillText(name.slice(0, 18), 256, 117, 460);
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

export function setupChat(send: (text: string) => boolean, focus: () => void) {
  const panel = document.createElement('aside'); panel.id = 'city-chat';
  panel.innerHTML = `<button type="button" id="chat-heading" aria-controls="chat-body"><b>City chat</b><span id="chat-toggle-label"></span></button><div id="chat-body"><div id="chat-messages" role="log" aria-live="polite" aria-label="City chat messages"></div><form id="chat-form"><input id="chat-input" aria-label="Message to the city" placeholder="Say hello, lah…" maxlength="200" required autocomplete="off"><button type="submit">Send</button></form><small id="chat-status" role="status">Connecting to the city…</small></div>`;
  document.getElementById('hud')!.append(panel);
  const input = panel.querySelector<HTMLInputElement>('input')!;
  const messages = panel.querySelector<HTMLElement>('#chat-messages')!;
  const status = panel.querySelector<HTMLElement>('#chat-status')!;
  const heading = panel.querySelector<HTMLButtonElement>('#chat-heading')!;
  const body = panel.querySelector<HTMLElement>('#chat-body')!;
  const toggleLabel = panel.querySelector<HTMLElement>('#chat-toggle-label')!;
  let collapsed = matchMedia('(any-pointer: coarse), (max-width: 600px)').matches, unread = 0;
  try { const saved = localStorage.getItem('lepak-chat-collapsed'); if (saved !== null) collapsed = saved === 'true'; } catch { /* Preference storage is optional. */ }
  function render() {
    body.hidden = collapsed; panel.classList.toggle('chat-collapsed', collapsed);
    heading.setAttribute('aria-expanded', String(!collapsed));
    heading.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} city chat${unread ? `, ${unread} unread messages` : ''}`);
    toggleLabel.textContent = collapsed ? `${unread ? `${unread} new · ` : ''}＋` : '−';
  }
  function expand() { collapsed = false; unread = 0; render(); messages.scrollTop = messages.scrollHeight; }
  heading.onclick = () => {
    if (collapsed) expand(); else { collapsed = true; input.blur(); render(); }
    try { localStorage.setItem('lepak-chat-collapsed', String(collapsed)); } catch { /* Keep working without storage. */ }
  };
  heading.onkeydown = event => event.stopPropagation();
  render();
  input.onfocus = focus;
  input.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') input.blur(); };
  panel.querySelector('form')!.onsubmit = e => {
    e.preventDefault(); const text = input.value.trim(); if (!text) return;
    if (send(text)) { input.value = ''; status.textContent = 'Visible to everyone in this city'; }
    else status.textContent = 'Reconnecting — your message was not sent. Try again when online.';
  };
  return {
    open() { expand(); input.focus(); },
    status(online: boolean) { status.textContent = online ? 'Visible to everyone in this city' : 'Connecting to the city…'; },
    append(name: string, text: string) {
      const row = document.createElement('p'); const author = document.createElement('strong'); author.textContent = `${name}: `;
      row.append(author, document.createTextNode(text)); messages.append(row);
      while (messages.children.length > 50) messages.firstElementChild!.remove();
      if (collapsed) { unread++; render(); }
      else messages.scrollTop = messages.scrollHeight;
    },
  };
}
