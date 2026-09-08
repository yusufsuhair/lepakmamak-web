import * as THREE from 'three';

export function nameTag(name: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 164;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  label.scale.set(3.8, 1.22, 1); label.position.y = 3.15;
  label.userData.drawVoice = (mic: boolean, speaker: boolean) => {
    ctx.clearRect(0, 0, 512, 164);
    ctx.fillStyle = '#173c32ed'; ctx.beginPath(); ctx.roundRect(8, 76, 496, 80, 24); ctx.fill();
    ctx.font = '600 36px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ddf69a';
    ctx.fillText(name.slice(0, 18), 256, 117, 460);
    for (const [x, on, kind] of [[218, mic, 'mic'], [294, speaker, 'speaker']] as const) {
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

export function setupChat(send: (text: string) => boolean, focus: () => void) {
  const panel = document.createElement('aside'); panel.id = 'city-chat';
  panel.innerHTML = `<div id="chat-heading">City chat <span>Click to type</span></div><div id="chat-body"><div id="chat-messages" role="log" aria-live="polite" aria-label="City chat messages"></div><form id="chat-form"><input id="chat-input" aria-label="Message to the city" placeholder="Say hello, lah…" maxlength="200" required autocomplete="off"><button type="submit">Send</button></form><small id="chat-status" role="status">Connecting to the city…</small></div>`;
  document.getElementById('hud')!.append(panel);
  const input = panel.querySelector<HTMLInputElement>('input')!;
  const messages = panel.querySelector<HTMLElement>('#chat-messages')!;
  const status = panel.querySelector<HTMLElement>('#chat-status')!;
  input.onfocus = focus;
  input.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') input.blur(); };
  panel.querySelector('form')!.onsubmit = e => {
    e.preventDefault(); const text = input.value.trim(); if (!text) return;
    if (send(text)) { input.value = ''; status.textContent = 'Visible to everyone in this city'; }
    else status.textContent = 'Reconnecting — your message was not sent. Try again when online.';
  };
  return {
    open() { input.focus(); },
    status(online: boolean) { status.textContent = online ? 'Visible to everyone in this city' : 'Connecting to the city…'; },
    append(name: string, text: string) {
      const row = document.createElement('p'); const author = document.createElement('strong'); author.textContent = `${name}: `;
      row.append(author, document.createTextNode(text)); messages.append(row);
      while (messages.children.length > 50) messages.firstElementChild!.remove();
      messages.scrollTop = messages.scrollHeight;
    },
  };
}
