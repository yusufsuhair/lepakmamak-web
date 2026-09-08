import * as THREE from 'three';

export function nameTag(name: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#173c32ed'; ctx.beginPath(); ctx.roundRect(8, 8, 496, 80, 24); ctx.fill();
  ctx.font = '600 36px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ddf69a';
  ctx.fillText(name.slice(0, 18), 256, 49, 460);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  label.scale.set(3.8, .71, 1); label.position.y = 2.9;
  return label;
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
