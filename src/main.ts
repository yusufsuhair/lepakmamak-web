import {dancePose,createDanceAudio} from './dance';
import { supermanPose } from './stunts';
import mapPlaces from '../shared/places.json';
import {setupCityDirectory,drawPlaceLabels} from './city-directory';
import {createPickleball,insidePickleball} from './pickleball';
import {createBasketball,insideBasketball} from './basketball';
import {createBuskers,buskingSpot,buskingVolume} from './busking';
import {watsonsSpot,watsonsVolume} from './watsons';
import {familyMartSpot,familyMartVolume} from './familymart';
import {masjidVolume,nearestMasjidDistance} from './masjid';
import {createStallWorld,setupStalls} from './stalls';
import {locationKey, readLocation, writeLocation} from './location-save';
import { setupProfileEditor, renderProfile, type PlayerProfile } from './profile';
import { setupTableSocial, type TableState } from './table-social';
import tableLocations from '../shared/tables.json';
import chairLocations from '../shared/chairs.json';
import './style.css';
import {createStreetAnimals, animalSound} from './animals';
import { setupShop } from './shop';
import vehicleSeats from '../shared/vehicle-seats.json';
import { savedLook, setupWardrobe } from './wardrobe';
import { version as appVersion } from '../package.json';
import * as THREE from 'three';
import { createWorld, createPerson, createBike, createDriveableCar, createIceCreamBike, applyAccessories, applyAppearance } from './world';
import { moveWithCollisions, safeDismount, dampAngle, overlaps } from './physics';
import type { Solid } from './physics';
import { auth, session, guestName, clearGuest, displayName, setupAuth } from './auth';
import { appearance, type Appearance } from './appearance';
import { nameTag, updateNameTagVoice, updateGameMasterTag, setupChat } from './social';
import { setupVoice } from './voice';
import { setupWall, type WallPost } from './wall';
import { setupExitConfirmation } from './exit-confirm';
import voiceConfig from '../shared/voice.json';

// Suppress native selection menus without interfering with player context menus or text entry.
for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
  document.addEventListener(type, event => {
    if (!(event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]'))) event.preventDefault();
  });
}

// Safari can treat repeated taps on fixed game layers as smart zoom.
// Gameplay already uses pointer events, so cancel the native touch-end action there.
function isGameTouchSurface(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('#world, #hud, #move-stick') &&
    !target.closest('button, a, input, textarea, select, [contenteditable="true"], #city-chat');
}
document.addEventListener('touchend', event => {
  if (isGameTouchSurface(event.target) && event.cancelable) event.preventDefault();
}, { passive: false });
document.addEventListener('dblclick', event => {
  if (isGameTouchSurface(event.target)) event.preventDefault();
});

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
$('app').innerHTML = `
  <div id="loading" role="status" aria-live="polite" aria-busy="true">
    <div class="loading-card">
      <img src="/icon-80.png" width="54" height="54" alt="" />
      <div class="loading-spinner" aria-hidden="true"><i></i><i></i><i></i></div>
      <strong>LEPAK<span>MAMAK.</span></strong>
      <p id="loading-title">Getting the city ready</p>
      <div id="loading-progress" class="loading-progress" role="progressbar" aria-label="Game loading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="8"><i></i></div>
      <small id="loading-detail">Setting the tables. Warming up the kapcai.</small>
    </div>
  </div>
  <audio id="background-music" src="/background-short.mp3" loop preload="auto" aria-hidden="true"></audio>
  <canvas id="world" aria-label="Interactive 3D Kuala Lumpur game world"></canvas>
  <section id="intro" aria-label="Welcome to LepakMamak">
    <div class="intro-top"><div class="brand"><img class="brand-mark" src="/icon-80.png" width="28" height="28" alt="" /> LEPAKMAMAK</div><div class="place-tag"><i class="live-dot"></i>KUALA LUMPUR, MALAYSIA</div></div>
    <div class="intro-copy"><div class="eyebrow intro-kicker">Your mamak. Your geng. Your cerita.</div><h1>LEPAK<span>MAMAK.</span></h1><p class="tagline">Good food. Good friends. A little chaos.</p><p class="intro-description">The teh tarik is hot. The streets are yours.<br>Grab your kapcai and find your own way<br>through a little slice of Kuala Lumpur.</p><p id="session-replaced-message" role="alert" hidden>Your account joined from another tab or device. This session has ended. Enter again to play here instead.</p><button class="primary" id="start">Jom, let's go <span class="arrow">↗</span></button><div class="intro-hint"><kbd>Enter</kbd> to hit the streets <span>·</span> Best with a keyboard</div></div>
    <div class="intro-bottom"><p>A small open world. A big Malaysian heart.</p><div class="postcard"><i class="postcard-line"></i><div><strong>Somewhere in Kuala Lumpur</strong><span>Late afternoon · no rush, lah.</span></div></div></div>
  </section>
  <section id="hud" aria-label="Game information" hidden>
    <div class="hud-top"><div class="hud-left"><div class="brand-status"><div class="game-brand">LEPAK<span>MAMAK.</span></div><button type="button" id="multiplayer-status" class="multiplayer-status" aria-label="Show online players" aria-haspopup="dialog"><i></i><span id="multiplayer-status-text">SOLO MODE</span><b id="player-count">1 / 24</b></button></div><div class="hud-divider"></div><div class="district"><strong id="district">Kampung Maju</strong><small id="weather-label">17:42 · Golden hour</small></div></div><div class="hud-right"><button type="button" id="open-wall" class="wall-toggle" aria-label="Open Lepak Wall" aria-haspopup="dialog"><span aria-hidden="true">▤</span><b>WALL</b><i id="wall-unread" hidden>0</i></button><div id="camera-controls" aria-label="Camera controls"><button id="camera-in" aria-label="Zoom camera in">+</button><button id="camera-reset" aria-label="Centre camera" title="Centre camera (C)">◎</button><button id="camera-out" aria-label="Zoom camera out">−</button></div><button class="menu-btn" id="menu" aria-label="Open settings"><span></span><span></span></button></div></div>
    <div id="minimap-wrap"><button type="button" id="open-map" class="map-frame" aria-label="Open city map" aria-haspopup="dialog"><canvas id="minimap" width="364" height="332" aria-label="Map showing your location"></canvas><span class="map-north">N ↑ · M</span></button><div class="map-caption"><span id="map-area">KAMPUNG MAJU</span><span>● YOU</span></div></div>
    <button type="button" id="interaction" hidden><span id="interaction-text"></span></button>
    <div id="controls-bar"><div class="control"><kbd>W A S D</kbd><span id="move-label">Move</span></div><div class="control"><kbd id="action-key">Shift</kbd><span id="action-label">Run</span></div><div class="control"><kbd>Space</kbd><span>Jump / brake</span></div><div class="control"><kbd>Drag</kbd><span>Look</span></div><div class="control"><kbd>Esc</kbd><span>Settings</span></div><button id="desktop-superman" class="stunt-button" type="button" aria-label="Superman motorbike stunt" hidden>SUPERMAN</button><button id="desktop-horn" class="recall-button" aria-label="Honk horn" hidden>HONK <kbd>H</kbd></button><button id="desktop-recall" class="recall-button" type="button"><span>RECALL</span><kbd>R</kbd></button></div>
    <section id="vehicle-seats" aria-label="Car occupants" hidden></section><div id="speedometer"><div><span class="speed-number" id="speed">00</span><span class="speed-unit">KM/H</span></div><div class="speed-track"><div id="speed-fill"></div></div><div class="vehicle-label" id="vehicle-label">ON FOOT · TAKE IT EASY</div></div>
    <div id="touch-controls" hidden><div id="move-stick" role="group" aria-label="Movement joystick"><div class="stick-ring"></div><div id="stick-thumb"></div><span>MOVE</span></div><div class="touch-actions"><button data-key="Space" aria-label="Brake">BRAKE</button><button id="touch-superman" class="stunt-button" type="button" aria-label="Superman motorbike stunt" hidden>SUPERMAN</button><button id="touch-horn" aria-label="Honk horn" hidden>HONK</button><button id="touch-recall" class="recall-button" type="button" aria-label="Spam recall emote">RECALL</button></div></div>
  </section>
  <div id="toast" role="status" aria-live="polite" hidden></div>
  <section id="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><div class="pause-panel"><div class="eyebrow">Ambil rehat dulu</div><h2 id="pause-title">Lepak a little.</h2><p id="app-version">LepakMamak v${appVersion}</p><p>The city keeps moving while you adjust your settings.</p><button class="primary" id="resume">Resume</button><button class="secondary" id="open-shop" type="button">Kedai · Skins & Accessories</button><button class="secondary" id="open-my-profile" type="button" hidden>My social profile</button><button class="secondary" id="open-edit-profile" type="button" hidden>Edit profile · About you</button><button class="secondary" id="open-wardrobe" type="button">Wardrobe · Change clothes</button><div id="afk-settings"><label for="afk-note">AFK note</label><input id="afk-note" maxlength="60" placeholder="e.g. berak jap" autocomplete="off" /><small>Stays above your head until you clear it.</small><div><button id="save-afk" type="button">Set note</button><button id="clear-afk" type="button">Clear note</button></div><span id="afk-status" role="status"></span></div><div class="settings"><label>Graphics<select id="graphics-quality" aria-label="Graphics quality"><option value="auto">Auto</option><option value="smooth">Smooth</option><option value="detailed">Detailed</option></select></label><label>Rain over KL<input id="rain-toggle" type="checkbox" /></label><label>Background music<input id="music-toggle" type="checkbox" checked /></label><label>City sounds<input id="sound-toggle" type="checkbox" checked /></label><label>Detailed shadows<input id="shadow-toggle" type="checkbox" checked /></label></div><button class="secondary" id="reset">Return to Mamak Maju</button><div class="pause-controls"><b>W A S D / arrows</b><span>Move or drive</span><b>Shift</b><span>Run on foot</span><b>Space</b><span>Jump on foot / brake on bike</span><b>Click / tap action</b><span>Sit, stand, enter or leave vehicles</span><b>R</b><span>Send a recall emote</span><b>Click / tap world</b><span>Punch on foot</span><b>Drag / scroll</b><span>Look around / camera distance</span><b>M</b><span>Open or close city map</span><b>C</b><span>Centre camera</span><b>Esc</b><span>Open or close settings</span></div></div></section>
  <dialog id="city-map" aria-labelledby="city-map-title"><header><div><div class="eyebrow">LEPAKMAMAK · LIVE MAP</div><h2 id="city-map-title">Explore the city.</h2></div><button id="close-map" type="button" aria-label="Close city map">Close ×</button></header><p id="map-place-info">All locations are shown. Tap a name to highlight the way.</p><div class="city-map-layout"><div><div class="city-map-viewport"><canvas id="expanded-map" width="1024" height="1024" aria-label="Full city map with your location, friends, motorbike"></canvas></div><p class="city-map-hint">N ↑ · On mobile, swipe the map to explore.</p></div><nav id="city-directory" class="city-directory" aria-label="City location directory"></nav></div><footer><span>▲ You &nbsp; ● Friends &nbsp; <span class="map-bike-key">● Bike</span> &nbsp; ● Car</span><span>Move normally · M / Esc to close</span></footer></dialog>
  <div id="player-options" role="menu" aria-label="Player options" hidden><button id="superman-action" class="stunt-button" type="button" role="menuitem" hidden>Superman · 6s</button><button id="dance-action" type="button" role="menuitem" hidden>Dance · 10s</button><button id="view-profile" type="button" role="menuitem">View profile</button></div>
  <dialog id="player-profile" aria-labelledby="profile-title"><h2 id="profile-title">Player profile</h2><p id="profile-name"></p><div id="profile-details"></div><button id="close-profile" type="button">Close</button></dialog>
  <dialog id="online-players" aria-labelledby="online-players-title"><header><div><h2 id="online-players-title">Who's in the city?</h2><p id="online-players-count"></p></div><button type="button" id="close-online-players" aria-label="Close online players">Close ×</button></header><p id="online-players-empty"></p><ul id="online-players-list"></ul><small>Players in your current room.</small></dialog>
  <div id="error" hidden><h2>Couldn't open the streets.</h2><p id="error-message"></p><button class="primary" id="reload">Try again</button></div>
`;

$('reload').onclick = () => location.reload();
const backgroundMusic = $<HTMLAudioElement>('background-music');
backgroundMusic.volume = .06;
backgroundMusic.loop = true;
function showLoading(title: string, detail: string, progress: number) {
  const value = Math.max(0, Math.min(100, progress));
  $('loading-title').textContent = title; $('loading-detail').textContent = detail;
  const bar = $('loading-progress'); bar.setAttribute('aria-valuenow', String(value));
  (bar.firstElementChild as HTMLElement).style.width = `${value}%`;
  $('loading').hidden = false; $('loading').setAttribute('aria-busy', 'true');
}
function hideLoading() { $('loading').hidden = true; $('loading').setAttribute('aria-busy', 'false'); }
function fail(message: string) { hideLoading(); $('error-message').textContent = message; $('error').hidden = false; }

async function init() {
  showLoading('Getting the city ready', 'Loading type and interface…', 12);
  await document.fonts.ready;
  showLoading('Building Kampung Maju', 'Placing roads, shops and mamak tables…', 34);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const canvas = $<HTMLCanvasElement>('world');
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch { fail('This game needs WebGL. Try a recent browser with hardware acceleration enabled.'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, matchMedia('(any-pointer: coarse)').matches ? 1.25 : 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail('The graphics connection was interrupted. Reload to return to the city. Reload to reconnect to the city.'); });
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#d6decd'); scene.fog = new THREE.Fog('#d6decd', 145, 440);
  scene.add(new THREE.HemisphereLight('#f6edcf', '#758b75', 1.8));
  const sun = new THREE.DirectionalLight('#ffdfa3', 2.7); sun.position.set(-70, 110, 60); sun.castShadow = true;
  const shadowSize = matchMedia('(any-pointer: coarse)').matches ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize); sun.shadow.camera.left = -90; sun.shadow.camera.right = 90; sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = .5; sun.shadow.camera.far = 320; sun.shadow.normalBias = .12; sun.shadow.bias = -.00015; scene.add(sun); scene.add(sun.target);
  const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, .1, 600);
  const world = createWorld(scene);
  const pickleball=createPickleball(scene,world);
  const basketball=createBasketball(scene,world);
  showLoading('Bringing the streets alive', 'Adding vehicles, neighbours and city sounds…', 66);
  createStallWorld(scene,world.solids);
  const buskers=createBuskers(scene,world.solids);
  const iceCreamBike = createIceCreamBike(); iceCreamBike.position.set(-11, .09, 44); iceCreamBike.rotation.y = Math.PI; scene.add(iceCreamBike);
  const iceCreamSolid = { x: -11, z: 44, hx: 1.35, hz: 1.8 }; world.solids.push(iceCreamSolid);
  const streetAnimals = createStreetAnimals(scene, world.solids);
  const player = createPerson(); scene.add(player.group);
  const bike = createBike(); scene.add(bike.group);
  const car = createDriveableCar(); car.group.position.set(-7, .09, 64); car.group.rotation.y = Math.PI; scene.add(car.group);
  let vehicle: 'bike' | 'car' = 'bike';
  let passengerOf: string | null = null;
  let passengerSeat = 0;
  let roomPlayers: NetworkPlayer[] = [];
  let roomTables: TableState[] = [];
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('lepak-city-save') || '{}') || {}; } catch { /* A damaged or unavailable save doesn't stop the game. */ }
  const savedMoney = Number((saved as { money?: number }).money);
  const money = Number.isFinite(savedMoney) ? Math.max(0, savedMoney) : 0;
  const pos = new THREE.Vector3(-18, .12, 52); let yaw = Math.PI;
  let bikeYaw = Math.PI; bike.group.position.set(-6.5, .09, 54); bike.group.rotation.y = bikeYaw;
  let riding = false, started = false, paused = false, speed = 0, walkSpeed = 0, elapsed = 0;
  const onlinePlayersDialog = $<HTMLDialogElement>('online-players');
  const cityMap = $<HTMLDialogElement>('city-map');
  function setMap(open: boolean) {
    dragging = false;
    if (open && started && !paused) { cityMap.append($('touch-controls')); cityMap.showModal(); drawMap(true); $('close-map').focus(); }
    else { cityMap.close(); $('hud').append($('touch-controls')); canvas.focus(); }
  }
  $('open-map').onclick = () => setMap(true);
  $('close-map').onclick = () => setMap(false);
  cityMap.addEventListener('cancel', event => { event.preventDefault(); setMap(false); });
  cityMap.addEventListener('click', event => { if (event.target === cityMap) { const rect = cityMap.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setMap(false); } });
  let seated = false;
  let seatedChairId: string | null = null;
  const standPosition = new THREE.Vector3();
  let jumpHeight = 0, jumpVelocity = 0;
  function jump() {
    if (!started || paused || seated || riding || jumpHeight > 0 || jumpVelocity > 0) return;
    jumpVelocity = 6.5; movementSound('jump');
  }
  let orbit = 0, cameraHeading = Math.PI, zoom = 9, cameraPitch = .35;
  let dragging = false, lastX = 0, lastY = 0, toastRemaining = 0, simTime = 0;
  let audioEnabled = true, rainEnabled = false, musicEnabled = true;
  try { musicEnabled = localStorage.getItem('lepakmamak-music') !== 'off'; } catch { /* Storage may be unavailable. */ }
  $<HTMLInputElement>('music-toggle').checked = musicEnabled;
  type NetworkPlayer = { supermanUntil?:number; danceUntil?:number; snack?:string|null; chairId?: string | null; afkNote?: string; gameMaster?: boolean; accessories?: string[]; seatIndex?: number | null; passengerOf?: string | null; vehicle?: 'bike' | 'car'; appearance?: Appearance; id: string; name: string; color: string; x: number; z: number; yaw: number; riding: boolean; speed: number; mic?: boolean; speaker?: boolean; seated?: boolean; jumpHeight?: number };
  type RemotePlayer = { bike: ReturnType<typeof createBike>; passengerOf: string | null; id: string; car: ReturnType<typeof createDriveableCar>; vehicle: string; label: THREE.Sprite; group: THREE.Group; target: THREE.Vector3; yaw: number; targetYaw: number; riding: boolean; speed: number; seated: boolean; recallUntil: number; person: ReturnType<typeof createPerson>; punchUntil: number };
  const danceAudio=createDanceAudio();
  const isDancing=()=>!!roomPlayers.find(p=>p.id===networkPlayerId&&Number(p.danceUntil)>Date.now());
  let localSupermanUntil=0;
  const supermanUntil=()=>Math.max(localSupermanUntil,Number(roomPlayers.find(p=>p.id===networkPlayerId)?.supermanUntil)||0);
  const isSuperman=()=>riding&&!passengerOf&&vehicle==='bike'&&supermanUntil()>Date.now();
  const remotePlayers = new Map<string, RemotePlayer>();
  let afkNote = '';
  const speechBubbles = new Map<string, { element: HTMLDivElement; expiresAt: number }>();
  const speechPosition = new THREE.Vector3();
  function clearSpeechBubbles() {
    for (const bubble of speechBubbles.values()) bubble.element.remove();
    speechBubbles.clear();
  }
  function showSpeechBubble(id: string, name: string, text: string) {
    if (!id.startsWith('afk:') && id !== networkPlayerId && !remotePlayers.has(id)) return;
    speechBubbles.get(id)?.element.remove();
    const element = document.createElement('div'); element.className = 'speech-bubble'; element.hidden = true;
    element.setAttribute('aria-hidden', 'true'); // The chat log already announces messages.
    const author = document.createElement('strong'); author.textContent = name;
    const message = document.createElement('span'); message.textContent = text;
    element.append(author, message); $('hud').append(element);
    speechBubbles.set(id, { element, expiresAt: performance.now() + 6500 });
  }
  function setAfkBubble(id: string, note: string) {
    const key = `afk:${id}`;
    const existing = speechBubbles.get(key);
    if (!note) { existing?.element.remove(); speechBubbles.delete(key); return; }
    if (existing?.element.querySelector('span')?.textContent === note) return;
    showSpeechBubble(key, 'AFK', note);
    const bubble = speechBubbles.get(key)!;
    bubble.expiresAt = Infinity; bubble.element.classList.add('afk-bubble');
  }
  function publishAfk(note: string) {
    afkNote = note.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60);
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'afk-note', text: afkNote }));
    $<HTMLInputElement>('afk-note').value = afkNote;
    $('afk-status').textContent = afkNote ? 'AFK note set' : 'AFK note cleared';
  }
  $('save-afk').onclick = () => publishAfk($<HTMLInputElement>('afk-note').value);
  $('clear-afk').onclick = () => publishAfk('');
  let localName: THREE.Sprite | null = null;
  const chat = setupChat(text => {
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN) return false;
    networkSocket.send(JSON.stringify({ type: 'chat', text })); return true;
  }, () => { keys.clear(); resetStick(); dragging = false; });
  let networkSocket: WebSocket | null = null;
  let networkPlayerId = '';
  let networkConnected = false;
  let networkSendTimer = 0, networkIdleTimer = 0;
  let lastNetworkState = '';
  let networkReconnectTimer: number | null = null;
  let entryLoadingTimer: number | null = null;
  function finishEntryLoading() {
    if (entryLoadingTimer !== null) { clearTimeout(entryLoadingTimer); entryLoadingTimer = null; }
    hideLoading();
  }
  function beginEntryLoading() {
    showLoading('Entering Kampung Maju', 'Starting your character and joining the city…', 68);
    if (entryLoadingTimer !== null) clearTimeout(entryLoadingTimer);
    entryLoadingTimer = window.setTimeout(() => {
      entryLoadingTimer = null; hideLoading();
      toast('Still connecting', 'You can explore while the city reconnects.', 4);
    }, 12000);
  }
  let recallUntil = 0, punchUntil = 0, punchCount = 0;
  function punch() {
    if (!started || paused || isDancing() || tableSocial.opened || streetStalls.opened || cityMap.open || seated || riding || punchUntil > simTime) return;
    if(insidePickleball(pos)){if(networkConnected&&networkSocket?.readyState===WebSocket.OPEN){punchUntil=simTime+.38;networkSocket.send(JSON.stringify({type:'pickleball-hit'}));}return;}
    if(insideBasketball(pos)){basketball.action();return;}
    punchUntil = simTime + .38; punchCount++; punchSound();
    if (networkConnected && networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'punch' }));
  }
  function punchPose(person: ReturnType<typeof createPerson>, until: number) {
    const remaining = until - simTime;
    if (remaining > 0) person.rightArm.rotation.x = -1.85 * Math.sin(Math.PI * (1 - remaining / .38));
  }
  pickleball.onHit(punch);
  basketball.connect(message=>{if(!networkConnected||networkSocket?.readyState!==WebSocket.OPEN)return false;networkSocket.send(JSON.stringify(message));return true;});
  const multiplayerEndpoint = (import.meta.env.VITE_MULTIPLAYER_URL as string | undefined)?.trim().replace(/\/$/, '') || '';
  const roomName = (new URLSearchParams(location.search).get('room') || 'kampung').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'kampung';
  let invitedTableId = tableLocations.find(t=>t.id===new URLSearchParams(location.search).get('table'))?.id;
  const tableSocial = setupTableSocial(message => {
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN) return false;
    networkSocket.send(JSON.stringify(message)); return true;
  }, roomName, () => { keys.clear(); resetStick(); dragging = false; });
  const streetStalls=setupStalls($('hud'),message=>{if(!networkConnected||networkSocket?.readyState!==WebSocket.OPEN)return false;networkSocket.send(JSON.stringify(message));return true;},()=>{keys.clear();resetStick();dragging=false;});
  const wall=setupWall(multiplayerEndpoint,()=>{keys.clear();resetStick();dragging=false;});
  $('open-wall').onclick=()=>wall.open();
  const tableLabels = tableLocations.map(table=>{
    const button=document.createElement('button');button.className='table-label';button.hidden=true;button.onclick=()=>tableSocial.open(table.id);$('hud').append(button);return {table,button};
  });
  const keys = new Set<string>();
  const stick = $('move-stick'), thumb = $('stick-thumb');
  let stickId: number | null = null, stickX = 0, stickY = 0;
  function resetStick() {
    const id = stickId; stickId = null; stickX = stickY = 0;
    thumb.style.transform = 'translate(-50%, -50%)'; stick.classList.remove('active');
    if (id !== null && stick.hasPointerCapture(id)) stick.releasePointerCapture(id);
  }
  function moveStick(event: PointerEvent) {
    const rect = stick.getBoundingClientRect(), radius = rect.width * .3;
    const x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(x, y), scale = Math.min(1, radius / (length || 1));
    const strength = Math.max(0, (Math.min(1, length / radius) - .12) / .88);
    stickX = length ? x / length * strength : 0; stickY = length ? -y / length * strength : 0;
    thumb.style.transform = `translate(-50%, -50%) translate(${x * scale}px, ${y * scale}px)`;
  }
  stick.addEventListener('pointerdown', event => {
    if (!started || paused || stickId !== null || event.button !== 0) return;
    event.preventDefault(); stickId = event.pointerId; stick.setPointerCapture(stickId); stick.classList.add('active'); moveStick(event);
  });
  stick.addEventListener('pointermove', event => { if (event.pointerId === stickId) { event.preventDefault(); moveStick(event); } });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(type, event => { if ((event as PointerEvent).pointerId === stickId) resetStick(); });
  const touch = matchMedia('(any-pointer: coarse)').matches;
  document.body.classList.toggle('touch-device', touch);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('touch-controls').hidden = !touch;
  if (touch) { $('controls-bar').hidden = true; document.querySelector('.intro-hint')!.textContent = 'Drag the thumbstick to move · drag the world to look'; }
  player.group.position.copy(pos); player.group.rotation.y = yaw;

  const rainCount = 1100;
  const rainPositions = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainCount; i++) { const j = i * 6; rainPositions[j] = (Math.random() - .5) * 85; rainPositions[j + 1] = Math.random() * 45; rainPositions[j + 2] = (Math.random() - .5) * 85; }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#d7e5de', transparent: true, opacity: .45 })); rain.visible = false; rain.frustumCulled = false; scene.add(rain);

  let audioContext: AudioContext | null = null, engine: OscillatorNode | null = null, engineGain: GainNode | null = null;
  const iceCreamSong = new Audio('/matkool.mp3'); iceCreamSong.loop = true; iceCreamSong.preload = 'auto';
  const buskingSong=new Audio('/busking.mp3');buskingSong.loop=true;buskingSong.preload='metadata';
  const watsonsSong=new Audio('/watson.mp3');watsonsSong.loop=true;watsonsSong.preload='metadata';
  const familyMartSong=new Audio('/familymart.mp3');familyMartSong.loop=true;familyMartSong.preload='metadata';
  const masjidSong=new Audio('/arrahman.mp3');masjidSong.loop=true;masjidSong.preload='metadata';
  let buskingGain:GainNode|null=null;
  let watsonsGain:GainNode|null=null;
  let familyMartGain:GainNode|null=null;
  let masjidGain:GainNode|null=null;
  let iceCreamGain: GainNode | null = null;
  let citySoundsGain: GainNode | null = null;
  function ensureAudio() {
    if (!audioEnabled) return;
    try {
      if (!audioContext) {
        audioContext = new AudioContext();
        citySoundsGain = audioContext.createGain(); citySoundsGain.gain.value = .5; citySoundsGain.connect(audioContext.destination);
        buskingGain=audioContext.createGain();buskingGain.gain.value=0;audioContext.createMediaElementSource(buskingSong).connect(buskingGain);buskingGain.connect(citySoundsGain!);
        watsonsGain=audioContext.createGain();watsonsGain.gain.value=0;audioContext.createMediaElementSource(watsonsSong).connect(watsonsGain);watsonsGain.connect(citySoundsGain!);
        familyMartGain=audioContext.createGain();familyMartGain.gain.value=0;audioContext.createMediaElementSource(familyMartSong).connect(familyMartGain);familyMartGain.connect(citySoundsGain!);
        masjidGain=audioContext.createGain();masjidGain.gain.value=0;audioContext.createMediaElementSource(masjidSong).connect(masjidGain);masjidGain.connect(citySoundsGain!);
        iceCreamGain = audioContext.createGain(); iceCreamGain.gain.value = 0;
        audioContext.createMediaElementSource(iceCreamSong).connect(iceCreamGain); iceCreamGain.connect(citySoundsGain!);
        engine = audioContext.createOscillator(); engine.type = 'triangle';
        engineGain = audioContext.createGain(); engineGain.gain.value = 0; engine.connect(engineGain); engineGain.connect(citySoundsGain!); engine.start();
      }
      if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
    } catch { audioEnabled = false; $<HTMLInputElement>('sound-toggle').checked = false; }
  }
  let musicContext: AudioContext | null = null;
  function startBackgroundMusic() {
    if(audioEnabled&&started&&buskingGain)void buskingSong.play().catch(()=>{});
    if(audioEnabled&&started&&watsonsGain)void watsonsSong.play().catch(()=>{});
    if(audioEnabled&&started&&familyMartGain)void familyMartSong.play().catch(()=>{});
    if(audioEnabled&&started&&masjidGain)void masjidSong.play().catch(()=>{});
    if (audioEnabled && started && iceCreamGain) void iceCreamSong.play().catch(() => {});
    if (!musicEnabled) return;
    try {
      if (!musicContext) {
        musicContext = new AudioContext();
        const musicGain = musicContext.createGain(); musicGain.gain.value = .06;
        musicContext.createMediaElementSource(backgroundMusic).connect(musicGain); musicGain.connect(musicContext.destination);
        backgroundMusic.volume = 1;
      }
      if (musicContext.state === 'suspended') void musicContext.resume().catch(() => {});
    } catch { /* Retain the quieter media-element fallback where supported. */ }
    void backgroundMusic.play().catch(() => {
      // Browsers can still reject playback when the user starts with the keyboard.
      // The next user interaction will try again without interrupting the game.
    });
  }
  document.addEventListener('pointerdown', () => {
    if (started && ((musicEnabled && (backgroundMusic.paused || musicContext?.state === 'suspended')) || (audioEnabled && (iceCreamSong.paused || buskingSong.paused || watsonsSong.paused || familyMartSong.paused || masjidSong.paused || audioContext?.state === 'suspended')))) { ensureAudio(); startBackgroundMusic(); }
  });
  let footstepDistance = 0;
  let stepNoise: AudioBuffer | null = null;
  function movementSound(kind: 'step' | 'jump' | 'land', running = false) {
    if (!audioEnabled || !started) return;
    ensureAudio();
    if (!audioContext || audioContext.state !== 'running') return;
    // Short filtered noise gives shoes a soft scuff and impact without downloaded audio.
    if (!stepNoise) {
      stepNoise = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * .22), audioContext.sampleRate);
      const samples = stepNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain();
    const duration = kind === 'jump' ? .18 : kind === 'land' ? .16 : .09;
    const now = audioContext.currentTime;
    source.buffer = stepNoise; source.playbackRate.value = .94 + Math.random() * .12;
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(kind === 'jump' ? 1600 : 700, now);
    filter.frequency.exponentialRampToValueAtTime(kind === 'jump' ? 450 : 160, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(kind === 'land' ? .22 : kind === 'jump' ? .08 : running ? .15 : .11, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(citySoundsGain!);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(); source.stop(now + duration + .01);
  }
  let punchNoise: AudioBuffer | null = null;
  function punchSound() {
    if (!audioEnabled || !started) return;
    ensureAudio(); if (!audioContext || audioContext.state !== 'running') return;
    if (!punchNoise) {
      punchNoise = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * .16), audioContext.sampleRate);
      const samples = punchNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain();
    const now = audioContext.currentTime;
    source.buffer = punchNoise;
    filter.type = 'bandpass'; filter.Q.value = .7;
    filter.frequency.setValueAtTime(1900, now); filter.frequency.exponentialRampToValueAtTime(280, now + .14);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.2, now + .025); gain.gain.exponentialRampToValueAtTime(.0001, now + .15);
    source.connect(filter); filter.connect(gain); gain.connect(citySoundsGain!);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(); source.stop(now + .16);
  }
  function chairSound(sitting: boolean) {
    if (!audioEnabled || !started) return;
    ensureAudio(); if (!audioContext || audioContext.state !== 'running') return;
    const oscillator = audioContext.createOscillator(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain();
    const now = audioContext.currentTime, duration = sitting ? .24 : .18;
    // A quiet, filtered creak: descending under weight, rising as the chair unloads.
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(sitting ? 190 : 105, now);
    oscillator.frequency.exponentialRampToValueAtTime(sitting ? 85 : 175, now + duration);
    filter.type = 'lowpass'; filter.frequency.value = 650;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.035, now + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(filter); filter.connect(gain); gain.connect(citySoundsGain!);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
    oscillator.start(); oscillator.stop(now + duration + .01);
  }
  let lastHornAt = -1;
  function hornSound(kind: string, volume = 1) {
    if (!started || !audioEnabled || volume <= 0) return;
    ensureAudio(); if (!audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    for (const frequency of kind === 'car' ? [349, 440] : [660]) {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'square'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.025 * volume, now + .015);
      gain.gain.setValueAtTime(.025 * volume, now + .2); gain.gain.linearRampToValueAtTime(0, now + .28);
      oscillator.connect(gain); gain.connect(citySoundsGain!);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(); oscillator.stop(now + .29);
    }
  }
  function honk() {
    if (!started || paused || !riding || passengerOf || simTime - lastHornAt < .4) return;
    lastHornAt = simTime; hornSound(vehicle);
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'horn' }));
  }
  function chime(success = false) {
    ensureAudio(); if (!audioContext || !audioEnabled) return;
    for (let i = 0; i < (success ? 3 : 1); i++) {
      const o = audioContext.createOscillator(), gain = audioContext.createGain(); o.connect(gain); gain.connect(citySoundsGain!);
      const time = audioContext.currentTime + i * .12; o.frequency.value = [523, 659, 784][i]; gain.gain.setValueAtTime(.035, time); gain.gain.exponentialRampToValueAtTime(.001, time + .23); o.start(time); o.stop(time + .25);
    }
  }
  function toast(title: string, body: string, seconds = 4) {
    $('toast').replaceChildren(); const strong = document.createElement('strong'); strong.textContent = title; $('toast').append(strong, document.createTextNode(body)); $('toast').hidden = false; toastRemaining = seconds;
  }
  function renderOnlinePlayers() {
    if (!onlinePlayersDialog.open) return;
    const people = networkConnected ? [...roomPlayers].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) : [];
    const key = JSON.stringify([networkConnected, networkPlayerId, people.map(p => [p.id, p.name])]);
    if (onlinePlayersDialog.dataset.people === key) return;
    onlinePlayersDialog.dataset.people = key;
    $('online-players-count').textContent = `${people.length} online`;
    $('online-players-empty').textContent = networkConnected ? people.length ? '' : 'Waiting for the player list…' : 'You are not connected to a multiplayer room.';
    const list = $('online-players-list'); list.replaceChildren();
    for (const person of people) {
      const row = document.createElement('li');
      const dot = document.createElement('span'); dot.className = 'online-player-dot'; dot.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.textContent = person.name;
      row.append(dot, name);
      if (person.id === networkPlayerId) { const you = document.createElement('small'); you.textContent = 'You'; row.append(you); }
      list.append(row);
    }
  }
  $('multiplayer-status').onclick = () => {
    if (!started) return;
    keys.clear(); resetStick(); dragging = false;
    onlinePlayersDialog.showModal(); renderOnlinePlayers(); $('close-online-players').focus();
  };
  $('close-online-players').onclick = () => onlinePlayersDialog.close();
  onlinePlayersDialog.addEventListener('keydown', event => event.stopPropagation());
  onlinePlayersDialog.addEventListener('close', () => $('multiplayer-status').focus());
  function setNetworkStatus(label: string, state: 'solo' | 'connecting' | 'online' | 'offline', count = 1) {
    const statusKey = `${label}:${state}:${count}`;
    if ($('multiplayer-status').dataset.statusKey === statusKey) { renderOnlinePlayers(); return; }
    $('multiplayer-status').dataset.statusKey = statusKey;
    chat.status(state === 'online');
    const status = $('multiplayer-status'); status.dataset.state = state;
    renderOnlinePlayers();
    $('multiplayer-status-text').textContent = label;
    $('player-count').textContent = `${count} / 24`;
  }
  function makeRemotePlayer(player: NetworkPlayer) {
    const group = new THREE.Group();
    group.userData.profileName = player.name; group.userData.profileId = player.id;
    const person = createPerson('#ef734c', false, appearance(player.appearance));
    person.group.scale.setScalar(.92); group.add(person.group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .73, 24), new THREE.MeshBasicMaterial({ color: player.color || '#72c8ba', side: THREE.DoubleSide, transparent: true, opacity: .8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .04; group.add(ring);
    const bike = createBike(); applyAppearance(bike.rider, player.appearance); bike.rider.visible = true; bike.group.visible = false; group.add(bike.group);
    const car = createDriveableCar(); applyAppearance(car.driver, player.appearance); car.driver.visible = true; car.group.visible = false; group.add(car.group);
    const label = nameTag(player.name); updateNameTagVoice(label, !!player.mic, !!player.speaker); group.add(label);
    group.position.set(player.x, .12, player.z); scene.add(group);
    return { bike, passengerOf: player.passengerOf || null, id: player.id, car, vehicle: player.vehicle || 'bike', label, group, target: new THREE.Vector3(player.x, .12, player.z), yaw: player.yaw, targetYaw: player.yaw, riding: player.riding, speed: player.speed, seated: !!player.seated, recallUntil: 0, person, punchUntil: 0 };
  }
  function syncRemotePlayers(players: NetworkPlayer[]) {
    streetStalls.state(players.find(p=>p.id===networkPlayerId)?.snack||null,networkConnected);
    roomPlayers = players;
    tableSocial.state(roomTables, networkPlayerId, networkConnected);
    const ownAccessories = players.find(p=>p.id===networkPlayerId)?.accessories; if(ownAccessories) setAccessories(ownAccessories);
    const self = players.find(p => p.id === networkPlayerId);
    if (self && (self.chairId || seatedChairId)) {
      const nowSeated = !!self.chairId;
      if (nowSeated !== seated) chairSound(nowSeated);
      seated = nowSeated; seatedChairId = self.chairId || null;
      pos.set(self.x, .12, self.z); yaw = self.yaw; walkSpeed = 0; speed = 0;
      keys.clear(); resetStick();
    }
    if (self?.afkNote !== undefined) afkNote = self.afkNote;
    if (self && (self.passengerOf || passengerOf)) {
      passengerOf = self.passengerOf || null; riding = !!passengerOf; seated = false; vehicle = self.vehicle || 'bike'; passengerSeat = self.seatIndex || 0;
      pos.set(self.x, .12, self.z); yaw = self.yaw; speed = self.speed;
      player.group.visible = true; bike.rider.visible = false; keys.clear(); resetStick();
    }
    const visibleIds = new Set<string>();
    for (const remote of players) {
      if (!remote.id || remote.id === networkPlayerId) continue;
      visibleIds.add(remote.id);
      setAfkBubble(remote.id, remote.afkNote || '');
      let entity = remotePlayers.get(remote.id);
      if (!entity) { entity = makeRemotePlayer(remote); remotePlayers.set(remote.id, entity); }
      const lookKey = JSON.stringify(remote.appearance);
      if (entity.group.userData.lookKey !== lookKey) {
        applyAppearance(entity.person.group, remote.appearance); applyAppearance(entity.bike.rider, remote.appearance); applyAppearance(entity.car.driver, remote.appearance);
        entity.group.userData.lookKey = lookKey;
      }
      for(const model of [entity.person.group,entity.bike.rider,entity.car.driver]) applyAccessories(model,remote.accessories || []);
      updateNameTagVoice(entity.label, !!remote.mic, !!remote.speaker);
      entity.target.set(remote.x, (remote.passengerOf ? remote.vehicle === 'car' ? .36 : .42 : remote.seated ? -.22 : .12) + (remote.jumpHeight || 0), remote.z); entity.targetYaw = remote.yaw; entity.riding = remote.riding; entity.speed = remote.speed; entity.seated = !!remote.seated; entity.vehicle = remote.vehicle || 'bike'; entity.passengerOf = remote.passengerOf || null;
      entity.car.group.visible = entity.riding && entity.vehicle === 'car' && !entity.passengerOf; entity.bike.group.visible = entity.riding && entity.vehicle === 'bike' && !entity.passengerOf;
      entity.person.group.visible = !entity.car.group.visible && !entity.bike.group.visible;
    }
    for (const [id, entity] of remotePlayers) {
      if (visibleIds.has(id)) continue;
      disposeRemote(entity); remotePlayers.delete(id);
    }
    setNetworkStatus(networkConnected ? 'CITY ONLINE' : multiplayerEndpoint ? 'RECONNECTING' : 'SOLO MODE', networkConnected ? 'online' : multiplayerEndpoint ? 'connecting' : 'solo', players.length || 1);
  }
  const voice = setupVoice(message => {
    if (message.type === 'voice-state' && localName) updateNameTagVoice(localName, !!message.mic, !!message.speaker);
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN || networkSocket.bufferedAmount > 65536) return false;
    networkSocket.send(JSON.stringify(message)); return true;
  });
  const voiceRadius=new THREE.Mesh(new THREE.RingGeometry(voiceConfig.hearingRadius-.18,voiceConfig.hearingRadius,72),new THREE.MeshBasicMaterial({color:'#ddf69a',transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false}));
  voiceRadius.rotation.x=-Math.PI/2;voiceRadius.position.y=.035;voiceRadius.visible=false;scene.add(voiceRadius);
  function disconnectMultiplayer() {
    saveLocation();
    seatedChairId = null; seated = false;
    tableSocial.close(); tableSocial.offline(); roomTables = [];
    wall.close();
    voice.connected(false);
    if (passengerOf) { passengerOf = null; riding = false; speed = 0; }
    clearSpeechBubbles();
    if (networkReconnectTimer !== null) { window.clearTimeout(networkReconnectTimer); networkReconnectTimer = null; }
    const oldSocket = networkSocket; networkSocket = null;
    oldSocket?.close(1000, 'Leaving the city');
    networkConnected = false; networkPlayerId = '';
    localSupermanUntil = 0;
    for (const entity of remotePlayers.values()) disposeRemote(entity);
    remotePlayers.clear(); roomPlayers = [];
  }
  function disposeRemote(entity: RemotePlayer) {
    entity.group.traverse(object => { if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose(); } });
    entity.group.removeFromParent();
  }
  function sessionReplaced() {
    leaveCity();
    $('session-replaced-message').hidden = false;
  }
  function retryMultiplayer() {
    if (!started || !multiplayerEndpoint || networkReconnectTimer !== null) return;
    networkReconnectTimer = window.setTimeout(() => { networkReconnectTimer = null; connectMultiplayer(); }, 2500);
  }
  let activeLocationKey='', locationSavedAt=0;
  function saveLocation(){
    if(!started||!networkConnected||!activeLocationKey)return;
    const chair=seatedChairId?chairLocations.find(c=>c.id===seatedChairId):null;
    const table=chair?tableLocations.find(t=>t.id===chair.tableId):null;
    const x=table?table.arrivalX:pos.x+(riding?Math.cos(yaw)*2.4:0);
    const z=table?table.arrivalZ:pos.z-(riding?Math.sin(yaw)*2.4:0);
    writeLocation(activeLocationKey,{x,z,yaw});
  }
  async function connectMultiplayer() {
    if (!multiplayerEndpoint) { setNetworkStatus('SOLO MODE', 'solo', 1); finishEntryLoading(); return; }
    setNetworkStatus('CONNECTING…', 'connecting', 1);
    try {
      const accessToken = auth && !guestName ? (await auth.auth.getSession()).data.session?.access_token : undefined;
      if (!started) return;
      const endpoint = multiplayerEndpoint.startsWith('ws') ? multiplayerEndpoint : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${multiplayerEndpoint}`;
      const socket = new WebSocket(`${endpoint}/ws`); networkSocket = socket;
      socket.addEventListener('open', () => {
        if (socket !== networkSocket) return;
        showLoading('Joining your room', 'Syncing nearby players, chat and tables…', 86);
        activeLocationKey=locationKey(roomName,guestName?'guest:'+guestName:'account:'+(session?.user.id||'solo'));
        socket.send(JSON.stringify({ type: 'join', resume:readLocation(activeLocationKey), room: roomName, tableId: invitedTableId, accessToken, guest: !!guestName, name: guestName || undefined }));
      });
      socket.addEventListener('message', event => {
        if (socket !== networkSocket) return;
        let message: { names?:string[]; post?:WallPost; profile?: PlayerProfile | null; tables?: TableState[]; tableId?: string; from?: string; count?: number; sentAt?: string; type?: string; id?: string; players?: NetworkPlayer[]; messages?: {id?:string;name:string;text:string;sentAt?:string;gameMaster?:boolean}[]; message?: string; name?: string; text?: string; gameMaster?: boolean; code?: string; volume?: number; audio?: string };
        try { message = JSON.parse(String(event.data)); } catch { return; }
        if (message.type === 'welcome' && message.id) { if(invitedTableId){invitedTableId=undefined;const url=new URL(location.href);url.searchParams.delete('table');history.replaceState(null,'',url); } networkPlayerId = message.id; networkConnected = true; { const self = message.players?.find(p=>p.id===message.id); if(self){pos.set(self.x,.12,self.z);yaw=self.yaw;riding=false;seated=false;speed=0;jumpHeight=0;} } voice.connected(true); socket.send(JSON.stringify({ type: 'afk-note', text: afkNote })); showLoading('Welcome to LepakMamak', 'City online. Jumpa member, jom lepak!', 100); finishEntryLoading(); }
        if (message.type === 'profile' && message.id === selectedProfileId && profile.open) { if (message.profile) renderProfile($('profile-details'), message.profile); else $('profile-details').textContent = 'This player has left the city.'; }
        if(message.type==='lukis-correct')tableSocial.gameCorrect((message as any).name,(message as any).points,message);
        if(message.type==='lukis-feedback')tableSocial.gameFeedback((message as any).kind,(message as any).message);
        if(message.type==='lukis-state')tableSocial.game((message as any).game);
        if(message.type==='uno-state')tableSocial.uno((message as any).game);
        if(message.type==='werewolf-state')tableSocial.werewolf((message as any).game);
        if(message.type==='poker-state')tableSocial.poker((message as any).game);
        if(message.type==='pickleball-state')pickleball.state((message as any).game);
        if(message.type==='basketball-state')basketball.state((message as any).game);
        if(message.type==='achievement-unlocked'&&(message as any).badges?.length){const badge=(message as any).badges[0];toast('Achievement unlocked!',`${badge.name} · ${badge.detail}`,6);}
        if(message.type==='pickleball-swing'&&message.id){if(message.id===networkPlayerId)punchUntil=simTime+.38;else{const remote=remotePlayers.get(message.id);if(remote)remote.punchUntil=simTime+.38;}}
        if(message.type==='lukis-ink')tableSocial.gameInk(message);
        if(message.type==='lukis-line')tableSocial.gameLine((message as any).line);
        if (message.type === 'tables' && message.tables) { roomTables=message.tables; tableSocial.state(roomTables,networkPlayerId,networkConnected); }
        if(message.type==='stall-action'&&message.id&&message.name&&message.text)showSpeechBubble(message.id,message.name,message.text);
        if (message.type === 'chat-history' && Array.isArray(message.messages)) chat.history(message.messages);
        if(message.type==='wall-new'&&message.post)wall.receive(message.post);
        if ((message.type === 'welcome' || message.type === 'players') && message.players) syncRemotePlayers(message.players);
        if (message.type === 'horn' && message.id && message.id !== networkPlayerId) {
          const remote = remotePlayers.get(message.id);
          if (remote) hornSound(remote.vehicle, Math.max(0, 1 - Math.hypot(remote.target.x - pos.x, remote.target.z - pos.z) / 35));
        }
        if (message.type === 'punch' && message.id && message.id !== networkPlayerId) { const remote = remotePlayers.get(message.id); if (remote) remote.punchUntil = simTime + .38; }
        if (message.type === 'recall' && message.id && message.id !== networkPlayerId) triggerRecall(message.id);
        if (message.type === 'chat' && typeof message.name === 'string' && typeof message.text === 'string') {
          chat.append(message.name, message.text, message.sentAt, !!message.gameMaster, message.id !== networkPlayerId);
          if (message.id) showSpeechBubble(message.id, message.name, message.text);
        }
        if (message.type === 'voice-audio' && message.id && typeof message.audio === 'string') voice.receive(message.id, message.name || 'Player', message.audio, message.volume);
        if(message.type==='voice-audience')voice.audience(Number(message.count)||0,Array.isArray(message.names)?message.names:[]);
        if (message.type === 'notice') chat.append('City', message.message || 'Please try again.', undefined, false, false);
        if (message.type === 'error' && message.code === 'SESSION_REPLACED') { sessionReplaced(); return; }
        if (message.type === 'error') {
          finishEntryLoading();
          setNetworkStatus(message.code === 'AUTH_REQUIRED' ? 'LOGIN REQUIRED' : 'UNAVAILABLE', 'offline');
          toast('Could not join', message.message || 'Please try again.');
          if (message.code === 'AUTH_REQUIRED') { leaveCity(); void auth?.auth.signOut({ scope: 'local' }); }
        }
      });
      socket.addEventListener('close', event => { if (socket !== networkSocket) return; finishEntryLoading(); if (event.code === 4002) { sessionReplaced(); return; } voice.connected(false); if (passengerOf) { passengerOf = null; riding = false; speed = 0; } networkConnected = false; streetStalls.state(null,false);streetStalls.close();tableSocial.offline(); roomTables=[]; if (seatedChairId) { seatedChairId = null; seated = false; } for (const remote of remotePlayers.values()) disposeRemote(remote); remotePlayers.clear(); roomPlayers = []; setNetworkStatus('RECONNECTING…', 'connecting', 1); retryMultiplayer(); });
      socket.addEventListener('error', () => { if (socket !== networkSocket) return; finishEntryLoading(); voice.connected(false); networkConnected = false; setNetworkStatus('OFFLINE', 'offline', 1); });
    } catch { finishEntryLoading(); setNetworkStatus('OFFLINE · SOLO', 'offline', 1); }
  }
  function sendNetworkState(dt: number) {
    if(Date.now()-locationSavedAt>1000){saveLocation();locationSavedAt=Date.now();}
    if (!networkConnected || !networkSocket || networkSocket.readyState !== WebSocket.OPEN) return;
    networkSendTimer += dt; networkIdleTimer += dt;
    if (networkSendTimer < .05) return;
    networkSendTimer = 0;
    if (networkSocket.bufferedAmount >= 16384) return;
    const state = JSON.stringify({ type: 'state', x: pos.x, z: pos.z, yaw, riding, speed, jumpHeight, seated, vehicle });
    if (state === lastNetworkState && networkIdleTimer < .5) return;
    lastNetworkState = state; networkIdleTimer = 0; networkSocket.send(state);
  }
  function recallSound() {
    ensureAudio(); if (!audioContext || !audioEnabled) return;
    const startAt = audioContext.currentTime;
    for (let i = 0; i < 4; i++) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = startAt + i * .13;
      oscillator.type = 'square'; oscillator.connect(gain); gain.connect(citySoundsGain!);
      oscillator.frequency.setValueAtTime(155 + i * 12, at);
      oscillator.frequency.exponentialRampToValueAtTime(315 + i * 10, at + .075);
      gain.gain.setValueAtTime(.045, at); gain.gain.exponentialRampToValueAtTime(.001, at + .115);
      oscillator.start(at); oscillator.stop(at + .13);
    }
  }
  function triggerRecall(remoteId?: string) {
    if (remoteId) {
      const remote = remotePlayers.get(remoteId); if (!remote || remote.riding) return; if (remote) remote.recallUntil = simTime + .82;
      if (remote && remote.target.distanceTo(pos) < 25) recallSound();
      return;
    }
    if (!started || paused || riding || passengerOf) return;
    if(isDancing())return;
    recallUntil = simTime + .82; recallSound();
    for (const id of ['desktop-recall', 'touch-recall']) {
      const button = $(id); button.classList.remove('recall-active'); void button.offsetWidth; button.classList.add('recall-active');
      window.setTimeout(() => button.classList.remove('recall-active'), 760);
    }
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'recall' }));
  }
  function setPause(value: boolean) {
    if (!started) return;
    if (value && cityMap.open) setMap(false);
    paused = value; $('pause').hidden = !value; keys.clear(); resetStick(); dragging = false;
    if (value) { $('resume').focus(); }
    else { ensureAudio(); startBackgroundMusic(); canvas.focus(); }
  }
  function setAccessories(items: string[]) { for(const model of [player.group,bike.rider,car.driver]) applyAccessories(model,items); }
  const profileEditor = setupProfileEditor(async () => {
    const token = (await auth?.auth.getSession())?.data.session?.access_token;
    if (token && networkConnected && networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({type:'profile-refresh',accessToken:token}));
    toast('Profile saved', 'Your mamak friends can get to know you better.');
  });
  $('open-edit-profile').onclick = () => profileEditor.open();
  const itemShop = setupShop(setAccessories);
  $('open-shop').onclick = () => { if (!guestName) itemShop.open(); };
  function start() {
    if (auth && !session && !guestName) return;
    if (started) return;
    beginEntryLoading();
    $('open-my-profile').hidden = !session || !!guestName;
    $('open-edit-profile').hidden = !session || !!guestName;
    applyAppearance(player.group, savedLook()); applyAppearance(bike.rider, savedLook()); applyAppearance(car.driver, savedLook());
    $('session-replaced-message').hidden = true;
    $('open-shop').hidden = !!guestName;
    if (!guestName) void itemShop.enter();
    started = true; $('intro').hidden = true; $('hud').hidden = false;
    ensureAudio(); startBackgroundMusic(); connectMultiplayer(); camera.position.set(pos.x + 2, 5, pos.z + 9); cameraHeading = yaw; updateHud(); canvas.tabIndex = -1; canvas.focus();
    if (!localName) { localName = nameTag(displayName(), true); scene.add(localName); }
    if (!guestName && new URLSearchParams(location.search).has('coins')) window.setTimeout(() => itemShop.open(), 0);
  }
  function leaveCity() {
    saveLocation();danceAudio.stop();localSupermanUntil=0;
    streetStalls.close();streetStalls.state(null,false);
    afkNote = ''; $<HTMLInputElement>('afk-note').value = '';
    $('afk-status').textContent = '';
    setMap(false); profile.close(); closeOptions();
    itemShop.close(); profileEditor.close(); clearGuest();
    onlinePlayersDialog.close();
    finishEntryLoading(); started = false; paused = false; keys.clear(); resetStick(); disconnectMultiplayer(); backgroundMusic.pause(); iceCreamSong.pause();buskingSong.pause();watsonsSong.pause();familyMartSong.pause();masjidSong.pause();if(buskingGain)buskingGain.gain.value=0;if(watsonsGain)watsonsGain.gain.value=0;if(familyMartGain)familyMartGain.gain.value=0;if(masjidGain)masjidGain.gain.value=0;
    $('hud').hidden = true; $('pause').hidden = true; $('intro').hidden = false;
    if (localName) { localName.removeFromParent(); localName.material.map?.dispose(); localName.material.dispose(); localName = null; }
  }
  const requestEntry = await setupAuth(start, leaveCity);
  const signout = document.createElement('button'); signout.className = 'secondary'; signout.textContent = 'Log out'; signout.hidden = !auth;
  const exitConfirmation=setupExitConfirmation(async()=>{if(guestName){leaveCity();return;}if(auth){const{error}=await auth.auth.signOut({scope:'local'});if(error)throw Error(error.message);}});
  signout.onclick = () => exitConfirmation.open();
  document.querySelector('.pause-panel')!.append(signout);
  function reset() {
    localSupermanUntil=0;
    if (seatedChairId && networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'chair-stand', reset: true }));
    if (passengerOf && networkSocket?.readyState === WebSocket.OPEN) { networkSocket.send(JSON.stringify({ type: 'passenger-leave', reset: true })); setPause(false); return; }
    car.group.position.set(-7, .09, 64); car.group.rotation.set(0, Math.PI, 0); car.driver.visible = false; vehicle = 'bike';
    seated = false; jumpHeight = 0; jumpVelocity = 0;
    riding = false; speed = 0; walkSpeed = 0; pos.set(-18, .12, 52); yaw = Math.PI; bikeYaw = Math.PI; orbit = 0; cameraHeading = yaw;
    bike.group.position.set(-6.5, .09, 54); bike.group.rotation.set(0, bikeYaw, 0); bike.rider.visible = false; player.group.visible = true;
    camera.position.set(pos.x + 2, 5, pos.z + 9); setPause(false); toast('Back at Mamak Maju', 'Grab a seat, meet your friends, or explore the city.');
  }
  function distanceTo(point: { x: number; z: number }) { return Math.hypot(pos.x - point.x, pos.z - point.z); }
  function nearbyDriver() { return [...remotePlayers.values()].filter(p => p.riding && !p.passengerOf && distanceTo(p.target) < 3.8).sort((a, b) => distanceTo(a.target) - distanceTo(b.target))[0]; }
  function backSeatFull(id: string) { return roomPlayers.filter(p => p.passengerOf === id).length >= (remotePlayers.get(id)?.vehicle === 'car' ? 3 : 1); }
  function chairOccupied(id: string) { return roomPlayers.some(p => p.id !== networkPlayerId && p.chairId === id); }
  function nearbyChair() { return world.chairs.filter(c => distanceTo(c) < 2.2).sort((a, b) => distanceTo(a) - distanceTo(b))[0]; }
  function sitPose(person: ReturnType<typeof createPerson>) { person.leftLeg.rotation.x = person.rightLeg.rotation.x = -Math.PI / 2; person.leftArm.rotation.x = person.rightArm.rotation.x = -.35; }
  function objectAction() {
    if (passengerOf || riding) return { point: pos, height: 2, label: Math.abs(speed) < 1.5 ? 'Get out' : 'Wait until stopped', disabled: Math.abs(speed) >= 1.5 };
    if (seated) return { point: pos, height: 1.3, label: 'Stand', disabled: false };
    const driver = nearbyDriver();
    if (driver) return { point: driver.target, height: 2, label: backSeatFull(driver.id) ? 'Full' : Math.abs(driver.speed) >= 1.5 ? 'Wait until stopped' : 'Enter', disabled: backSeatFull(driver.id) || Math.abs(driver.speed) >= 1.5 };
    const chair = nearbyChair();
    if (chair) return { point: chair, height: 1.3, label: chairOccupied(chair.id) ? 'Occupied' : 'Sit', disabled: chairOccupied(chair.id) };
    const vehiclePoint = distanceTo(car.group.position) < distanceTo(bike.group.position) ? car.group.position : bike.group.position;
    if (distanceTo(vehiclePoint) < 3.8) return { point: vehiclePoint, height: 1.8, label: 'Enter', disabled: false };
    return null;
  }
  function interact() {
    if (!started || paused || isDancing() || tableSocial.opened || streetStalls.opened) return;
    if (jumpHeight > 0 || jumpVelocity > 0) return;
    if (passengerOf) { if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'passenger-leave' })); return; }
    if (seated) { if (networkConnected && networkSocket?.readyState === WebSocket.OPEN) { networkSocket.send(JSON.stringify({ type: 'chair-stand' })); return; } seatedChairId = null; seated = false; chairSound(false); pos.copy(standPosition); keys.clear(); resetStick(); return; }
    const driver = !riding && nearbyDriver();
    if (driver) { if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'passenger-join', driverId: driver.id })); return; }
    const chair = !riding && nearbyChair();
    if (chair) { if (chairOccupied(chair.id)) return; if (networkConnected && networkSocket?.readyState === WebSocket.OPEN) { keys.clear(); resetStick(); networkSocket.send(JSON.stringify({ type: 'chair-sit', chairId: chair.id })); return; } if (auth) return; standPosition.copy(pos); pos.set(chair.x, .12, chair.z); yaw = chair.yaw; seated = true; chairSound(true); walkSpeed = 0; keys.clear(); resetStick(); return; }
    if (riding) {
      if (Math.abs(speed) > 1.5) { toast('Slow down dulu', 'Hold Space to brake before getting off.', 2); return; }
      const exit = safeDismount(pos, yaw, [...world.solids, ...world.traffic.map(c => ({ x: c.x, z: c.z, hx: 1.8, hz: 1.8 }))], vehicle === 'car' ? 2.7 : 2.2);
      if (!exit) { toast('A little more room', 'Move the bike to an open spot before getting off.', 2); return; }
      riding = false; localSupermanUntil=0; speed = 0; pos.set(exit.x, .12, exit.z); player.group.visible = true; bike.rider.visible = false; car.driver.visible = false; return;
    }
    if (distanceTo(car.group.position) < 3.8 && distanceTo(car.group.position) < distanceTo(bike.group.position)) { localSupermanUntil=0; vehicle = 'car'; riding = true; player.group.visible = false; car.driver.visible = true; pos.copy(car.group.position); yaw = car.group.rotation.y; speed = 0; orbit = 0; chime(); return; }
    if (distanceTo(bike.group.position) < 3.8) { vehicle = 'bike'; riding = true; player.group.visible = false; bike.rider.visible = true; pos.copy(bike.group.position); yaw = bikeYaw; speed = 0; orbit = 0; chime(); }
  }
  $('open-wardrobe').onclick = setupWardrobe(look => {
    applyAppearance(player.group, look); applyAppearance(bike.rider, look); applyAppearance(car.driver, look);
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'outfit', shirt: look.shirt, trousers: look.trousers }));
    toast('Looking good, lah', 'Your new outfit is saved.', 2);
  });
  $('touch-horn').onclick = honk; $('desktop-horn').onclick = honk; $('touch-superman').onclick = toggleSuperman; $('desktop-superman').onclick = toggleSuperman;
  $('start').onclick = requestEntry; $('menu').onclick = () => setPause(true); $('resume').onclick = () => setPause(false); $('reset').onclick = reset; $('interaction').onclick = () => { interact(); keys.clear(); canvas.focus(); }; $('touch-recall').onclick = () => triggerRecall(); $('desktop-recall').onclick = () => triggerRecall();
  $<HTMLInputElement>('rain-toggle').onchange = event => {
    rainEnabled = (event.target as HTMLInputElement).checked; rain.visible = rainEnabled;
    const color = rainEnabled ? '#adbeb8' : '#d6decd'; scene.background = new THREE.Color(color); (scene.fog as THREE.Fog).color.set(color);
    sun.intensity = rainEnabled ? 1.25 : 2.7;
    $('weather-label').textContent = rainEnabled ? '17:42 · Hujan sekejap' : '17:42 · Golden hour';
  };
  $<HTMLInputElement>('music-toggle').onchange = event => {
    musicEnabled = (event.target as HTMLInputElement).checked;
    try { localStorage.setItem('lepakmamak-music', musicEnabled ? 'on' : 'off'); } catch { /* Playback still works without storage. */ }
    if (musicEnabled && started) startBackgroundMusic(); else backgroundMusic.pause();
  };
  $<HTMLInputElement>('sound-toggle').onchange = event => { audioEnabled = (event.target as HTMLInputElement).checked; if (audioEnabled) { ensureAudio(); startBackgroundMusic(); } else { danceAudio.stop();buskingSong.pause();if(buskingGain)buskingGain.gain.value=0;watsonsSong.pause();if(watsonsGain)watsonsGain.gain.value=0;familyMartSong.pause();if(familyMartGain)familyMartGain.gain.value=0;masjidSong.pause();if(masjidGain)masjidGain.gain.value=0;iceCreamSong.pause(); if (iceCreamGain) iceCreamGain.gain.value = 0; } };
  function setShadows(enabled: boolean) {
    if (renderer.shadowMap.enabled === enabled) return;
    renderer.shadowMap.enabled = enabled;
    scene.traverse(obj => { if (obj instanceof THREE.Mesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m.needsUpdate = true);
    } });
    $<HTMLInputElement>('shadow-toggle').checked = enabled;
  }
  let graphicsQuality = 'auto', autoReduced = false, slowFrames = 0;
  try { const savedQuality = localStorage.getItem('lepak-graphics'); if (['auto', 'smooth', 'detailed'].includes(savedQuality || '')) graphicsQuality = savedQuality!; } catch { /* Storage is optional. */ }
  function applyQuality() {
    const smooth = graphicsQuality === 'smooth' || (graphicsQuality === 'auto' && (touch || autoReduced));
    renderer.setPixelRatio(Math.min(devicePixelRatio, smooth ? 1 : 1.6));
    setShadows(!smooth);
    $<HTMLSelectElement>('graphics-quality').value = graphicsQuality;
  }
  $('graphics-quality').onchange = () => {
    graphicsQuality = $<HTMLSelectElement>('graphics-quality').value; autoReduced = false; slowFrames = 0;
    try { localStorage.setItem('lepak-graphics', graphicsQuality); } catch { /* Storage is optional. */ }
    applyQuality();
  };
  $<HTMLInputElement>('shadow-toggle').onchange = event => setShadows((event.target as HTMLInputElement).checked);
  applyQuality();
  function resetCamera() { orbit = 0; cameraPitch = .35; cameraHeading = yaw; zoom = 9; }
  $('camera-reset').onclick = () => { resetCamera(); canvas.focus(); };
  $('camera-in').onclick = () => { zoom = Math.max(5, zoom - 2); canvas.focus(); };
  $('camera-out').onclick = () => { zoom = Math.min(17, zoom + 2); canvas.focus(); };
  function updateTypingLayout() {
    const typing = document.activeElement?.id === 'chat-input';
    document.body.classList.toggle('chat-typing', typing);
    const viewport = window.visualViewport;
    const keyboardHeight = viewport ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
  }
  document.addEventListener('focusin', updateTypingLayout);
  document.addEventListener('focusout', () => queueMicrotask(updateTypingLayout));
  window.visualViewport?.addEventListener('resize', updateTypingLayout);
  window.visualViewport?.addEventListener('scroll', updateTypingLayout);
  const gameKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyR', 'KeyH']);
  window.addEventListener('keydown', event => {
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!$('auth-panel').hidden) return;
    if (event.code === 'Enter' && !started) { event.preventDefault(); requestEntry(); return; }
    if(wall.opened){if(event.code==='Escape'){event.preventDefault();wall.close();}return;}
    if (profile.open || tableSocial.opened || streetStalls.opened) return;
    if (event.code === 'KeyM' && started && !paused && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); if (!event.repeat) setMap(!cityMap.open); return; }
    if (cityMap.open && event.code === 'Escape') { event.preventDefault(); setMap(false); return; }
    if (event.code === 'Escape') { event.preventDefault(); setPause(!paused); return; }
    if (paused && event.code === 'Tab') {
      const focusable = Array.from($('pause').querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')).filter(element => element.getClientRects().length > 0);
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)!.focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
      return;
    }
    if (!started || paused || event.ctrlKey || event.metaKey || event.altKey) return;
    if (gameKeys.has(event.code)) event.preventDefault();
    if (event.code === 'Space' && !event.repeat) jump();
    if (event.code === 'KeyH' && !event.repeat) honk();
    if (event.code === 'KeyR' && !event.repeat) triggerRecall();
    if (event.code === 'KeyC') resetCamera();
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('pagehide', saveLocation);
  window.addEventListener('beforeunload', disconnectMultiplayer);
  window.addEventListener('blur', () => { keys.clear(); resetStick(); dragging = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveLocation(); keys.clear(); resetStick(); dragging = false; } });
  const options = $('player-options');
  const profile = $<HTMLDialogElement>('player-profile');
  let selectedName = '', selectedProfileId = '';
  function closeOptions() { options.hidden = true; }
  function toggleSuperman() {
    if (!riding || passengerOf || vehicle !== 'bike') return;
    const cancel = isSuperman(); localSupermanUntil = cancel ? 0 : Date.now() + 6000;
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: cancel ? 'superman-cancel' : 'superman' }));
    updateHud();
  }
  function openPlayerOptions(x: number, y: number) {
    closeOptions();
    if (!started || paused || cityMap.open || profile.open || wall.opened) return;
    const rect = canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), camera);
    const own = riding && !passengerOf ? (vehicle === 'car' ? car.driver : bike.rider) : player.group;
    own.userData.profileName = displayName(); own.userData.profileId = networkPlayerId;
    if (localName) { localName.userData.profileName = displayName(); localName.userData.profileId = networkPlayerId; }
    const targets = [own, ...Array.from(remotePlayers.values(), p => p.group), ...(localName ? [localName] : [])];
    const hit = ray.intersectObjects(targets, true)[0];
    if (!hit) return;
    let object: THREE.Object3D | null = hit.object;
    while (object && typeof object.userData.profileName !== 'string') object = object.parent;
    if (!object) return;
    $('dance-action').hidden=object.userData.profileId!==networkPlayerId;
    $('dance-action').textContent=isDancing()?'Stop dance':'Dance · 10s';
    $<HTMLButtonElement>('dance-action').disabled=!networkConnected||(!isDancing()&&(riding||seated||jumpHeight>0));
    $('superman-action').hidden=object.userData.profileId!==networkPlayerId||!riding||!!passengerOf||vehicle!=='bike';
    $('superman-action').textContent=isSuperman()?'Stop Superman':'Superman · 6s';
    selectedName = object.userData.profileName; selectedProfileId = object.userData.profileId || '';
    keys.clear(); resetStick(); dragging = false;
    options.hidden = false;
    options.style.left = `${Math.max(8, Math.min(x, innerWidth - options.offsetWidth - 8))}px`;
    options.style.top = `${Math.max(8, Math.min(y, innerHeight - options.offsetHeight - 8))}px`;
    $('view-profile').focus();
  }
  $('dance-action').onclick=()=>{closeOptions();if(isDancing()){if(networkSocket?.readyState===WebSocket.OPEN)networkSocket.send(JSON.stringify({type:'dance-cancel'}));return;}if(riding||seated||jumpHeight>0)return;ensureAudio();keys.clear();resetStick();walkSpeed=0;if(networkSocket?.readyState===WebSocket.OPEN)networkSocket.send(JSON.stringify({type:'dance'}));};
  $('superman-action').onclick=()=>{closeOptions();toggleSuperman();};
  function openSelectedProfile() { closeOptions(); $('profile-name').textContent = selectedName; $('profile-details').replaceChildren(); if (networkConnected && networkSocket?.readyState === WebSocket.OPEN && selectedProfileId) { $('profile-details').textContent = 'Loading profile…'; networkSocket.send(JSON.stringify({type:'profile-view',id:selectedProfileId})); } else $('profile-details').textContent='Reconnect to view this profile.'; profile.showModal(); $('close-profile').focus(); }
  $('view-profile').onclick = openSelectedProfile;
  $('open-my-profile').onclick = () => { selectedName=displayName();selectedProfileId=networkPlayerId;openSelectedProfile(); };
  $('close-profile').onclick = () => { profile.close(); canvas.focus(); };
  profile.addEventListener('cancel', event => { event.preventDefault(); profile.close(); canvas.focus(); });
  document.addEventListener('pointerdown', event => { if (!options.contains(event.target as Node)) closeOptions(); });
  options.addEventListener('keydown', event => { if (event.key === 'Escape' || event.key === 'Tab') { closeOptions(); canvas.focus(); event.preventDefault(); event.stopPropagation(); } });
  canvas.addEventListener('contextmenu', event => { event.preventDefault(); openPlayerOptions(event.clientX, event.clientY); });
  let pointerId: number | null = null, pointerX = 0, pointerY = 0, pointerAt = 0, pointerMoved = false, touchPointer = false;
  canvas.addEventListener('pointerdown', event => {
    if (!started || paused || cityMap.open || wall.opened || dragging || event.button !== 0) return;
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
  window.addEventListener('resize', () => { resetStick(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  let selectedMapPlace='';
  const mapDirectory=setupCityDirectory($('city-directory'),$<HTMLCanvasElement>('expanded-map'),id=>{selectedMapPlace=id;mapDirectory.selected(id);drawMap(true);});
  function drawMap(expanded = false) {
    const map = $<HTMLCanvasElement>(expanded ? 'expanded-map' : 'minimap'); const ctx = map.getContext('2d')!;
    const w = map.width, h = map.height, scale = expanded ? w / 340 : 1.06;
    ctx.fillStyle = '#294b3f'; ctx.fillRect(0, 0, w, h); ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(scale, scale);
    ctx.fillStyle = '#395b44'; ctx.fillRect(-62, -147, 124, 67);
    ctx.fillStyle = '#82907a';
    for (const x of [0, 76, -82]) ctx.fillRect(x - 8.5, -157, 17, 314);
    for (const z of [-64, 8, 78]) ctx.fillRect(-157, z - 8.5, 314, 17);
    for (const b of world.mapBuildings) { ctx.fillStyle = '#4d6c56'; ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d); }
    for(const place of mapPlaces){
      const chosen=place.id===selectedMapPlace;
      ctx.fillStyle=chosen?'#ffffff':place.kind==='kedai'?'#f1c85c':place.kind==='gerai'?'#efab83':place.kind==='minyak'?'#45d8cf':place.kind==='ibadah'?'#d3a6f5':'#7ee1bd';ctx.beginPath();ctx.arc(place.x,place.z,expanded?5.5:2,0,Math.PI*2);ctx.fill();
      if(expanded){ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.fillStyle='#183b30';ctx.fillText(place.id,place.x,place.z+2.7);}
      if(expanded&&chosen){ctx.strokeStyle='#fff1a1';ctx.lineWidth=.8;ctx.setLineDash([2,2]);ctx.beginPath();ctx.moveTo(pos.x,pos.z);ctx.lineTo(place.x,place.z);ctx.stroke();ctx.setLineDash([]);}
    }
    const selectedPlace=mapPlaces.find(p=>p.id===selectedMapPlace);
    if(expanded){drawPlaceLabels(ctx,mapDirectory.labels,selectedMapPlace);$('map-place-info').textContent=selectedPlace?`${selectedPlace.name} · ${Math.round(distanceTo(selectedPlace))} m away · Follow the dotted line`:'All locations are shown. Tap a map label or directory name to highlight the way.';}
    if (!riding || vehicle !== 'car') { ctx.fillStyle = '#f4a5bf'; ctx.beginPath(); ctx.arc(car.group.position.x, car.group.position.z, 3, 0, Math.PI * 2); ctx.fill(); }
    if (!riding || vehicle !== 'bike') { ctx.fillStyle = '#5ed7c3'; ctx.beginPath(); ctx.arc(bike.group.position.x, bike.group.position.z, 2.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.translate(pos.x, pos.z); ctx.rotate(-yaw); ctx.fillStyle = '#fff9db'; ctx.strokeStyle = '#274735'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(-5, -5); ctx.lineTo(0, -2); ctx.lineTo(5, -5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#d3dfba'; ctx.font = '600 9px "DM Sans"'; ctx.textAlign = 'center'; if(!expanded)ctx.fillText('KLCC', 0, -138);
    if (expanded) {
      ctx.fillText('N ↑', 140, -145);
      for (const remote of remotePlayers.values()) { ctx.fillStyle = '#e4b87b'; ctx.beginPath(); ctx.arc(remote.group.position.x, remote.group.position.z, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  function updateHud() {
    const jumpButton = document.querySelector<HTMLButtonElement>('.touch-actions [data-key="Space"]')!;
    jumpButton.textContent = riding ? 'BRAKE' : 'JUMP'; jumpButton.setAttribute('aria-label', riding ? 'Brake' : 'Jump');
    const area = pos.z < -74 ? 'KLCC Park' : pos.z < 9 ? 'Jalan Lepak' : 'Kampung Maju';
    $('district').textContent = area; $('map-area').textContent = area.toUpperCase();
    $('move-label').textContent = riding ? 'Drive' : 'Move'; $('action-key').textContent = riding ? 'Space' : 'Shift'; $('action-label').textContent = riding ? 'Brake' : 'Run';
    const kmh = Math.round(Math.abs(riding ? speed : walkSpeed) * 3.6);
    $('speed').textContent = String(kmh).padStart(2, '0'); $('speed-fill').style.width = `${Math.min(100, kmh / 72 * 100)}%`;
    $('vehicle-label').textContent = passengerOf ? vehicle === 'car' ? 'CAR · PASSENGER' : 'PILLION · PASSENGER' : riding ? vehicle === 'car' ? 'MYVI · CAR' : 'MAJU 110 · KAPCAI' : 'ON FOOT · TAKE IT EASY';
    $('touch-recall').hidden = $('desktop-recall').hidden = riding;
    $('touch-horn').hidden = $('desktop-horn').hidden = !riding || !!passengerOf;
    const showSuperman=riding&&!passengerOf&&vehicle==='bike';
    for(const id of ['touch-superman','desktop-superman']){const button=$<HTMLButtonElement>(id);button.hidden=!showSuperman;button.textContent=isSuperman()?'STOP':'SUPERMAN';button.setAttribute('aria-pressed',String(isSuperman()));}
    const seatsPanel = $('vehicle-seats');
    seatsPanel.hidden = !riding || vehicle !== 'car';
    if (!seatsPanel.hidden) {
      const driverId = passengerOf || networkPlayerId;
      const occupants = roomPlayers.filter(p => p.passengerOf === driverId);
      const names = [passengerOf ? roomPlayers.find(p => p.id === driverId)?.name || 'Driver' : displayName(), ...[0, 1, 2].map(i => occupants.find(p => p.seatIndex === i)?.name || '')];
      const key = JSON.stringify(names);
      if (seatsPanel.dataset.seats !== key) {
        seatsPanel.dataset.seats = key; seatsPanel.replaceChildren();
        const heading = document.createElement('strong'); heading.textContent = `CAR · ${names.filter(Boolean).length} / 4`; seatsPanel.append(heading);
        names.forEach((name, i) => { const row = document.createElement('div'); row.textContent = `${i + 1} · ${i === 0 ? 'Driver: ' : ''}${name || 'Empty seat'}`; row.className = name ? 'occupied' : ''; seatsPanel.append(row); });
      }
    }
    drawMap();
    if (cityMap.open) drawMap(true);
  }

  const desiredCamera = new THREE.Vector3(); const target = new THREE.Vector3();
  let hudTimer = 0, lastTime = performance.now();
  function frame(time: number) {
    const frameSeconds = (time - lastTime) / 1000;
    if (started && !document.hidden && graphicsQuality === 'auto' && !autoReduced && !touch) {
      slowFrames = frameSeconds > .025 && frameSeconds < .2 ? slowFrames + frameSeconds : Math.max(0, slowFrames - frameSeconds * .5);
      if (slowFrames > 5) { autoReduced = true; applyQuality(); }
    }
    const dt = Math.min(frameSeconds, .04); lastTime = time; elapsed += dt;
    const active = started;
    {
      simTime += dt;
      streetAnimals.update(Date.now()/1000, pos, (cat, volume, pan) => {
        if (started && audioEnabled && audioContext?.state === 'running') animalSound(audioContext, cat, volume, pan, citySoundsGain!);
      });
      // A shared clock-based route keeps the vendor in the same area for all players.
      const vendorPhase = (Date.now() % 90000) / 90000 * Math.PI * 2;
      const vendorX = -5 * Math.cos(vendorPhase), vendorZ = 44 + 18 * Math.sin(vendorPhase);
      iceCreamBike.position.set(vendorX, .09, vendorZ);
      iceCreamBike.rotation.y = Math.atan2(5 * Math.sin(vendorPhase), 18 * Math.cos(vendorPhase));
      const vendorSpeed = Math.hypot(5 * Math.sin(vendorPhase), 18 * Math.cos(vendorPhase)) * Math.PI * 2 / 90;
      for (const wheel of iceCreamBike.userData.wheels as THREE.Mesh[]) wheel.rotation.x += vendorSpeed * dt / .45;
      iceCreamSolid.x = vendorX; iceCreamSolid.z = vendorZ;

      for (const car of world.traffic) {
        const coordinate = car.axis; const old = car[coordinate];
        const ahead = new THREE.Vector3(car.x, 0, car.z); ahead[coordinate] += car.direction * 5;
        const nearPlayer = (started && Math.hypot(ahead.x - pos.x, ahead.z - pos.z) < 3.6) || Math.hypot(ahead.x - vendorX, ahead.z - vendorZ) < 4;
        // Stagger crossing traffic and stop before entering the player's space.
        const crossing = car.axis === 'x' && Math.abs(car.x) < 13 && Math.abs(car.x) > 8 && Math.sin(simTime * .2) < 0;
        if (!nearPlayer && !crossing) car[coordinate] += car.speed * car.direction * dt;
        if (car[coordinate] > 150) car[coordinate] = -150; if (car[coordinate] < -150) car[coordinate] = 150;
        if (started && Math.hypot(car.x - pos.x, car.z - pos.z) < 2.5) car[coordinate] = old;
        car.group.visible = Math.hypot(car.x - pos.x, car.z - pos.z) < 100;
        car.group.position.set(car.x, 0, car.z);
        for (const wheel of (car.group.userData.wheels || []) as THREE.Group[]) wheel.rotation.x += Math.abs(car[coordinate] - old) / .36;
      }
      for (const ped of world.pedestrians) {
        const t = simTime * .12 + ped.phase;
        const offset = Math.sin(t) * ped.range;
        ped.person.group.position.set(ped.startX + (ped.axis === 'x' ? offset : 0), .1, ped.startZ + (ped.axis === 'z' ? offset : 0));
        ped.person.group.visible = Math.hypot(ped.person.group.position.x - pos.x, ped.person.group.position.z - pos.z) < 80;
        ped.person.group.rotation.y = ped.axis === 'x' ? Math.cos(t) > 0 ? Math.PI / 2 : -Math.PI / 2 : Math.cos(t) > 0 ? 0 : Math.PI;
        ped.person.leftLeg.rotation.x = Math.sin(simTime * 6 + ped.phase) * .35; ped.person.rightLeg.rotation.x = -ped.person.leftLeg.rotation.x;
        ped.person.leftArm.rotation.x = -ped.person.leftLeg.rotation.x * .65; ped.person.rightArm.rotation.x = ped.person.leftLeg.rotation.x * .65;
      }
      for (const remote of remotePlayers.values()) {
        remote.group.position.lerp(remote.target, 1 - Math.exp(-14 * dt));
        remote.yaw = dampAngle(remote.yaw, remote.targetYaw, 1 - Math.exp(-12 * dt));
        remote.group.rotation.y = remote.yaw;
        remote.person.group.scale.setScalar(remote.passengerOf && remote.vehicle === 'car' ? .7 : 1);
        remote.person.leftLeg.rotation.x = remote.person.rightLeg.rotation.x = remote.person.leftArm.rotation.x = remote.person.rightArm.rotation.x = 0;
        if (remote.seated || remote.passengerOf) sitPose(remote.person);
        if (!remote.riding) punchPose(remote.person, remote.punchUntil);
        pickleball.equip(remote.person,!remote.riding&&!remote.seated&&insidePickleball(remote.group.position),Math.max(0,(remote.punchUntil-simTime)/.38));
        basketball.pose(remote.person,remote.id);
        if (remote.riding) remote.recallUntil = 0;
        const recallProgress = remote.recallUntil > simTime ? 1 - (remote.recallUntil - simTime) / .82 : 0;
        const pulse = recallProgress > 0 ? 1 + Math.sin(recallProgress * Math.PI) * .16 : 1;
        remote.group.scale.setScalar(remote.car.group.visible || remote.bike.group.visible ? 1 : pulse); remote.bike.rider.scale.setScalar(remote.bike.group.visible ? pulse : 1); remote.car.driver.scale.setScalar(.7 * (remote.car.group.visible ? pulse : 1));
      }
    }
    if (active) {
      const forward = isDancing()?0:THREE.MathUtils.clamp(Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + stickY, -1, 1);
      const turn = isDancing()?0:THREE.MathUtils.clamp(Number(keys.has('KeyA') || keys.has('ArrowLeft')) - Number(keys.has('KeyD') || keys.has('ArrowRight')) - stickX, -1, 1);
      const dynamicSolids: Solid[] = world.traffic.map(car => ({ x: car.x, z: car.z, hx: car.axis === 'z' ? 1 : 1.9, hz: car.axis === 'z' ? 1.9 : 1 }));
      const solids = [...world.solids, ...dynamicSolids];
      if (!riding || vehicle !== 'bike') solids.push({ x: bike.group.position.x, z: bike.group.position.z, hx: .5, hz: 1.15 });
      if (!riding || vehicle !== 'car') solids.push({ x: car.group.position.x, z: car.group.position.z, hx: 1.8, hz: 1.8 });
      if (passengerOf) {
        const driver = remotePlayers.get(passengerOf);
        if (driver) {
          yaw = driver.yaw; const [x, z] = vehicleSeats[vehicle][passengerSeat] || vehicleSeats[vehicle][0];
          pos.set(driver.group.position.x + Math.cos(yaw) * x + Math.sin(yaw) * z, .12, driver.group.position.z - Math.sin(yaw) * x + Math.cos(yaw) * z); speed = driver.speed;
        }
        player.group.position.set(pos.x, vehicle === 'car' ? .36 : .42, pos.z); player.group.rotation.y = yaw; sitPose(player); walkSpeed = 0;
      } else if (riding) {
        if (keys.has('Space')) speed = THREE.MathUtils.damp(speed, 0, 6, dt);
        else if (forward) speed += forward * (forward * speed < 0 ? 15 : 6.7) * dt;
        else speed = THREE.MathUtils.damp(speed, 0, 1.1, dt);
        speed = THREE.MathUtils.clamp(speed, -5, vehicle === 'car' ? 24 : 20);
        if (Math.abs(speed) < .025) speed = 0;
        const steering = Math.min(1, Math.abs(speed) / 3) * (1.65 - Math.min(1, Math.abs(speed) / 23) * .65);
        yaw += turn * steering * dt * Math.sign(speed);
        const hit = moveWithCollisions(pos, Math.sin(yaw) * speed * dt, Math.cos(yaw) * speed * dt, vehicle === 'car' ? 1.85 : .83, solids);
        if (hit) speed *= Math.exp(-9 * dt);
        if (vehicle === 'car') {
          car.group.position.copy(pos); car.group.rotation.y = yaw;
          car.wheels.forEach(wheel => wheel.rotation.x += speed * dt / .38);
        } else {
        bikeYaw = yaw; bike.group.position.copy(pos); bike.group.rotation.y = yaw; bike.group.rotation.z = THREE.MathUtils.damp(bike.group.rotation.z, -turn * Math.min(.17, Math.abs(speed) * .012), 6, dt);
        bike.wheels.forEach(wheel => wheel.rotation.x += speed * dt / .4);
        }
        walkSpeed = 0;
      } else if (seated) {
        player.group.position.set(pos.x, -.22, pos.z); player.group.rotation.y = yaw; sitPose(player); walkSpeed = 0;
      } else {
        if (jumpVelocity !== 0 || jumpHeight > 0) {
          jumpVelocity -= 18 * dt; jumpHeight = Math.max(0, jumpHeight + jumpVelocity * dt);
          if (jumpHeight === 0) { jumpVelocity = 0; movementSound('land'); footstepDistance = 0; }
        }
        const input = new THREE.Vector2(-turn, forward); if (input.length() > 1) input.normalize();
        const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stickX, stickY) > .85; const maxSpeed = running ? 7 : 3.7;
        walkSpeed = THREE.MathUtils.damp(walkSpeed, input.length() * maxSpeed, 14, dt);
        const previousX = pos.x, previousZ = pos.z;
        if (input.length()) {
          input.normalize();
          const reference = cameraHeading + orbit;
          const dx = Math.sin(reference) * input.y - Math.cos(reference) * input.x;
          const dz = Math.cos(reference) * input.y + Math.sin(reference) * input.x;
          yaw = dampAngle(yaw, Math.atan2(dx, dz), 1 - Math.exp(-14 * dt));
          moveWithCollisions(pos, dx * walkSpeed * dt, dz * walkSpeed * dt, .46, solids);
        }
        const travelled = Math.hypot(pos.x - previousX, pos.z - previousZ);
        if (jumpHeight === 0 && travelled > .001) {
          footstepDistance += travelled;
          if (footstepDistance >= (running ? 1.65 : 1.15)) { movementSound('step', running); footstepDistance = 0; }
        } else footstepDistance = 0;
        player.group.position.copy(pos); player.group.rotation.y = yaw;
        const stride = Math.sin(simTime * (running ? 13 : 9)) * Math.min(.7, walkSpeed * .12);
        player.leftLeg.rotation.x = stride; player.rightLeg.rotation.x = -stride; player.leftArm.rotation.x = -stride * .7; player.rightArm.rotation.x = stride * .7;
        player.group.position.y = .12 + jumpHeight + Math.abs(Math.sin(simTime * 9)) * Math.min(.05, walkSpeed * .008);
      }
      if (!riding) punchPose(player, punchUntil);
      pickleball.equip(player,!riding&&!seated&&insidePickleball(pos),Math.max(0,(punchUntil-simTime)/.38));
      basketball.pose(player,networkPlayerId);
      if (riding) recallUntil = 0;
      const localRecallProgress = recallUntil > simTime ? 1 - (recallUntil - simTime) / .82 : 0;
      const localRecallScale = localRecallProgress > 0 ? 1 + Math.sin(localRecallProgress * Math.PI) * .16 : 1;
      player.group.scale.setScalar((passengerOf && vehicle === 'car' ? .7 : 1) * (riding && !passengerOf ? 1 : localRecallScale));
      bike.rider.scale.setScalar(riding && vehicle === 'bike' ? localRecallScale : 1);
      car.driver.scale.setScalar(.7 * (riding && vehicle === 'car' ? localRecallScale : 1));
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
    if (engineGain && engine && audioContext) {
      engineGain.gain.setTargetAtTime(audioEnabled && active && riding ? .013 + Math.abs(speed) * .0007 : 0, audioContext.currentTime, .1);
      engine.frequency.setTargetAtTime(48 + Math.abs(speed) * 6, audioContext.currentTime, .1);
    }
    hudTimer += dt;
    if (active && hudTimer > .1) { hudTimer = 0; updateHud(); }
    const danceNow=Date.now();
    const selfDance=roomPlayers.find(p=>p.id===networkPlayerId)?.danceUntil||0;
    dancePose(player,selfDance-danceNow,10-(selfDance-danceNow)/1000,reducedMotion);
    for(const remote of remotePlayers.values()){const until=roomPlayers.find(p=>p.id===remote.id)?.danceUntil||0;dancePose(remote.person,until-danceNow,10-(until-danceNow)/1000,reducedMotion);}
    supermanPose(bike.riderRig,isSuperman(),elapsed,reducedMotion);
    for(const remote of remotePlayers.values()){const state=roomPlayers.find(p=>p.id===remote.id);supermanPose(remote.bike.riderRig,!!state?.riding&&!state.passengerOf&&state.vehicle==='bike'&&Number(state.supermanUntil)>danceNow,elapsed,reducedMotion);}
    danceAudio.update(roomPlayers,pos,audioContext,citySoundsGain,started&&audioEnabled);
    buskers.update(elapsed,reducedMotion);
    if(buskingGain&&audioContext)buskingGain.gain.setTargetAtTime(started&&audioEnabled?buskingVolume(Math.hypot(pos.x-buskingSpot.x,pos.z-buskingSpot.z)):0,audioContext.currentTime,.2);
    if(watsonsGain&&audioContext)watsonsGain.gain.setTargetAtTime(started&&audioEnabled?watsonsVolume(Math.hypot(pos.x-watsonsSpot.x,pos.z-watsonsSpot.z)):0,audioContext.currentTime,.2);
    if(familyMartGain&&audioContext)familyMartGain.gain.setTargetAtTime(started&&audioEnabled?familyMartVolume(Math.hypot(pos.x-familyMartSpot.x,pos.z-familyMartSpot.z)):0,audioContext.currentTime,.2);
    if(masjidGain&&audioContext)masjidGain.gain.setTargetAtTime(started&&audioEnabled?masjidVolume(nearestMasjidDistance(pos)):0,audioContext.currentTime,.25);
    if (iceCreamGain && audioContext) {
      const distance = Math.hypot(pos.x - iceCreamBike.position.x, pos.z - iceCreamBike.position.z);
      const proximity = Math.max(0, Math.min(1, (24 - distance) / 20));
      iceCreamGain.gain.setTargetAtTime(started && audioEnabled ? 1.2 * proximity * proximity : 0, audioContext.currentTime, .18);
    }
    if (localName) localName.position.set(pos.x, 3.1 + jumpHeight + (passengerOf ? .3 : 0) - (seated ? .34 : 0), pos.z);
    if (localName) updateGameMasterTag(localName, !!roomPlayers.find(p => p.id === networkPlayerId)?.gameMaster, elapsed, reducedMotion);
    for (const remote of roomPlayers) {
      const entity = remotePlayers.get(remote.id);
      if (entity) updateGameMasterTag(entity.label, !!remote.gameMaster, elapsed, reducedMotion);
    }
    voiceRadius.visible=started&&voice.micActive;
    if(voiceRadius.visible){voiceRadius.position.set(pos.x,.035,pos.z);voiceRadius.material.opacity=reducedMotion ? .3 : .22+Math.sin(elapsed*3)*.08;}
    camera.updateMatrixWorld();
    const actionButton = $<HTMLButtonElement>('interaction');
    const action = objectAction();
    actionButton.hidden = !started || paused || cityMap.open || wall.opened || profile.open || onlinePlayersDialog.open || !action || jumpHeight > 0;
    if (action && !actionButton.hidden) {
      const anchor = new THREE.Vector3(action.point.x, action.height, action.point.z).project(camera);
      actionButton.hidden = anchor.z < -1 || anchor.z > 1 || Math.abs(anchor.x) > 1 || Math.abs(anchor.y) > 1;
      actionButton.style.left = `${Math.max(60, Math.min(innerWidth - 60, (anchor.x + 1) * innerWidth / 2))}px`;
      actionButton.style.top = `${Math.max(50, Math.min(innerHeight - 70, (1 - anchor.y) * innerHeight / 2))}px`;
      actionButton.disabled = action.disabled;
      $('interaction-text').textContent = action.label;
    }
    const voicePanel = $('voice-panel');
    voicePanel.hidden = !started || !localName || paused || cityMap.open || wall.opened || profile.open || onlinePlayersDialog.open;
    if (localName && !voicePanel.hidden) {
      const anchor = localName.position.clone().add(new THREE.Vector3(0, .35, 0)).project(camera);
      voicePanel.hidden = anchor.z < -1 || anchor.z > 1 || Math.abs(anchor.x) > 1 || Math.abs(anchor.y) > 1;
      voicePanel.style.left = `${(anchor.x + 1) * innerWidth / 2}px`;
      voicePanel.style.top = `${(1 - anchor.y) * innerHeight / 2}px`;
    }

    camera.updateMatrixWorld();
    streetStalls.update(pos,camera,started&&!paused&&!cityMap.open&&!wall.opened&&!tableSocial.opened&&!riding&&!seated);
    setAfkBubble('self', started ? afkNote : '');
    for(const {table,button} of tableLabels){
      const state=roomTables.find(t=>t.id===table.id);
      button.hidden=!started||paused||cityMap.open||wall.opened||tableSocial.opened||distanceTo(table)>8;
      if(!button.hidden){const p=new THREE.Vector3(table.x,2.1,table.z).project(camera);button.hidden=p.z< -1||p.z>1||Math.abs(p.x)>.9||Math.abs(p.y)>.9;button.style.left=`${(p.x+1)*innerWidth/2}px`;button.style.top=`${(1-p.y)*innerHeight/2}px`;const name=state?.name||table.name;const label=`${name} · ${state?.occupants.length||0}/${state?.capacity||(table.id==='meja-2'?2:3)} · OPEN`;if(button.textContent!==label)button.textContent=label;button.setAttribute('aria-label',`Open Meja Kita at ${name}`);}
    }
    const placedBubbles: { left: number; right: number; top: number; bottom: number }[] = [];
    for (const [id, bubble] of speechBubbles) {
      const afk = id.startsWith('afk:');
      const speakerId = afk ? id.slice(4) : id;
      const speaker = speakerId === 'self' || speakerId === networkPlayerId ? (riding && !passengerOf ? (vehicle === 'car' ? car.group.position : bike.group.position) : player.group.position) : remotePlayers.get(speakerId)?.group.position;
      const remaining = bubble.expiresAt - time;
      if (!speaker || remaining <= 0 || (!networkConnected && !afk)) {
        bubble.element.remove(); speechBubbles.delete(id); continue;
      }
      speechPosition.set(speaker.x, speaker.y + (afk ? 4.5 : 3.8), speaker.z).project(camera);
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
    pickleball.update(pos,started&&!paused&&!riding&&!seated,dt,networkConnected);
    basketball.update(pos,started&&!paused&&!riding&&!seated,dt,networkConnected,networkPlayerId);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  // Read-only diagnostics support browser smoke tests without modifying gameplay state.
  if (import.meta.env.DEV) {
    Object.defineProperty(window, '__lepak', { get: () => ({ superman:isSuperman(), busking:{playing:!buskingSong.paused,gain:buskingGain?.gain.value??0}, watsons:{playing:!watsonsSong.paused,gain:watsonsGain?.gain.value??0}, familyMart:{playing:!familyMartSong.paused,gain:familyMartGain?.gain.value??0}, masjid:{playing:!masjidSong.paused,gain:masjidGain?.gain.value??0,distance:nearestMasjidDistance(pos)}, trafficModels: world.traffic.map(item => item.group.userData.model), graphicsQuality, autoReduced, shadows: renderer.shadowMap.enabled, pixelRatio: renderer.getPixelRatio(), cameraZoom: zoom, cameraOrbit: orbit, iceCream: { x: iceCreamBike.position.x, z: iceCreamBike.position.z, playing: !iceCreamSong.paused, gain: iceCreamGain?.gain.value ?? 0 }, started, paused, riding, passengerOf, vehicle, seated, jumpHeight, punchCount, stick: { x: stickX, y: stickY }, profileScreen: (() => { const p = player.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)).project(camera); return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 }; })(), position: { x: pos.x, z: pos.z }, yaw, speed, money, bike: { x: bike.group.position.x, z: bike.group.position.z }, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, simTime, rain: rainEnabled }) });
  }
  showLoading('Ready to lepak', 'The city is ready.', 100);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  hideLoading();
  // Returning members skip the title screen once Supabase restores a valid session.
  // Calling the same entry function preserves recovery mode and all normal startup checks.
  if (session) requestEntry();
  requestAnimationFrame(frame);
}
void init().catch(error => { console.error(error); fail('The city could not finish loading. Please reload and try again.'); });
