import './style.css';
import * as THREE from 'three';
import { createWorld, createPerson, createBike } from './world';
import { moveWithCollisions, safeDismount, dampAngle, overlaps } from './physics';
import type { Solid } from './physics';
import { DeliveryMission, PICKUP, DELIVERY } from './mission';
import { auth, session, displayName, setupAuth } from './auth';
import { nameTag, setupChat } from './social';
import { setupVoice } from './voice';

// Suppress native selection menus without interfering with player context menus or text entry.
for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
  document.addEventListener(type, event => {
    if (!(event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]'))) event.preventDefault();
  });
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
$('app').innerHTML = `
  <div id="loading"><strong>LEPAKMAMAK</strong><p>Setting the tables. Warming up the kapcai.</p></div>
  <audio id="background-music" src="/background-short.mp3" loop preload="auto" aria-hidden="true"></audio>
  <canvas id="world" aria-label="Interactive 3D Kuala Lumpur game world"></canvas>
  <section id="intro" aria-label="Welcome to LepakMamak">
    <div class="intro-top"><div class="brand"><span class="brand-mark">L</span> LEPAKMAMAK</div><div class="place-tag"><i class="live-dot"></i>KUALA LUMPUR, MALAYSIA</div></div>
    <div class="intro-copy"><div class="eyebrow intro-kicker">Your mamak. Your geng. Your cerita.</div><h1>LEPAK<span>MAMAK.</span></h1><p class="tagline">Good food. Good friends. A little chaos.</p><p class="intro-description">The teh tarik is hot. The streets are yours.<br>Grab your kapcai and find your own way<br>through a little slice of Kuala Lumpur.</p><button class="primary" id="start">Jom, let's go <span class="arrow">↗</span></button><div class="intro-hint"><kbd>Enter</kbd> to hit the streets <span>·</span> Best with a keyboard</div></div>
    <div class="intro-bottom"><p>A small open world. A big Malaysian heart.</p><div class="postcard"><i class="postcard-line"></i><div><strong>Somewhere in Kuala Lumpur</strong><span>Late afternoon · no rush, lah.</span></div></div></div>
  </section>
  <section id="hud" aria-label="Game information" hidden>
    <div class="hud-top"><div class="hud-left"><div class="game-brand">LEPAK<span>MAMAK.</span></div><div class="hud-divider"></div><div class="district"><strong id="district">Kampung Maju</strong><small id="weather-label">17:42 · Golden hour</small></div></div><div class="hud-right"><div id="multiplayer-status" class="multiplayer-status"><i></i><span id="multiplayer-status-text">SOLO MODE</span><b id="player-count">1 / 24</b></div><div class="wallet"><small>IN YOUR POCKET</small><strong id="money">RM 0</strong></div><button class="menu-btn" id="menu" aria-label="Open settings"><span></span><span></span></button></div></div>
    <aside id="mission-card"><div class="mission-label"><span id="mission-status">YOUR FIRST JOB</span><span>RM 25</span></div><h2 id="mission-title">Mamak run</h2><p id="mission-description">Uncle has an order ready. Head to the counter at Mamak Maju.</p><div class="mission-footer"><span id="mission-step">01 / PICK UP</span><span id="mission-distance">5 m away</span></div></aside>
    <div id="minimap-wrap"><button type="button" id="open-map" class="map-frame" aria-label="Open city map" aria-haspopup="dialog"><canvas id="minimap" width="364" height="332" aria-label="Map showing your location and delivery destination"></canvas><span class="map-north">N ↑ · M</span></button><div class="map-caption"><span id="map-area">KAMPUNG MAJU</span><span>● YOU &nbsp; ◆ JOB</span></div></div>
    <div id="interaction" hidden><kbd>Enter</kbd><span id="interaction-text"></span></div>
    <div id="controls-bar"><div class="control"><kbd>W A S D</kbd><span id="move-label">Move</span></div><div class="control"><kbd id="action-key">Shift</kbd><span id="action-label">Run</span></div><div class="control"><kbd>Space</kbd><span>Jump / brake</span></div><div class="control"><kbd>Drag</kbd><span>Look</span></div><div class="control"><kbd>Esc</kbd><span>Settings</span></div><button id="desktop-recall" class="recall-button" type="button"><span>RECALL</span><kbd>R</kbd></button></div>
    <div id="speedometer"><div><span class="speed-number" id="speed">00</span><span class="speed-unit">KM/H</span></div><div class="speed-track"><div id="speed-fill"></div></div><div class="vehicle-label" id="vehicle-label">ON FOOT · TAKE IT EASY</div></div>
    <div id="destination-label" hidden><span id="beacon-text">MAMAK MAJU</span><b></b></div>
    <div id="touch-controls" hidden><div class="touch-pad"><button data-key="KeyW" aria-label="Move forward">↑</button><button data-key="KeyA" aria-label="Turn left">←</button><button data-key="KeyS" aria-label="Move backward">↓</button><button data-key="KeyD" aria-label="Turn right">→</button></div><div class="touch-actions"><button id="touch-interact">INTERACT</button><button data-key="Space" aria-label="Brake">BRAKE</button><button id="touch-recall" class="recall-button" type="button" aria-label="Spam recall emote">RECALL</button></div></div>
  </section>
  <div id="toast" role="status" aria-live="polite" hidden></div>
  <section id="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><div class="pause-panel"><div class="eyebrow">Ambil rehat dulu</div><h2 id="pause-title">Lepak a little.</h2><p>The city keeps moving while you adjust your settings.</p><button class="primary" id="resume">Back to the streets <span class="arrow">↗</span></button><div class="settings"><label>Rain over KL<input id="rain-toggle" type="checkbox" /></label><label>Music & city sounds<input id="sound-toggle" type="checkbox" checked /></label><label>Detailed shadows<input id="shadow-toggle" type="checkbox" checked /></label></div><button class="secondary" id="reset">Return to Mamak Maju</button><div class="pause-controls"><b>W A S D / arrows</b><span>Move or drive</span><b>Shift</b><span>Run on foot</span><b>Space</b><span>Jump on foot / brake on bike</span><b>Enter</b><span>Sit, stand, ride, get off or interact</span><b>R</b><span>Send a recall emote</span><b>Click / tap world</b><span>Punch on foot</span><b>Drag / scroll</b><span>Look around / camera distance</span><b>M</b><span>Open or close city map</span><b>C</b><span>Centre camera</span><b>Esc</b><span>Open or close settings</span></div></div></section>
  <dialog id="city-map" aria-labelledby="city-map-title"><header><div><div class="eyebrow">LEPAKMAMAK · LIVE MAP</div><h2 id="city-map-title">Know your streets.</h2></div><button id="close-map" type="button" aria-label="Close city map">Close ×</button></header><canvas id="expanded-map" width="1024" height="1024" aria-label="Full city map with your location, friends, motorbike and delivery route"></canvas><footer><span>▲ You &nbsp; ● Friends &nbsp; ◆ Job &nbsp; <span class="map-bike-key">● Bike</span></span><span>M / Esc to close · City stays live</span></footer></dialog>
  <div id="player-options" role="menu" aria-label="Player options" hidden><button id="view-profile" type="button" role="menuitem">View profile</button></div>
  <dialog id="player-profile" aria-labelledby="profile-title"><h2 id="profile-title">Player profile</h2><p id="profile-name"></p><button id="close-profile" type="button">Close</button></dialog>
  <div id="error" hidden><h2>Couldn't open the streets.</h2><p id="error-message"></p><button class="primary" id="reload">Try again</button></div>
`;

$('reload').onclick = () => location.reload();
const backgroundMusic = $<HTMLAudioElement>('background-music');
backgroundMusic.volume = .22;
backgroundMusic.loop = true;
function fail(message: string) { $('loading').hidden = true; $('error-message').textContent = message; $('error').hidden = false; }

async function init() {
  await document.fonts.ready;
  const canvas = $<HTMLCanvasElement>('world');
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch { fail('This game needs WebGL. Try a recent browser with hardware acceleration enabled.'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail('The graphics connection was interrupted. Reload to return to the city. Your earned money is saved.'); });
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#d6decd'); scene.fog = new THREE.Fog('#d6decd', 145, 440);
  scene.add(new THREE.HemisphereLight('#f6edcf', '#758b75', 1.8));
  const sun = new THREE.DirectionalLight('#ffdfa3', 2.7); sun.position.set(-70, 110, 60); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -90; sun.shadow.camera.right = 90; sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = .5; sun.shadow.camera.far = 320; sun.shadow.normalBias = .12; sun.shadow.bias = -.00015; scene.add(sun); scene.add(sun.target);
  const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, .1, 600);
  const world = createWorld(scene);
  const player = createPerson(); scene.add(player.group);
  const bike = createBike(); scene.add(bike.group);
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('lepak-city-save') || '{}') || {}; } catch { /* A damaged or unavailable save doesn't stop the game. */ }
  const mission = new DeliveryMission(saved);
  const pos = new THREE.Vector3(-18, .12, 52); let yaw = Math.PI;
  let bikeYaw = Math.PI; bike.group.position.set(-6.5, .09, 54); bike.group.rotation.y = bikeYaw;
  let riding = false, started = false, paused = false, speed = 0, walkSpeed = 0, elapsed = 0;
  const cityMap = $<HTMLDialogElement>('city-map');
  function setMap(open: boolean) {
    keys.clear(); dragging = false;
    if (open && started && !paused) { cityMap.showModal(); drawMap(true); $('close-map').focus(); }
    else { cityMap.close(); canvas.focus(); }
  }
  $('open-map').onclick = () => setMap(true);
  $('close-map').onclick = () => setMap(false);
  cityMap.addEventListener('cancel', event => { event.preventDefault(); setMap(false); });
  cityMap.addEventListener('click', event => { if (event.target === cityMap) { const rect = cityMap.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setMap(false); } });
  let seated = false;
  const standPosition = new THREE.Vector3();
  let jumpHeight = 0, jumpVelocity = 0;
  function jump() {
    if (!started || paused || seated || riding || jumpHeight > 0 || jumpVelocity > 0) return;
    jumpVelocity = 6.5;
  }
  let orbit = 0, cameraHeading = Math.PI, zoom = 9, cameraPitch = .35;
  let dragging = false, lastX = 0, lastY = 0, toastRemaining = 0, simTime = 0;
  let audioEnabled = true, rainEnabled = false;
  type NetworkPlayer = { id: string; name: string; color: string; x: number; z: number; yaw: number; riding: boolean; speed: number; seated?: boolean; jumpHeight?: number };
  type RemotePlayer = { group: THREE.Group; target: THREE.Vector3; yaw: number; targetYaw: number; riding: boolean; speed: number; seated: boolean; recallUntil: number; person: ReturnType<typeof createPerson>; punchUntil: number };
  const remotePlayers = new Map<string, RemotePlayer>();
  const speechBubbles = new Map<string, { element: HTMLDivElement; expiresAt: number }>();
  const speechPosition = new THREE.Vector3();
  function clearSpeechBubbles() {
    for (const bubble of speechBubbles.values()) bubble.element.remove();
    speechBubbles.clear();
  }
  function showSpeechBubble(id: string, name: string, text: string) {
    if (id !== networkPlayerId && !remotePlayers.has(id)) return;
    speechBubbles.get(id)?.element.remove();
    const element = document.createElement('div'); element.className = 'speech-bubble'; element.hidden = true;
    element.setAttribute('aria-hidden', 'true'); // The chat log already announces messages.
    const author = document.createElement('strong'); author.textContent = name;
    const message = document.createElement('span'); message.textContent = text;
    element.append(author, message); $('hud').append(element);
    speechBubbles.set(id, { element, expiresAt: performance.now() + 6500 });
  }
  let localName: THREE.Sprite | null = null;
  const chat = setupChat(text => {
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN) return false;
    networkSocket.send(JSON.stringify({ type: 'chat', text })); return true;
  }, () => keys.clear());
  let networkSocket: WebSocket | null = null;
  let networkPlayerId = '';
  let networkConnected = false;
  let networkSendTimer = 0;
  let networkReconnectTimer: number | null = null;
  let recallUntil = 0, punchUntil = 0, punchCount = 0;
  function punch() {
    if (!started || paused || cityMap.open || seated || riding || punchUntil > simTime) return;
    punchUntil = simTime + .38; punchCount++;
    if (networkConnected && networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'punch' }));
  }
  function punchPose(person: ReturnType<typeof createPerson>, until: number) {
    const remaining = until - simTime;
    if (remaining > 0) person.rightArm.rotation.x = -1.85 * Math.sin(Math.PI * (1 - remaining / .38));
  }
  const multiplayerEndpoint = (import.meta.env.VITE_MULTIPLAYER_URL as string | undefined)?.trim().replace(/\/$/, '') || '';
  const roomName = (new URLSearchParams(location.search).get('room') || 'kampung').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'kampung';
  const keys = new Set<string>();
  const touch = matchMedia('(pointer: coarse)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('touch-controls').hidden = !touch;
  if (touch) { $('controls-bar').hidden = true; document.querySelector('.intro-hint')!.textContent = 'Touch controls included · landscape recommended'; }
  player.group.position.copy(pos); player.group.rotation.y = yaw;

  const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.7, 48), new THREE.MeshBasicMaterial({ color: '#d9f993', side: THREE.DoubleSide, transparent: true, opacity: .92, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .15; scene.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 5, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#d9f993', transparent: true, opacity: .11, side: THREE.DoubleSide, depthWrite: false })); scene.add(beam);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.44), new THREE.MeshStandardMaterial({ color: '#dafa8e', emissive: '#94bd4a', emissiveIntensity: .45 })); scene.add(diamond);
  const rainCount = 1100;
  const rainPositions = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainCount; i++) { const j = i * 6; rainPositions[j] = (Math.random() - .5) * 85; rainPositions[j + 1] = Math.random() * 45; rainPositions[j + 2] = (Math.random() - .5) * 85; }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#d7e5de', transparent: true, opacity: .45 })); rain.visible = false; rain.frustumCulled = false; scene.add(rain);

  let audioContext: AudioContext | null = null, engine: OscillatorNode | null = null, engineGain: GainNode | null = null;
  function ensureAudio() {
    if (!audioEnabled) return;
    try {
      if (!audioContext) {
        audioContext = new AudioContext(); engine = audioContext.createOscillator(); engine.type = 'triangle';
        engineGain = audioContext.createGain(); engineGain.gain.value = 0; engine.connect(engineGain); engineGain.connect(audioContext.destination); engine.start();
      }
      if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
    } catch { audioEnabled = false; $<HTMLInputElement>('sound-toggle').checked = false; }
  }
  function startBackgroundMusic() {
    if (!audioEnabled) return;
    void backgroundMusic.play().catch(() => {
      // Browsers can still reject playback when the user starts with the keyboard.
      // The next user interaction will try again without interrupting the game.
    });
  }
  function chime(success = false) {
    ensureAudio(); if (!audioContext || !audioEnabled) return;
    for (let i = 0; i < (success ? 3 : 1); i++) {
      const o = audioContext.createOscillator(), gain = audioContext.createGain(); o.connect(gain); gain.connect(audioContext.destination);
      const time = audioContext.currentTime + i * .12; o.frequency.value = [523, 659, 784][i]; gain.gain.setValueAtTime(.035, time); gain.gain.exponentialRampToValueAtTime(.001, time + .23); o.start(time); o.stop(time + .25);
    }
  }
  function toast(title: string, body: string, seconds = 4) {
    $('toast').replaceChildren(); const strong = document.createElement('strong'); strong.textContent = title; $('toast').append(strong, document.createTextNode(body)); $('toast').hidden = false; toastRemaining = seconds;
  }
  function save() { try { localStorage.setItem('lepak-city-save', JSON.stringify(mission.save())); } catch { toast('Delivery saved for this session', 'Browser storage is unavailable, so earnings may not survive a reload.'); } }
  function setNetworkStatus(label: string, state: 'solo' | 'connecting' | 'online' | 'offline', count = 1) {
    chat.status(state === 'online');
    const status = $('multiplayer-status'); status.dataset.state = state;
    $('multiplayer-status-text').textContent = label;
    $('player-count').textContent = `${count} / 24`;
  }
  function makeRemotePlayer(player: NetworkPlayer) {
    const group = new THREE.Group();
    group.userData.profileName = player.name;
    const person = createPerson(player.color || '#72c8ba');
    person.group.scale.setScalar(.92); group.add(person.group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .73, 24), new THREE.MeshBasicMaterial({ color: player.color || '#72c8ba', side: THREE.DoubleSide, transparent: true, opacity: .8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .04; group.add(ring);
    group.add(nameTag(player.name));
    group.position.set(player.x, .12, player.z); scene.add(group);
    return { group, target: new THREE.Vector3(player.x, .12, player.z), yaw: player.yaw, targetYaw: player.yaw, riding: player.riding, speed: player.speed, seated: !!player.seated, recallUntil: 0, person, punchUntil: 0 };
  }
  function syncRemotePlayers(players: NetworkPlayer[]) {
    const visibleIds = new Set<string>();
    for (const remote of players) {
      if (!remote.id || remote.id === networkPlayerId) continue;
      visibleIds.add(remote.id);
      let entity = remotePlayers.get(remote.id);
      if (!entity) { entity = makeRemotePlayer(remote); remotePlayers.set(remote.id, entity); }
      entity.target.set(remote.x, (remote.seated ? -.22 : .12) + (remote.jumpHeight || 0), remote.z); entity.targetYaw = remote.yaw; entity.riding = remote.riding; entity.speed = remote.speed; entity.seated = !!remote.seated;
    }
    for (const [id, entity] of remotePlayers) {
      if (visibleIds.has(id)) continue;
      disposeRemote(entity); remotePlayers.delete(id);
    }
    setNetworkStatus(networkConnected ? 'CITY ONLINE' : multiplayerEndpoint ? 'RECONNECTING' : 'SOLO MODE', networkConnected ? 'online' : multiplayerEndpoint ? 'connecting' : 'solo', players.length || 1);
  }
  const voice = setupVoice(message => {
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN || networkSocket.bufferedAmount > 65536) return false;
    networkSocket.send(JSON.stringify(message)); return true;
  });
  function disconnectMultiplayer() {
    voice.connected(false);
    clearSpeechBubbles();
    if (networkReconnectTimer !== null) { window.clearTimeout(networkReconnectTimer); networkReconnectTimer = null; }
    const oldSocket = networkSocket; networkSocket = null;
    oldSocket?.close(1000, 'Leaving the city');
    networkConnected = false; networkPlayerId = '';
    for (const entity of remotePlayers.values()) disposeRemote(entity);
    remotePlayers.clear();
  }
  function disposeRemote(entity: RemotePlayer) {
    entity.group.traverse(object => { if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose(); } });
    entity.group.removeFromParent();
  }
  function retryMultiplayer() {
    if (!started || !multiplayerEndpoint || networkReconnectTimer !== null) return;
    networkReconnectTimer = window.setTimeout(() => { networkReconnectTimer = null; connectMultiplayer(); }, 2500);
  }
  async function connectMultiplayer() {
    if (!multiplayerEndpoint) { setNetworkStatus('SOLO MODE', 'solo', 1); return; }
    setNetworkStatus('CONNECTING…', 'connecting', 1);
    try {
      const accessToken = auth ? (await auth.auth.getSession()).data.session?.access_token : undefined;
      if (!started) return;
      const endpoint = multiplayerEndpoint.startsWith('ws') ? multiplayerEndpoint : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${multiplayerEndpoint}`;
      const socket = new WebSocket(`${endpoint}/ws`); networkSocket = socket;
      socket.addEventListener('open', () => {
        if (socket !== networkSocket) return;
        socket.send(JSON.stringify({ type: 'join', room: roomName, accessToken }));
      });
      socket.addEventListener('message', event => {
        if (socket !== networkSocket) return;
        let message: { type?: string; id?: string; players?: NetworkPlayer[]; message?: string; name?: string; text?: string; code?: string; audio?: string };
        try { message = JSON.parse(String(event.data)); } catch { return; }
        if (message.type === 'welcome' && message.id) { networkPlayerId = message.id; networkConnected = true; voice.connected(true); }
        if ((message.type === 'welcome' || message.type === 'players') && message.players) syncRemotePlayers(message.players);
        if (message.type === 'punch' && message.id && message.id !== networkPlayerId) { const remote = remotePlayers.get(message.id); if (remote) remote.punchUntil = simTime + .38; }
        if (message.type === 'recall' && message.id && message.id !== networkPlayerId) triggerRecall(message.id);
        if (message.type === 'chat' && typeof message.name === 'string' && typeof message.text === 'string') {
          chat.append(message.name, message.text);
          if (message.id) showSpeechBubble(message.id, message.name, message.text);
        }
        if (message.type === 'voice-audio' && message.id && typeof message.audio === 'string') voice.receive(message.id, message.name || 'Player', message.audio);
        if (message.type === 'notice') chat.append('City', message.message || 'Please try again.');
        if (message.type === 'error') {
          setNetworkStatus(message.code === 'AUTH_REQUIRED' ? 'LOGIN REQUIRED' : 'UNAVAILABLE', 'offline');
          toast('Could not join', message.message || 'Please try again.');
          if (message.code === 'AUTH_REQUIRED') { leaveCity(); void auth?.auth.signOut({ scope: 'local' }); }
        }
      });
      socket.addEventListener('close', () => { if (socket !== networkSocket) return; voice.connected(false); networkConnected = false; for (const remote of remotePlayers.values()) disposeRemote(remote); remotePlayers.clear(); setNetworkStatus('RECONNECTING…', 'connecting', 1); retryMultiplayer(); });
      socket.addEventListener('error', () => { if (socket !== networkSocket) return; voice.connected(false); networkConnected = false; setNetworkStatus('OFFLINE', 'offline', 1); });
    } catch { setNetworkStatus('OFFLINE · SOLO', 'offline', 1); }
  }
  function sendNetworkState(dt: number) {
    if (!networkConnected || !networkSocket || networkSocket.readyState !== WebSocket.OPEN) return;
    networkSendTimer += dt;
    if (networkSendTimer < .05) return;
    networkSendTimer = 0;
    networkSocket.send(JSON.stringify({ type: 'state', x: pos.x, z: pos.z, yaw, riding, speed, jumpHeight, seated }));
  }
  function recallSound() {
    ensureAudio(); if (!audioContext || !audioEnabled) return;
    const startAt = audioContext.currentTime;
    for (let i = 0; i < 4; i++) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = startAt + i * .13;
      oscillator.type = 'square'; oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(155 + i * 12, at);
      oscillator.frequency.exponentialRampToValueAtTime(315 + i * 10, at + .075);
      gain.gain.setValueAtTime(.045, at); gain.gain.exponentialRampToValueAtTime(.001, at + .115);
      oscillator.start(at); oscillator.stop(at + .13);
    }
  }
  function triggerRecall(remoteId?: string) {
    if (remoteId) {
      const remote = remotePlayers.get(remoteId); if (remote) remote.recallUntil = simTime + .82;
      if (remote && remote.target.distanceTo(pos) < 25) recallSound();
      return;
    }
    if (!started || paused) return;
    recallUntil = simTime + .82; recallSound();
    for (const id of ['desktop-recall', 'touch-recall']) {
      const button = $(id); button.classList.remove('recall-active'); void button.offsetWidth; button.classList.add('recall-active');
      window.setTimeout(() => button.classList.remove('recall-active'), 760);
    }
    toast('BZZ BZZ BZZ BZZ', 'Recall spam activated. Your friends can hear it too.', 2.2);
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'recall' }));
  }
  function setPause(value: boolean) {
    if (!started) return;
    if (value && cityMap.open) setMap(false);
    paused = value; $('pause').hidden = !value; keys.clear(); dragging = false;
    if (value) { $('resume').focus(); }
    else { ensureAudio(); startBackgroundMusic(); canvas.focus(); }
  }
  function start() {
    if (auth && !session) return;
    if (started) return; started = true; $('intro').hidden = true; $('hud').hidden = false;
    ensureAudio(); startBackgroundMusic(); connectMultiplayer(); camera.position.set(pos.x + 2, 5, pos.z + 9); cameraHeading = yaw; updateHud(); canvas.tabIndex = -1; canvas.focus();
    if (!localName && session) { localName = nameTag(displayName()); scene.add(localName); }
  }
  function leaveCity() {
    cityMap.close(); profile.close(); closeOptions();
    started = false; paused = false; keys.clear(); disconnectMultiplayer(); backgroundMusic.pause();
    $('hud').hidden = true; $('pause').hidden = true; $('intro').hidden = false;
    if (localName) { localName.removeFromParent(); localName.material.map?.dispose(); localName.material.dispose(); localName = null; }
  }
  const requestEntry = await setupAuth(start, leaveCity);
  const signout = document.createElement('button'); signout.className = 'secondary'; signout.textContent = 'Log out'; signout.hidden = !auth;
  signout.onclick = async () => { if (auth) { const { error } = await auth.auth.signOut({ scope: 'local' }); if (error) toast('Could not log out', error.message); } };
  document.querySelector('.pause-panel')!.append(signout);
  function reset() {
    seated = false; jumpHeight = 0; jumpVelocity = 0;
    riding = false; speed = 0; walkSpeed = 0; pos.set(-18, .12, 52); yaw = Math.PI; bikeYaw = Math.PI; orbit = 0; cameraHeading = yaw;
    bike.group.position.set(-6.5, .09, 54); bike.group.rotation.set(0, bikeYaw, 0); bike.rider.visible = false; player.group.visible = true;
    camera.position.set(pos.x + 2, 5, pos.z + 9); setPause(false); toast('Back at Mamak Maju', mission.stage === 'delivering' ? 'Your order is still with you. KLCC is north of here.' : 'A fresh start. Your earnings are safe.');
  }
  function distanceTo(point: { x: number; z: number }) { return Math.hypot(pos.x - point.x, pos.z - point.z); }
  function nearbyChair() { return world.chairs.filter(c => distanceTo(c) < 2.2).sort((a, b) => distanceTo(a) - distanceTo(b))[0]; }
  function sitPose(person: ReturnType<typeof createPerson>) { person.leftLeg.rotation.x = person.rightLeg.rotation.x = -Math.PI / 2; person.leftArm.rotation.x = person.rightArm.rotation.x = -.35; }
  function interact() {
    if (!started || paused) return;
    if (jumpHeight > 0 || jumpVelocity > 0) return;
    if (seated) { seated = false; pos.copy(standPosition); keys.clear(); return; }
    const chair = !riding && nearbyChair();
    if (chair) { standPosition.copy(pos); pos.set(chair.x, .12, chair.z); yaw = chair.yaw; seated = true; walkSpeed = 0; keys.clear(); return; }
    if (riding) {
      if (Math.abs(speed) > 1.5) { toast('Slow down dulu', 'Hold Space to brake before getting off.', 2); return; }
      const exit = safeDismount(pos, yaw, world.solids);
      if (!exit) { toast('A little more room', 'Move the bike to an open spot before getting off.', 2); return; }
      riding = false; speed = 0; pos.set(exit.x, .12, exit.z); player.group.visible = true; bike.rider.visible = false; return;
    }
    if (distanceTo(mission.destination) <= 4) {
      const result = mission.interact(distanceTo(mission.destination), riding);
      if (result === 'pickup') { chime(); toast('“Hantar ke KLCC, ya!”', 'Two roti canai and a teh tarik. Your kapcai is parked by the road.', 5); }
      if (result === 'delivered') { save(); chime(true); toast('Terima kasih! + RM 25', 'Delivery complete. Explore the city, or head back to Mamak Maju for another order.', 7); }
      updateHud(); return;
    }
    if (distanceTo(bike.group.position) < 3.8) { riding = true; player.group.visible = false; bike.rider.visible = true; pos.copy(bike.group.position); yaw = bikeYaw; speed = 0; orbit = 0; chime(); }
  }
  $('start').onclick = requestEntry; $('menu').onclick = () => setPause(true); $('resume').onclick = () => setPause(false); $('reset').onclick = reset; $('touch-interact').onclick = interact; $('touch-recall').onclick = () => triggerRecall(); $('desktop-recall').onclick = () => triggerRecall();
  $<HTMLInputElement>('rain-toggle').onchange = event => {
    rainEnabled = (event.target as HTMLInputElement).checked; rain.visible = rainEnabled;
    const color = rainEnabled ? '#adbeb8' : '#d6decd'; scene.background = new THREE.Color(color); (scene.fog as THREE.Fog).color.set(color);
    sun.intensity = rainEnabled ? 1.25 : 2.7;
    $('weather-label').textContent = rainEnabled ? '17:42 · Hujan sekejap' : '17:42 · Golden hour';
  };
  $<HTMLInputElement>('sound-toggle').onchange = event => { audioEnabled = (event.target as HTMLInputElement).checked; if (audioEnabled) { ensureAudio(); startBackgroundMusic(); } else { backgroundMusic.pause(); } };
  $<HTMLInputElement>('shadow-toggle').onchange = event => { renderer.shadowMap.enabled = (event.target as HTMLInputElement).checked; scene.traverse(obj => { if (obj instanceof THREE.Mesh) { const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach(m => m.needsUpdate = true); } }); };
  const gameKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyR']);
  window.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (!$('auth-panel').hidden) return;
    if (event.code === 'Enter' && !started) { event.preventDefault(); requestEntry(); return; }
    if (profile.open) return;
    if (event.code === 'KeyM' && started && !paused && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); if (!event.repeat) setMap(!cityMap.open); return; }
    if (cityMap.open) { if (event.code === 'Escape') { event.preventDefault(); setMap(false); } return; }
    if (event.code === 'Escape') { event.preventDefault(); setPause(!paused); return; }
    if (paused && event.code === 'Tab') {
      const focusable = Array.from($('pause').querySelectorAll<HTMLElement>('button, input'));
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)!.focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
      return;
    }
    if (!started || paused || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) interact(); return; }
    if (gameKeys.has(event.code)) event.preventDefault();
    if (event.code === 'Space' && !event.repeat) jump();
    if (event.code === 'KeyR' && !event.repeat) triggerRecall();
    if (event.code === 'KeyC') { orbit = 0; cameraPitch = .35; }
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('beforeunload', disconnectMultiplayer);
  window.addEventListener('blur', () => { keys.clear(); dragging = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); dragging = false; } });
  const options = $('player-options');
  const profile = $<HTMLDialogElement>('player-profile');
  let selectedName = '';
  function closeOptions() { options.hidden = true; }
  function openPlayerOptions(x: number, y: number) {
    closeOptions();
    if (!started || paused || cityMap.open || profile.open) return;
    const rect = canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), camera);
    const own = riding ? bike.rider : player.group;
    own.userData.profileName = displayName();
    if (localName) localName.userData.profileName = displayName();
    const targets = [own, ...Array.from(remotePlayers.values(), p => p.group), ...(localName ? [localName] : [])];
    const hit = ray.intersectObjects(targets, true)[0];
    if (!hit) return;
    let object: THREE.Object3D | null = hit.object;
    while (object && typeof object.userData.profileName !== 'string') object = object.parent;
    if (!object) return;
    selectedName = object.userData.profileName;
    keys.clear(); dragging = false;
    options.hidden = false;
    options.style.left = `${Math.max(8, Math.min(x, innerWidth - options.offsetWidth - 8))}px`;
    options.style.top = `${Math.max(8, Math.min(y, innerHeight - options.offsetHeight - 8))}px`;
    $('view-profile').focus();
  }
  $('view-profile').onclick = () => { closeOptions(); $('profile-name').textContent = selectedName; profile.showModal(); $('close-profile').focus(); };
  $('close-profile').onclick = () => { profile.close(); canvas.focus(); };
  profile.addEventListener('cancel', event => { event.preventDefault(); profile.close(); canvas.focus(); });
  document.addEventListener('pointerdown', event => { if (!options.contains(event.target as Node)) closeOptions(); });
  options.addEventListener('keydown', event => { if (event.key === 'Escape' || event.key === 'Tab') { closeOptions(); canvas.focus(); event.preventDefault(); event.stopPropagation(); } });
  canvas.addEventListener('contextmenu', event => { event.preventDefault(); openPlayerOptions(event.clientX, event.clientY); });
  let pointerId: number | null = null, pointerX = 0, pointerY = 0, pointerAt = 0, pointerMoved = false, touchPointer = false;
  canvas.addEventListener('pointerdown', event => {
    if (!started || paused || cityMap.open || !event.isPrimary || event.button !== 0) return;
    touchPointer = event.pointerType === 'touch';
    canvas.focus(); dragging = true; pointerId = event.pointerId; pointerX = lastX = event.clientX; pointerY = lastY = event.clientY; pointerAt = performance.now(); pointerMoved = false; canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== pointerId) return;
    if (Math.hypot(event.clientX - pointerX, event.clientY - pointerY) > 10) pointerMoved = true;
    orbit -= (event.clientX - lastX) * .005; cameraPitch = THREE.MathUtils.clamp(cameraPitch + (event.clientY - lastY) * .004, -.15, .95); lastX = event.clientX; lastY = event.clientY;
  });
  canvas.addEventListener('pointerup', event => {
    if (event.pointerId !== pointerId) return;
    const tap = dragging && !pointerMoved && Math.hypot(event.clientX - pointerX, event.clientY - pointerY) <= 10 && performance.now() - pointerAt < 350;
    const longPress = dragging && touchPointer && !pointerMoved && performance.now() - pointerAt >= 500;
    dragging = false; pointerId = null;
    if (longPress) openPlayerOptions(event.clientX, event.clientY);
    if (tap) punch();
  });
  const endDrag = () => { dragging = false; pointerId = null; };
  canvas.addEventListener('pointercancel', endDrag); canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('wheel', event => { if (!started || paused) return; event.preventDefault(); zoom = THREE.MathUtils.clamp(zoom + event.deltaY * .01, 5, 17); }, { passive: false });
  document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(button => {
    button.addEventListener('pointerdown', event => { event.preventDefault(); if (paused) return; button.setPointerCapture(event.pointerId); if (button.dataset.key === 'Space') jump(); keys.add(button.dataset.key!); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => keys.delete(button.dataset.key!));
  });
  window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  function drawMap(expanded = false) {
    const map = $<HTMLCanvasElement>(expanded ? 'expanded-map' : 'minimap'); const ctx = map.getContext('2d')!;
    const w = map.width, h = map.height, scale = expanded ? w / 340 : 1.06;
    ctx.fillStyle = '#294b3f'; ctx.fillRect(0, 0, w, h); ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(scale, scale);
    ctx.fillStyle = '#395b44'; ctx.fillRect(-62, -147, 124, 67);
    ctx.fillStyle = '#82907a';
    for (const x of [0, 76, -82]) ctx.fillRect(x - 8.5, -157, 17, 314);
    for (const z of [-64, 8, 78]) ctx.fillRect(-157, z - 8.5, 314, 17);
    for (const b of world.mapBuildings) { ctx.fillStyle = '#4d6c56'; ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d); }
    ctx.strokeStyle = '#d6f28d'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath();
    ctx.moveTo(pos.x, pos.z);
    if (mission.stage === 'delivering') { ctx.lineTo(-3, pos.z); ctx.lineTo(-3, DELIVERY.z); ctx.lineTo(DELIVERY.x, DELIVERY.z); }
    else ctx.lineTo(PICKUP.x, PICKUP.z);
    ctx.stroke(); ctx.setLineDash([]);
    for (const [point, color] of [[PICKUP, '#e4b87b'], [DELIVERY, '#a4b79a']] as const) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(point.x, point.z, 3, 0, Math.PI * 2); ctx.fill(); }
    const d = mission.destination; ctx.fillStyle = '#e5ff9f'; ctx.save(); ctx.translate(d.x, d.z); ctx.rotate(Math.PI / 4); ctx.fillRect(-3.8, -3.8, 7.6, 7.6); ctx.restore();
    if (!riding) { ctx.fillStyle = '#5ed7c3'; ctx.beginPath(); ctx.arc(bike.group.position.x, bike.group.position.z, 2.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.translate(pos.x, pos.z); ctx.rotate(-yaw); ctx.fillStyle = '#fff9db'; ctx.strokeStyle = '#274735'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(-5, -5); ctx.lineTo(0, -2); ctx.lineTo(5, -5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#d3dfba'; ctx.font = '600 9px "DM Sans"'; ctx.textAlign = 'center'; ctx.fillText('KLCC', 0, -138);
    if (expanded) {
      ctx.fillText('MAMAK MAJU', PICKUP.x, PICKUP.z + 14);
      ctx.fillText('N ↑', 140, -145);
      for (const remote of remotePlayers.values()) { ctx.fillStyle = '#e4b87b'; ctx.beginPath(); ctx.arc(remote.group.position.x, remote.group.position.z, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  function updateHud() {
    const jumpButton = document.querySelector<HTMLButtonElement>('.touch-actions [data-key="Space"]')!;
    jumpButton.textContent = riding ? 'BRAKE' : 'JUMP'; jumpButton.setAttribute('aria-label', riding ? 'Brake' : 'Jump');
    $('money').textContent = `RM ${mission.money.toLocaleString()}`;
    const delivery = mission.stage === 'delivering', complete = mission.stage === 'complete';
    $('mission-status').textContent = delivery ? 'ORDER ON BOARD' : complete ? 'NICELY DONE' : 'YOUR FIRST JOB';
    $('mission-title').textContent = delivery ? 'Roti to the towers' : complete ? 'The city is yours' : 'Mamak run';
    $('mission-description').textContent = delivery ? 'Take the order to the KLCC entrance. Park up and deliver it on foot.' : complete ? 'RM 25 earned. Go explore, or return to the mamak for another delivery.' : 'Uncle has an order ready. Collect it at Mamak Maju, then find your kapcai.';
    $('mission-step').textContent = delivery ? '02 / DELIVER' : complete ? 'FREE ROAM / NEXT JOB' : '01 / PICK UP';
    $('mission-distance').textContent = `${Math.round(distanceTo(mission.destination))} m away`;
    $('beacon-text').textContent = delivery ? 'KLCC · DROP OFF' : 'MAMAK MAJU';
    const area = pos.z < -74 ? 'KLCC Park' : pos.z < 9 ? 'Jalan Lepak' : 'Kampung Maju';
    $('district').textContent = area; $('map-area').textContent = area.toUpperCase();
    $('move-label').textContent = riding ? 'Drive' : 'Move'; $('action-key').textContent = riding ? 'Space' : 'Shift'; $('action-label').textContent = riding ? 'Brake' : 'Run';
    const kmh = Math.round(Math.abs(riding ? speed : walkSpeed) * 3.6);
    $('speed').textContent = String(kmh).padStart(2, '0'); $('speed-fill').style.width = `${Math.min(100, kmh / 72 * 100)}%`;
    $('vehicle-label').textContent = riding ? 'MAJU 110 · KAPCAI' : 'ON FOOT · TAKE IT EASY';
    let hint = '';
    if (riding) hint = Math.abs(speed) < 1.5 ? 'Get off your kapcai' : '';
    else if (distanceTo(mission.destination) < 4) hint = delivery ? 'Deliver the order' : complete ? 'Pick up another order' : 'Collect the order';
    else if (distanceTo(bike.group.position) < 3.8) hint = 'Ride your kapcai';
    if (seated) hint = 'Stand up'; else if (!riding && nearbyChair()) hint = 'Sit at the mamak';
    $('interaction').hidden = !hint; $('interaction-text').textContent = hint;
    $('touch-interact').textContent = seated ? 'STAND' : nearbyChair() && !riding ? 'SIT' : riding ? 'GET OFF' : distanceTo(mission.destination) < 4 ? delivery ? 'DELIVER' : 'PICK UP' : 'RIDE';
    drawMap();
    if (cityMap.open) drawMap(true);
  }

  const desiredCamera = new THREE.Vector3(); const target = new THREE.Vector3(); const projected = new THREE.Vector3();
  let hudTimer = 0, lastTime = performance.now();
  function frame(time: number) {
    const dt = Math.min((time - lastTime) / 1000, .04); lastTime = time; elapsed += dt;
    const active = started;
    {
      simTime += dt;
      for (const car of world.traffic) {
        const coordinate = car.axis; const old = car[coordinate];
        const ahead = new THREE.Vector3(car.x, 0, car.z); ahead[coordinate] += car.direction * 5;
        const nearPlayer = started && Math.hypot(ahead.x - pos.x, ahead.z - pos.z) < 3.6;
        // Stagger crossing traffic and stop before entering the player's space.
        const crossing = car.axis === 'x' && Math.abs(car.x) < 13 && Math.abs(car.x) > 8 && Math.sin(simTime * .2) < 0;
        if (!nearPlayer && !crossing) car[coordinate] += car.speed * car.direction * dt;
        if (car[coordinate] > 150) car[coordinate] = -150; if (car[coordinate] < -150) car[coordinate] = 150;
        if (started && Math.hypot(car.x - pos.x, car.z - pos.z) < 2.5) car[coordinate] = old;
        car.group.position.set(car.x, 0, car.z);
      }
      for (const ped of world.pedestrians) {
        const t = simTime * .12 + ped.phase;
        const offset = Math.sin(t) * ped.range;
        ped.person.group.position.set(ped.startX + (ped.axis === 'x' ? offset : 0), .1, ped.startZ + (ped.axis === 'z' ? offset : 0));
        ped.person.group.rotation.y = ped.axis === 'x' ? Math.cos(t) > 0 ? Math.PI / 2 : -Math.PI / 2 : Math.cos(t) > 0 ? 0 : Math.PI;
        ped.person.leftLeg.rotation.x = Math.sin(simTime * 6 + ped.phase) * .35; ped.person.rightLeg.rotation.x = -ped.person.leftLeg.rotation.x;
        ped.person.leftArm.rotation.x = -ped.person.leftLeg.rotation.x * .65; ped.person.rightArm.rotation.x = ped.person.leftLeg.rotation.x * .65;
      }
      for (const remote of remotePlayers.values()) {
        remote.group.position.lerp(remote.target, 1 - Math.exp(-14 * dt));
        remote.yaw = dampAngle(remote.yaw, remote.targetYaw, 1 - Math.exp(-12 * dt));
        remote.group.rotation.y = remote.yaw;
        remote.person.leftLeg.rotation.x = remote.person.rightLeg.rotation.x = remote.person.leftArm.rotation.x = remote.person.rightArm.rotation.x = 0;
        if (remote.seated) sitPose(remote.person);
        if (!remote.riding) punchPose(remote.person, remote.punchUntil);
        const recallProgress = remote.recallUntil > simTime ? 1 - (remote.recallUntil - simTime) / .82 : 0;
        remote.group.scale.setScalar(recallProgress > 0 ? 1 + Math.sin(recallProgress * Math.PI) * .16 : 1);
      }
    }
    if (active) {
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const turn = Number(keys.has('KeyA') || keys.has('ArrowLeft')) - Number(keys.has('KeyD') || keys.has('ArrowRight'));
      const dynamicSolids: Solid[] = world.traffic.map(car => ({ x: car.x, z: car.z, hx: car.axis === 'z' ? 1 : 1.9, hz: car.axis === 'z' ? 1.9 : 1 }));
      const solids = [...world.solids, ...dynamicSolids];
      if (riding) {
        if (keys.has('Space')) speed = THREE.MathUtils.damp(speed, 0, 6, dt);
        else if (forward) speed += forward * (forward * speed < 0 ? 15 : 6.7) * dt;
        else speed = THREE.MathUtils.damp(speed, 0, 1.1, dt);
        speed = THREE.MathUtils.clamp(speed, -5, 20);
        if (Math.abs(speed) < .025) speed = 0;
        const steering = Math.min(1, Math.abs(speed) / 3) * (1.65 - Math.min(1, Math.abs(speed) / 23) * .65);
        yaw += turn * steering * dt * Math.sign(speed);
        const hit = moveWithCollisions(pos, Math.sin(yaw) * speed * dt, Math.cos(yaw) * speed * dt, .83, solids);
        if (hit) speed *= Math.exp(-9 * dt);
        bikeYaw = yaw; bike.group.position.copy(pos); bike.group.rotation.y = yaw; bike.group.rotation.z = THREE.MathUtils.damp(bike.group.rotation.z, -turn * Math.min(.17, Math.abs(speed) * .012), 6, dt);
        bike.wheels.forEach(wheel => wheel.rotation.x += speed * dt / .4);
        walkSpeed = 0;
      } else if (seated) {
        player.group.position.set(pos.x, -.22, pos.z); player.group.rotation.y = yaw; sitPose(player); walkSpeed = 0;
      } else {
        if (jumpVelocity !== 0 || jumpHeight > 0) {
          jumpVelocity -= 18 * dt; jumpHeight = Math.max(0, jumpHeight + jumpVelocity * dt);
          if (jumpHeight === 0) jumpVelocity = 0;
        }
        const input = new THREE.Vector2(-turn, forward); if (input.length() > 1) input.normalize();
        const running = keys.has('ShiftLeft') || keys.has('ShiftRight'); const maxSpeed = running ? 7 : 3.7;
        walkSpeed = THREE.MathUtils.damp(walkSpeed, input.length() * maxSpeed, 14, dt);
        if (input.length()) {
          const reference = cameraHeading + orbit;
          const dx = Math.sin(reference) * input.y - Math.cos(reference) * input.x;
          const dz = Math.cos(reference) * input.y + Math.sin(reference) * input.x;
          yaw = dampAngle(yaw, Math.atan2(dx, dz), 1 - Math.exp(-14 * dt));
          moveWithCollisions(pos, dx * walkSpeed * dt, dz * walkSpeed * dt, .46, solids);
        }
        player.group.position.copy(pos); player.group.rotation.y = yaw;
        const stride = Math.sin(simTime * (running ? 13 : 9)) * Math.min(.7, walkSpeed * .12);
        player.leftLeg.rotation.x = stride; player.rightLeg.rotation.x = -stride; player.leftArm.rotation.x = -stride * .7; player.rightArm.rotation.x = stride * .7;
        player.group.position.y = .12 + jumpHeight + Math.abs(Math.sin(simTime * 9)) * Math.min(.05, walkSpeed * .008);
      }
      if (mission.stage === 'delivering') mission.elapsed += dt;
      if (!riding) punchPose(player, punchUntil);
      const localRecallProgress = recallUntil > simTime ? 1 - (recallUntil - simTime) / .82 : 0;
      const localRecallScale = localRecallProgress > 0 ? 1 + Math.sin(localRecallProgress * Math.PI) * .16 : 1;
      player.group.scale.setScalar(riding ? 1 : localRecallScale);
      bike.rider.scale.setScalar(riding ? localRecallScale : 1);
      if (toastRemaining > 0) { toastRemaining -= dt; if (toastRemaining <= 0) $('toast').hidden = true; }
      if (riding) cameraHeading = dampAngle(cameraHeading, yaw, 1 - Math.exp(-3 * dt));
      const heading = cameraHeading + orbit;
      const distance = zoom + (riding ? Math.abs(speed) * .07 : 0);
      let cameraDistance = distance;
      // Shorten the camera arm when a building would obscure the player.
      for (let step = 1.5; step < distance; step += .65) {
        const p = { x: pos.x - Math.sin(heading) * step, z: pos.z - Math.cos(heading) * step };
        if (world.solids.some(s => overlaps(p, .35, s))) { cameraDistance = Math.max(1.2, step - .65); break; }
      }
      target.set(pos.x, riding ? 2 : 1.6, pos.z);
      desiredCamera.set(pos.x - Math.sin(heading) * cameraDistance, Math.max(.75, target.y + cameraDistance * cameraPitch), pos.z - Math.cos(heading) * cameraDistance);
      camera.position.lerp(desiredCamera, 1 - Math.exp(-9 * dt)); camera.lookAt(target);
      sun.position.set(pos.x - 70, 110, pos.z + 60); sun.target.position.set(pos.x, 0, pos.z);
      if (rainEnabled) {
        rain.position.set(pos.x, 0, pos.z);
        for (let i = 0; i < rainCount; i++) {
          const j = i * 6; rainPositions[j + 1] -= dt * 23;
          if (rainPositions[j + 1] < 0) rainPositions[j + 1] = 45;
          rainPositions[j + 3] = rainPositions[j] + .2; rainPositions[j + 4] = rainPositions[j + 1] - .85; rainPositions[j + 5] = rainPositions[j + 2] + .12;
        }
        rainGeometry.attributes.position.needsUpdate = true;
      }
      sendNetworkState(dt);
    }
    if (!started) {
      const drift = reducedMotion ? 0 : Math.sin(elapsed * .055) * 3;
      camera.position.set(43 + drift, 29, 108); camera.lookAt(-10, 22, -45);
    }
    const destination = mission.destination;
    ring.position.x = beam.position.x = diamond.position.x = destination.x;
    ring.position.z = beam.position.z = diamond.position.z = destination.z;
    beam.position.y = 2.55; diamond.position.y = 3.4 + (reducedMotion ? 0 : Math.sin(simTime * 2) * .18); diamond.rotation.y = simTime * .6;
    if (engineGain && engine && audioContext) {
      engineGain.gain.setTargetAtTime(audioEnabled && active && riding ? .013 + Math.abs(speed) * .0007 : 0, audioContext.currentTime, .1);
      engine.frequency.setTargetAtTime(48 + Math.abs(speed) * 6, audioContext.currentTime, .1);
    }
    hudTimer += dt;
    if (active && hudTimer > .1) { hudTimer = 0; updateHud(); }
    if (started) {
      projected.set(destination.x, 5, destination.z).project(camera);
      const screenX = (projected.x * .5 + .5) * innerWidth;
      const screenY = (-projected.y * .5 + .5) * innerHeight;
      const visible = projected.z < 1 && projected.z > -1 && Math.abs(projected.x) < .94 && screenY > 110 && screenY < innerHeight - 90;
      $('destination-label').hidden = !visible || paused;
      if (visible) { $('destination-label').style.left = `${THREE.MathUtils.clamp(screenX, 85, innerWidth - 85)}px`; $('destination-label').style.top = `${screenY}px`; $('destination-label').style.transform = 'translate(-50%, -100%)'; }
    }
    if (localName) localName.position.set(pos.x, 3.1 + jumpHeight - (seated ? .34 : 0), pos.z);
    camera.updateMatrixWorld();
    const placedBubbles: { left: number; right: number; top: number; bottom: number }[] = [];
    for (const [id, bubble] of speechBubbles) {
      const speaker = id === networkPlayerId ? (riding ? bike.group.position : player.group.position) : remotePlayers.get(id)?.group.position;
      const remaining = bubble.expiresAt - time;
      if (!speaker || remaining <= 0 || !networkConnected) {
        bubble.element.remove(); speechBubbles.delete(id); continue;
      }
      speechPosition.set(speaker.x, speaker.y + 3.8, speaker.z).project(camera);
      bubble.element.hidden = !started || speechPosition.z < -1 || speechPosition.z > 1 || Math.abs(speechPosition.x) > 1 || Math.abs(speechPosition.y) > 1;
      if (!bubble.element.hidden) {
        const width = bubble.element.offsetWidth, height = bubble.element.offsetHeight;
        const x = THREE.MathUtils.clamp((speechPosition.x * .5 + .5) * innerWidth, width / 2 + 8, innerWidth - width / 2 - 8);
        let y = (-speechPosition.y * .5 + .5) * innerHeight;
        // Stack nearby speakers upward so each message remains readable.
        for (let attempt = 0; attempt < placedBubbles.length; attempt++) {
          const overlap = placedBubbles.find(rect => x + width / 2 > rect.left && x - width / 2 < rect.right && y > rect.top - 10 && y - height < rect.bottom + 10);
          if (!overlap) break;
          y = overlap.top - 10;
        }
        bubble.element.hidden = y - height < 8;
        if (bubble.element.hidden) continue;
        placedBubbles.push({ left: x - width / 2, right: x + width / 2, top: y - height, bottom: y });
        bubble.element.style.left = `${x}px`;
        bubble.element.style.top = `${y}px`;
        bubble.element.style.opacity = String(Math.min(1, remaining / 500));
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  // Read-only diagnostics support browser smoke tests without modifying gameplay state.
  if (import.meta.env.DEV) {
    Object.defineProperty(window, '__lepak', { get: () => ({ started, paused, riding, seated, jumpHeight, punchCount, profileScreen: (() => { const p = player.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)).project(camera); return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 }; })(), position: { x: pos.x, z: pos.z }, yaw, speed, mission: mission.stage, money: mission.money, completed: mission.completed, bike: { x: bike.group.position.x, z: bike.group.position.z }, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, simTime, rain: rainEnabled }) });
  }
  $('loading').hidden = true;
  requestAnimationFrame(frame);
}
void init().catch(error => { console.error(error); fail('The city could not finish loading. Please reload and try again.'); });
