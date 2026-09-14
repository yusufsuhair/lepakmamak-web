import { createMusicPlayer } from './music-player';
import {disposeCharacter} from './character-assets';
import {PlayerStateStream, createFrameQueue, createHeartbeat} from './network-stream';
import {SKY,skyHeight,inSkyPool} from '../shared/sky-dining.mjs';
import {createSkyDining,setSkyDiningNight,swimPose} from './sky-dining';
import {setSalomaNight} from './saloma';
import {createSkyMusic} from './sky-music';
import {beachRestPose,createBeach,type BeachRestKind,type BeachRestSpot} from './beach';
import {createLegoland} from './legoland';
import type {ParkRide} from '../shared/legoland.mjs';
import {createIdleGuard} from './idle';
import {setupChatSound} from './chat-sound';
import {setupUiSounds} from './ui-sound';
import {audioVolume, setAudioVolume} from './audio-preferences';
import {setupVehicleRadio} from './vehicle-radio';
import {updateVehiclePresentation} from './vehicle-presentation';
import {setupLocationArrival} from './location-arrival';
import {createMapOverview} from './map-overview';
import {setupInventory} from './inventory';
import city from '../shared/city.json';
import {SALOMA,salomaGround} from './bridge';
import {rembayungGroundHeight,rembayungPoint} from './rembayung-layout';
import {createAnnouncer} from './announce';
import {createNetStatus} from './netstatus';
import {createSpeakingList} from './speaking';
import {createWhatsNew} from './changelog';
import {createOnboarding} from './onboarding';
import {createRefresher,shouldOfferConnectionRestart} from './refresh';
import {createRipples} from './ripple';
import {createCarFinder,drawCarPin} from './car-finder';
import {districtFor} from '../shared/districts.mjs';
import {createGmAura,gmHover} from './gm-aura';
import teleports from '../shared/teleports.json';
import {horizontalDistance,remoteIsVisible,remoteNeedsSnap} from './remote-visibility';
import {setupWeather} from './weather';
import {setKlccNight} from './klcc';
import {setSkylineNight} from './skyline';
import {createClouds} from './clouds';
import {dancePose,createDanceAudio} from './dance';
import { supermanPose } from './stunts';
import mapPlaces from '../shared/places.json';
import {setupCityDirectory,drawPlaceLabels} from './city-directory';
import {drawLegolandMap,isInLegoland,LEGOLAND_MAP_BOUNDS,LEGOLAND_MAX_ZOOM} from './legoland-map';
import {createPickleball,insidePickleball} from './pickleball';
import {createBasketball,insideBasketball} from './basketball';
import {createBuskers,buskingSpot,rembayungBuskingSpot,buskingVolume} from './busking';
import {createVillageResidents,villageOrigin,villageResidents} from './durian-village';
import {watsonsSpot,watsonsVolume} from './watsons';
import {familyMartSpot,familyMartVolume} from './familymart';
import {masjidVolume,nearestMasjidDistance,setMasjidNight} from './masjid';
import {setWorshipNight} from './worship';
import {setShoplotNight,shoplotFloorHeight} from './shoplots';
import {setBrandsNight} from './brands';
import {createStallWorld,nearestStallDistance,setHawkerNight,setupStalls,stallVoiceVolume} from './stalls';
import {setDistrictNight} from './district-night';
import {locationKey, readLocation, writeLocation} from './location-save';
import { setupSecurity } from './security';
import { setupProfileEditor, renderProfile, renderProfileLoading, renderProfileMessage, type PlayerProfile } from './profile';
import { setupTableSocial, type TableState, type TableInvite } from './table-social';
import tableLocations from '../shared/tables.json';
import chairLocations from '../shared/chairs.json';
import './style.css';
import {createStreetAnimals, animalSound} from './animals';
import { setupShop } from './shop';
import vehicleSeats from '../shared/vehicle-seats.json';
import { savedLook } from './wardrobe';
import { version as appVersion } from '../package.json';
import * as THREE from 'three';
import {createLrt,setLrtNight} from './lrt';
import {stations as lrtStations,trainState,riderPoint,seatOffset,clampCoach,railHeight,arrivalIn} from '../shared/lrt.mjs';
import { nearestLamp } from './lamps';
import {createWorld, createStreetLights, createPerson, createBike, createDriveableCar, createIceCreamBike, applyAccessories, applyAppearance, carStyles, vehicleSolid, type CarStyle, type KlccLift, updateStreaming} from './world';
import { configureMamakLighting, disposeWebAsset, type MamakLighting, type WebAssetState } from './web-assets';
import { installMamakStreets } from './mamak-streets';
import { loadMamakShops } from './mamak-shops';
import {loadMamakRealism,mamakRealismStatus} from './mamak-realism';
import {createMamakFacade} from './mamak-facade';
import { moveWithCollisions, safeDismount, dampAngle, overlaps } from './physics';
import type { Solid } from './physics';
import { auth, session, guestName, clearGuest, displayName, setupAuth } from './auth';
import * as authLifecycle from './auth';
import {preparePetronasEnvironment,PETRONAS} from './petronas';
import {cdnUrl} from './cdn';
import { appearance, type Appearance } from './appearance';
import { shoutTag, nameTag, updateNameTagName, updateNameTagGeng, updateNameTagVoice, updateGameMasterTag, setupChat } from './social';
import { setupVoice } from './voice';
import { setupWall, type WallPost } from './wall';
import { setupExitConfirmation, setupPageExitWarning } from './exit-confirm';
import voiceConfig from '../shared/voice.json';
import './ui-polish.css';
import {setupDeveloperOptions} from './developer-options';
import {createMamakSteam} from './mamak-steam';
import {setupGeng, type GengEvent, type GengState} from './geng';
import {setupFriends, type FriendEvent, type FriendState} from './friends';
import {setupHandleClaim} from './handles';
import {setupInbox, type Peer, type StoredMessage} from './inbox';
import {accountToken, clearStandIn, setStandInToken, standInTokenFor} from './account-token';

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
      <div class="loading-meta"><span id="loading-stage">WORLD</span><span id="loading-percent">8%</span></div>
      <small id="loading-detail">Setting the tables. Warming up the kapcai.</small>
    </div>
  </div>
  <audio id="background-music" crossorigin="anonymous" loop preload="none" aria-hidden="true"></audio>
  <audio id="lofi-music" crossorigin="anonymous" preload="none" aria-hidden="true"></audio>
  <canvas id="world" aria-label="Interactive 3D Kuala Lumpur game world"></canvas>
  <section id="intro" aria-label="Welcome to LepakMamak">
    <div class="intro-top"><div class="brand"><img class="brand-mark" src="/icon-80.png" width="28" height="28" alt="" /> LEPAKMAMAK</div><div class="place-tag"><i class="live-dot"></i>KUALA LUMPUR, MALAYSIA</div></div>
    <div class="intro-copy"><div class="eyebrow intro-kicker">Your mamak. Your geng. Your cerita.</div><h1>LEPAK<span>MAMAK.</span></h1><p class="tagline">Good food. Good friends. A little chaos.</p><p class="intro-description">The teh tarik is hot. The streets are yours.<br>Grab your kapcai and find your own way<br>through a little slice of Kuala Lumpur.</p><p id="session-replaced-message" role="alert" hidden>Your account joined from another tab or device. This session has ended. Enter again to play here instead.</p><button class="primary" id="start">Jom, let's go <span class="arrow">↗</span></button><div class="intro-hint"><span class="hint-keyboard"><kbd>Enter</kbd> to hit the streets <span>·</span> Best with a keyboard</span><span class="hint-touch">Tap to hit the streets</span></div></div>
    <div class="intro-bottom"><p>A small open world. A big Malaysian heart.</p><div class="postcard"><i class="postcard-line"></i><div><strong>Somewhere in Kuala Lumpur</strong><span>Late afternoon · no rush, lah.</span></div></div></div>
  </section>
  <section id="hud" aria-label="Game information" hidden>
    <div class="hud-top"><div class="hud-left"><div class="brand-status"><button type="button" id="multiplayer-status" class="multiplayer-status" aria-label="Show online players" aria-haspopup="dialog"><i></i><span id="multiplayer-status-text">SOLO MODE</span><b id="player-count">1 / ${city.maxPlayers}</b></button><p id="roster-brief" hidden></p></div><div class="hud-divider"></div><div class="district"><strong id="district">Kampung Maju</strong><small id="weather-label">17:42 · Golden hour</small></div></div><div class="hud-right"><button type="button" id="hud-more" aria-label="More controls" aria-expanded="false" aria-controls="hud-right-items"><span aria-hidden="true">⋮</span></button><button type="button" id="open-wall" class="wall-toggle" aria-label="Open Lepak Wall" aria-haspopup="dialog"><span aria-hidden="true">▤</span><b>WALL</b><i id="wall-unread" hidden>0</i></button><div id="camera-controls" aria-label="Camera controls"><button id="camera-reset" aria-label="Centre camera" title="Centre camera (C)"><svg id="compass-needle" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 8.5 13 12 11.2 15.5 13Z" fill="#e2564a"/><path d="M12 21.5 8.5 11 12 12.8 15.5 11Z" fill="#e8efdc"/></svg></button></div><button class="menu-btn" id="menu" aria-label="Open settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z"/><path d="M19.4 13.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z"/></svg></button></div></div>
    <div id="minimap-wrap"><button type="button" id="open-map" class="map-frame" aria-label="Open city map" aria-haspopup="dialog"><canvas id="minimap" width="364" height="332" aria-label="Map showing your location"></canvas><span class="map-north">N ↑ · M</span></button><div class="map-caption"><span id="map-area">KAMPUNG MAJU</span><span>● YOU</span></div></div>
    <button type="button" id="interaction" hidden><span id="interaction-text"></span></button>
    <div id="controls-bar"><div class="control"><kbd>W A S D</kbd><span id="move-label">Move</span></div><div class="control"><kbd id="action-key">Shift</kbd><span id="action-label">Run</span></div><div class="control"><kbd>Space</kbd><span>Jump / brake</span></div><div class="control"><kbd>Drag</kbd><span>Look</span></div><div class="control"><kbd>Esc</kbd><span>Settings</span></div><button id="desktop-superman" class="stunt-button" type="button" aria-label="Superman motorbike stunt" hidden>SUPERMAN</button><button id="desktop-horn" class="recall-button" aria-label="Honk horn" hidden>HONK <kbd>H</kbd></button><button id="desktop-recall" class="recall-button" type="button"><span>RECALL</span><kbd>R</kbd></button></div>
    <section id="vehicle-seats" aria-label="Car occupants" hidden></section><div id="speedometer"><div><span class="speed-number" id="speed">00</span><span class="speed-unit">KM/H</span></div><div class="speed-track"><div id="speed-fill"></div></div><div class="vehicle-label" id="vehicle-label">ON FOOT · TAKE IT EASY</div></div>
    <div id="touch-controls" hidden><div id="move-stick" role="group" aria-label="Movement joystick"><div class="stick-ring"></div><div id="stick-thumb"></div><span>MOVE</span></div><div class="touch-actions"><button data-key="Space" aria-label="Brake">BRAKE</button><button id="touch-superman" class="stunt-button" type="button" aria-label="Superman motorbike stunt" hidden>SUPERMAN</button><button id="touch-horn" aria-label="Honk horn" hidden>HONK</button><button id="touch-recall" class="recall-button" type="button" aria-label="Spam recall emote">RECALL</button></div></div>
  </section>
  <div id="toast" role="status" aria-live="polite" hidden></div>
  <section id="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><div class="pause-panel"><div class="pause-head"><h2 id="pause-title">Settings</h2><button type="button" id="pause-close" aria-label="Close settings">×</button></div><p id="app-version">LepakMamak v${appVersion}</p><button class="primary" id="resume">Resume</button><button class="secondary" id="open-my-profile" type="button" hidden>My social profile</button><button class="secondary" id="open-edit-profile" type="button" hidden>Edit profile · About you</button><button class="secondary" id="open-security" type="button" hidden>Security · Password &amp; account</button><div id="afk-settings"><label for="afk-note">Note</label><input id="afk-note" maxlength="60" placeholder="e.g. AFK jap" autocomplete="off" /><small>Stays above your head until you clear it.</small><div><button id="save-afk" type="button">Set note</button><button id="clear-afk" type="button">Clear note</button></div><span id="afk-status" role="status"></span></div><div class="settings"><label>Graphics<select id="graphics-quality" aria-label="Graphics quality"><option value="low">Low</option><option value="high">High</option></select></label><label>Rain over KL<input id="rain-toggle" type="checkbox" /></label><label>Background music<input id="music-toggle" type="checkbox" checked /></label><label>City sounds<input id="sound-toggle" type="checkbox" checked /></label><label>Sound effects <span class="range-control"><input id="sfx-volume" type="range" min="0" max="1" step="0.05" aria-label="Sound effects volume" /><output id="sfx-volume-value"></output></span></label><label>Background music volume <span class="range-control"><input id="music-volume" type="range" min="0" max="1" step="0.05" aria-label="Background music volume" /><output id="music-volume-value"></output></span></label><label>Voice chat <span class="range-control"><input id="voice-volume" type="range" min="0" max="1" step="0.05" aria-label="Voice chat volume" /><output id="voice-volume-value"></output></span></label></div><button class="secondary" id="reset">Return to Mamak Maju</button><div class="pause-controls"><b>W A S D / arrows</b><span>Move or drive</span><b>Shift</b><span>Run on foot</span><b>Space</b><span>Jump on foot / brake on bike</span><b>Click / tap action</b><span>Sit, stand, enter or leave vehicles</span><b>R</b><span>Send a recall emote</span><b>Click / tap world</b><span>Punch on foot</span><b>Drag / scroll</b><span>Look around / camera distance</span><b>M</b><span>Open or close city map</span><b>C</b><span>Centre camera</span><b>Esc</b><span>Open or close settings</span></div></div></section>
  <dialog id="city-map" aria-labelledby="city-map-title"><header><h2 id="city-map-title" hidden>City map</h2><button id="close-map" type="button" aria-label="Close city map">Close ×</button></header><p id="map-place-info">All locations are shown. Tap a name to highlight the way.</p><div class="city-map-layout"><div><div class="city-map-viewport"><canvas id="expanded-map" width="1024" height="1024" aria-label="Full city map with your location, friends, motorbike"></canvas></div><p class="city-map-hint">N ↑ · On mobile, swipe the map to explore.</p></div><nav id="city-directory" class="city-directory" aria-label="City location directory"></nav></div><footer><span>▲ You &nbsp; ● Friends &nbsp; <span class="map-bike-key">● Bike</span> &nbsp; ● Car</span><span>Move normally · M / Esc to close</span></footer></dialog>
  <div id="player-options" role="menu" aria-label="Player options" hidden><button id="superman-action" class="stunt-button" type="button" role="menuitem" hidden>Superman · 6s</button><button id="dance-action" type="button" role="menuitem" hidden>Dance · 10s</button><button id="view-profile" type="button" role="menuitem">View profile</button><button id="add-friend" type="button" role="menuitem" hidden>Add friend</button><button id="invite-party" type="button" role="menuitem" hidden>Invite to Party</button><button id="message-player" type="button" role="menuitem" hidden>Message</button><button id="leave-party" type="button" role="menuitem" hidden>Leave Geng</button><button id="report-player" type="button" role="menuitem" hidden>Report player</button></div>
  <dialog id="report-player-dialog" aria-labelledby="report-title"><form id="report-form" method="dialog"><h2 id="report-title">Report a player</h2><p id="report-target"></p><label for="report-surface">What happened where?</label><select id="report-surface"><option value="voice">Voice in the room</option><option value="chat">City chat</option><option value="dm">Private messages</option><option value="wall">Wall post</option><option value="drawing">Lukis drawing</option><option value="name">Their display name</option><option value="behaviour">Something else they did</option></select><label for="report-reason">What was wrong with it?</label><select id="report-reason"><option value="harassment">Harassment or bullying</option><option value="sexual">Sexual content</option><option value="hate">Hate speech or slurs</option><option value="threat">Threats or violence</option><option value="scam">Scam or begging for money</option><option value="child-safety">Something involving a child</option><option value="other">Other</option></select><label for="report-note">Anything the moderator should know? (optional)</label><textarea id="report-note" maxlength="300" rows="3" placeholder="In your own words. Not shown to anyone else."></textarea><p id="report-privacy">Voice is never recorded. We send who you reported, the room, and who else was close enough to hear.</p><div><button type="button" id="cancel-report">Cancel</button><button type="submit" id="send-report" class="primary">Send report</button></div></form></dialog>
  <dialog id="player-profile" aria-labelledby="profile-title"><h2 id="profile-title">Player profile</h2><p id="profile-name"></p><div id="profile-details"></div><div id="profile-actions" hidden><button id="profile-add-friend" type="button">Add friend</button><button id="profile-message" type="button">Message</button></div><button id="close-profile" type="button">Close</button></dialog>
  <dialog id="online-players" aria-labelledby="online-players-title"><header><div><h2 id="online-players-title">Who's in the city?</h2><p id="online-players-count"></p></div><button type="button" id="close-online-players" aria-label="Close online players">Close ×</button></header><p id="online-players-empty"></p><ul id="online-players-list"></ul><small>Players in your current room.</small></dialog>
  <div id="error" hidden><h2>Couldn't open the streets.</h2><p id="error-message"></p><button class="primary" id="reload">Try again</button></div>
`;

$('reload').onclick = () => location.reload();
const backgroundMusic = $<HTMLAudioElement>('background-music');
backgroundMusic.volume = .06;
backgroundMusic.loop = true;
// background-short.mp3 is the city ambience. The lofi is the actual background song, laid over it
// and rotated between two tracks. Measured with ffmpeg ebur128: city -18.7 LUFS, lofi1 -18.4,
// lofi2 -17.4. Each track is trimmed to the city's loudness so the rotation never jumps in volume,
// then sat 1.6 dB under the city so it stays a soothing bed rather than the loudest thing playing.
const LOFI_UNDER_CITY = .83;
const LOFI_TRACKS = [{file: 'lofi1.mp3', trim: .966}, {file: 'lofi2.mp3', trim: .861}] as const;
const lofiMusic = $<HTMLAudioElement>('lofi-music');
let lofiTrack = Math.floor(Math.random() * LOFI_TRACKS.length);
let lofiGain: GainNode | null = null;
function lofiLevel() { return LOFI_UNDER_CITY * LOFI_TRACKS[lofiTrack].trim; }
function showLoading(title: string, detail: string, progress: number) {
  const value = Math.max(0, Math.min(100, progress));
  $('loading-title').textContent = title; $('loading-detail').textContent = detail;
  const bar = $('loading-progress'); bar.setAttribute('aria-valuenow', String(value));
  bar.setAttribute('aria-valuetext', detail);
  (bar.firstElementChild as HTMLElement).style.width = `${value}%`;
  $('loading-percent').textContent = `${Math.round(value)}%`;
  $('loading-stage').textContent = value < 60 ? 'WORLD' : value < 100 ? 'CITY LINK' : 'READY';
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
  const ambient=new THREE.HemisphereLight('#f6edcf', '#758b75', 1.8);scene.add(ambient);
  // The shadow pass was 64% of all draw calls with a 180 m box around the player. A 110 m box pushed
  // 30 m ahead of the camera covers what is on screen (fog starts at 145) and sharpens the shadows.
  const SHADOW_REACH = 55, SHADOW_AHEAD = 30;
  const sun = new THREE.DirectionalLight('#ffdfa3', 2.7); sun.position.set(-70, 110, 60); sun.castShadow = true;
  const shadowSize = matchMedia('(any-pointer: coarse)').matches ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize); sun.shadow.camera.left = -SHADOW_REACH; sun.shadow.camera.right = SHADOW_REACH; sun.shadow.camera.top = SHADOW_REACH; sun.shadow.camera.bottom = -SHADOW_REACH;
  sun.shadow.camera.near = .5; sun.shadow.camera.far = 320; sun.shadow.normalBias = .12; sun.shadow.bias = -.00015; scene.add(sun); scene.add(sun.target);
  const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, .1, 600);
  let viewportResizeFrame = 0;
  let viewportResizeTimer = 0;
  function resizeGameViewport() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  // iOS can resize the layout while its keyboard opens, then restore only visualViewport
  // when it closes. In that case the HUD returns to full height but WebGL keeps the short
  // keyboard-sized buffer, exposing the plain green page below the city. Resize once after
  // the next paint and once after Safari's viewport animation has settled.
  function scheduleGameViewportResize() {
    cancelAnimationFrame(viewportResizeFrame);
    viewportResizeFrame = requestAnimationFrame(() => {
      viewportResizeFrame = requestAnimationFrame(resizeGameViewport);
    });
    clearTimeout(viewportResizeTimer);
    viewportResizeTimer = window.setTimeout(resizeGameViewport, 420);
  }
  const clouds=createClouds(scene);
  if(import.meta.env.DEV) Object.defineProperty(window,'__lepakClouds',{get:()=>clouds.status});
  const world = createWorld(scene);
  if(import.meta.env.DEV)Object.defineProperty(window,'__lepakFoliage',{get:()=>({...world.foliage})});
  // Detailed venue models stream in on approach; their fallbacks and every collision are live
  // from the start, and fog begins at 145 m, so the swap lands before the detail is legible.
  // Petronas is 61 m from spawn and loads at once; Rembayung (~131 m) waits for a visit.
  const VENUE_LOAD_RADIUS = 120;
  const venues = [{...PETRONAS, load: () => preparePetronasEnvironment(renderer, world.petronas)}, {...rembayungPoint(0, 17), load: () => world.rembayung.load()}];
  if(import.meta.env.DEV)Object.defineProperty(window,'__lepakPetronas',{get:()=>({...world.petronas.status,fallbackVisible:world.petronas.fallback.visible})});
  const mamakSteam=createMamakSteam(scene);
  if(import.meta.env.DEV)Object.defineProperty(window,'__lepakMamakSteam',{get:()=>({visible:mamakSteam.visible,count:mamakSteam.count})});
  const shopAssets = loadMamakShops(scene, world.shopFallbacks);
  if (import.meta.env.DEV) Object.defineProperty(window, '__lepakShops', {get: () => Object.fromEntries(
    Object.entries(shopAssets.status).map(([asset, state]) => [asset, {state, fallbackVisible: world.shopFallbacks.get(asset)?.visible}]))});
  let mamakAssetState: WebAssetState = 'loading';
  const mamakFacade = createMamakFacade(scene);
  if(import.meta.env.DEV)Object.defineProperty(window,'__lepakMamakFacade',{get:()=>({...mamakFacade.status})});
  let mamakLighting: MamakLighting | null = null, mamakNight = false;
  if(import.meta.env.DEV)Object.defineProperty(window,'__lepakMamakRealism',{get:()=>mamakRealismStatus});
  // Profiling handle: what is actually being drawn, and from which group.
  if(import.meta.env.DEV)Object.assign(window,{__lepakScene:scene});
  void loadMamakRealism(scene,renderer)
    .then(asset => {
      try { mamakLighting = configureMamakLighting(asset); }
      catch (error) { scene.remove(asset); disposeWebAsset(asset); throw error; }
      mamakLighting.setNight(mamakNight);
      mamakSteam.setLayout(mamakRealismStatus.state==='ready'?'realism':'baseline');
      world.mamakProcedural.visible = false;
      mamakAssetState = 'ready';
      asset.userData.source = 'blender-glb';
      void mamakFacade.load(asset);
    })
    .catch(error => {
      mamakAssetState = 'fallback';
      mamakSteam.setLayout('procedural');
      console.warn('[web-assets] Mamak Maju GLB unavailable; keeping procedural fallback', error);
    });
  if(import.meta.env.DEV)Object.defineProperty(window,'__lepakRembayung',{configurable:true,get:()=>({...world.rembayung.status,fallbackVisible:world.rembayung.fallback.visible})});
  if (import.meta.env.DEV) Object.defineProperty(window, '__lepakMamakLighting', {get: () => ({
    state: mamakAssetState, bulbCount: mamakLighting?.bulbCount ?? 0,
    night: mamakNight, intensity: mamakLighting?.intensity ?? 0,
  })});
  const park = createLegoland(scene,world,{
    send:message=>{if(networkSocket?.readyState===WebSocket.OPEN)networkSocket.send(JSON.stringify(message));},
    online:()=>networkConnected,
    canEnter:()=>started&&!paused&&!riding&&!seated&&!beachResting&&lrtId==null&&jumpHeight===0,
    clearInput:()=>{keys.clear();resetStick();},
    notice:(title,body)=>toast(title,body,4),
  });
  const streetLights = createStreetLights(scene, world.solids);
  const streetAssetStatus = { state: 'loading' as WebAssetState, instances: 0, draws: 0, switchableLamps: 0 };
  void installMamakStreets(scene, world.mamakStreetFallback, streetLights).then(asset => {
    streetAssetStatus.state = 'ready';
    for (const model of asset.children) streetAssetStatus.instances += Number(model.userData.instances || 0);
    asset.traverse(object => { if (object instanceof THREE.InstancedMesh) streetAssetStatus.draws++; });
    streetAssetStatus.switchableLamps = asset.userData.switchableLampIndices.length;
  }).catch(error => {
    streetAssetStatus.state = 'fallback';
    console.warn('[web-assets] Mamak street props unavailable; keeping fallback', error);
  });
  if (import.meta.env.DEV) Object.defineProperty(window, '__lepakStreets', {get: () => ({...streetAssetStatus, fallbackVisible: world.mamakStreetFallback.visible})});
  // Night only decides the default: each lamp carries its own answer once somebody walks
  // up and flips it, and that answer is shared with everyone in the room.
  const lampNear = () => nearestLamp(streetLights.lamps, pos.x, pos.z);
  function flipLamp(index: number) {
    const on = !streetLights.lit(index);
    // Solo play still gets the switch; online it is the server that tells everybody.
    if (networkSocket?.readyState !== WebSocket.OPEN) { streetLights.setLamp(index, on); return; }
    networkSocket.send(JSON.stringify({type: 'lamp', index, on}));
  }
  const lrt=createLrt(scene,world.solids);
  let lrtId:number|null=null,lrtSeat=0,lrtClockOffset=0;
  // Where you are standing inside the coach. Only this small offset travels; the carriage
  // itself comes from the shared clock, so everyone draws it in the same place.
  let lrtAlong=0,lrtAcross=0,lrtSentAt=0,lrtSentAlong=0,lrtSentAcross=0;
  const lrtNow=()=>Date.now()+lrtClockOffset;
  // On a phone the top-right row is five 44px targets across a 390px screen, on top of the
  // brand and the district. They fold into one ⋮ that drops the rest underneath it; on a
  // wider screen the row is fine as it is and the ⋮ never appears.
  {
    const row = document.querySelector<HTMLElement>('.hud-right')!;
    const more = $<HTMLButtonElement>('hud-more');
    const shut = () => { row.classList.remove('hud-open'); more.setAttribute('aria-expanded', 'false'); };
    more.onclick = event => {
      event.stopPropagation();
      const open = !row.classList.contains('hud-open');
      row.classList.toggle('hud-open', open);
      more.setAttribute('aria-expanded', String(open));
    };
    // Delegated, not per child: the inventory and Kedai buttons are created later in
    // startup, so a listener attached to each child now would miss them.
    row.addEventListener('click', event => { if (!more.contains(event.target as Node)) shut(); });
    addEventListener('pointerdown', event => { if (!row.contains(event.target as Node)) shut(); });
  }
  const refresher = createRefresher($('hud'));
  const notificationStack=document.createElement('div');notificationStack.id='notification-stack';$('hud').append(notificationStack);notificationStack.append($('toast'));
  const lrtPanel=document.createElement('section');lrtPanel.className='lrt-panel';lrtPanel.hidden=true;lrtPanel.innerHTML='<strong></strong><small></small><button type="button">Turun di stesen</button>';notificationStack.append(lrtPanel);
  lrtPanel.querySelector('button')!.onclick=()=>{if(networkSocket?.readyState===WebSocket.OPEN)networkSocket.send(JSON.stringify({type:'lrt-exit'}));};
  const village=createVillageResidents(scene);
  const villageTalk=document.createElement('button');villageTalk.className='village-talk';villageTalk.hidden=true;document.body.append(villageTalk);
  let villageNearby:typeof villageResidents[number]|undefined;
  const pickleball=createPickleball(scene,world);
  const basketball=createBasketball(scene,world);
  if(import.meta.env.DEV)Object.defineProperty(window,'__lepakCourts',{get:()=>({LM_ENV_Pickleball:{...pickleball.status},LM_ENV_Basketball:{...basketball.status}})});
  const beach=createBeach(scene,world);
  const sky=createSkyDining(scene);
  showLoading('Bringing the streets alive', 'Adding vehicles, neighbours and city sounds…', 66);
  createStallWorld(scene,world.solids);
  const buskers=createBuskers(scene,world.solids);
  const rembayungBuskers=createBuskers(scene,world.solids,rembayungBuskingSpot);
  const iceCreamBike = createIceCreamBike(); iceCreamBike.position.set(-11, .09, 44); iceCreamBike.rotation.y = Math.PI; scene.add(iceCreamBike);
  const iceCreamSolid = { x: -11, z: 44, hx: 1.35, hz: 1.8 }; world.solids.push(iceCreamSolid);
  const rembayungIceCream=createIceCreamBike();rembayungIceCream.position.set(-108,.09,138);rembayungIceCream.rotation.y=Math.PI/2;scene.add(rembayungIceCream);
  world.solids.push({x:-108,z:138,hx:1.8,hz:1.35});
  const streetAnimals = createStreetAnimals(scene, world.solids);
  const player = createPerson(); scene.add(player.group);
  const bike = createBike(); scene.add(bike.group);
  let car = createDriveableCar(); car.group.position.set(-7, .09, 64); car.group.rotation.y = Math.PI; scene.add(car.group);
  const personalCar=car;
  let fleetId:string|null=null, claimPendingUntil=0;
  let pressedCarId:string|null=null,interactionPressUntil=0,interactionPointerDown=false;
  let angryVoice:Promise<ArrayBuffer|null>|null=null;
  const ANGRY_LINES=['Woi! Kereta aku tu!','Eh, cilok kereta aku?!','Woi! Turun sekarang!'];
  let angryBuffer:Promise<AudioBuffer|null>|null=null;
  const angryDrivers:{person:ReturnType<typeof createPerson>;until:number;line:string;gain?:GainNode;source?:AudioBufferSourceNode}[]=[];
  function angryDriver(x:number,z:number,heading:number){
    if(!started||Math.hypot(pos.x-x,pos.z-z)>35*soundRange)return;
    const npc=createPerson('#ef734c');
    const exit=safeDismount(new THREE.Vector3(x,.12,z),heading,world.solids,3);
    npc.group.position.set(exit?.x??x,.12,exit?.z??z);scene.add(npc.group);
    const line=ANGRY_LINES[Math.floor(Math.random()*ANGRY_LINES.length)];
    npc.group.add(shoutTag(line));
    const actor:typeof angryDrivers[number]={person:npc,until:simTime+8,line};angryDrivers.push(actor);
    if(audioEnabled&&audioContext&&citySoundsGain){
      const ctx=audioContext;angryVoice??=fetch('/audio/angry.mp3').then(r=>r.ok?r.arrayBuffer():null).catch(()=>null);angryBuffer??=angryVoice.then(data=>data?ctx.decodeAudioData(data):null).catch(()=>null);
      void angryBuffer.then(buffer=>{if(!buffer||!started||simTime>=actor.until||!audioEnabled)return;
        actor.gain=ctx.createGain();actor.gain.gain.value=0;actor.gain.connect(citySoundsGain!);
        actor.source=ctx.createBufferSource();actor.source.buffer=buffer;actor.source.connect(actor.gain);actor.source.start();
      });
    }
  }
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
    const showing = open && started && !paused;
    // The map owns the screen: the thumbstick and action buttons would otherwise sit on top of it.
    document.body.classList.toggle('map-open', showing);
    if (showing) { resetStick(); keys.delete('Space'); }
    if (showing) { cityMap.showModal(); drawMap(true); $('close-map').focus(); }
    else { cityMap.close(); canvas.focus(); }
  }
  $('open-map').onclick = () => setMap(true);
  $('close-map').onclick = () => setMap(false);
  cityMap.addEventListener('cancel', event => { event.preventDefault(); setMap(false); });
  cityMap.addEventListener('click', event => { if (event.target === cityMap) { const rect = cityMap.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setMap(false); } });
  let skyDining=false;
  let seated = false;
  let seatedChairId: string | null = null;
  let beachResting: BeachRestKind | null = null;
  let beachRestSpot: BeachRestSpot | null = null;
  const standPosition = new THREE.Vector3();
  let jumpHeight = 0, jumpVelocity = 0;
  function jump() {
    if (!started || paused || park.active || seated || beachResting || riding || klccLiftRide || jumpHeight > 0 || jumpVelocity > 0) return;
    jumpVelocity = 6.5; movementSound('jump');
  }
  // The camera starts, and Recall returns it, at the widest view; wheel and pinch zoom in from there.
  const ZOOM_NEAR = 5, ZOOM_FAR = 17;
  let orbit = 0, cameraHeading = Math.PI, zoom = ZOOM_FAR, cameraPitch = .35;
  let dragging = false, lastX = 0, lastY = 0, toastRemaining = 0, simTime = 0;
  const vehicleRadio=setupVehicleRadio();
  const locationArrival=setupLocationArrival(true);
  let audioEnabled = true, rainEnabled = false, musicEnabled = true;
  let soundRange = 1;
  try {
    const storedRange = localStorage.getItem('lepakmamak-sound-range');
    const savedRange = storedRange === null ? NaN : Number(storedRange);
    if (Number.isFinite(savedRange)) soundRange = THREE.MathUtils.clamp(savedRange, .5, 2);
  } catch { /* Storage may be unavailable. */ }
  try { musicEnabled = localStorage.getItem('lepakmamak-music') !== 'off'; } catch { /* Storage may be unavailable. */ }
  $<HTMLInputElement>('music-toggle').checked = musicEnabled;
  function setSoundRange(value: number) {
    soundRange = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 1, .5, 2);
    try { localStorage.setItem('lepakmamak-sound-range', String(soundRange)); } catch { /* Storage may be unavailable. */ }
  }
  setSoundRange(soundRange);
  // A larger value makes the same source audible farther away; 100% preserves the authored falloffs.
  const soundDistance = (distance: number) => distance / soundRange;
  type NetworkPlayer = { skyDining?:boolean; parkRide?:ParkRide|null; y?: number; liftId?: string | null; lrtId?:number|null;lrtSeat?:number;lrtAlong?:number|null;lrtAcross?:number|null; carStyle?:CarStyle; supermanUntil?:number; danceUntil?:number; resting?: BeachRestKind|null; chairId?: string | null; afkNote?: string; gameMaster?: boolean; geng?: string; gengId?: string | null; gengLeader?: boolean; accessories?: string[]; seatIndex?: number | null; passengerOf?: string | null; vehicle?: 'bike' | 'car'; appearance?: Appearance; id: string; name: string; color: string; x: number; z: number; yaw: number; riding: boolean; speed: number; mic?: boolean; speaker?: boolean; seated?: boolean; jumpHeight?: number };
  type RemotePlayer = { stand: THREE.Mesh; detail: boolean; bike: ReturnType<typeof createBike>; passengerOf: string | null; id: string; car: ReturnType<typeof createDriveableCar>; vehicle: string; label: THREE.Sprite; group: THREE.Group; target: THREE.Vector3; yaw: number; targetYaw: number; riding: boolean; speed: number; seated: boolean; resting: BeachRestKind|null; recallUntil: number; person: ReturnType<typeof createPerson>; punchUntil: number };
  const danceAudio=createDanceAudio();
  const isDancing=()=>!!roomPlayers.find(p=>p.id===networkPlayerId&&Number(p.danceUntil)>Date.now());
  let localSupermanUntil=0;
  const supermanUntil=()=>Math.max(localSupermanUntil,Number(roomPlayers.find(p=>p.id===networkPlayerId)?.supermanUntil)||0);
  const isSuperman=()=>riding&&!passengerOf&&vehicle==='bike'&&supermanUntil()>Date.now();
  const remotePlayers = new Map<string, RemotePlayer>();
  let partyMembers = new Set<string>();
  // The only raised floor in the city. onBridge is what keeps the road underneath open.
  let onBridge = false, deckY = 0;
  type KlccLiftRide = { lift: KlccLift; direction: 'up' | 'down'; elapsed: number; phase: 'moving' | 'top' };
  let klccLiftRide: KlccLiftRide | null = null;
  const KLCC_LIFT_TRAVEL_SECONDS = 16;
  const klccLiftPanel = document.createElement('section');
  klccLiftPanel.id = 'klcc-lift-status'; klccLiftPanel.setAttribute('role', 'status'); klccLiftPanel.setAttribute('aria-live', 'polite');
  klccLiftPanel.hidden = true;
  klccLiftPanel.innerHTML = '<strong>Lif KLCC</strong><small></small><b></b><button type="button">Turun lif KLCC</button>';
  notificationStack.append(klccLiftPanel);
  const klccLiftPhase = klccLiftPanel.querySelector('small')!;
  const klccLiftCountdown = klccLiftPanel.querySelector('b')!;
  const klccLiftDown = klccLiftPanel.querySelector('button')!;
  function renderKlccLiftStatus() {
    const ride = klccLiftRide;
    klccLiftPanel.hidden = !started || !ride || paused || cityMap.open;
    if (!ride) return;
    const duration = reducedMotion ? .35 : KLCC_LIFT_TRAVEL_SECONDS;
    const remaining = Math.max(0, Math.ceil(duration - ride.elapsed));
    if (ride.phase === 'top') {
      klccLiftPhase.textContent = 'Berhenti di rooftop · sedia untuk turun';
      klccLiftCountdown.textContent = 'STOP';
      klccLiftDown.hidden = false;
      klccLiftDown.disabled = false;
    } else {
      klccLiftPhase.textContent = ride.direction === 'up' ? 'Sedang naik ke rooftop' : 'Sedang turun ke bawah';
      klccLiftCountdown.textContent = `${remaining}s`;
      klccLiftDown.hidden = true;
      klccLiftDown.disabled = true;
    }
  }
  klccLiftDown.onclick = () => {
    const ride = klccLiftRide;
    if (ride?.phase === 'top') startKlccLift(ride.lift, 'down');
  };
  // The Game Master floats, wings out, over a turning seal. Gated on the server's
  // gameMaster flag, which only the Game Master account carries.
  let isGm = false;
  const gmAura = createGmAura();
  gmAura.group.visible = false;
  const partyInvite = document.createElement('aside'); partyInvite.id = 'party-invite'; partyInvite.hidden = true;
  partyInvite.innerHTML = '<p id="party-invite-text"></p><div><button type="button" id="party-accept">Jom</button><button type="button" id="party-decline">Tak nak</button></div>';
  const tableInvite = document.createElement('aside'); tableInvite.id = 'table-invite'; tableInvite.hidden = true;
  tableInvite.innerHTML = '<p id="table-invite-text"></p><small id="table-invite-meta"></small><div><button type="button" id="table-invite-open">Open table</button><button type="button" id="table-invite-dismiss">Later</button></div>';
  let inviteTimer = 0;
  function answerInvite(type: 'party-accept' | 'party-decline') {
    window.clearTimeout(inviteTimer); partyInvite.hidden = true;
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({type}));
  }
  function showPartyInvite(name: string) {
    partyInvite.querySelector('#party-invite-text')!.textContent = `${name} ajak anda masuk geng.`;
    partyInvite.hidden = false;
    // The server drops the invite after a minute; the banner should not outlive it.
    window.clearTimeout(inviteTimer); inviteTimer = window.setTimeout(() => { partyInvite.hidden = true; }, 60000);
  }
  let tableInviteId = '', tableInviteTimer = 0;
  function hideTableInvite() {
    tableInvite.hidden = true; tableInviteId = ''; tableInvite.querySelector<HTMLButtonElement>('#table-invite-open')!.disabled = false;
    window.clearTimeout(tableInviteTimer);
  }
  function showTableInvite(invite: TableInvite) {
    tableInviteId = invite.id;
    tableInvite.querySelector('#table-invite-text')!.textContent = `${invite.inviter.name} invited you to ${invite.game === 'lukis' ? 'Lukis Lah!' : invite.game === 'poker' ? 'Poker Kampung' : invite.game === 'uno' ? 'UNO Lepak' : 'Werewolf'} at ${invite.tableName}.`;
    tableInvite.querySelector('#table-invite-meta')!.textContent = `${invite.available} space${invite.available === 1 ? '' : 's'} available · Open the table first, then choose JOIN and READY yourself.`;
    tableInvite.querySelector<HTMLButtonElement>('#table-invite-open')!.disabled = false;
    tableInvite.hidden = false;
    window.clearTimeout(tableInviteTimer); tableInviteTimer = window.setTimeout(hideTableInvite, 60000);
  }
  function showTableInviteError(message: string) {
    tableInvite.querySelector('#table-invite-text')!.textContent = message;
    tableInvite.querySelector('#table-invite-meta')!.textContent = 'This invitation was not opened, so you were not seated or enrolled.';
    tableInvite.querySelector<HTMLButtonElement>('#table-invite-open')!.disabled = true;
    tableInvite.hidden = false;
  }
  let peerDots: {x: number; z: number; party: boolean; name?: string}[] = [];
  let partyLeaderId = '';
  let afkNote = '';
  // A Geng belongs to the account and is changed through the server-backed social module.
  // Guests have no wallet or membership, so they simply carry no badge.
  let geng = '', gengLeader = false;
  let gengButton: HTMLButtonElement | null = null;
  let friendsButton: HTMLButtonElement | null = null;
  function applyGengState(state: GengState | null) {
    const current = state?.current || null;
    geng = current?.name || ''; gengLeader = !!current?.leader;
    if (gengButton) { gengButton.hidden = !session || !!guestName; gengButton.dataset.geng = geng; gengButton.title = geng ? `${geng}${gengLeader ? ' · Leader' : ''}` : 'Create or join a Geng'; }
    if (localName) updateNameTagGeng(localName, geng, gengLeader);
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({type: 'geng-refresh'}));
  }
  const speechBubbles = new Map<string, { element: HTMLDivElement; expiresAt: number }>();
  const speechPosition = new THREE.Vector3();
  function clearSpeechBubbles() {
    for (const bubble of speechBubbles.values()) bubble.element.remove();
    speechBubbles.clear();
  }
  function showSpeechBubble(id: string, name: string, text: string) {
    if (!id.startsWith('afk:') && !id.startsWith('village:') && id !== networkPlayerId && !remotePlayers.has(id)) return;
    speechBubbles.get(id)?.element.remove();
    const element = document.createElement('div'); element.className = 'speech-bubble'; element.hidden = true;
    element.setAttribute('aria-hidden', 'true'); // Floating speech is visual-only; City chat remains separate.
    const author = document.createElement('strong'); author.textContent = name;
    const message = document.createElement('span'); message.textContent = text;
    element.append(author, message); $('hud').append(element);
    speechBubbles.set(id, { element, expiresAt: performance.now() + 6500 });
  }
  villageTalk.onclick=()=>{
    if(!villageNearby)return;
    showSpeechBubble(`village:${villageNearby.name}`,villageNearby.name,villageNearby.line);
  };
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
    $('afk-status').textContent = afkNote ? 'Note set' : 'Note cleared';
  }
  // Filled from storage at startup, not on welcome: solo play never receives one. The tag
  // itself is painted when the label exists, which is later.
  $('save-afk').onclick = () => publishAfk($<HTMLInputElement>('afk-note').value);
  $('clear-afk').onclick = () => publishAfk('');
  let localName: THREE.Sprite | null = null;
  const chatPop=setupChatSound();
  const uiSounds=setupUiSounds($<HTMLInputElement>('sound-toggle'));
  const announcer=createAnnouncer($('hud'));
  createWhatsNew(document.querySelector('.pause-panel') as HTMLElement);
  const netStatus=createNetStatus(document.querySelector('.brand-status') as HTMLElement);
  const speaking=createSpeakingList($('hud'));
  const chat = setupChat((text, channel, to) => {
    // Stored conversations go over HTTP and survive a dropped socket; everything else is live.
    if (channel === 'pm') return !!to && inbox.send(to, text);
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN) return false;
    networkSocket.send(JSON.stringify({ type: 'chat', text, channel, to })); return true;
  }, () => { keys.clear(); resetStick(); dragging = false; }, {
    opened: userId => void inbox.opened(userId),
    older: userId => inbox.older(userId),
    block: userId => void inbox.block(userId),
    report: userId => inbox.report(userId),
  });
  let networkSocket: WebSocket | null = null;
  if(import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true') setupDeveloperOptions(message=>{if(networkSocket?.readyState!==WebSocket.OPEN)return false;networkSocket.send(JSON.stringify(message));return true;},value=>weatherUI.preview(value),{get:()=>soundRange,set:setSoundRange});
  let networkPlayerId = '';
  let networkConnected = false;
  let networkSendTimer = 0, networkIdleTimer = 0;
  let lastNetworkState = '';
  let networkReconnectTimer: number | null = null;
  // Why the server last turned us away, kept across the close that follows it.
  let rejection: { code?: string } | null = null;
  let retryDelay = 2500;
  // A cold Railway instance, a sleeping mobile radio, or a brief edge hiccup can
  // reject the first WebSocket while the rest of the page is already loaded. Give
  // the initial join the same recovery path as a returning player, but stop after
  // a few attempts so a genuinely unavailable city still gets a clear error.
  const INITIAL_RETRY_LIMIT = 3;
  let entryLoadingTimer: number | null = null;
  let connectedOnceThisEntry = false, connectionAttempts = 0;
  function finishEntryLoading() {
    if (entryLoadingTimer !== null) { clearTimeout(entryLoadingTimer); entryLoadingTimer = null; }
    hideLoading();
    onboarding.showOnce();
  }
  function completeEntryLoading() {
    if (entryLoadingTimer !== null) clearTimeout(entryLoadingTimer);
    entryLoadingTimer = window.setTimeout(() => { entryLoadingTimer = null; hideLoading(); onboarding.showOnce(); }, 320);
  }
  function beginEntryLoading() {
    connectedOnceThisEntry = false; connectionAttempts = 0;
    showLoading('Entering Kampung Maju', 'Starting your character and joining the city…', 68);
    if (entryLoadingTimer !== null) clearTimeout(entryLoadingTimer);
    entryLoadingTimer = window.setTimeout(() => {
      entryLoadingTimer = null;
      showLoading('Still joining the city', 'Keeping your place ready while the city responds…', 82);
    }, 7000);
  }
  let recallUntil = 0, punchUntil = 0, punchCount = 0;
  function punch() {
    if (!started || paused || park.active || isDancing() || tableSocial.opened || cityMap.open || seated || beachResting || riding || punchUntil > simTime) return;
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
  // Derived once, and empty when there is no endpoint. It used to fall back to the
  // production URL, which meant a build without VITE_MULTIPLAYER_URL — a dev build, say —
  // would send account deletion and weather to the live server. Better to have no API than
  // somebody else's.
  const apiBase = multiplayerEndpoint ? multiplayerEndpoint.replace(/^ws/, 'http').replace(/\/ws$/, '') : '';
  const roomName = (new URLSearchParams(location.search).get('room') || 'kampung').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'kampung';
  let invitedTableId = tableLocations.find(t=>t.id===new URLSearchParams(location.search).get('table'))?.id;
  const tableSocial = setupTableSocial(message => {
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN) return false;
    networkSocket.send(JSON.stringify(message)); return true;
  }, roomName, () => { keys.clear(); resetStick(); dragging = false; }, (title, body) => toast(title, body, 6), tableId => {
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN) return false;
    networkSocket.send(JSON.stringify({type: 'table-go', tableId})); return true;
  }, () => document.getElementById('voice-panel'));
  const streetStalls=setupStalls($('hud'));
  const wall=setupWall(multiplayerEndpoint,()=>{keys.clear();resetStick();dragging=false;},(id,name)=>void openAccountProfile(id,name));
  $('open-wall').onclick=()=>wall.open();
  // Seats per table are counted from the same chair data used to render the world. Normal
  // game tables have four seats; the nine-seat tables keep their larger social layout.
  const seatsPerTable = new Map<string, number>();
  for (const chair of chairLocations) if (chair.tableId) seatsPerTable.set(chair.tableId, (seatsPerTable.get(chair.tableId) || 0) + 1);
  let pressedTableId: string | null = null;
  const tableLabels = tableLocations.map(table=>{
    const button=document.createElement('button');button.className='table-label';button.hidden=true;button.onclick=()=>tableSocial.open(table.id);button.type='button';
    button.addEventListener('pointerdown',event=>{pressedTableId=table.id;button.setPointerCapture(event.pointerId);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{setTimeout(()=>{pressedTableId=null;},0);});
    $('hud').append(button);return {table,button};
  });
  const tableGameTitles:Record<string,string>={lukis:'Lukis Lah!',poker:'Poker Kampung',uno:'UNO Lepak',werewolf:'Werewolf'};
  const tableGamePhases:Record<string,string>={lobby:'lobi',countdown:'mula sebentar lagi',playing:'sedang dimainkan'};
  const keys = new Set<string>();
  let openShopFromGeng:()=>void = () => {};
  let closeGeng = () => {};
  const gengUI = setupGeng(apiBase, applyGengState, () => { keys.clear(); resetStick(); dragging = false; }, action => {
    if (action === 'leave' && networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({type: 'geng-leave'}));
  }, () => openShopFromGeng(), (id, name) => {
    closeGeng();
    void openAccountProfile(id, name);
  }, (event: GengEvent, pending: number) => {
    if (gengButton) {
      const badge = gengButton.querySelector<HTMLElement>('#geng-unread');
      if (badge) { badge.hidden = pending < 1; badge.textContent = pending > 99 ? '99+' : String(pending); }
      gengButton.setAttribute('aria-label', pending ? `Open Geng, ${pending} pending request${pending === 1 ? '' : 's'}` : 'Open Geng');
    }
    const sound = event === 'request-received' ? 'notify' : event === 'accepted' ? 'success' : event === 'declined' ? 'close' : event === 'request-sent' ? 'open' : null;
    if (sound) uiSounds.play(sound);
  });
  closeGeng = () => gengUI.close();
  const friendsUI = setupFriends(apiBase, (_state: FriendState | null) => {
    if (friendsButton) friendsButton.hidden = !accountToken();
    renderProfileActions();
  }, () => { keys.clear(); resetStick(); dragging = false; }, (playerId, name) => {
    friendsUI.close(); chat.openDm(playerId, name); chat.open();
  }, (event: FriendEvent, unread: number) => {
    if (friendsButton) {
      const badge = friendsButton.querySelector<HTMLElement>('#friends-unread');
      if (badge) { badge.hidden = unread < 1; badge.textContent = unread > 99 ? '99+' : String(unread); }
      friendsButton.setAttribute('aria-label', unread ? `Open friends, ${unread} new notification${unread === 1 ? '' : 's'}` : 'Open friends');
    }
    const sound = event === 'request-received' ? 'notify'
      : event === 'accepted' ? 'success'
      : event === 'declined' || event === 'cancelled' || event === 'removed' ? 'close'
      : event === 'request-sent' ? 'open' : null;
    if (sound) uiSounds.play(sound);
  }, (userId, handle, name) => {
    friendsUI.close(); inbox.open({userId, handle, name}); chat.open();
  });
  const handleClaim = setupHandleClaim(apiBase, handle => toast('Handle claimed', `Friends can find you as @${handle}.`, 5));
  const inbox = setupInbox(apiBase, chat.pm, {
    me: () => displayName(),
    toast: (title, body) => toast(title, body, 5),
    report: peer => openConversationReport(peer),
  });
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
  // maxTouchPoints as well as the media query: a tablet with a trackpad attached reports a
  // fine primary pointer, which is how the keyboard hints kept showing up on iPads.
  const touch = matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  document.body.classList.toggle('touch-device', touch);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  createRipples(document.body, {reducedMotion});
  $('touch-controls').hidden = !touch;
  const onboarding = createOnboarding(touch, () => { keys.clear(); resetStick(); dragging = false; });
  document.querySelector('.pause-panel')!.insertBefore(onboarding.button, document.querySelector('#whats-new'));
  if (touch) { $('controls-bar').hidden = true; document.querySelector('.intro-hint')!.textContent = 'Drag the thumbstick to move · drag the world to look'; document.querySelector('#city-map footer span:last-child')!.textContent = 'Close the map to keep moving'; }
  function cubicBezier(t: number, x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    let u = Math.max(0, Math.min(1, t));
    for (let i = 0; i < 5; i++) {
      const x = ((ax * u + bx) * u + cx) * u - t;
      const derivative = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(derivative) < .0001) break;
      u = Math.max(0, Math.min(1, u - x / derivative));
    }
    return ((ay * u + by) * u + cy) * u;
  }
  function setKlccLiftHeight(lift: KlccLift, y: number) {
    lift.cabin.position.y = y;
  }
  function startKlccLift(lift: KlccLift, direction: 'up' | 'down') {
    // A completed upward trip remains in `top` until the player asks to go down.
    // Blocking every non-null ride made the downward action silently do nothing.
    if (klccLiftRide?.phase === 'moving' || riding || seated || lrtId != null) return;
    const from = direction === 'up' ? 0 : lift.topY;
    klccLiftRide = {lift, direction, elapsed: 0, phase: 'moving'};
    pos.set(lift.x, .12, lift.z); deckY = from; onBridge = false;
    setKlccLiftHeight(lift, from);
    player.group.visible = true; bike.rider.visible = false; car.driver.visible = false;
    player.group.position.set(pos.x, deckY + .12, pos.z);
    jumpHeight = 0; jumpVelocity = 0; walkSpeed = 0; keys.clear(); resetStick();
    renderKlccLiftStatus();
    toast('Lif KLCC', direction === 'up' ? 'Naik perlahan ke rooftop KLCC…' : 'Turun perlahan ke bawah…', 4);
  }
  function updateKlccLift(dt: number) {
    const ride = klccLiftRide;
    if (!ride || ride.phase !== 'moving') { renderKlccLiftStatus(); return; }
    const duration = reducedMotion ? .35 : KLCC_LIFT_TRAVEL_SECONDS;
    ride.elapsed = Math.min(duration, ride.elapsed + dt);
    const progress = ride.elapsed / duration;
    const eased = reducedMotion ? progress : cubicBezier(progress, .77, 0, .175, 1);
    const from = ride.direction === 'up' ? 0 : ride.lift.topY;
    const to = ride.direction === 'up' ? ride.lift.topY : 0;
    deckY = THREE.MathUtils.lerp(from, to, eased);
    setKlccLiftHeight(ride.lift, deckY);
    player.group.position.set(pos.x, deckY + .12, pos.z);
    renderKlccLiftStatus();
    if (progress < 1) return;
    if (ride.direction === 'up') {
      deckY = ride.lift.topY; ride.phase = 'top';
      renderKlccLiftStatus();
      toast('Sampai rooftop KLCC', 'Jalan sikit atas platform, atau tekan Turun lif KLCC.', 5);
    } else {
      setKlccLiftHeight(ride.lift, 0); deckY = 0; klccLiftRide = null;
      player.group.position.set(pos.x, .12, pos.z);
      renderKlccLiftStatus();
      toast('Sampai bawah', 'Jom sambung jalan.', 3);
    }
  }
  player.group.position.copy(pos); player.group.rotation.y = yaw;

  // A monsoon downpour: long, fast, wind-slanted streaks packed into a box around the player (about five
  // times the old density). One draw; low graphics draws and moves half of them.
  const rainCount = 4000, RAIN_HEIGHT = 32;
  const rainPositions = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainCount; i++) { const j = i * 6; rainPositions[j] = (Math.random() - .5) * 70; rainPositions[j + 1] = Math.random() * RAIN_HEIGHT; rainPositions[j + 2] = (Math.random() - .5) * 70; }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#c9d5dc', transparent: true, opacity: .42 })); rain.visible = false; rain.frustumCulled = false; scene.add(rain);

  let audioContext: AudioContext | null = null, engine: OscillatorNode | null = null, engineGain: GainNode | null = null;
  const trainDoorStates = new Map<number, boolean>();
  // Area loops fetch nothing until audible: setNearbyLoop attaches src on the first play. The
  // long ones stream from the asset host, and crossOrigin must precede src there or the
  // MediaElementSource below hands Web Audio silence instead of samples.
  const areaLoop = (src: string) => { const song = new Audio(); song.crossOrigin = 'anonymous'; song.loop = true; song.preload = 'none'; song.dataset.src = src; return song; };
  const iceCreamSong = areaLoop('/matkool.mp3');
  const buskingSong=areaLoop(cdnUrl('busking.mp3'));
  const watsonsSong=areaLoop(cdnUrl('watson.mp3'));
  const familyMartSong=areaLoop('/familymart.mp3');
  const masjidSong=areaLoop(cdnUrl('arrahman.mp3'));
  const stallVoiceSong=areaLoop('/duasinggit.mp3');
  let buskingGain:GainNode|null=null;
  let watsonsGain:GainNode|null=null;
  let familyMartGain:GainNode|null=null;
  let masjidGain:GainNode|null=null;
  let stallVoiceGain:GainNode|null=null;
  let iceCreamGain: GainNode | null = null;
  // Straight-piped exhaust: it carries, so it gets a tighter radius and a quieter peak
  // than the ice-cream song, which is meant to be heard across the street.
  const lamboSong = areaLoop('/gintani.mp3');
  const LAMBO_REACH = 16, LAMBO_FULL = 4, LAMBO_PEAK = .3;
  let lamboGain: GainNode | null = null;
  let citySoundsGain: GainNode | null = null;
  function ensureAudio() {
    if (!audioEnabled) return;
    try {
      if (!audioContext) {
        audioContext = new AudioContext();
        citySoundsGain = audioContext.createGain(); citySoundsGain.gain.value = .5 * audioVolume('sfx'); citySoundsGain.connect(audioContext.destination);
        buskingGain=audioContext.createGain();buskingGain.gain.value=0;audioContext.createMediaElementSource(buskingSong).connect(buskingGain);buskingGain.connect(citySoundsGain!);
        watsonsGain=audioContext.createGain();watsonsGain.gain.value=0;audioContext.createMediaElementSource(watsonsSong).connect(watsonsGain);watsonsGain.connect(citySoundsGain!);
        familyMartGain=audioContext.createGain();familyMartGain.gain.value=0;audioContext.createMediaElementSource(familyMartSong).connect(familyMartGain);familyMartGain.connect(citySoundsGain!);
        masjidGain=audioContext.createGain();masjidGain.gain.value=0;audioContext.createMediaElementSource(masjidSong).connect(masjidGain);masjidGain.connect(citySoundsGain!);
        stallVoiceGain=audioContext.createGain();stallVoiceGain.gain.value=0;audioContext.createMediaElementSource(stallVoiceSong).connect(stallVoiceGain);stallVoiceGain.connect(citySoundsGain!);
    iceCreamGain = audioContext.createGain(); iceCreamGain.gain.value = 0;
        audioContext.createMediaElementSource(iceCreamSong).connect(iceCreamGain); iceCreamGain.connect(citySoundsGain!);
        lamboGain = audioContext.createGain(); lamboGain.gain.value = 0;
        audioContext.createMediaElementSource(lamboSong).connect(lamboGain); lamboGain.connect(citySoundsGain!);
        engine = audioContext.createOscillator(); engine.type = 'triangle';
        engineGain = audioContext.createGain(); engineGain.gain.value = 0; engine.connect(engineGain); engineGain.connect(citySoundsGain!); engine.start();
      }
      if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
    } catch { audioEnabled = false; $<HTMLInputElement>('sound-toggle').checked = false; }
  }
  // Table games have their own foley; songs would fight it. Duck them while one is open.
  let musicDuck = 1;
  let musicContext: AudioContext | null = null;
  let musicGain: GainNode | null = null;
  let skyMusic: ReturnType<typeof createSkyMusic> | null = null;
  const updateMusicPlayer = createMusicPlayer(lofiMusic, () => {
    const toggle = $<HTMLInputElement>('music-toggle');
    toggle.checked = !musicEnabled;
    toggle.dispatchEvent(new Event('change'));
  }, nextSong);
  updateMusicPlayer(LOFI_TRACKS[lofiTrack].file);
  function nextSong() {
    lofiTrack = (lofiTrack + 1) % LOFI_TRACKS.length;
    if (lofiGain) lofiGain.gain.value = lofiLevel();
    lofiMusic.src = cdnUrl(LOFI_TRACKS[lofiTrack].file);
    updateMusicPlayer(LOFI_TRACKS[lofiTrack].file);
    if (musicEnabled && started) startBackgroundMusic();
  }
  lofiMusic.addEventListener('ended', nextSong);
  function startBackgroundMusic(force = false) {
    // Entering the city starts the simulation before the socket has admitted the player.
    // Do not let a click on the sign-in form turn that short interval into a music preview.
    if (!musicEnabled || (!force && multiplayerEndpoint && !networkConnected)) return;
    try {
      if (!musicContext) {
        musicContext = new AudioContext();
        skyMusic = createSkyMusic(musicContext);
        musicGain = musicContext.createGain(); musicGain.gain.value = .06 * audioVolume('music');
        musicContext.createMediaElementSource(backgroundMusic).connect(musicGain); musicGain.connect(musicContext.destination);
        lofiGain = musicContext.createGain(); lofiGain.gain.value = lofiLevel();
        musicContext.createMediaElementSource(lofiMusic).connect(lofiGain); lofiGain.connect(musicGain);
        backgroundMusic.volume = 1;
      }
      if (musicContext.state === 'suspended') void musicContext.resume().catch(() => {});
    } catch { /* Retain the quieter media-element fallback where supported. */ }
    // Attached here, not in the markup, so a player with music off never downloads the track.
    if (!backgroundMusic.hasAttribute('src')) backgroundMusic.src = cdnUrl('background-short.mp3');
    if (!lofiMusic.hasAttribute('src')) lofiMusic.src = cdnUrl(LOFI_TRACKS[lofiTrack].file);
    void lofiMusic.play().catch(() => { /* Retried on the next interaction, like the city track. */ });
    void backgroundMusic.play().catch(() => {
      // Browsers can still reject playback when the user starts with the keyboard.
      // The next user interaction will try again without interrupting the game.
    });
  }
  const nearbyLoopStarting = new WeakSet<HTMLAudioElement>();
  // A loop whose download failed rests before retrying, instead of re-requesting every frame.
  const nearbyLoopRetryAt = new WeakMap<HTMLAudioElement, number>();
  function setNearbyLoop(song: HTMLAudioElement, audible: boolean) {
    if (audible) {
      if (song.paused && !nearbyLoopStarting.has(song) && (nearbyLoopRetryAt.get(song) ?? 0) <= performance.now()) {
        if (!song.hasAttribute('src')) {
          song.addEventListener('error', () => { song.pause(); nearbyLoopRetryAt.set(song, performance.now() + 15000); });
          song.src = song.dataset.src!;
        } else if (song.error) song.load();
        nearbyLoopStarting.add(song);
        void song.play().catch(() => {}).finally(() => nearbyLoopStarting.delete(song));
      }
    } else if (!song.paused) song.pause();
  }
  document.addEventListener('pointerdown', () => {
    if (started && ((musicEnabled && (backgroundMusic.paused || lofiMusic.paused || musicContext?.state === 'suspended')) || (audioEnabled && audioContext?.state === 'suspended'))) { ensureAudio(); startBackgroundMusic(); }
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
    if (lrtId!=null || !started || paused || !riding || passengerOf || simTime - lastHornAt < .4) return;
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
  function trainDoorSound(open: boolean, train: number) {
    if (!audioEnabled || !started) return;
    ensureAudio(); if (!audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    // A small two-step electronic chime reads as carriage doors without sounding like a
    // car horn. Closing is lower and shorter; opening rises so both states are obvious.
    const notes = open ? [392, 523, 659] : [494, 370];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      const at = now + index * (open ? .065 : .08);
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(.026, at + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, at + (open ? .18 : .14));
      oscillator.connect(gain); gain.connect(citySoundsGain!);
      oscillator.start(at); oscillator.stop(at + (open ? .2 : .16));
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
    // Keep this argument in the call signature so a later shared-train mixer can pan
    // the sound per carriage without changing the transition detection.
    void train;
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
    // The red player-count dot means the city transport is unavailable. Give the player
    // the same lower-right recovery action as a release update, while keeping auth and
    // moderation states informational because restarting cannot fix either one.
    // A first join has never had a connection to "lose". Showing recovery here made a
    // normal sign-in look broken while a realtime instance was still responding.
    const restartable = connectedOnceThisEntry && shouldOfferConnectionRestart(state, label);
    if (restartable) refresher.showConnectionRestart();
    else if (state === 'online' || state === 'solo' || label === 'LOGIN REQUIRED' || label === 'SUSPENDED' || label === 'CITY FULL') refresher.hideConnectionRestart();
    const statusKey = `${label}:${state}:${count}`;
    if ($('multiplayer-status').dataset.statusKey === statusKey) { renderOnlinePlayers(); return; }
    $('multiplayer-status').dataset.statusKey = statusKey;
    chat.status(state === 'online');
    const status = $('multiplayer-status'); status.dataset.state = state;
    renderOnlinePlayers();
    $('multiplayer-status-text').textContent = label;
    $('player-count').textContent = `${count} / ${city.maxPlayers}`;
    // Who is here, without having to open anything. Four names and a tally, because the
    // point is a glance — the full list is one tap away on the button above.
    const brief = $('roster-brief');
    const others = roomPlayers.filter(p => p.id !== networkPlayerId).map(p => p.name);
    brief.hidden = !networkConnected || !others.length;
    if (!brief.hidden) {
      const shown = others.slice(0, 4).join(', ');
      brief.textContent = others.length > 4 ? `${shown} +${others.length - 4}` : shown;
      brief.title = others.join(', ');
    }
  }
  // A crowded mamak used to draw every one of a hundred players in full articulation, about
  // 33 draw calls each. Only the nearest few earn that; the rest become one capsule, and the
  // far ones stop drawing at all. The geometry is shared, so a stand-in costs one call.
  const STAND_GEOMETRY = new THREE.CapsuleGeometry(.26, .78, 2, 6);
  const CLOSE_RANGE = 9;     // anyone this near is always a person, whatever the budget costs
  const DETAIL_LIMIT = 24;   // articulated players beyond that, nearest first
  const DETAIL_RANGE = 22;   // metres past which nobody is articulated
  const DETAIL_CEILING = 40; // hard bound, so a hundred people in one spot cannot melt a phone
  const VISIBLE_RANGE = 110; // metres past which nobody is drawn
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
    const stand = new THREE.Mesh(STAND_GEOMETRY, new THREE.MeshLambertMaterial({ color: player.color || '#72c8ba' }));
    stand.position.y = .74; stand.visible = false; stand.castShadow = false; group.add(stand);
    group.position.set(player.x, .12, player.z); scene.add(group);
    return { stand, detail: true, bike, passengerOf: player.passengerOf || null, id: player.id, car, vehicle: player.vehicle || 'bike', label, group, target: new THREE.Vector3(player.x, .12, player.z), yaw: player.yaw, targetYaw: player.yaw, riding: player.riding, speed: player.speed, seated: !!player.seated, resting: player.resting || null, recallUntil: 0, person, punchUntil: 0 };
  }
  function syncRemotePlayers(players: NetworkPlayer[]) {
    peerDots = players.filter(p => p.id !== networkPlayerId).map(p => ({x: p.x ?? 0, z: p.z ?? 0, party: partyMembers.has(p.id!), name: p.name}));
    const me = players.find(p => p.id === networkPlayerId);
    if (me?.gameMaster && !isGm) { isGm = true; gmAura.group.visible = true; player.group.add(gmAura.group); }
    roomPlayers = players;
    chat.online(players.map(p => p.id).filter((id): id is string => !!id));
    weatherUI.role(!!players.find(p=>p.id===networkPlayerId)?.gameMaster);
    tableSocial.state(roomTables, networkPlayerId, networkConnected);
    const ownAccessories = players.find(p=>p.id===networkPlayerId)?.accessories; if(ownAccessories) setAccessories(ownAccessories);
    const self = players.find(p => p.id === networkPlayerId);
    if (self) {
      geng = String(self.geng || '').slice(0, 24);
      gengLeader = !!self.gengLeader;
      if (gengButton) { gengButton.hidden = !session || !!guestName; gengButton.dataset.geng = geng; gengButton.title = geng ? `${geng}${gengLeader ? ' · Leader' : ''}` : 'Create or join a Geng'; }
      if (localName) updateNameTagGeng(localName, geng, gengLeader);
    }
    park.peers(players);
    park.sync(self?.parkRide||null);
    if (self?.resting && !self.chairId && !self.passengerOf && !self.riding) {
      const spot = beach.nearbyRest(self);
      if (spot && spot.kind === self.resting) { beachResting = self.resting; beachRestSpot = spot; }
      else { beachResting = null; beachRestSpot = null; beachRestPose(player, null); }
    } else if (self && !self.resting) {
      beachResting = null; beachRestSpot = null; beachRestPose(player, null);
    }
    if(self?.lrtId!=null){lrtId=self.lrtId;lrtSeat=self.lrtSeat||0;const seat=seatOffset(lrtSeat);lrtAlong=self.lrtAlong??seat.along;lrtAcross=self.lrtAcross??seat.across;riding=true;}
    if(self){if(skyDining&&!self.skyDining)deckY=0;skyDining=!!self.skyDining;if(skyDining)deckY=self.y??skyHeight(self);}
    if (self && (self.chairId || seatedChairId)) {
      const nowSeated = !!self.chairId;
      // The table tab follows the chair: it appears when you sit and retires when you get up.
      if (nowSeated !== seated) { chairSound(nowSeated); chat.seated(nowSeated); }
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
      const style=remote.carStyle&&carStyles.includes(remote.carStyle)?remote.carStyle:'myvi';
      if(entity.car.group.userData.model!==style){
        const cache:Map<string,ReturnType<typeof createDriveableCar>>=entity.group.userData.carCache??=new Map();
        cache.set(entity.car.group.userData.model,entity.car);entity.car.group.removeFromParent();
        entity.car=cache.get(style)??createDriveableCar(style);entity.group.add(entity.car.group);entity.car.driver.visible=true;entity.group.userData.lookKey=null;
      }
      const lookKey = JSON.stringify(remote.appearance);
      if (entity.group.userData.lookKey !== lookKey) {
        applyAppearance(entity.person.group, remote.appearance); applyAppearance(entity.bike.rider, remote.appearance); applyAppearance(entity.car.driver, remote.appearance);
        entity.group.userData.lookKey = lookKey;
      }
      for(const model of [entity.person.group,entity.bike.rider,entity.car.driver]) applyAccessories(model,remote.accessories || []);
      updateNameTagVoice(entity.label, !!remote.mic, !!remote.speaker);
      if (remote.mic && Math.hypot(remote.x - pos.x, remote.z - pos.z) < voiceConfig.hearingRadius) speaking.nearby(remote.id, remote.name, remote.appearance);
      else speaking.away(remote.id);
      entity.resting = remote.resting || null;
      const remoteBaseY = entity.resting ? .12 : remote.passengerOf ? remote.vehicle === 'car' ? .36 : .42 : remote.seated ? -.22 : .12;
      entity.target.set(remote.x, remoteBaseY + (remote.jumpHeight || 0) + (remote.y || 0) + (remote.gameMaster ? gmHover(simTime) : 0), remote.z); entity.targetYaw = remote.yaw; entity.riding = remote.riding; entity.speed = remote.speed; entity.seated = !!remote.seated; entity.vehicle = remote.vehicle || 'bike'; entity.passengerOf = remote.passengerOf || null;
      // Visibility is settled once per frame in the detail pass below, which runs more often
      // than this snapshot and would otherwise flicker against it.
    }
    for (const [id, entity] of remotePlayers) {
      if (visibleIds.has(id)) continue;
      disposeRemote(entity); remotePlayers.delete(id);
    }
    setNetworkStatus(networkConnected ? 'CITY ONLINE' : multiplayerEndpoint ? connectedOnceThisEntry ? 'RECONNECTING…' : 'JOINING CITY' : 'SOLO MODE', networkConnected ? 'online' : multiplayerEndpoint ? 'connecting' : 'solo', players.length || 1);
  }
  const voice = setupVoice(message => {
    if (message.type === 'voice-state' && localName) updateNameTagVoice(localName, !!message.mic, !!message.speaker);
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN || networkSocket.bufferedAmount > (message.type === 'voice-audio' ? 4096 : 65536)) return false;
    networkSocket.send(JSON.stringify(message)); return true;
  }, (id, name, level) => speaking.heard(id, name, level, roomPlayers.find(player=>player.id===id)?.appearance));
  voice.volume(audioVolume('voice'));
  vehicleRadio.setVolume(audioVolume('music'));
  for (const channel of ['sfx','music','voice'] as const) {
    const input=$<HTMLInputElement>(`${channel}-volume`),output=$<HTMLOutputElement>(`${channel}-volume-value`);
    const render=()=>{const value=audioVolume(channel);input.value=String(value);output.value=`${Math.round(value*100)}%`;};
    render();
    input.oninput=()=>{
      const value=setAudioVolume(channel,Number(input.value));output.value=`${Math.round(value*100)}%`;
      if(channel==='sfx'&&citySoundsGain)citySoundsGain.gain.value=.5*value;
      if(channel==='music'){if(musicGain)musicGain.gain.value=.06*value;vehicleRadio.setVolume(value);}
      if(channel==='voice')voice.volume(value);
    };
  }
  const voiceRadius=new THREE.Mesh(new THREE.RingGeometry(voiceConfig.hearingRadius-.5,voiceConfig.hearingRadius,72),new THREE.MeshBasicMaterial({color:'#ddf69a',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));
  voiceRadius.renderOrder=10;voiceRadius.rotation.x=-Math.PI/2;voiceRadius.position.y=.035;voiceRadius.visible=false;scene.add(voiceRadius);
  function updateSpeakingProximity() {
    for (const remote of roomPlayers) {
      if (remote.id === networkPlayerId) continue;
      if (remote.mic && Math.hypot(remote.x - pos.x, remote.z - pos.z) < voiceConfig.hearingRadius) speaking.nearby(remote.id, remote.name, remote.appearance);
      else speaking.away(remote.id);
    }
  }
  function disconnectMultiplayer() {
    if(lrtId!=null){lrtId=null;riding=false;speed=0;pos.y=.12;}
    saveLocation();
    seatedChairId = null; if (seated) chat.seated(false); seated = false;
    beachResting = null; beachRestSpot = null; beachRestPose(player, null);
    tableSocial.close(); tableSocial.offline(); roomTables = [];
    partyMembers = new Set(); partyLeaderId = ''; gengUI.live(null); chat.party(null);
    wall.close();
    voice.connected(false);
    if (passengerOf) { passengerOf = null; riding = false; speed = 0; }
    clearSpeechBubbles();
    if (networkReconnectTimer !== null) { window.clearTimeout(networkReconnectTimer); networkReconnectTimer = null; }
    const oldSocket = networkSocket; networkSocket = null;
    oldSocket?.close(1000, 'Leaving the city');
    networkConnected = false; networkPlayerId = '';
    refresher.hideConnectionRestart();
    localSupermanUntil = 0;
    for (const entity of remotePlayers.values()) disposeRemote(entity);
    remotePlayers.clear(); roomPlayers = [];
  }
  function disposeRemote(entity: RemotePlayer) {
    (entity.stand.material as THREE.Material).dispose();
    entity.group.traverse(object => { if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose(); } });
    disposeCharacter(entity.person.group); disposeCharacter(entity.bike.rider); disposeCharacter(entity.car.driver);
    entity.group.removeFromParent();
  }
  function sessionReplaced() {
    leaveCity();
    $('session-replaced-message').hidden = false;
  }
  function retryMultiplayer() {
    if (!started || !multiplayerEndpoint || networkReconnectTimer !== null) return;
    // Before the first welcome, connectionAttempts is the number of sockets that have
    // already failed. Keep a small retry budget for transient startup failures; after
    // that, leave the actionable failure state in place instead of retrying forever.
    if (!connectedOnceThisEntry && connectionAttempts >= INITIAL_RETRY_LIMIT) return;
    networkReconnectTimer = window.setTimeout(() => { networkReconnectTimer = null; connectMultiplayer(); }, retryDelay);
    // A full city refuses everyone at once, and each retry costs a fresh auth check, so
    // backing off keeps a crowd from hammering the server at a fixed 2.5s forever.
    retryDelay = Math.min(retryDelay * 2, 30000);
  }
  let activeLocationKey='', locationSavedAt=0;
  function saveLocation(){
    if(!started||!networkConnected||!activeLocationKey)return;
    const chair=seatedChairId?chairLocations.find(c=>c.id===seatedChairId):null;
    const table=chair?tableLocations.find(t=>t.id===chair.tableId):null;
    const x=table?table.arrivalX:pos.x+(riding?Math.cos(yaw)*2.4:0);
    const z=table?table.arrivalZ:pos.z-(riding?Math.sin(yaw)*2.4:0);
    writeLocation(activeLocationKey,skyDining?{...SKY.entry,yaw}:{x,z,yaw});
  }
  // Old browsers without DecompressionStream keep getting plain JSON.
  const recentFrameTimes:number[]=[];
  const canInflate = typeof DecompressionStream === 'function';
  async function inflateFrame(buffer: ArrayBuffer): Promise<string> {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate'));
    return await new Response(stream).text();
  }
  async function connectMultiplayer() {
    if (!multiplayerEndpoint) {
      setNetworkStatus('SOLO MODE', 'solo', 1);
      startBackgroundMusic();
      showLoading('Welcome to LepakMamak', 'The city is ready.', 100);
      completeEntryLoading();
      return;
    }
    rejection = null;
    connectionAttempts++;
    setNetworkStatus(connectedOnceThisEntry ? 'RECONNECTING…' : 'JOINING CITY', 'connecting', 1);
    if (!connectedOnceThisEntry) showLoading(connectionAttempts > 1 ? 'Still joining the city' : 'Connecting to LepakMamak', connectionAttempts > 1 ? `Connection attempt ${connectionAttempts}…` : 'Opening a secure connection to the city…', connectionAttempts > 1 ? 80 : 74);
    try {
      const accessToken = auth && !guestName ? (await auth.auth.getSession()).data.session?.access_token : undefined;
      if (!started) return;
      const endpoint = multiplayerEndpoint.startsWith('ws') ? multiplayerEndpoint : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${multiplayerEndpoint}`;
      const socket = new WebSocket(`${endpoint}/ws`); networkSocket = socket;
      const playerStates = new PlayerStateStream<any>();
      let pendingPlayers:Parameters<typeof syncRemotePlayers>[0]|null=null, renderPlayers=0;
      const queuePlayers=(players:Parameters<typeof syncRemotePlayers>[0])=>{pendingPlayers=players;if(!renderPlayers)renderPlayers=requestAnimationFrame(()=>{renderPlayers=0;if(socket===networkSocket&&pendingPlayers){syncRemotePlayers(pendingPlayers);pendingPlayers=null;}});};

      const heartbeat = createHeartbeat();
      let telemetryAt = performance.now();
      const heartbeatTimer = window.setInterval(() => {
        if (socket !== networkSocket) { clearInterval(heartbeatTimer); return; }
        if (heartbeat.tick(document.hidden)) { socket.close(4000, 'Heartbeat timeout'); return; }
        if (networkConnected && socket.readyState === WebSocket.OPEN && !document.hidden) {
          socket.send(JSON.stringify({type:'ping',t:heartbeat.probe()}));
          if(performance.now()-telemetryAt>15000){telemetryAt=performance.now();void voice.stats().then(stats=>{if(socket===networkSocket&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'network-telemetry',...heartbeat.stats(),...frames.stats(),frameP95Ms:Math.round([...recentFrameTimes].sort((a,b)=>a-b)[Math.floor(recentFrameTimes.length*.95)]||0),...stats}));}).catch(()=>{});}
        }
      },3000);
      socket.addEventListener('close',()=>{clearInterval(heartbeatTimer);frames.close();cancelAnimationFrame(renderPlayers);pendingPlayers=null;});
      socket.addEventListener('open', () => {
        if (socket !== networkSocket) return;
        if (!connectedOnceThisEntry) showLoading('Joining your room', 'Syncing nearby players, chat and tables…', 90);
        activeLocationKey=locationKey(roomName,guestName?'guest:'+guestName:'account:'+(session?.user.id||'solo'));
        carFinder.clear();
        socket.send(JSON.stringify({ type: 'join', sfu: true, delta: true, deflate: canInflate, opus: voice.opusCapable, resume:readLocation(activeLocationKey), room: roomName, tableId: invitedTableId, accessToken, guest: !!guestName, name: guestName || undefined, standInToken: guestName ? standInTokenFor() || undefined : undefined }));
      });
      const processMessage = (raw: string) => {
        if (socket !== networkSocket) return;
        let message: { serverTime?:number;train?:number;seat?:number; cars?:{id:string;x:number;z:number;yaw:number;owner:string|null;npc:boolean}[];car?:{id:string;x:number;z:number;yaw:number;style:CarStyle};x?:number;z?:number;yaw?:number; names?:string[]; post?:WallPost; profile?: PlayerProfile | null; tables?: TableState[]; tableId?: string; from?: string; count?: number; sentAt?: string; type?: string; id?: string; players?: NetworkPlayer[]; messages?: {id?:string;name:string;text:string;sentAt?:string;gameMaster?:boolean}[]; message?: string; name?: string; text?: string; gameMaster?: boolean; code?: string; volume?: number; audio?: string; codec?: 'pcm'|'opus'; channel?: 'all'|'party'|'dm'|'table'; to?: string; toName?: string; party?: {id:string;leader:string;members:{id:string;name:string;connected?:boolean;reconnecting?:boolean;reconnectUntil?:number;leader?:boolean}[]}|null; lobby?: any; t?: number; inviter?: {id:string;name:string}; invite?: TableInvite; ok?: boolean; sent?: number };
        try { message = JSON.parse(raw); } catch { return; }
        if(message.type==='park-complete'&&message.id)park.complete(Number(message.id));
        if(message.type==='notice'&&message.message){if(message.code==='CAR_CLAIM_DENIED')claimPendingUntil=0;toast('City',message.message,4);}
        if(message.type==='lrt-clock'&&message.serverTime)lrtClockOffset=message.serverTime-Date.now();
        if(message.type==='sky-arrived'){arriveSky(!!(message as unknown as {upstairs:boolean}).upstairs);}
        if(message.type==='lrt-boarded'){lrtClockOffset=message.serverTime!-Date.now();lrtId=message.train!;lrtSeat=message.seat!;{const seat=seatOffset(lrtSeat);lrtAlong=seat.along;lrtAcross=seat.across;lrtSentAlong=seat.along;lrtSentAcross=seat.across;}riding=true;vehicle='car';orbit=.65;const p=riderPoint({lrtId,lrtSeat,lrtAlong,lrtAcross},lrtNow());cameraHeading=p.yaw;camera.position.set(p.x-Math.sin(p.yaw+orbit)*22,railHeight+15,p.z-Math.cos(p.yaw+orbit)*22);player.group.visible=true;car.driver.visible=false;bike.rider.visible=false;jumpHeight=0;speed=0;keys.clear();resetStick();}
        if(message.type==='lrt-exited'){lrtId=null;riding=false;speed=0;pos.set(message.x!,.12,message.z!);player.group.position.copy(pos);keys.clear();resetStick();}
        if(message.type==='fleet'&&message.cars){carFinder.receive(message.cars);for(const state of message.cars){const item=world.traffic.find(c=>c.id===state.id);if(item)Object.assign(item,state);}}
        if(message.type==='car-angry')angryDriver(message.x!,message.z!,message.yaw!);
        if(message.type==='car-claimed'&&message.car){
          const item=world.traffic.find(c=>c.id===message.car!.id);claimPendingUntil=0;
          if(item){car.driver.visible=false;car=item.model;fleetId=item.id;item.owner=networkPlayerId;
            vehicle='car';riding=true;player.group.visible=false;car.group.visible=true;car.driver.visible=true;applyAppearance(car.driver,savedLook());
            pos.set(message.car.x,.12,message.car.z);yaw=message.car.yaw;car.group.position.copy(pos);car.group.rotation.y=yaw;speed=0;orbit=0;keys.clear();resetStick();chime();}
        }
        if(message.type==='teleported'&&message.id)finishTeleport(message.id);
        if(message.type==='teleport-denied'){teleportPending=false;teleportButton.disabled=false;teleportButton.textContent='Teleport';toast('Teleport unavailable',message.message||'Try again.');}
        if(message.type==='weather-override')weatherUI.override((message as unknown as {override:{condition:string;daylight:string}}).override);
        if(message.type==='lamps')streetLights.setLamps((message as unknown as {lamps:Record<string,boolean>}).lamps);
        if(message.type==='lamp'){const lamp=message as unknown as {index:number;on:boolean};streetLights.setLamp(lamp.index,lamp.on);}
        if (message.type === 'welcome' && message.id) { voice.transport((message as any).voiceTransport || 'legacy'); const firstWelcome=!connectedOnceThisEntry; connectedOnceThisEntry=true; connectionAttempts=0; refresher.check(appVersion, String((message as unknown as {version?:string}).version || '')); if(invitedTableId){invitedTableId=undefined;const url=new URL(location.href);url.searchParams.delete('table');history.replaceState(null,'',url); } networkPlayerId = message.id; networkConnected = true; rejection = null; retryDelay = 2500; { const self = message.players?.find(p=>p.id===message.id); if(self){pos.set(self.x,.12,self.z);yaw=self.yaw;riding=false;seated=false;beachResting=null;beachRestSpot=null;beachRestPose(player,null);speed=0;jumpHeight=0;} } voice.connected(true); if (localName) updateNameTagGeng(localName, geng, gengLeader); if(firstWelcome){showLoading('Welcome to LepakMamak', 'City online. Jumpa member, jom lepak!', 100);startBackgroundMusic();completeEntryLoading();} }
        if (message.type === 'welcome' && message.id) {
          // Dev only: the server hands a guest a stand-in account for handles and stored messages.
          const standIn = (message as unknown as {standIn?: {token?: string}}).standIn;
          if (standIn?.token && guestName) { setStandInToken(standIn.token); void friendsUI.refresh(); }
          if (friendsButton) friendsButton.hidden = !accountToken();
          if (accountToken()) void inbox.login();
        }
        if (message.type === 'handle-required') {
          keys.clear(); resetStick(); dragging = false;
          handleClaim.require(String((message as unknown as {suggestion?: string}).suggestion || ''));
        }
        if (message.type === 'dm-new') {
          const pushed = message as unknown as {message?: StoredMessage; from?: Peer};
          if (pushed.message) { inbox.receive(pushed.message, pushed.from); chatPop(); }
        }
        if (message.type === 'profile' && message.id === selectedProfileId && profile.open) { if (message.profile) showLoadedProfile(message.profile, '', message.id); else renderProfileMessage($('profile-details'), 'This player has left the city.'); }
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
        if (message.type === 'pong' && typeof message.t === 'number') { const rtt=heartbeat.reply(message.t);if(rtt!==null)netStatus.sample(rtt); }
        if (message.type === 'gm-announce' && typeof message.text === 'string') { if (message.text) announcer.show(message.text, message.name); else announcer.clear(); }
        if (message.type === 'lobby-state') tableSocial.lobby(message.lobby);
        if (message.type === 'lobby-react') tableSocial.react(message);
        if (message.type === 'party-state') {
          // Reconnecting members have no live player id. They remain visible in the Geng
          // panel, but must not become a minimap marker or count as an online voice peer.
          partyMembers = new Set((message.party?.members || []).map((m: {id: string}) => m.id).filter(Boolean));
          partyLeaderId = String(message.party?.leader || '');
          gengUI.live(message.party || null);
          chat.party(message.party?.members || null);
          voice.party(partyMembers.size > 0);
          tableSocial.geng(partyMembers.size, partyLeaderId === networkPlayerId);
        }
        if (message.type === 'party-invited' && message.inviter) showPartyInvite(message.inviter.name);
        if (message.type === 'table-invited' && message.invite) showTableInvite(message.invite as TableInvite);
        if (message.type === 'table-invite-opened' && message.invite) { hideTableInvite(); tableSocial.openInvite(message.invite as TableInvite); }
        if (message.type === 'table-invite-result' && message.ok === false) showTableInviteError(String(message.message || 'This table invitation is no longer available.'));
        if (message.type === 'geng-updated') void gengUI.refresh();
        if (message.type === 'friends-updated') void friendsUI.refresh();
        if (message.type === 'chat-history' && Array.isArray(message.messages)) chat.history(message.messages);
        if (message.type === 'dm-closed' && message.id) chat.closeDm(message.id);
        if(message.type==='wall-new'&&message.post)wall.receive(message.post);
        if ((message.type === 'welcome' || message.type === 'players') && message.players) queuePlayers(playerStates.full(message.players, (message as any).revision));
        if (message.type === 'players-delta') { const players=playerStates.delta(message as any);if(players)queuePlayers(players);else if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'players-resync'})); }
        if (message.type === 'horn' && message.id && message.id !== networkPlayerId) {
          const remote = remotePlayers.get(message.id);
          if (remote) hornSound(remote.vehicle, Math.max(0, 1 - Math.hypot(remote.target.x - pos.x, remote.target.z - pos.z) / 35));
        }
        if (message.type === 'punch' && message.id && message.id !== networkPlayerId) { const remote = remotePlayers.get(message.id); if (remote) remote.punchUntil = simTime + .38; }
        if (message.type === 'recall' && message.id && message.id !== networkPlayerId) triggerRecall(message.id);
        if (message.type === 'chat' && typeof message.name === 'string' && typeof message.text === 'string') {
          const own = message.id === networkPlayerId;
          // A private thread is named after the other person, whichever end sent it.
          const thread = message.channel === 'dm'
            ? (own ? {id: message.to as string, name: message.toName as string} : {id: message.id as string, name: message.name as string})
            : undefined;
          chat.append(message.name, message.text, message.sentAt, !!message.gameMaster, !own, message.channel === 'party' || message.channel === 'dm' || message.channel === 'table' ? message.channel : 'all', thread, String((message as unknown as {area?:string}).area || ''));
          if(message.id !== networkPlayerId)chatPop();
          if (message.id) showSpeechBubble(message.id, message.name, message.text);
        }
        if(message.type==='voice-rpc-result'||message.type==='voice-peers'||message.type==='voice-warning')voice.signal(message);
        if (message.type === 'voice-audio' && message.id && typeof message.audio === 'string') voice.receive(message.id, message.name || 'Player', message.audio, message.volume, message.codec === 'opus' ? 'opus' : 'pcm');
        if(message.type==='voice-codec')voice.codec(message.codec === 'opus' ? 'opus' : 'pcm');
        if(message.type==='voice-audience')voice.audience(Number(message.count)||0,Array.isArray(message.names)?message.names:[]);
        if (message.type === 'error' && message.code === 'SESSION_REPLACED') { sessionReplaced(); return; }
        if (message.type === 'error' && message.code === 'BANNED') {
          finishEntryLoading(); rejection = { code: 'BANNED' };
          setNetworkStatus('SUSPENDED', 'offline', 1);
          toast('Account suspended', message.message || 'You cannot join the city.', 12);
          leaveCity(); return;
        }
        if (message.type === 'error') {
          finishEntryLoading();
          rejection = { code: message.code };
          setNetworkStatus(message.code === 'AUTH_REQUIRED' ? 'LOGIN REQUIRED' : 'UNAVAILABLE', 'offline');
          toast('Could not join', message.message || 'Please try again.');
          if (message.code === 'AUTH_REQUIRED') {
            leaveCity();
            void requestEntry.invalidate('Your login expired. Please log in again.');
          }
        }
      };
      // Snapshots arrive deflated from the server because Railway's edge strips the
      // WebSocket's own compression. Inflating is asynchronous, so every frame goes through
      // one queue: without it a slow inflate could apply an older snapshot after a newer one.
      socket.binaryType = 'arraybuffer';
      const frames = createFrameQueue<string|ArrayBuffer>(
        data => typeof data === 'string' ? Promise.resolve(data) : inflateFrame(data),
        processMessage,
        () => socket.close(4000,'Incoming queue exceeded latency budget'),
      );
      socket.addEventListener('message', event => {
        if (socket !== networkSocket) return;
        // Ping bypasses decompression but gameplay messages retain reliable ordering.
        if(typeof event.data==='string'){
          try{const m=JSON.parse(event.data);if(m.type==='pong'){const rtt=heartbeat.reply(m.t);if(rtt!==null)netStatus.sample(rtt);return;}}catch{/* queue handles invalid messages */}
        }
        frames.push(event.data);
      });
      socket.addEventListener('close', event => { if (socket !== networkSocket) return;carFinder.clear(); if (event.code === 4002) { finishEntryLoading(); sessionReplaced(); return; } voice.connected(false); if (passengerOf) { passengerOf = null; riding = false; speed = 0; } networkConnected = false; park.disconnect(); tableSocial.offline(); roomTables=[]; if (seatedChairId) { seatedChairId = null; seated = false; } beachResting=null; beachRestSpot=null; beachRestPose(player,null); for (const remote of remotePlayers.values()) disposeRemote(remote); remotePlayers.clear(); roomPlayers = [];
        // The close lands milliseconds after the server's explanation and used to overwrite
        // it with RECONNECTING…, so a full city and an expired login both looked like a
        // reconnect that never finished. Keep the reason the server gave.
        if (rejection?.code === 'AUTH_REQUIRED' || event.code === 4001) { finishEntryLoading(); setNetworkStatus('LOGIN REQUIRED', 'offline', 1); return; }
        // No retry loop: reconnecting cannot lift a suspension, it just hammers the server.
        if (rejection?.code === 'BANNED' || event.code === 4003) { finishEntryLoading(); setNetworkStatus('SUSPENDED', 'offline', 1); return; }
        // Keep a real transport failure red and actionable while the background retry runs.
        // A full room has its own orange state and does not ask the player to restart.
        if (rejection?.code === 'ROOM_FULL') { finishEntryLoading(); setNetworkStatus('CITY FULL', 'connecting', 1); }
        else if (!connectedOnceThisEntry && connectionAttempts < INITIAL_RETRY_LIMIT) { finishEntryLoading(); setNetworkStatus('JOINING CITY', 'connecting', 1); }
        else if (!connectedOnceThisEntry) { finishEntryLoading(); setNetworkStatus('CONNECTION FAILED', 'offline', 1); }
        else { finishEntryLoading(); setNetworkStatus('OFFLINE', 'offline', 1); }
        retryMultiplayer(); });
      // Browsers fire `error` before `close`, often without a useful reason. Let close own
      // the visible state so the loader does not flash a failure during sign-in.
      socket.addEventListener('error', () => { if (socket !== networkSocket) return; voice.connected(false); networkConnected = false; });
    } catch {
      finishEntryLoading();
      const canRetry = connectedOnceThisEntry || connectionAttempts < INITIAL_RETRY_LIMIT;
      if (canRetry) {
        setNetworkStatus(connectedOnceThisEntry ? 'RECONNECTING…' : 'JOINING CITY', 'connecting', 1);
        retryMultiplayer();
      } else setNetworkStatus('CONNECTION FAILED', 'offline', 1);
    }
  }
  function sendNetworkState(dt: number) {
    if(teleportPending)return;
    if(Date.now()-locationSavedAt>1000){saveLocation();locationSavedAt=Date.now();}
    if (!networkConnected || !networkSocket || networkSocket.readyState !== WebSocket.OPEN) return;
    networkSendTimer += dt; networkIdleTimer += dt;
    if (networkSendTimer < .05) return;
    networkSendTimer = 0;
    if (networkSocket.bufferedAmount >= 16384) return;
    const state = JSON.stringify({ type: 'state', x: pos.x, z: pos.z, y: deckY, liftId: klccLiftRide?.lift.id || null, yaw, riding, speed, jumpHeight, seated, resting: beachResting, restSpotId: beachRestSpot?.id || null, vehicle, fleetId });
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
      if (remote && remote.target.distanceTo(pos) < 25 * soundRange) recallSound();
      return;
    }
    if (!started || paused || riding || passengerOf || beachResting) return;
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
  // Tapping the darkness around the panel closes settings, the way any modal behaves.
  // The press and the release both have to land outside, so dragging a scrollbar or
  // selecting text inside the panel never dismisses it by accident.
  let pressedOutsidePause = false;
  $('pause').addEventListener('pointerdown', event => { pressedOutsidePause = event.target === $('pause'); });
  $('pause').addEventListener('click', event => { if (pressedOutsidePause && event.target === $('pause')) setPause(false); });

  function setAccessories(items: string[]) { for(const model of [player.group,bike.rider,car.driver]) applyAccessories(model,items); }
  const profileEditor = setupProfileEditor(async newName => {
    const token = (await auth?.auth.getSession())?.data.session?.access_token;
    if (token && networkConnected && networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({type:'profile-refresh',accessToken:token}));
    if(localName)updateNameTagName(localName,newName);
    toast('Profile saved', `${newName} is now your display name.`);
  });
  $('open-edit-profile').textContent = 'Edit profile & display name';
  $('open-edit-profile').onclick = () => profileEditor.open();
  // Password and deletion belong to the account, so guests never see the panel at all.
  const security = setupSecurity(apiBase);
  $('open-security').onclick = () => security();
  // Kedai's try-on starts from exactly what the city character has on.
  const itemShop = setupShop(setAccessories, undefined, () => player.group.userData.appearance);
  openShopFromGeng = () => { gengUI.close(); itemShop.open(); };
  const inventory=setupInventory(itemShop,()=>{keys.clear();resetStick();dragging=false;},look=>{
    applyAppearance(player.group, look); applyAppearance(bike.rider, look); applyAppearance(car.driver, look);
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'outfit', ...look }));
  });
  // A hanger, not a second bag: beside Kedai's shopping bag the old backpack read as another shop.
  const inventoryButton=document.createElement('button');inventoryButton.id='open-inventory';inventoryButton.type='button';inventoryButton.setAttribute('aria-label','Open inventory');inventoryButton.title='Inventory';inventoryButton.setAttribute('aria-haspopup','dialog');inventoryButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.6 6.2a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .8-1 1.5v.8"/><path d="m12 10.7-8.3 5.6c-.9.6-.5 2 .6 2h15.4c1.1 0 1.5-1.4.6-2L12 10.7Z"/></svg>';// Wall · recentre · Kedai · character · Geng · settings, reading outwards along the top bar.
  const shopButton=document.createElement('button');shopButton.id='open-shop';shopButton.type='button';shopButton.setAttribute('aria-label','Open Kedai');shopButton.title='Kedai · Skins & Accessories';shopButton.setAttribute('aria-haspopup','dialog');shopButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16l-1.2 12H5.2L4 8Z"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/></svg>';
  gengButton=document.createElement('button');gengButton.id='open-geng';gengButton.type='button';gengButton.setAttribute('aria-label','Open Geng');gengButton.title='Create or join a Geng';gengButton.setAttribute('aria-haspopup','dialog');gengButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5.5c0 4.5-3.2 7.9-8 9.5-4.8-1.6-8-5-8-9.5V6l8-3Z"/><path d="m12 7.7 1.25 2.55 2.8.4-2.03 1.98.48 2.79L12 14.1l-2.5 1.32.48-2.79-2.03-1.98 2.8-.4L12 7.7Z"/></svg>';
  gengButton.insertAdjacentHTML('beforeend','<i id="geng-unread" aria-hidden="true" hidden>0</i>');
  friendsButton=document.createElement('button');friendsButton.id='open-friends';friendsButton.type='button';friendsButton.setAttribute('aria-label','Open friends');friendsButton.title='Friend List';friendsButton.setAttribute('aria-haspopup','dialog');friendsButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.3 11.2a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM15.7 10a2.8 2.8 0 1 0 0-5.6M3.7 19.5v-1.1c0-2.3 2-4.1 4.6-4.1h.1c2.6 0 4.6 2 4.6 4.1v1.1M14.2 14.1h1.2c2.7 0 4.9 1.7 4.9 4.2v1.2"/><path d="M18.2 14.5v5M15.7 17h5"/></svg>';
  friendsButton.insertAdjacentHTML('beforeend','<i id="friends-unread" aria-hidden="true" hidden>0</i>');
  $('menu').before(shopButton,inventoryButton,gengButton,friendsButton);inventoryButton.onclick=()=>inventory.open();
  gengButton.onclick=()=>gengUI.open(); gengButton.hidden=!session||!!guestName;
  friendsButton.onclick=()=>friendsUI.open(); friendsButton.hidden=!accountToken();

  $('open-shop').onclick = () => itemShop.open();
  function start() {
    if (auth && !session && !guestName) return;
    if (started) return;
    beginEntryLoading();
    $('open-my-profile').hidden = !session || !!guestName;
    $('open-edit-profile').hidden = !session || !!guestName;
    $('open-security').hidden = !session || !!guestName;
    if (friendsButton) friendsButton.hidden = !accountToken();
    applyAppearance(player.group, savedLook()); applyAppearance(bike.rider, savedLook()); applyAppearance(car.driver, savedLook());
    $('session-replaced-message').hidden = true;
    void itemShop.enter();
    started = true; $('intro').hidden = true; $('hud').hidden = false;
    if (!guestName) { void gengUI.refresh(); void friendsUI.refresh(); }
    ensureAudio(); connectMultiplayer(); camera.position.set(pos.x + 2, 5, pos.z + 9); cameraHeading = yaw; updateHud(); canvas.tabIndex = -1; canvas.focus();
    if (!localName) { localName = nameTag(displayName(), true); updateNameTagGeng(localName, geng, gengLeader); scene.add(localName); }
    if (!guestName && new URLSearchParams(location.search).has('coins')) window.setTimeout(() => itemShop.open(), 0);
  }
  const idleGuard = createIdleGuard(() => started && seated, () => {
    if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({type:'leave-game-seat'}));
    else { seatedChairId=null; seated=false; chat.seated(false); pos.copy(standPosition); }
    toast('Away too long', 'Your game and seat were released after 5 minutes without input.', 6);
  });
  for (const event of ['pointerdown','pointermove','keydown','wheel'] as const) window.addEventListener(event, e => { if(e.isTrusted) idleGuard.activity(); }, {passive:true});
  window.setInterval(() => idleGuard.tick(), 1000);
  function leaveCity() {
    if(networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({type:'leave-city'}));
    vehicleRadio.update(false);
    locationArrival.reset();
    saveLocation();danceAudio.stop();localSupermanUntil=0;
    if (klccLiftRide) setKlccLiftHeight(klccLiftRide.lift, 0);
    klccLiftRide = null; renderKlccLiftStatus(); deckY = 0; onBridge = false; player.group.position.set(pos.x, .12, pos.z);
    park.disconnect();
    afkNote = ''; $<HTMLInputElement>('afk-note').value = '';
    $('afk-status').textContent = '';
    setMap(false); profile.close(); closeOptions();
    inventory.close();itemShop.close(); profileEditor.close(); friendsUI.close(); inbox.reset(); clearStandIn(); clearGuest();
    if (friendsButton) friendsButton.hidden = true;
    onlinePlayersDialog.close();
    finishEntryLoading(); started = false; paused = false; keys.clear(); resetStick(); disconnectMultiplayer(); backgroundMusic.pause(); lofiMusic.pause(); iceCreamSong.pause();lamboSong.pause();if(lamboGain)lamboGain.gain.value=0;buskingSong.pause();watsonsSong.pause();familyMartSong.pause();masjidSong.pause();stallVoiceSong.pause();if(buskingGain)buskingGain.gain.value=0;if(watsonsGain)watsonsGain.gain.value=0;if(familyMartGain)familyMartGain.gain.value=0;if(masjidGain)masjidGain.gain.value=0;if(stallVoiceGain)stallVoiceGain.gain.value=0;
    $('hud').hidden = true; $('pause').hidden = true; $('intro').hidden = false;
    if (localName) { localName.removeFromParent(); localName.material.map?.dispose(); localName.material.dispose(); localName = null; }
  }
  const requestEntry = await setupAuth(start, leaveCity);
  const signout = document.createElement('button'); signout.className = 'secondary'; signout.textContent = 'Log out'; signout.hidden = !auth;
  const exitConfirmation=setupExitConfirmation(async()=>{
    if(guestName){leaveCity();return;}
    if(auth){
      authLifecycle.beginLogout?.();
      try{
        const{error}=await auth.auth.signOut({scope:'local'});
        if(error)throw Error(error.message);
      }catch(error){
        authLifecycle.cancelLogout?.();
        throw error;
      }
    }
  });
  signout.onclick = () => exitConfirmation.open();
  document.querySelector('.pause-panel')!.append(signout);
  $('reset').remove();
  document.querySelector('.pause-controls')!.remove();
  function distanceTo(point: { x: number; z: number }) { return Math.hypot(pos.x - point.x, pos.z - point.z); }
  function nearbyKlccLift() { return world.klccLifts.filter(lift => distanceTo(lift) < 3.8).sort((a, b) => distanceTo(a) - distanceTo(b))[0]; }
  function nearbyDriver() { return [...remotePlayers.values()].filter(p => roomPlayers.find(q=>q.id===p.id)?.lrtId==null && p.riding && !p.passengerOf && distanceTo(p.target) < 3.8).sort((a, b) => distanceTo(a.target) - distanceTo(b.target))[0]; }
  function backSeatFull(id: string) { return roomPlayers.filter(p => p.passengerOf === id).length >= (remotePlayers.get(id)?.vehicle === 'car' ? 3 : 1); }
  function chairOccupied(id: string) { return roomPlayers.some(p => p.id !== networkPlayerId && p.chairId === id); }
  function nearbyChair() { return world.chairs.filter(c => Math.abs((c.y||0)-deckY)<2 && distanceTo(c) < 2.2).sort((a, b) => distanceTo(a) - distanceTo(b))[0]; }
  function nearbyCar(){return world.traffic.filter(c=>!c.owner&&distanceTo(c)<4.8).sort((a,b)=>distanceTo(a)-distanceTo(b))[0];}
  const unciloked=(id:string)=>world.traffic.find(c=>c.id===id)?.group.userData.model==='lamborghini';
  function claimCar(id:string){
    if(park.active||skyDining)return;
    if(!started||paused||riding||seated||beachResting||jumpHeight>0||jumpVelocity>0||isDancing()||tableSocial.opened)return;
    // The button is greyed out, but the keyboard does not read that, so the refusal is said
    // out loud here as well. The server refuses it a third time, for anything that gets past.
    if(unciloked(id)){toast('Tak bole','Kereta ni bukan untuk cilok.',2);return;}
    if(networkConnected&&networkSocket?.readyState===WebSocket.OPEN&&performance.now()>=claimPendingUntil){sendNetworkState(1);claimPendingUntil=performance.now()+2000;networkSocket.send(JSON.stringify({type:'car-claim',id}));}
  }
  function sitPose(person: ReturnType<typeof createPerson>) { person.leftLeg.rotation.x = person.rightLeg.rotation.x = -Math.PI / 2; person.leftArm.rotation.x = person.rightArm.rotation.x = -.35; }
  function objectAction() {
    if(lrtId!=null || park.active || klccLiftRide?.phase === 'moving')return null;
    if (klccLiftRide?.phase === 'top') return { point: klccLiftRide.lift, height: deckY + 2.6, label: 'Turun lif KLCC', disabled: false };
    if(skyDining&&!seated){if(distanceTo(SKY.landing)<1)return {point:SKY.landing,height:SKY.y+2,label:'Turun Wet Deck',disabled:false};const chair=nearbyChair();if(chair)return {point:chair,height:SKY.y+1.3,label:chairOccupied(chair.id)?'Occupied':'Sit',disabled:chairOccupied(chair.id)};return null;}
    if(!riding&&!seated&&distanceTo(SKY.entry)<3)return {point:SKY.entry,height:3,label:'Naik Wet Deck',disabled:false};
    if (passengerOf || riding) return { point: pos, height: 2, label: Math.abs(speed) < 1.5 ? 'Get out' : 'Wait until stopped', disabled: Math.abs(speed) >= 1.5 };
    if (beachResting && beachRestSpot) return { point: beachRestSpot, height: beachRestSpot.height + 1.15, label: 'Bangun', disabled: false };
    if (seated) return { point: pos, height: deckY+1.3, label: 'Stand', disabled: false };
    const rest = beach.nearbyRest(pos);
    if (rest) return { point: rest, height: rest.height + 1.15, label: rest.kind === 'hammock' ? 'Masuk hammock' : 'Baring', disabled: false };
    const driver = nearbyDriver();
    if (driver) return { point: driver.target, height: 2, label: backSeatFull(driver.id) ? 'Full' : Math.abs(driver.speed) >= 1.5 ? 'Wait until stopped' : 'Enter', disabled: backSeatFull(driver.id) || Math.abs(driver.speed) >= 1.5 };
    const chair = nearbyChair();
    if (chair) return { point: chair, height: 1.3, label: chairOccupied(chair.id) ? 'Occupied' : 'Sit', disabled: chairOccupied(chair.id) };
    const lift = nearbyKlccLift();
    if (lift) return { point: lift, height: klccLiftRide?.phase === 'top' ? lift.topY + 2.6 : 3, label: klccLiftRide?.phase === 'top' ? 'Turun lif KLCC' : 'Naik lif KLCC', disabled: false };
    const station=lrtStations.find(s=>distanceTo(s)<5);
    if(station){const train=[0,1].find(id=>{const t=trainState(id,lrtNow());return t.doors&&lrtStations[t.station]?.id===station.id;});return{point:station,height:2,label:train!=null?'Naik LRT':`LRT ${station.name} · ${arrivalIn(lrtStations.indexOf(station),lrtNow())}s`,disabled:train==null||!networkConnected};}
    // Lamps stand on the kerb of the roads the traffic drives down, and a car counts as
    // near from 4.8m away. Last place meant a passing car took the prompt off every lamp
    // in the city, so from here on it is whichever is actually closer that wins.
    const lamp = lampNear();
    const lampAway = lamp >= 0 ? distanceTo(streetLights.lamps[lamp]) : Infinity;
    // Anchored on the post rather than the lamp head, which is off the top of the screen
    // by the time you are close enough to reach it.
    const lampAction = () => ({index: lamp, point: streetLights.lamps[lamp], height: 2.2, label: streetLights.lit(lamp) ? 'Turn off' : 'Turn on', disabled: false});
    // A Lamborghini is not getting ciloked. The prompt still appears so
    // the refusal is the joke rather than a dead spot where every other car offers you one.
    const trafficCar=nearbyCar();
    if(trafficCar&&distanceTo(trafficCar)<=lampAway){
     if(unciloked(trafficCar.id))return {point:trafficCar.group.position,height:2.4,label:'Tak bole',disabled:true};
     return {carId:trafficCar.id,point:trafficCar.group.position,height:2.4,label:performance.now()<claimPendingUntil?'Wait…':trafficCar.npc?'Cilok':'Enter',disabled:!networkConnected||performance.now()<claimPendingUntil};
    }
    const vehiclePoint = distanceTo(personalCar.group.position) < distanceTo(bike.group.position) ? personalCar.group.position : bike.group.position;
    if (distanceTo(vehiclePoint) < 3.8 && distanceTo(vehiclePoint) <= lampAway) return { point: vehiclePoint, height: 1.8, label: 'Enter', disabled: false };
    if (lamp >= 0) return lampAction();
    return null;
  }
  function arriveSky(upstairs:boolean){skyDining=upstairs;const p=upstairs?SKY.landing:SKY.entry;pos.set(p.x,.12,p.z);deckY=upstairs?SKY.y:0;onBridge=false;walkSpeed=0;speed=0;if(upstairs){cameraHeading=Math.atan2(-SKY.x,-122-SKY.z);orbit=0;zoom=12;}keys.clear();resetStick();player.group.position.set(pos.x,deckY+.12,pos.z);toast(upstairs?'Wet Deck · Sky Dining':'Hotel lobby',upstairs?'Pool steps ahead · table games in the lounge':'Welcome back to the city');}
  function interact() {
    if(lrtId!=null)return;
    if (!started || paused || park.active || klccLiftRide?.phase === 'moving' || isDancing() || tableSocial.opened) return;
    if (jumpHeight > 0 || jumpVelocity > 0) return;
    if(!riding&&!seated&&distanceTo(skyDining?SKY.landing:SKY.entry)<(skyDining?1:3)){if(networkConnected&&networkSocket?.readyState===WebSocket.OPEN)networkSocket.send(JSON.stringify({type:'sky-lift'}));else arriveSky(!skyDining);return;}
    if (klccLiftRide?.phase === 'top') { startKlccLift(klccLiftRide.lift, 'down'); return; }
    if (beachResting && beachRestSpot) {
      const exit = beach.exitSpot(beachRestSpot);
      beachResting = null; beachRestSpot = null; beachRestPose(player, null);
      pos.set(exit.x, .12, exit.z); yaw = Math.PI; deckY = 0; onBridge = false;
      player.group.position.copy(pos); player.group.rotation.y = yaw;
      walkSpeed = 0; speed = 0; punchUntil = 0; keys.clear(); resetStick(); sendNetworkState(1);
      return;
    }
    if (passengerOf) { if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'passenger-leave' })); return; }
    if (seated) { if (networkConnected && networkSocket?.readyState === WebSocket.OPEN) { networkSocket.send(JSON.stringify({ type: 'chair-stand' })); return; } seatedChairId = null; seated = false; chairSound(false); pos.copy(standPosition); keys.clear(); resetStick(); return; }
    const rest = !skyDining && !riding && !seated ? beach.nearbyRest(pos) : null;
    if (rest) {
      beachResting = rest.kind; beachRestSpot = rest; pos.set(rest.x, .12, rest.z); yaw = rest.yaw; deckY = 0; onBridge = false;
      jumpHeight = 0; jumpVelocity = 0; walkSpeed = 0; speed = 0; punchUntil = 0; keys.clear(); resetStick();
      beachRestPose(player, rest.kind, rest.yaw); player.group.position.set(rest.x, rest.height, rest.z); sendNetworkState(1); return;
    }
    const driver = !skyDining && !riding && nearbyDriver();
    const station=!skyDining&&!riding&&!seated&&lrtStations.find(s=>distanceTo(s)<5);
    if(station){const train=[0,1].find(id=>{const t=trainState(id,lrtNow());return t.doors&&lrtStations[t.station]?.id===station.id;});if(train!=null&&networkSocket?.readyState===WebSocket.OPEN)networkSocket.send(JSON.stringify({type:'lrt-board',station:station.id,train}));return;}
    if (driver) { if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({ type: 'passenger-join', driverId: driver.id })); return; }
    const chair = !riding && nearbyChair();
    if (chair) { if (chairOccupied(chair.id)) return; if (networkConnected && networkSocket?.readyState === WebSocket.OPEN) { keys.clear(); resetStick(); networkSocket.send(JSON.stringify({ type: 'chair-sit', chairId: chair.id })); return; } if (auth) return; standPosition.copy(pos); pos.set(chair.x, .12, chair.z); yaw = chair.yaw; seated = true; chairSound(true); walkSpeed = 0; keys.clear(); resetStick(); return; }
    if(skyDining)return;
    const lift = !riding && !seated && nearbyKlccLift();
    if (lift) { startKlccLift(lift, klccLiftRide?.phase === 'top' ? 'down' : 'up'); return; }
    if (riding) {
      if (Math.abs(speed) > 1.5) { toast('Slow down dulu', 'Hold Space to brake before getting off.', 2); return; }
      const exit = safeDismount(pos, yaw, [...world.solids, ...world.traffic.map(c => vehicleSolid(c.group,c.x,c.z,c.yaw))], vehicle === 'car' ? 2.7 : 2.2);
      if (!exit) { toast('A little more room', 'Move the bike to an open spot before getting off.', 2); return; }
      riding = false; localSupermanUntil=0; speed = 0; pos.set(exit.x, .12, exit.z); player.group.visible = true; bike.rider.visible = false; car.driver.visible = false; return;
    }
    // objectAction already worked out which of the car, the vehicle and the lamp is nearest,
    // so the click follows the prompt instead of deciding again and disagreeing with it.
    const showing = objectAction();
    if (showing && 'index' in showing) { flipLamp(showing.index); return; }
    const trafficCar=nearbyCar();
    if(trafficCar){claimCar(trafficCar.id);return;}
    if (distanceTo(personalCar.group.position) < 3.8 && distanceTo(personalCar.group.position) < distanceTo(bike.group.position)) { car=personalCar;fleetId=null;localSupermanUntil=0; vehicle = 'car'; riding = true; player.group.visible = false; car.driver.visible = true; pos.copy(car.group.position); yaw = car.group.rotation.y; speed = 0; orbit = 0; chime(); return; }
    if (distanceTo(bike.group.position) < 3.8) { vehicle = 'bike'; riding = true; player.group.visible = false; bike.rider.visible = true; pos.copy(bike.group.position); yaw = bikeYaw; speed = 0; orbit = 0; chime(); }
  }
  $('touch-horn').onclick = honk; $('desktop-horn').onclick = honk; $('touch-superman').onclick = toggleSuperman; $('desktop-superman').onclick = toggleSuperman;
  $('start').onclick = requestEntry; $('menu').onclick = () => setPause(true); $('resume').onclick = () => setPause(false); $('pause-close').onclick = () => setPause(false);
  const interactionButton = $<HTMLButtonElement>('interaction');
  interactionButton.onclick = () => { const id=pressedCarId||interactionButton.dataset.carId;pressedCarId=null;interactionPressUntil=0;interactionPointerDown=false;if(id)claimCar(id);else interact();keys.clear(); canvas.focus(); }; $('touch-recall').onclick = () => triggerRecall(); $('desktop-recall').onclick = () => triggerRecall();
  interactionButton.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&interactionButton.dataset.carId){pressedCarId=interactionButton.dataset.carId;interactionPressUntil=performance.now()+800;}});
  interactionButton.addEventListener('pointerdown',()=>{interactionPointerDown=true;pressedCarId=interactionButton.dataset.carId||null;if(pressedCarId)interactionPressUntil=performance.now()+800;});
  interactionButton.addEventListener('pointercancel',()=>{interactionPointerDown=false;pressedCarId=null;interactionPressUntil=0;});
  interactionButton.addEventListener('pointerup',()=>{setTimeout(()=>{interactionPointerDown=false;pressedCarId=null;interactionPressUntil=0;},0);});
  window.addEventListener('pointerup',()=>{setTimeout(()=>{interactionPointerDown=false;pressedCarId=null;interactionPressUntil=0;},0);});
  const weatherUI=setupWeather(scene,sun,ambient,apiBase,value=>{rainEnabled=value;rain.visible=value;},message=>{if(!networkConnected||networkSocket?.readyState!==WebSocket.OPEN)return false;networkSocket.send(JSON.stringify(message));return true;},night=>{mamakNight=night;setKlccNight(night);streetLights.setNight(night);mamakLighting?.setNight(night);mamakFacade.setNight(night);setMasjidNight(night);setShoplotNight(night);setSkylineNight(night);setBrandsNight(night);setLrtNight(night);setWorshipNight(night);setHawkerNight(night);setDistrictNight(night);for(const setNight of [setSalomaNight,setSkyDiningNight])setNight(night);},value=>clouds.setWeather(value));
  $<HTMLInputElement>('music-toggle').onchange = event => {
    musicEnabled = (event.target as HTMLInputElement).checked;
    try { localStorage.setItem('lepakmamak-music', musicEnabled ? 'on' : 'off'); } catch { /* Playback still works without storage. */ }
    vehicleRadio.update(started && lrtId==null && (riding || !!passengerOf) && musicEnabled);
    if (musicEnabled && started) startBackgroundMusic(true); else { backgroundMusic.pause(); lofiMusic.pause(); }
  };
  $<HTMLInputElement>('sound-toggle').onchange = event => { audioEnabled = (event.target as HTMLInputElement).checked; if (audioEnabled) { ensureAudio(); } else { danceAudio.stop();buskingSong.pause();if(buskingGain)buskingGain.gain.value=0;watsonsSong.pause();if(watsonsGain)watsonsGain.gain.value=0;familyMartSong.pause();if(familyMartGain)familyMartGain.gain.value=0;masjidSong.pause();if(masjidGain)masjidGain.gain.value=0;stallVoiceSong.pause();if(stallVoiceGain)stallVoiceGain.gain.value=0;iceCreamSong.pause(); if (iceCreamGain) iceCreamGain.gain.value = 0; lamboSong.pause(); if (lamboGain) lamboGain.gain.value = 0; } };
  function setShadows(enabled: boolean) {
    if (renderer.shadowMap.enabled === enabled) return;
    renderer.shadowMap.enabled = enabled;
    scene.traverse(obj => { if (obj instanceof THREE.Mesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m.needsUpdate = true);
    } });
  }
  let graphicsQuality = touch ? 'low' : 'high';
  let autoReduced = false, slowSeconds = 0;
  try {
    const saved = localStorage.getItem('lepak-graphics');
    if (saved === 'low' || saved === 'smooth') graphicsQuality = 'low';
    if (saved === 'high' || saved === 'detailed') graphicsQuality = 'high';
    localStorage.setItem('lepak-graphics', graphicsQuality);
  } catch { /* Storage is optional. */ }
  function applyQuality() {
    const smooth = graphicsQuality === 'low';
    renderer.setPixelRatio(Math.min(devicePixelRatio, smooth ? 1 : 1.6));
    setShadows(!smooth);
    $<HTMLSelectElement>('graphics-quality').value = graphicsQuality;
  }
  $('graphics-quality').onchange = () => {
    graphicsQuality = $<HTMLSelectElement>('graphics-quality').value; slowSeconds = 0; autoReduced = false;
    try { localStorage.setItem('lepak-graphics', graphicsQuality); } catch { /* Storage is optional. */ }
    applyQuality();
  };
  applyQuality();
  function resetCamera() { orbit = 0; cameraPitch = .35; cameraHeading = yaw; zoom = ZOOM_FAR; }
  $('camera-reset').onclick = () => { resetCamera(); canvas.focus(); };
  const compass = $('compass-needle'); let compassAngle = 0;
  function updateTypingLayout() {
    const typing = document.activeElement?.id === 'chat-input';
    document.body.classList.toggle('chat-typing', typing);
    const viewport = window.visualViewport;
    const keyboardHeight = viewport ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    scheduleGameViewportResize();
  }
  document.addEventListener('focusin', updateTypingLayout);
  document.addEventListener('focusout', () => {
    queueMicrotask(updateTypingLayout);
    window.setTimeout(updateTypingLayout, 80);
  });
  window.visualViewport?.addEventListener('resize', updateTypingLayout);
  window.visualViewport?.addEventListener('scroll', updateTypingLayout);
  const gameKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyR', 'KeyH']);
  window.addEventListener('keydown', event => {
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!$('auth-panel').hidden) return;
    if (event.code === 'Enter' && !started) { event.preventDefault(); requestEntry(); return; }
    if(wall.opened){if(event.code==='Escape'){event.preventDefault();wall.close();}return;}
    if (profile.open || tableSocial.opened) return;
    // Enter is the chat key, the way it is in every other game. The guard above already
    // excluded every open modal, and this listener bails on input targets, so a second
    // Enter lands on the composer's own form rather than reopening it.
    if (event.code === 'Enter' && started && !paused && !cityMap.open) { event.preventDefault(); chat.open(); return; }
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
  setupPageExitWarning(() => started);
  window.addEventListener('pagehide', disconnectMultiplayer);
  window.addEventListener('blur', () => { keys.clear(); resetStick(); dragging = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveLocation(); keys.clear(); resetStick(); dragging = false; } });
  const options = $('player-options');
  $('hud').append(partyInvite, tableInvite);
  $('party-accept').onclick = () => answerInvite('party-accept');
  $('party-decline').onclick = () => answerInvite('party-decline');
  $('table-invite-open').onclick = () => {
    if (!tableInviteId || networkSocket?.readyState !== WebSocket.OPEN) return;
    $<HTMLButtonElement>('table-invite-open').disabled = true;
    $('table-invite-text').textContent = 'Checking the table…';
    networkSocket.send(JSON.stringify({type: 'table-invite-open', inviteId: tableInviteId}));
  };
  $('table-invite-dismiss').onclick = hideTableInvite;
  partyInvite.addEventListener('keydown', event => event.stopPropagation());
  tableInvite.addEventListener('keydown', event => event.stopPropagation());
  const profile = $<HTMLDialogElement>('player-profile');
  profile.prepend($('close-profile'));
  let selectedName = '', selectedProfileId = '';
  let profileAccountId = '', profilePlayerId = '', profilePersonName = '', profileReady = false, profileRegistered = false;
  const profileActions = $('profile-actions');
  const profileAddFriend = $<HTMLButtonElement>('profile-add-friend');
  const profileMessage = $<HTMLButtonElement>('profile-message');
  function closeOptions() { options.hidden = true; }
  function renderProfileActions() {
    const own = profileAccountId === session?.user.id || (!!profilePlayerId && profilePlayerId === networkPlayerId);
    const available = profileReady && profileRegistered && !!session && !guestName && !own;
    profileActions.hidden = !available;
    if (!available) return;
    const targetId = profileAccountId || profilePlayerId;
    const relation = friendsUI.relationship(targetId);
    profileAddFriend.hidden = relation === 'friend';
    profileAddFriend.disabled = relation === 'outgoing';
    profileAddFriend.textContent = relation === 'incoming' ? 'Accept friend request' : relation === 'outgoing' ? 'Request sent' : 'Add friend';
    profileMessage.disabled = !networkConnected || !profilePlayerId;
    profileMessage.textContent = profilePlayerId ? 'Message' : 'Message · Offline';
    profileMessage.title = profilePlayerId ? `Message ${profilePersonName}` : `${profilePersonName} is offline`;
  }
  function beginProfile(name: string, accountId = '', playerId = '') {
    closeOptions(); selectedName = name; selectedProfileId = playerId;
    profileAccountId = accountId; profilePlayerId = playerId; profilePersonName = name;
    profileReady = false; profileRegistered = false; profileActions.hidden = true;
    $('profile-name').textContent = name; $('profile-details').replaceChildren();
    if (!profile.open) profile.showModal();
    $('close-profile').focus();
  }
  function showLoadedProfile(value: PlayerProfile, accountId = '', playerId = '') {
    renderProfile($('profile-details'), value);
    profileAccountId = value.registered ? value.id : accountId;
    profilePlayerId = playerId;
    profilePersonName = value.name || profilePersonName;
    profileReady = true; profileRegistered = value.registered;
    renderProfileActions();
  }
  async function openAccountProfile(id: string, name: string) {
    beginProfile(name, id);
    if (!apiBase) { renderProfileMessage($('profile-details'), 'Reconnect to view this profile.'); return; }
    renderProfileLoading($('profile-details'));
    try {
      const response = await fetch(`${apiBase}/profiles/${encodeURIComponent(id)}`);
      const data = await response.json().catch(() => ({})) as {profile?: PlayerProfile | null; playerId?: string | null; error?: string};
      if (!response.ok) throw Error(data.error || 'Could not load this profile.');
      if (!profile.open || profileAccountId !== id) return;
      if (data.profile) showLoadedProfile(data.profile, id, data.playerId || '');
      else renderProfileMessage($('profile-details'), 'This player has left the city.');
    } catch (error) {
      if (profile.open && profileAccountId === id) renderProfileMessage($('profile-details'), error instanceof Error ? error.message : 'Could not load this profile.');
    }
  }
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
    const targetId=object.userData.profileId||'', mine=targetId===networkPlayerId;
    // You cannot invite yourself, someone already in your geng, or nobody in particular.
    const relation = friendsUI.relationship(targetId);
    const addFriend = $<HTMLButtonElement>('add-friend');
    addFriend.hidden = mine || !targetId || !networkConnected || relation === 'friend';
    addFriend.disabled = relation === 'outgoing';
    addFriend.textContent = relation === 'incoming' ? 'Accept friend request' : relation === 'outgoing' ? 'Request sent' : 'Add friend';
    $('invite-party').hidden=mine||!targetId||!networkConnected||partyMembers.has(targetId)||partyMembers.size>=6||!!partyMembers.size&&partyLeaderId!==networkPlayerId;
    $('message-player').hidden=mine||!targetId||!networkConnected;
    $('report-player').hidden=mine||!targetId||!networkConnected;
    $('leave-party').hidden=!mine||!partyMembers.size;
    $('superman-action').textContent=isSuperman()?'Stop Superman':'Superman · 6s';
    selectedName = object.userData.profileName; selectedProfileId = object.userData.profileId || '';
    keys.clear(); resetStick(); dragging = false;
    options.hidden = false;
    options.style.left = `${Math.max(8, Math.min(x, innerWidth - options.offsetWidth - 8))}px`;
    options.style.top = `${Math.max(8, Math.min(y, innerHeight - options.offsetHeight - 8))}px`;
    $('view-profile').focus();
  }
  $('dance-action').onclick=()=>{closeOptions();if(isDancing()){if(networkSocket?.readyState===WebSocket.OPEN)networkSocket.send(JSON.stringify({type:'dance-cancel'}));return;}if(riding||seated||beachResting||jumpHeight>0)return;ensureAudio();keys.clear();resetStick();walkSpeed=0;if(networkSocket?.readyState===WebSocket.OPEN)networkSocket.send(JSON.stringify({type:'dance'}));};
  $('superman-action').onclick=()=>{closeOptions();toggleSuperman();};
  function openSelectedProfile() { beginProfile(selectedName, '', selectedProfileId); if (networkConnected && networkSocket?.readyState === WebSocket.OPEN && selectedProfileId) { renderProfileLoading($('profile-details')); networkSocket.send(JSON.stringify({type:'profile-view',id:selectedProfileId})); } else renderProfileMessage($('profile-details'),'Reconnect to view this profile.'); }
  $('view-profile').onclick = openSelectedProfile;
  $<HTMLButtonElement>('add-friend').dataset.uiSound = 'none';
  $('add-friend').onclick = () => {
    const relation = friendsUI.relationship(selectedProfileId);
    const relationId = friendsUI.relationshipId(selectedProfileId);
    closeOptions();
    if (relation === 'incoming' && relationId) void friendsUI.respond(relationId, true);
    else if (relation === 'none') void friendsUI.add(selectedProfileId, selectedName);
  };
  profileAddFriend.dataset.uiSound = 'none';
  profileAddFriend.onclick = () => {
    const targetId = profileAccountId || profilePlayerId;
    const relation = friendsUI.relationship(targetId);
    const relationId = friendsUI.relationshipId(targetId);
    if (relation === 'incoming' && relationId) void friendsUI.respond(relationId, true);
    else if (relation === 'none' && profileAccountId) void friendsUI.addAccount(profileAccountId, profilePersonName);
    else if (relation === 'none' && profilePlayerId) void friendsUI.add(profilePlayerId, profilePersonName);
  };
  profileMessage.onclick = () => {
    if (!profilePlayerId || !networkConnected) return;
    const id = profilePlayerId, name = profilePersonName;
    profile.close(); profileActions.hidden = true;
    chat.openDm(id, name); chat.open();
  };
  $('invite-party').onclick = () => { closeOptions(); if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({type:'geng-invite',id:selectedProfileId})); };
  $('message-player').onclick = () => { closeOptions(); chat.openDm(selectedProfileId, selectedName); chat.open(); };
  $('leave-party').onclick = () => { closeOptions(); if (networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify({type:'party-leave'})); };
  const reportDialog = $<HTMLDialogElement>('report-player-dialog');
  let reportTargetId = '', reportAccountId = '';
  const reportSurface = $<HTMLSelectElement>('report-surface');
  const reportPrivacy = $('report-privacy').textContent || '';
  $('report-player').onclick = () => {
    closeOptions(); reportTargetId = selectedProfileId; reportAccountId = '';
    $('report-target').textContent = `You are reporting ${selectedName}.`;
    reportSurface.disabled = false; if (reportSurface.value === 'dm') reportSurface.value = 'behaviour';
    $('report-privacy').textContent = reportPrivacy;
    $<HTMLTextAreaElement>('report-note').value = '';
    reportDialog.showModal();
  };
  // A conversation is reported by account; the server attaches the recent messages itself.
  function openConversationReport(peer: Peer) {
    reportTargetId = ''; reportAccountId = peer.userId;
    $('report-target').textContent = `You are reporting ${peer.handle ? `@${peer.handle}` : peer.name} for private messages.`;
    reportSurface.value = 'dm'; reportSurface.disabled = true;
    $('report-privacy').textContent = 'Your recent private messages with them are attached, exactly as they were sent.';
    $<HTMLTextAreaElement>('report-note').value = '';
    reportDialog.showModal();
  }
  $('cancel-report').onclick = () => { reportDialog.close(); canvas.focus(); };
  reportDialog.addEventListener('cancel', event => { event.preventDefault(); reportDialog.close(); canvas.focus(); });
  reportDialog.addEventListener('keydown', event => event.stopPropagation());
  $('report-form').addEventListener('submit', () => {
    // The server decides whether this counts, who was in earshot and what gets stored;
    // the client only carries the reporter's answers across.
    const reason = $<HTMLSelectElement>('report-reason').value, note = $<HTMLTextAreaElement>('report-note').value;
    if ((reportTargetId || reportAccountId) && networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify(reportAccountId
      ? { type: 'report', surface: 'dm', userId: reportAccountId, reason, note }
      : { type: 'report', id: reportTargetId, surface: reportSurface.value, reason, note }));
    else toast('Report not sent', 'Reconnect to the city and try again.');
    reportTargetId = ''; reportAccountId = ''; canvas.focus();
  });
  $('open-my-profile').onclick = () => { selectedName=displayName();selectedProfileId=networkPlayerId;openSelectedProfile(); };
  $('close-profile').onclick = () => { profile.close(); profileActions.hidden = true; canvas.focus(); };
  profile.addEventListener('cancel', event => { event.preventDefault(); profile.close(); profileActions.hidden = true; canvas.focus(); });
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
  canvas.addEventListener('wheel', event => { if (!started || paused) return; event.preventDefault(); zoom = THREE.MathUtils.clamp(zoom + event.deltaY * .01, ZOOM_NEAR, ZOOM_FAR); }, { passive: false });
  // Two-finger pinch replaces the removed +/- buttons: touch has no wheel, so this is the only zoom on phones.
  const pinch = new Map<number, { x: number; y: number }>(); let pinchSpan = 0;
  const spanOf = () => { const [a, b] = [...pinch.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !started || paused) return;
    pinch.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.size === 2) { pinchSpan = spanOf(); dragging = false; pointerId = null; }
  });
  canvas.addEventListener('pointermove', event => {
    if (!pinch.has(event.pointerId)) return;
    pinch.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.size !== 2 || !pinchSpan) return;
    const span = spanOf();
    if (span > 0) { zoom = THREE.MathUtils.clamp(zoom * (pinchSpan / span), ZOOM_NEAR, ZOOM_FAR); pinchSpan = span; }
  });
  const releasePinch = (event: PointerEvent) => { pinch.delete(event.pointerId); if (pinch.size < 2) pinchSpan = 0; };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, event => releasePinch(event as PointerEvent));
  document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(button => {
    button.addEventListener('pointerdown', event => { event.preventDefault(); if (paused) return; button.setPointerCapture(event.pointerId); if (button.dataset.key === 'Space') jump(); keys.add(button.dataset.key!); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => keys.delete(button.dataset.key!));
  });
  window.addEventListener('resize', () => { resetStick(); resizeGameViewport(); scheduleGameViewportResize(); });

  document.querySelector('.brand-status')!.append($('vehicle-seats'));
  let selectedMapPlace='';
  let teleportPending=false;
  const teleportButton=document.createElement('button');teleportButton.type='button';teleportButton.className='primary';teleportButton.id='map-teleport';teleportButton.textContent='Teleport';teleportButton.title='Select a place on the map first';teleportButton.disabled=true;
  const teleportBar=document.createElement('div');teleportBar.className='map-teleport-bar';teleportBar.append(teleportButton);$('map-place-info').before(teleportBar);
  function finishTeleport(id:string){
    const destination=teleports.find(p=>p.id===id);if(!destination)return;
    teleportPending=false;teleportButton.disabled=false;teleportButton.textContent='Teleport';
    seated=false;seatedChairId=null;beachResting=null;beachRestSpot=null;beachRestPose(player,null);jumpHeight=0;jumpVelocity=0;speed=0;walkSpeed=0;localSupermanUntil=0;
    skyDining=false;deckY=0;onBridge=false;
    pos.set(destination.x,.12,destination.z);player.group.position.copy(pos);keys.clear();resetStick();
    camera.position.set(pos.x+2,pos.y+5,pos.z+9);setMap(false);sendNetworkState(1);
    toast('Teleported',mapPlaces.find(p=>p.id===id)?.name||'You have arrived.');
  }
  teleportButton.onclick=()=>{
    if(park.active){toast('Keluar tarikan dahulu','Tekan Keluar tarikan sebelum teleport.');return;}
    if(!started||teleportPending||!selectedMapPlace)return;
    if(riding||passengerOf){toast('Leave your vehicle first','Get out, then choose your teleport destination.');return;}
    if(networkConnected&&networkSocket?.readyState===WebSocket.OPEN){teleportPending=true;teleportButton.disabled=true;teleportButton.textContent='Teleporting…';networkSocket.send(JSON.stringify({type:'teleport',id:selectedMapPlace}));setTimeout(()=>{if(teleportPending){teleportPending=false;teleportButton.disabled=false;teleportButton.textContent='Teleport';}},5000);}

    else toast('City offline','Reconnect before teleporting.');
  };
  // Opening the 3D overview creates a second WebGL context and renders the whole city
  // into an off-screen canvas. That is too much GPU memory for phones (and became more
  // noticeable once avatars gained real GLB geometry). Start with the lightweight 2D
  // directory map; 3D remains an explicit opt-in from the map controls.
  let mapMode:'2d'|'3d'='2d';
  const defaultMapZoom=.8,minMapZoom=.5,maxMapZoom=2.2,mapZoomStep=.2;
  let mapZoom=defaultMapZoom;
  let cityMapPanX=0,cityMapPanZ=0,parkMapPanX=0,parkMapPanZ=0;
  const expandedCanvas=$<HTMLCanvasElement>('expanded-map');
  const mapMaxZoom=()=>expandedCanvas.dataset.scope==='legoland'?LEGOLAND_MAX_ZOOM:maxMapZoom;
  expandedCanvas.dataset.mode=mapMode;
  const selectMapPlace=(id:string)=>{carFinder.deselect();selectedMapPlace=id;teleportButton.disabled=teleportPending;teleportButton.textContent=`Teleport to ${mapPlaces.find(p=>p.id===id)?.name||'destination'}`;mapDirectory.selected(id);drawMap(true);};
  const mapDirectory=setupCityDirectory($('city-directory'),expandedCanvas,selectMapPlace);
  const overview=createMapOverview(scene,expandedCanvas,selectMapPlace);
  const viewControls=document.createElement('div');viewControls.className='map-view-controls';viewControls.setAttribute('role','group');viewControls.setAttribute('aria-label','Map view');
  for(const mode of ['2d','3d'] as const){const button=document.createElement('button');button.type='button';button.textContent=mode.toUpperCase();button.setAttribute('aria-pressed',String(mode===mapMode));button.onclick=()=>{mapMode=mode;expandedCanvas.dataset.mode=mode;document.querySelector('.city-map-hint')!.textContent=mode==='3d'?'Angled city overview · Numbered pins match the directory.':'N ↑ · On mobile, swipe the map to explore.';for(const b of viewControls.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));drawMap(true);};viewControls.append(button);}
  const mapViewport=document.querySelector<HTMLElement>('.city-map-viewport')!;
  const mapFrame=document.createElement('div');mapFrame.className='map-frame';mapViewport.before(mapFrame);mapFrame.append(mapViewport);
  const mapToolbar=document.createElement('div');mapToolbar.className='map-toolbar';mapToolbar.append(viewControls,teleportBar);mapFrame.append(mapToolbar);
  const mapZoomControls=document.createElement('div');mapZoomControls.className='map-zoom-controls';mapZoomControls.setAttribute('role','group');mapZoomControls.setAttribute('aria-label','Map zoom');
  const zoomIn=document.createElement('button'),zoomLevel=document.createElement('button'),zoomOut=document.createElement('button');
  zoomIn.type=zoomLevel.type=zoomOut.type='button';zoomIn.textContent='+';zoomOut.textContent='−';zoomIn.setAttribute('aria-label','Zoom in');zoomOut.setAttribute('aria-label','Zoom out');zoomLevel.setAttribute('aria-label','Reset map zoom');zoomLevel.title='Reset to default zoom';mapZoomControls.append(zoomIn,zoomLevel,zoomOut);mapFrame.append(mapZoomControls);
  type MapPoint={x:number;y:number};
  const mapPoint=(event:{clientX:number;clientY:number}):MapPoint=>{const rect=expandedCanvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*expandedCanvas.width/Math.max(1,rect.width),y:(event.clientY-rect.top)*expandedCanvas.height/Math.max(1,rect.height)};};
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
  function cityMapMetrics(){
    let minX=-170,maxX=170,minZ=-170,maxZ=170;
    for(const building of world.mapBuildings){minX=Math.min(minX,building.x-building.w/2);maxX=Math.max(maxX,building.x+building.w/2);minZ=Math.min(minZ,building.z-building.d/2);maxZ=Math.max(maxZ,building.z+building.d/2);}
    const width=maxX-minX,height=maxZ-minZ;
    return{centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2,width,height,baseScale:Math.min(expandedCanvas.width/(width+44),expandedCanvas.height/(height+44))};
  }
  function parkMapMetrics(){
    const width=LEGOLAND_MAP_BOUNDS.maxX-LEGOLAND_MAP_BOUNDS.minX,height=LEGOLAND_MAP_BOUNDS.maxZ-LEGOLAND_MAP_BOUNDS.minZ,padding=28;
    return{centerX:(LEGOLAND_MAP_BOUNDS.minX+LEGOLAND_MAP_BOUNDS.maxX)/2,centerZ:(LEGOLAND_MAP_BOUNDS.minZ+LEGOLAND_MAP_BOUNDS.maxZ)/2,width,height,baseScale:Math.min((expandedCanvas.width-padding*2)/width,(expandedCanvas.height-padding*2)/height)};
  }
  function clampCityPan(){
    const metrics=cityMapMetrics(),scale=metrics.baseScale*mapZoom;
    const breathingRoom=Math.max(0,(mapZoom-defaultMapZoom)*60),maxX=Math.max(0,(metrics.width+44-expandedCanvas.width/scale)/2)+breathingRoom,maxZ=Math.max(0,(metrics.height+44-expandedCanvas.height/scale)/2)+breathingRoom;
    cityMapPanX=clamp(cityMapPanX,-maxX,maxX);cityMapPanZ=clamp(cityMapPanZ,-maxZ,maxZ);
  }
  function clampParkPan(){
    const metrics=parkMapMetrics(),scale=metrics.baseScale*mapZoom;
    const breathingRoom=Math.max(0,(mapZoom-defaultMapZoom)*60),maxX=Math.max(0,(metrics.width+40-expandedCanvas.width/scale)/2)+breathingRoom,maxZ=Math.max(0,(metrics.height+40-expandedCanvas.height/scale)/2)+breathingRoom;
    parkMapPanX=clamp(parkMapPanX,-maxX,maxX);parkMapPanZ=clamp(parkMapPanZ,-maxZ,maxZ);
  }
  function focusCity2d(point:MapPoint,nextZoom:number){
    const metrics=cityMapMetrics(),currentScale=metrics.baseScale*mapZoom,nextScale=metrics.baseScale*nextZoom;
    const worldX=metrics.centerX+(point.x-expandedCanvas.width/2)/currentScale-cityMapPanX;
    const worldZ=metrics.centerZ+(point.y-expandedCanvas.height/2)/currentScale-cityMapPanZ;
    cityMapPanX=metrics.centerX-worldX+(point.x-expandedCanvas.width/2)/nextScale;
    cityMapPanZ=metrics.centerZ-worldZ+(point.y-expandedCanvas.height/2)/nextScale;
    clampCityPan();
  }
  function focusPark(point:MapPoint,nextZoom:number){
    const metrics=parkMapMetrics(),currentScale=metrics.baseScale*mapZoom,nextScale=metrics.baseScale*nextZoom;
    const worldX=metrics.centerX+(point.x-expandedCanvas.width/2)/currentScale-parkMapPanX;
    const worldZ=metrics.centerZ+(point.y-expandedCanvas.height/2)/currentScale-parkMapPanZ;
    parkMapPanX=metrics.centerX-worldX+(point.x-expandedCanvas.width/2)/nextScale;
    parkMapPanZ=metrics.centerZ-worldZ+(point.y-expandedCanvas.height/2)/nextScale;
    clampParkPan();
  }
  function publishMapZoom(){
    expandedCanvas.dataset.zoom=String(mapZoom);zoomLevel.textContent=`${Math.round(mapZoom*100)}%`;zoomIn.disabled=mapZoom>=mapMaxZoom();zoomOut.disabled=mapZoom<=minMapZoom;
  }
  function setMapZoom(next:number,point?:MapPoint){
    const clamped=clamp(Math.round(next*100)/100,minMapZoom,mapMaxZoom());
    if(point&&clamped!==mapZoom){
      if(expandedCanvas.dataset.scope==='legoland')focusPark(point,clamped);
      else if(mapMode==='3d')overview.zoomAt(point.x,point.y,clamped);
      else focusCity2d(point,clamped);
    }
    mapZoom=clamped;publishMapZoom();drawMap(true);
  }
  function resetMapView(){mapZoom=defaultMapZoom;cityMapPanX=cityMapPanZ=parkMapPanX=parkMapPanZ=0;overview.reset();publishMapZoom();drawMap(true);}
  zoomIn.onclick=()=>setMapZoom(mapZoom+mapZoomStep);zoomOut.onclick=()=>setMapZoom(mapZoom-mapZoomStep);zoomLevel.onclick=resetMapView;
  expandedCanvas.addEventListener('wheel',event=>{event.preventDefault();setMapZoom(mapZoom+(event.deltaY<0?mapZoomStep:-mapZoomStep),mapPoint(event));},{passive:false});
  const mapTouches=new Map<number,{x:number;y:number}>();let mapPinchSpan=0,mapPinchCenter:MapPoint|undefined,mapMoved=false;
  const mapTouchSpan=()=>{const [a,b]=[...mapTouches.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  const mapTouchCenter=()=>{const [a,b]=[...mapTouches.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
  const mapPanByPixels=(dx:number,dy:number)=>{
    const rect=expandedCanvas.getBoundingClientRect(),pixelX=dx*expandedCanvas.width/Math.max(1,rect.width),pixelY=dy*expandedCanvas.height/Math.max(1,rect.height);
    if(expandedCanvas.dataset.scope==='legoland'){
      const scale=parkMapMetrics().baseScale*mapZoom;parkMapPanX+=pixelX/scale;parkMapPanZ+=pixelY/scale;clampParkPan();
    }else if(mapMode==='3d')overview.pan(pixelX,pixelY);
    else{const scale=cityMapMetrics().baseScale*mapZoom;cityMapPanX+=pixelX/scale;cityMapPanZ+=pixelY/scale;clampCityPan();}
    drawMap(true);
  };
  const markMapMoved=()=>{mapMoved=true;expandedCanvas.dataset.gesture='true';};
  expandedCanvas.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    event.preventDefault();expandedCanvas.setPointerCapture(event.pointerId);mapTouches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(mapTouches.size===2){mapPinchSpan=mapTouchSpan();mapPinchCenter=mapTouchCenter();markMapMoved();}
  });
  expandedCanvas.addEventListener('pointermove',event=>{
    const previous=mapTouches.get(event.pointerId);if(!previous)return;
    event.preventDefault();mapTouches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(mapTouches.size===1){const distance=Math.hypot(event.clientX-previous.x,event.clientY-previous.y);if(distance>1){markMapMoved();mapPanByPixels(event.clientX-previous.x,event.clientY-previous.y);}return;}
    if(!mapPinchCenter||!mapPinchSpan)return;
    const center=mapTouchCenter(),span=mapTouchSpan();
    if(Math.hypot(center.x-mapPinchCenter.x,center.y-mapPinchCenter.y)>1){markMapMoved();mapPanByPixels(center.x-mapPinchCenter.x,center.y-mapPinchCenter.y);}
    if(span>0&&Math.abs(span-mapPinchSpan)>.1){markMapMoved();setMapZoom(mapZoom*span/mapPinchSpan,mapPoint({clientX:center.x,clientY:center.y}));}
    mapPinchCenter=center;mapPinchSpan=span;
  });
  const endMapTouch=(event:PointerEvent)=>{
    mapTouches.delete(event.pointerId);
    if(mapTouches.size===2){mapPinchSpan=mapTouchSpan();mapPinchCenter=mapTouchCenter();return;}
    mapPinchSpan=0;mapPinchCenter=undefined;
    if(mapTouches.size===0){const dragged=mapMoved;mapMoved=false;if(dragged)setTimeout(()=>{if(!mapTouches.size)delete expandedCanvas.dataset.gesture;},120);else delete expandedCanvas.dataset.gesture;}
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])expandedCanvas.addEventListener(type,event=>endMapTouch(event as PointerEvent));
  expandedCanvas.addEventListener('click',event=>{if(expandedCanvas.dataset.scope!=='legoland'&&mapMode==='3d')overview.click(event);});

  const carFinderRoot=document.createElement('div');mapFrame.after(carFinderRoot);
  const carFinder=createCarFinder(carFinderRoot,()=>{selectedMapPlace='';mapDirectory.selected('');teleportButton.disabled=true;teleportButton.textContent='Select a place to teleport';drawMap(true);});
  setMapZoom(defaultMapZoom);

  function syncMapScope(inPark:boolean){
    const scope=inPark?'legoland':'city',changed=expandedCanvas.dataset.scope!==scope;
    expandedCanvas.dataset.scope=scope;
    // Only the park zooms past the city's limit, so leaving it brings the zoom back in range.
    if(changed){mapZoom=Math.min(mapZoom,mapMaxZoom());publishMapZoom();}
    $('minimap').dataset.scope=scope;
    cityMap.classList.toggle('park-map',inPark);
    $('open-map').setAttribute('aria-label',inPark?'Open Legoland map':'Open city map');
    $('city-map-title').textContent=inPark?'LEGOLAND map':'City map';
    const hint=document.querySelector<HTMLElement>('.city-map-hint');
    if(hint)hint.textContent=inPark?'LEGOLAND · Your position and Geng are shown here.':mapMode==='3d'?'Angled city overview · Numbered pins match the directory.':'N ↑ · On mobile, swipe the map to explore.';
  }

  function drawMap(expanded = false) {
    const inPark=isInLegoland(pos.x);
    syncMapScope(inPark);
    if(inPark){
      const map=$<HTMLCanvasElement>(expanded?'expanded-map':'minimap');
      drawLegolandMap(map,{x:pos.x,z:pos.z,yaw},peerDots,expanded,expanded?mapZoom:.86,expanded?{panX:parkMapPanX,panZ:parkMapPanZ}:undefined,park.played);
      if(expanded)$('map-place-info').textContent=`LEGOLAND MAP · ${park.summary}`;
      return;
    }
    const carPin=expanded?carFinder.update(networkConnected,pos,roomPlayers):undefined;
    if(expanded&&mapMode==='3d'){try{overview.draw(pos.x,pos.z,selectedMapPlace,mapZoom,carPin);const selectedPlace=mapPlaces.find(p=>p.id===selectedMapPlace);$('map-place-info').textContent=selectedPlace?`${selectedPlace.name} · ${Math.round(distanceTo(selectedPlace))} m away · Follow the dotted line`:'3D city overview · Tap a numbered pin or choose a location below to teleport.';return;}catch{mapMode='2d';expandedCanvas.dataset.mode='2d';for(const b of viewControls.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.textContent==='2D'));}}
    const map = $<HTMLCanvasElement>(expanded ? 'expanded-map' : 'minimap'); const ctx = map.getContext('2d')!;
    const w=map.width,h=map.height;let scale=1.13,centerX=0,centerZ=0;
    if(expanded){
      const metrics=cityMapMetrics();centerX=metrics.centerX;centerZ=metrics.centerZ;scale=metrics.baseScale*mapZoom;
      map.dataset.worldScale=String(scale);map.dataset.centerX=String(centerX);map.dataset.centerZ=String(centerZ);map.dataset.panX=cityMapPanX.toFixed(2);map.dataset.panZ=cityMapPanZ.toFixed(2);
    }
    ctx.fillStyle = '#294b3f'; ctx.fillRect(0, 0, w, h); ctx.save(); ctx.translate(w / 2 + (expanded?cityMapPanX*scale:0), h / 2 + (expanded?cityMapPanZ*scale:0)); ctx.scale(scale, scale);ctx.translate(-centerX,-centerZ);
    ctx.fillStyle = '#395b44'; ctx.fillRect(-62, -147, 124, 67);
    ctx.fillStyle = '#82907a';
    for (const x of [0, 76, -82]) ctx.fillRect(x - 8.5, -157, 17, 314);
    for (const z of [-64, 8, 78]) ctx.fillRect(-157, z - 8.5, 314, 17);
    for (const b of world.mapBuildings) { ctx.fillStyle = '#4d6c56'; ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d); }
    lrt.drawMap(ctx);
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
    for (const peer of [...peerDots].sort((a, b) => Number(a.party) - Number(b.party))) {
      ctx.fillStyle = peer.party ? '#ff5a4f' : '#49cfff';
      ctx.beginPath(); ctx.arc(peer.x, peer.z, expanded ? 3.2 : 2.6, 0, Math.PI * 2); ctx.fill();
    }
    const arrowSize=expanded?1:1.75;
    ctx.save();ctx.translate(pos.x,pos.z);
    ctx.fillStyle='#173c32aa';ctx.strokeStyle='#dff092';ctx.lineWidth=expanded?1.4:2.3;ctx.beginPath();ctx.arc(0,0,expanded?5:10,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.rotate(-yaw);ctx.fillStyle='#fff9db';ctx.strokeStyle='#173c32';ctx.lineWidth=expanded?1.4:2.2;
    ctx.beginPath();ctx.moveTo(0,7*arrowSize);ctx.lineTo(-5*arrowSize,-5*arrowSize);ctx.lineTo(0,-2*arrowSize);ctx.lineTo(5*arrowSize,-5*arrowSize);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    ctx.fillStyle = '#d3dfba'; ctx.font = '600 9px "Oxanium"'; ctx.textAlign = 'center'; if(!expanded)ctx.fillText('KLCC', 0, -138);
    if (expanded) {
      ctx.fillText('N ↑', 140, -145);
      for (const remote of remotePlayers.values()) { ctx.fillStyle = '#e4b87b'; ctx.beginPath(); ctx.arc(remote.group.position.x, remote.group.position.z, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    if(carPin){
      drawCarPin(ctx,carPin,pos,10);
    }
    ctx.restore();
  }
  function updateHud() {
    document.body.classList.toggle('on-lrt',lrtId!=null);
    locationArrival.update(pos.x,pos.z,started&&lrtId==null,audioEnabled);
    vehicleRadio.update(started && lrtId==null && (riding || !!passengerOf) && musicEnabled);
    musicDuck += ((tableSocial.playing || skyDining ? 0 : 1) - musicDuck) * .08;
    skyMusic?.update(started && !paused && skyDining && musicEnabled, tableSocial.playing, audioVolume('music'));
    backgroundMusic.volume=(musicContext?1:.06*audioVolume('music'))*((riding||passengerOf)? .15:1)*musicDuck;
    lofiMusic.volume=(musicContext?1:.06*audioVolume('music')*lofiLevel())*((riding||passengerOf)? .15:1)*musicDuck;
    const jumpButton = document.querySelector<HTMLButtonElement>('.touch-actions [data-key="Space"]')!;
    jumpButton.textContent = riding ? 'BRAKE' : 'JUMP'; jumpButton.setAttribute('aria-label', riding ? 'Brake' : 'Jump');
    const area = districtFor(pos.z,pos.x);
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
    seatsPanel.hidden = lrtId!=null || !riding || vehicle !== 'car';
    if (!seatsPanel.hidden) {
      const driverId = passengerOf || networkPlayerId;
      const occupants = roomPlayers.filter(p => p.passengerOf === driverId);
      const names = [passengerOf ? roomPlayers.find(p => p.id === driverId)?.name || 'Driver' : displayName(), ...[0, 1, 2].map(i => occupants.find(p => p.seatIndex === i)?.name || '')];
      const key = JSON.stringify(names);
      if (seatsPanel.dataset.seats !== key) {
        const expanded=seatsPanel.querySelector('details')?.open??false;
        seatsPanel.dataset.seats = key; seatsPanel.replaceChildren();
        const details=document.createElement('details');details.open=expanded;seatsPanel.append(details);
        const heading = document.createElement('summary'); heading.textContent = `Car · ${names.filter(Boolean).length}/4 seats`; details.append(heading);
        names.forEach((name, i) => { const row = document.createElement('div'); row.textContent = `${i + 1} · ${i === 0 ? 'Driver: ' : ''}${name || 'Empty seat'}`; row.className = name ? 'occupied' : ''; details.append(row); });
      }
    }
    drawMap();
    if (cityMap.open) drawMap(true);
  }

  const desiredCamera = new THREE.Vector3(); const target = new THREE.Vector3();
  let hudTimer = 0, lastTime = performance.now();
  function frame(time: number) {
    const frameSeconds = (time - lastTime) / 1000;
    if (!document.hidden) netStatus.frame(frameSeconds);
    if(started&&!document.hidden){recentFrameTimes.push(frameSeconds*1000);if(recentFrameTimes.length>300)recentFrameTimes.shift();}
    const dt = Math.min(frameSeconds, .04); lastTime = time; elapsed += dt;
    const active = started;
    if (started && !document.hidden && graphicsQuality === 'high' && frameSeconds < .5) {
      slowSeconds = frameSeconds > .035 ? slowSeconds + frameSeconds : Math.max(0, slowSeconds - frameSeconds);
      if (slowSeconds > 5) { graphicsQuality = 'low'; autoReduced = true; slowSeconds = 0; applyQuality(); }
    }
    park.update(pos,camera,lrtNow(),started&&!paused&&!cityMap.open&&!tableSocial.opened);
    lrt.update(lrtNow(),pos,lrtId);
    for (const id of [0, 1]) {
      const state = trainState(id, lrtNow());
      const previous = trainDoorStates.get(id);
      if (previous !== undefined && previous !== state.doors) {
        const station = state.station >= 0 ? lrtStations[state.station] : undefined;
        const nearby = lrtId === id || !!station && Math.hypot(pos.x - station.x, pos.z - station.z) < 28 * soundRange;
        if (nearby) trainDoorSound(state.doors, id);
      }
      trainDoorStates.set(id, state.doors);
    }
    lrtPanel.hidden=!started||lrtId==null||cityMap.open||paused;
    if(lrtId!=null){const state=trainState(lrtId,lrtNow());lrtPanel.querySelector('strong')!.textContent=state.station>=0?`LRT · ${lrtStations[state.station].name}`:`Seterusnya · ${lrtStations[state.next].name}`;lrtPanel.querySelector('small')!.textContent=state.doors?'Pintu dibuka · Boleh turun':`${state.station>=0?'Berlepas':'Tiba'} dalam ${Math.ceil(state.remaining)}s`;lrtPanel.querySelector('button')!.disabled=!state.doors;}
    {
      simTime += dt;
      updateSpeakingProximity();
      streetAnimals.update(Date.now()/1000, pos, (cat, volume, pan) => {
        if (started && audioEnabled && audioContext?.state === 'running') animalSound(audioContext, cat, volume, pan, citySoundsGain!);
      }, soundRange);
      // A shared clock-based route keeps the vendor in the same area for all players.
      const vendorPhase = (Date.now() % 90000) / 90000 * Math.PI * 2;
      const vendorX = -5 * Math.cos(vendorPhase), vendorZ = 44 + 18 * Math.sin(vendorPhase);
      iceCreamBike.position.set(vendorX, .09, vendorZ);
      iceCreamBike.rotation.y = Math.atan2(5 * Math.sin(vendorPhase), 18 * Math.cos(vendorPhase));
      const vendorSpeed = Math.hypot(5 * Math.sin(vendorPhase), 18 * Math.cos(vendorPhase)) * Math.PI * 2 / 90;
      for (const wheel of iceCreamBike.userData.wheels as THREE.Mesh[]) wheel.rotation.x += vendorSpeed * dt / .45;
      iceCreamSolid.x = vendorX; iceCreamSolid.z = vendorZ;

      for (const item of world.traffic) {
        if(item.owner===networkPlayerId&&riding&&vehicle==='car'&&fleetId===item.id)continue;
        item.group.visible=!item.owner&&Math.hypot(item.x-pos.x,item.z-pos.z)<100;
        item.model.driver.visible=item.npc;
        const distance=item.group.position.distanceTo(new THREE.Vector3(item.x,.12,item.z));
        if(distance>20)item.group.position.set(item.x,.12,item.z);
        else item.group.position.lerp(new THREE.Vector3(item.x,.12,item.z),1-Math.exp(-14*dt));
        item.group.rotation.y=item.yaw;
        for(const wheel of item.model.wheels)wheel.rotation.x+=Math.min(distance,1)*dt*14/.36;
      }
      for(let i=angryDrivers.length-1;i>=0;i--){
        const actor=angryDrivers[i],npc=actor.person,left=actor.until-simTime;
        if(left<=0||!started){actor.source?.stop();actor.source?.disconnect();actor.gain?.disconnect();npc.group.traverse(o=>{if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}});disposeCharacter(npc.group);npc.group.removeFromParent();angryDrivers.splice(i,1);continue;}
        const distance=distanceTo(npc.group.position);
        if(actor.gain)actor.gain.gain.value=audioEnabled?Math.max(0,1-distance/25)*.9:0;
        npc.group.rotation.y=Math.atan2(pos.x-npc.group.position.x,pos.z-npc.group.position.z);
        npc.leftArm.rotation.x=-1.7+Math.sin(simTime*15)*.3;npc.rightArm.rotation.x=-1.4+Math.cos(simTime*13)*.35;
        npc.group.position.y=.12+Math.abs(Math.sin(simTime*8))*.08;
        npc.group.scale.setScalar(Math.min(1,left));
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
      // Nearest first, so the detail budget goes to the players actually worth articulating.
      // Use the server target for ranking and culling. After a local teleport, the rendered
      // group is still at the old site until this pass catches it up; measuring that stale
      // position hides a nearby player forever.
      const viewer = {x: pos.x, z: pos.z};
      const remoteDistance = (remote: RemotePlayer) => horizontalDistance(remote.target, viewer);
      const ranked = [...remotePlayers.values()].sort((a, b) => remoteDistance(a) - remoteDistance(b));
      let detailed = 0;
      for (const remote of ranked) {
        const distance = remoteDistance(remote);
        const shown = remoteIsVisible(remote.target, viewer, VISIBLE_RANGE);
        remote.group.visible = shown;
        // Standing next to someone must never show a capsule, so close range ignores the budget.
        remote.detail = shown && detailed < DETAIL_CEILING && (distance < CLOSE_RANGE || (distance < DETAIL_RANGE && detailed < DETAIL_LIMIT));
        if (remote.detail) detailed++;
        // A rider still shows their vehicle however far away: there are few of them, and a
        // capsule where a car should be reads as a bug rather than as distance.
        const riding = remote.riding && !remote.passengerOf;
        remote.stand.visible = shown && !remote.detail && !riding;
        remote.label.visible = remote.detail;
      }
      for (const remote of remotePlayers.values()) {
        if (remoteNeedsSnap(remote.group.position, remote.target)) remote.group.position.copy(remote.target);
        else remote.group.position.lerp(remote.target, 1 - Math.exp(-14 * dt));
        if (!remote.group.visible) continue;
        remote.yaw = dampAngle(remote.yaw, remote.targetYaw, 1 - Math.exp(-12 * dt));
        remote.group.rotation.y = remote.yaw;
        const onCar = remote.riding && remote.vehicle === 'car' && !remote.passengerOf;
        const onBike = remote.riding && remote.vehicle === 'bike' && !remote.passengerOf;
        remote.car.group.visible = onCar; remote.bike.group.visible = onBike;
        remote.person.group.visible = remote.detail && !onCar && !onBike;
        const rider=roomPlayers.find(p=>p.id===remote.id);
        if(rider?.lrtId!=null){const point=riderPoint(rider,lrtNow());remote.group.position.set(point.x,point.y,point.z);remote.group.rotation.y=point.yaw;remote.car.group.visible=false;remote.bike.group.visible=false;remote.person.group.visible=true;}
        if (!remote.detail) continue;
        remote.person.group.scale.setScalar(remote.passengerOf && remote.vehicle === 'car' ? .7 : 1);
        if (remote.resting) beachRestPose(remote.person, remote.resting, remote.targetYaw);
        else {
          beachRestPose(remote.person, null);
          // Seated until they get up: a rider who has walked is standing, like you are.
          const strolling = rider?.lrtId!=null && (rider.lrtAlong!=null || rider.lrtAcross!=null);
          if ((rider?.lrtId!=null && !strolling) || remote.seated || remote.passengerOf) sitPose(remote.person);
          if (!remote.riding) punchPose(remote.person, remote.punchUntil);
        }
        pickleball.equip(remote.person,!remote.riding&&!remote.seated&&!remote.resting&&insidePickleball(remote.group.position),Math.max(0,(remote.punchUntil-simTime)/.38));
        basketball.pose(remote.person,remote.id);
        if(rider?.skyDining&&inSkyPool(remote.target)&&!remote.seated)swimPose(remote.person,simTime);
        if (remote.riding) remote.recallUntil = 0;
        const recallProgress = remote.recallUntil > simTime ? 1 - (remote.recallUntil - simTime) / .82 : 0;
        const pulse = recallProgress > 0 ? 1 + Math.sin(recallProgress * Math.PI) * .16 : 1;
        remote.group.scale.setScalar(remote.car.group.visible || remote.bike.group.visible ? 1 : pulse); remote.bike.rider.scale.setScalar(remote.bike.group.visible ? pulse : 1); remote.car.driver.scale.setScalar((remote.car.group.userData.driverScale ?? .7) * (remote.car.group.visible ? pulse : 1));
      }
    }
    if (active) {
      if (!paused) updateKlccLift(dt);
      const forward = isDancing()?0:THREE.MathUtils.clamp(Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + stickY, -1, 1);
      const turn = isDancing()?0:THREE.MathUtils.clamp(Number(keys.has('KeyA') || keys.has('ArrowLeft')) - Number(keys.has('KeyD') || keys.has('ArrowRight')) - stickX, -1, 1);
      const dynamicSolids: Solid[] = world.traffic.filter(c=>!(c.owner===networkPlayerId&&riding)&&(!passengerOf||c.owner!==passengerOf)).map(c => vehicleSolid(c.group,c.x,c.z,c.yaw));
      const solids = [...world.solids, ...dynamicSolids];
      if(skyDining){solids.length=0;solids.push(...sky.solids);}
      if (!skyDining && (!riding || vehicle !== 'bike')) solids.push({ x: bike.group.position.x, z: bike.group.position.z, hx: .5, hz: 1.15 });
      if (!skyDining && (!riding || vehicle !== 'car'||car!==personalCar)) solids.push(vehicleSolid(personalCar.group));
      if(klccLiftRide?.phase === 'moving'){
        walkSpeed=0;
      } else {
        const parkPosition=park.pose(lrtNow());
        if(parkPosition){pos.set(parkPosition.x,.12,parkPosition.z);deckY=parkPosition.y;onBridge=false;yaw=parkPosition.yaw;player.group.position.set(pos.x,deckY+.12,pos.z);player.group.rotation.y=yaw;walkSpeed=0;speed=0;}
        else if(lrtId!=null){
        // Walking inside a moving carriage: the keys move you within the coach, not across
        // the city, and the walls are where the clamp is.
        const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
        const sideways=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
        const step=2.4*dt;
        if(forward||sideways||stickX||stickY){
          const spot=clampCoach(lrtAlong+(forward-stickY)*step,lrtAcross+(sideways+stickX)*step);
          lrtAlong=spot.along;lrtAcross=spot.across;
        }
        // Told to the server only when it has actually changed, and never faster than the
        // ordinary movement rate.
        const now=performance.now();
        if(now-lrtSentAt>120&&(Math.abs(lrtAlong-lrtSentAlong)>.02||Math.abs(lrtAcross-lrtSentAcross)>.02)&&networkSocket?.readyState===WebSocket.OPEN){
          lrtSentAt=now;lrtSentAlong=lrtAlong;lrtSentAcross=lrtAcross;
          networkSocket.send(JSON.stringify({type:'lrt-walk',along:lrtAlong,across:lrtAcross}));
        }
        const point=riderPoint({lrtId,lrtSeat,lrtAlong,lrtAcross},lrtNow());pos.set(point.x,point.y,point.z);yaw=point.yaw;speed=trainState(lrtId,lrtNow()).speed;player.group.position.copy(pos);player.group.rotation.y=yaw;player.group.visible=true;walkSpeed=0;
      } else if (passengerOf) {
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
      } else if (beachResting && beachRestSpot) {
        beachRestPose(player, beachResting, beachRestSpot.yaw);
        player.group.position.set(beachRestSpot.x, beachRestSpot.height, beachRestSpot.z);
        pos.set(beachRestSpot.x, .12, beachRestSpot.z); yaw = beachRestSpot.yaw; deckY = 0; onBridge = false;
        walkSpeed = 0; speed = 0; jumpHeight = 0; jumpVelocity = 0;
      } else if (seated) {
        player.group.position.set(pos.x, deckY-.22, pos.z); player.group.rotation.y = yaw; sitPose(player); walkSpeed = 0;
      } else {
        if (jumpVelocity !== 0 || jumpHeight > 0) {
          jumpVelocity -= 18 * dt; jumpHeight = Math.max(0, jumpHeight + jumpVelocity * dt);
          if (jumpHeight === 0) { jumpVelocity = 0; movementSound('land'); footstepDistance = 0; }
        }
        const input = new THREE.Vector2(-turn, forward); if (input.length() > 1) input.normalize();
        const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stickX, stickY) > .85; const maxSpeed = skyDining&&inSkyPool(pos)?2.5:park.driving ? 15 : running ? 7 : 3.7;
        walkSpeed = THREE.MathUtils.damp(walkSpeed, input.length() * maxSpeed, 14, dt);
        const previousX = pos.x, previousZ = pos.z;
        if (input.length()) {
          input.normalize();
          const reference = cameraHeading + orbit;
          const dx = Math.sin(reference) * input.y - Math.cos(reference) * input.x;
          const dz = Math.cos(reference) * input.y + Math.sin(reference) * input.x;
          yaw = dampAngle(yaw, Math.atan2(dx, dz), 1 - Math.exp(-14 * dt));
          moveWithCollisions(pos, dx * walkSpeed * dt, dz * walkSpeed * dt, .46, solids);
          if(skyDining){pos.x=THREE.MathUtils.clamp(pos.x,SKY.x-SKY.hx+.6,SKY.x+SKY.hx-.6);pos.z=THREE.MathUtils.clamp(pos.z,SKY.z-SKY.hz+.6,SKY.z+SKY.hz-.6);deckY=skyHeight(pos);onBridge=false;}
          else if (klccLiftRide?.phase === 'top') {
            const edge = 3.15;
            pos.x = Math.max(klccLiftRide.lift.x - edge, Math.min(klccLiftRide.lift.x + edge, pos.x));
            pos.z = Math.max(klccLiftRide.lift.z - edge, Math.min(klccLiftRide.lift.z + edge, pos.z));
            onBridge = false; deckY = klccLiftRide.lift.topY;
          } else {
            const footing = salomaGround(pos.x, pos.z, onBridge);
            // Up on the deck the railings are the edge of the world, so hold the walk to it.
            if (footing.elevated) pos.z = Math.max(SALOMA.z - SALOMA.walkHalfWidth, Math.min(SALOMA.z + SALOMA.walkHalfWidth, pos.z));
            onBridge = footing.elevated; deckY = footing.y;
          }
        }
        const travelled = Math.hypot(pos.x - previousX, pos.z - previousZ);
        if(!skyDining&&!klccLiftRide){const height=rembayungGroundHeight(pos)??shoplotFloorHeight(world.shoplots.lots,pos);if(height!==null)deckY=height;}
        if (!(skyDining&&inSkyPool(pos)) && jumpHeight === 0 && travelled > .001) {
          footstepDistance += travelled;
          if (footstepDistance >= (running ? 1.65 : 1.15)) { movementSound('step', running); footstepDistance = 0; }
        } else footstepDistance = 0;
        player.group.position.copy(pos); player.group.rotation.y = yaw;
        const stride = Math.sin(simTime * (running ? 13 : 9)) * Math.min(.7, walkSpeed * .12);
        player.leftLeg.rotation.x = stride; player.rightLeg.rotation.x = -stride; player.leftArm.rotation.x = -stride * .7; player.rightArm.rotation.x = stride * .7;
        player.group.position.y = deckY + .12 + jumpHeight + Math.abs(Math.sin(simTime * 9)) * Math.min(.05, walkSpeed * .008)
          + (isGm ? gmHover(simTime) : 0);
      }
      }
      if(skyDining&&inSkyPool(pos)&&!seated){swimPose(player,simTime);jumpHeight=0;jumpVelocity=0;}
      else if (!riding && !beachResting) punchPose(player, punchUntil);
      if (isGm) gmAura.update(simTime);
      pickleball.equip(player,!riding&&!seated&&!beachResting&&insidePickleball(pos),Math.max(0,(punchUntil-simTime)/.38));
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
      // North is world -z, which the minimap draws upward, so the needle leads the camera by pi.
      if (Math.abs(heading - Math.PI - compassAngle) > .01) { compassAngle = heading - Math.PI; compass.style.transform = `rotate(${compassAngle}rad)`; }
      const distance = (lrtId!=null?Math.max(22,zoom):zoom) + (riding ? Math.abs(speed) * .07 : 0);
      let cameraDistance = distance;
      // Shorten the camera arm when a building would obscure the player.
      for (let step = 1.5; !skyDining && lrtId==null && !park.active && !klccLiftRide && step < distance; step += .65) {
        const p = { x: pos.x - Math.sin(heading) * step, z: pos.z - Math.cos(heading) * step };
        const cameraRayY=deckY+(riding?2:1.6)+step*cameraPitch;
        if (world.solids.some(s => (s.cameraTop===undefined||cameraRayY<=s.cameraTop)&&overlaps(p, .35, s))) { cameraDistance = Math.max(1.2, step - .65); break; }
      }
      target.set(pos.x, (lrtId!=null?railHeight+2:riding ? 2 : 1.6) + deckY, pos.z);
      desiredCamera.set(pos.x - Math.sin(heading) * cameraDistance, Math.max(.75, target.y + cameraDistance * (lrtId!=null?Math.max(.55,cameraPitch):cameraPitch)), pos.z - Math.cos(heading) * cameraDistance);
      camera.position.lerp(desiredCamera, 1 - Math.exp(-9 * dt)); camera.lookAt(target);
      const shadowX = pos.x + Math.sin(heading) * SHADOW_AHEAD, shadowZ = pos.z + Math.cos(heading) * SHADOW_AHEAD;
      sun.position.set(shadowX + weatherUI.sunOffset.x, weatherUI.sunOffset.y, shadowZ + weatherUI.sunOffset.z); sun.target.position.set(shadowX, 0, shadowZ);
      if (rainEnabled) {
        rain.position.set(pos.x, 0, pos.z);
        const drops = graphicsQuality === 'low' ? rainCount / 2 : rainCount;
        for (let i = 0; i < drops; i++) {
          const j = i * 6; rainPositions[j + 1] -= dt * 30;
          if (rainPositions[j + 1] < 0) rainPositions[j + 1] += RAIN_HEIGHT;
          rainPositions[j + 3] = rainPositions[j] + .4; rainPositions[j + 4] = rainPositions[j + 1] - 2.1; rainPositions[j + 5] = rainPositions[j + 2] + .1;
        }
        rainGeometry.setDrawRange(0, drops * 2); rainGeometry.attributes.position.needsUpdate = true;
      }
      sendNetworkState(dt);
    }
    if (!started) {
      const drift = reducedMotion ? 0 : Math.sin(elapsed * .055) * 3;
      camera.position.set(43 + drift, 29, 108); camera.lookAt(-10, 22, -45);
      sun.position.copy(weatherUI.sunOffset);
    }
    if (engineGain && engine && audioContext) {
      engineGain.gain.setTargetAtTime(audioEnabled && active && riding && lrtId==null ? .013 + Math.abs(speed) * .0007 : 0, audioContext.currentTime, .1);
      engine.frequency.setTargetAtTime(48 + Math.abs(speed) * 6, audioContext.currentTime, .1);
    }
    hudTimer += dt;
    if (active && hudTimer > .1) { hudTimer = 0; updateHud(); }
    const danceNow=Date.now();
    const selfDance=roomPlayers.find(p=>p.id===networkPlayerId)?.danceUntil||0;
    dancePose(player,selfDance-danceNow,10-(selfDance-danceNow)/1000,reducedMotion);
    for(const remote of remotePlayers.values()){if(!remote.detail)continue;const until=roomPlayers.find(p=>p.id===remote.id)?.danceUntil||0;dancePose(remote.person,until-danceNow,10-(until-danceNow)/1000,reducedMotion);}
    supermanPose(bike.riderRig,isSuperman(),elapsed,reducedMotion);
    for(const remote of remotePlayers.values()){if(!remote.detail)continue;const state=roomPlayers.find(p=>p.id===remote.id);supermanPose(remote.bike.riderRig,!!state?.riding&&!state.passengerOf&&state.vehicle==='bike'&&Number(state.supermanUntil)>danceNow,elapsed,reducedMotion);}
    danceAudio.update(roomPlayers,pos,audioContext,citySoundsGain,started&&audioEnabled,soundRange);
    sky.update(elapsed,reducedMotion,skyDining);
    clouds.update(elapsed,camera,reducedMotion,graphicsQuality==='low');
    mamakSteam.update(elapsed,started&&!paused&&!document.hidden&&!reducedMotion&&mamakAssetState==='ready'&&Math.hypot(pos.x+29,pos.z-46)<35&&graphicsQuality==='high');
    buskers.update(elapsed,reducedMotion);
    village.group.visible=Math.hypot(pos.x-villageOrigin.x,pos.z-villageOrigin.z)<85;
    for(let i=venues.length;i--;)if(Math.hypot(pos.x-venues[i].x,pos.z-venues[i].z)<VENUE_LOAD_RADIUS)void venues.splice(i,1)[0].load();
    updateStreaming(pos.x,pos.z);
    if(village.group.visible)village.update(reducedMotion?0:elapsed);
    villageNearby=started&&!paused&&!riding&&!cityMap.open?village.nearby(pos.x,pos.z):undefined;
    villageTalk.hidden=!villageNearby;villageTalk.textContent=villageNearby?`Tegur ${villageNearby.name}`:'';
    rembayungBuskers.update(elapsed,reducedMotion||Math.hypot(pos.x-rembayungBuskingSpot.x,pos.z-rembayungBuskingSpot.z)>65);
    // Spatial loops may be near spawn. Do not request or play them until this entry has an
    // authoritative welcome, otherwise login becomes a burst of nearby city audio.
    const ambienceAllowed=started&&(networkConnected||!multiplayerEndpoint)&&audioEnabled&&!tableSocial.playing&&audioContext?.state==='running';
    const buskingLevel=ambienceAllowed?buskingVolume(soundDistance(Math.min(Math.hypot(pos.x-buskingSpot.x,pos.z-buskingSpot.z),Math.hypot(pos.x-rembayungBuskingSpot.x,pos.z-rembayungBuskingSpot.z)))):0;
    const watsonsLevel=ambienceAllowed?watsonsVolume(soundDistance(Math.hypot(pos.x-watsonsSpot.x,pos.z-watsonsSpot.z))):0;
    const familyMartLevel=ambienceAllowed?familyMartVolume(soundDistance(Math.hypot(pos.x-familyMartSpot.x,pos.z-familyMartSpot.z))):0;
    const masjidLevel=ambienceAllowed?masjidVolume(soundDistance(nearestMasjidDistance(pos))):0;
    const stallVoiceLevel=ambienceAllowed?stallVoiceVolume(soundDistance(nearestStallDistance(pos))):0;
    if(buskingGain&&audioContext)buskingGain.gain.setTargetAtTime(buskingLevel,audioContext.currentTime,.2);
    if(watsonsGain&&audioContext)watsonsGain.gain.setTargetAtTime(watsonsLevel,audioContext.currentTime,.2);
    if(familyMartGain&&audioContext)familyMartGain.gain.setTargetAtTime(familyMartLevel,audioContext.currentTime,.2);
    if(masjidGain&&audioContext)masjidGain.gain.setTargetAtTime(masjidLevel,audioContext.currentTime,.25);
    if(stallVoiceGain&&audioContext)stallVoiceGain.gain.setTargetAtTime(stallVoiceLevel,audioContext.currentTime,.2);
    setNearbyLoop(buskingSong,buskingLevel>.001);setNearbyLoop(watsonsSong,watsonsLevel>.001);setNearbyLoop(familyMartSong,familyMartLevel>.001);setNearbyLoop(masjidSong,masjidLevel>.001);setNearbyLoop(stallVoiceSong,stallVoiceLevel>.001);
    if (iceCreamGain && audioContext) {
      const distance = soundDistance(Math.min(Math.hypot(pos.x - iceCreamBike.position.x, pos.z - iceCreamBike.position.z),Math.hypot(pos.x-rembayungIceCream.position.x,pos.z-rembayungIceCream.position.z),Math.hypot(pos.x-beach.iceCream.position.x,pos.z-beach.iceCream.position.z)));
      const proximity = Math.max(0, Math.min(1, (24 - distance) / 20));
      const level=ambienceAllowed?1.2*proximity*proximity:0;
      iceCreamGain.gain.setTargetAtTime(level, audioContext.currentTime, .18);setNearbyLoop(iceCreamSong,level>.001);
    }
    if (lamboGain && audioContext) {
      const distance = soundDistance(Math.min(...world.traffic.filter(car => car.group.userData.model === 'lamborghini').map(car => Math.hypot(pos.x-car.group.position.x, pos.z-car.group.position.z))));
      const proximity = Math.max(0, Math.min(1, (LAMBO_REACH - distance) / (LAMBO_REACH - LAMBO_FULL)));
      const level=ambienceAllowed?LAMBO_PEAK*proximity*proximity:0;
      lamboGain.gain.setTargetAtTime(level, audioContext.currentTime, .18);setNearbyLoop(lamboSong,level>.001);
    }
    if (localName) localName.position.set(pos.x, (lrtId!=null?railHeight+.85:deckY) + 3.34 + jumpHeight + (passengerOf ? .3 : 0) - (seated ? .34 : 0), pos.z);
    if (localName) updateGameMasterTag(localName, !!roomPlayers.find(p => p.id === networkPlayerId)?.gameMaster, elapsed, reducedMotion);
    for (const remote of roomPlayers) {
      const entity = remotePlayers.get(remote.id);
      if (entity) {
        updateGameMasterTag(entity.label, !!remote.gameMaster, elapsed, reducedMotion);
        // updateNameTagGeng redraws only when the value actually changes.
        updateNameTagGeng(entity.label, String(remote.geng || ''), !!remote.gengLeader);
      }
    }
    voiceRadius.visible=started&&voice.micActive&&!voice.partyOnly;
    if(voiceRadius.visible){voiceRadius.position.set(pos.x,deckY+.08,pos.z);voiceRadius.material.opacity=reducedMotion ? .65 : .6+Math.sin(elapsed*3)*.12;}
    camera.updateMatrixWorld();
    const actionButton = document.getElementById('interaction') as HTMLButtonElement | null;
    const action = objectAction();
    if(actionButton && !interactionPointerDown && performance.now()>=interactionPressUntil){
    actionButton.dataset.carId=action&&'carId' in action?action.carId||'':'';
    actionButton.hidden = !started || paused || cityMap.open || wall.opened || profile.open || onlinePlayersDialog.open || !action || jumpHeight > 0;
    if (action && !actionButton.hidden) {
      const anchor = new THREE.Vector3(action.point.x, action.height, action.point.z).project(camera);
      actionButton.hidden = anchor.z < -1 || anchor.z > 1 || Math.abs(anchor.x) > 1 || Math.abs(anchor.y) > 1;
      actionButton.style.left = `${Math.max(60, Math.min(innerWidth - 60, (anchor.x + 1) * innerWidth / 2))}px`;
      actionButton.style.top = `${Math.max(50, Math.min(innerHeight - 70, (1 - anchor.y) * innerHeight / 2))}px`;
      actionButton.disabled = action.disabled;
      const interactionText = document.getElementById('interaction-text');
      if (interactionText) interactionText.textContent = action.label;
    }
    }
    const voicePanel = document.getElementById('voice-panel') as HTMLElement | null;
    const voiceInTable=!!voicePanel?.closest('#table-social');
    if (voicePanel) voicePanel.hidden = !started || !localName || paused || cityMap.open || wall.opened || profile.open || onlinePlayersDialog.open;
    if(localName && voicePanel && !voicePanel.hidden && !voiceInTable){
      camera.updateMatrixWorld();
      const anchor=localName.position.clone().add(new THREE.Vector3(0,.35,0)).project(camera);
      voicePanel.hidden=anchor.z < -1 || anchor.z > 1 || Math.abs(anchor.x)>1;
      voicePanel.style.left=`${Math.max(60,Math.min(innerWidth-60,(anchor.x+1)*innerWidth/2))}px`;
      voicePanel.style.top=`${Math.max(105,Math.min(innerHeight-65,(1-anchor.y)*innerHeight/2))}px`;
    }else if(voiceInTable&&voicePanel){
      voicePanel.style.removeProperty('left');voicePanel.style.removeProperty('top');
    }


    camera.updateMatrixWorld();
    streetStalls.update(pos,camera,started&&!paused&&!cityMap.open&&!wall.opened&&!tableSocial.opened&&!riding&&!seated);
    setAfkBubble('self', started ? afkNote : '');
    // Keep the nearest table action attached to its world position.
    const promptBlocked=!started||paused||cityMap.open||wall.opened||tableSocial.opened;
    let nearestLabel:typeof tableLabels[number]|null=null,nearestLabelDistance=8;
    if(!promptBlocked)for(const entry of tableLabels){const away=Math.abs((entry.table.y||0)-deckY)>2?Infinity:distanceTo(entry.table);if(away<=nearestLabelDistance){nearestLabelDistance=away;nearestLabel=entry;}}
    const ownTableId=chairLocations.find(chair=>chair.id===seatedChairId)?.tableId;
    if(!promptBlocked && (pressedTableId||ownTableId))nearestLabel=tableLabels.find(entry=>entry.table.id===(pressedTableId||ownTableId))||nearestLabel;
    for(const {table,button} of tableLabels){
      const active=nearestLabel?.table.id===table.id;
      button.hidden=!active;
      if(!active)continue;
      if(pressedTableId===table.id)continue; // Keep the target still until the tap finishes.
      const tableAnchor=new THREE.Vector3(table.x,(table.y||0)+2.8,table.z).project(camera);
      button.hidden=tableAnchor.z < -1 || tableAnchor.z > 1 || Math.abs(tableAnchor.x)>1 || Math.abs(tableAnchor.y)>1;
      if(button.hidden)continue;
      button.style.left=`${THREE.MathUtils.clamp((tableAnchor.x+1)*innerWidth/2,Math.min(160,innerWidth*.36)+8,innerWidth-Math.min(160,innerWidth*.36)-8)}px`;
      button.style.top=`${(1-tableAnchor.y)*innerHeight/2}px`;
      const state=roomTables.find(t=>t.id===table.id);
      const name=state?.name||table.name;
      // Who is actually sitting here, by name — the table already knows, it just never said.
      const seated=state?.occupants||[];
      const capacity=state?.capacity||seatsPerTable.get(table.id)||4;
      const names=seated.map(o=>o.name).join(', ');
      const game=state?.activeGame;
      const gameText=game?` · ${tableGameTitles[game.game]||game.game} · ${tableGamePhases[game.phase]||game.phase}`:'';
      const label=seated.length
        ? `${name} · ${seated.length}/${capacity} · ${names}${gameText}`
        : `${name} · kosong · ${capacity} tempat${gameText}`;
      if(button.textContent!==label)button.textContent=label;
      button.setAttribute('aria-label',`Open games at ${name}`);
    }
    const placedBubbles: { left: number; right: number; top: number; bottom: number }[] = [];
    // Your mic/speaker controls float over your own head, and a taller nameplate (Game Master, geng)
    // lifts them into your speech bubble. Treat them as a placed bubble so speech stacks above them.
    const voiceRect = voicePanel && !voicePanel.hidden && !voiceInTable ? voicePanel.getBoundingClientRect() : null;
    if (voiceRect) placedBubbles.push({ left: voiceRect.left, right: voiceRect.right, top: voiceRect.top, bottom: voiceRect.bottom });
    for (const [id, bubble] of speechBubbles) {
      const afk = id.startsWith('afk:');
      const villageNpc = id.startsWith('village:');
      const speakerId = afk ? id.slice(4) : id;
      const villageName = villageNpc ? speakerId.slice(8) : '';
      // Residents are parented to the village group, so their own position is village-local and
      // projected near the world origin: off camera, which hid every "Tegur" bubble.
      const villageSpeaker = villageNpc ? village.people.find(person => person.resident.name === villageName)?.rig.group.getWorldPosition(new THREE.Vector3()) : undefined;
      const speaker = villageSpeaker || (speakerId === 'self' || speakerId === networkPlayerId ? (lrtId==null && riding && !passengerOf ? (vehicle === 'car' ? car.group.position : bike.group.position) : player.group.position) : remotePlayers.get(speakerId)?.group.position);
      const remaining = bubble.expiresAt - time;
      if (!speaker || remaining <= 0 || (!networkConnected && !afk && !villageNpc)) {
        bubble.element.remove(); speechBubbles.delete(id); continue;
      }
      speechPosition.set(speaker.x, speaker.y + (afk ? 4.5 : villageNpc ? 3.25 : 3.8), speaker.z).project(camera);
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
        // A close camera puts the speaker's head near the top edge. Clamp the bubble into the
        // viewport instead of hiding it, or Tegur disappears exactly when you walk up to talk.
        y = Math.max(y, height + 8);
        // No room above the controls at the top edge: read it just below them instead.
        if (voiceRect && x + width / 2 > voiceRect.left && x - width / 2 < voiceRect.right && y > voiceRect.top - 10 && y - height < voiceRect.bottom + 10) y = voiceRect.bottom + 10 + height;
        placedBubbles.push({ left: x - width / 2, right: x + width / 2, top: y - height, bottom: y });
        bubble.element.style.left = `${x}px`;
        bubble.element.style.top = `${y}px`;
        bubble.element.style.opacity = String(Math.min(1, remaining / 500));
      }
    }
    beach.update(simTime,pos);
    pickleball.update(pos,started&&!paused&&!riding&&!seated,dt,networkConnected);
    basketball.update(pos,started&&!paused&&!riding&&!seated,dt,networkConnected,networkPlayerId);
    updateVehiclePresentation(scene,camera,dt,mamakNight,
      riding && vehicle==='car' ? {group:car.group,controls:{speed,
        steering:THREE.MathUtils.clamp(Number(keys.has('KeyA')||keys.has('ArrowLeft'))-Number(keys.has('KeyD')||keys.has('ArrowRight'))-stickX,-1,1),
        braking:keys.has('Space')}} : undefined,simTime,.12);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  // Read-only diagnostics support browser smoke tests without modifying gameplay state.
  if (import.meta.env.DEV) {
    Object.defineProperty(window, '__lepak', { get: () => ({ skyDining,swimming:skyDining&&inSkyPool(pos),lrtId,lrtSeat,superman:isSuperman(),soundRange, angry:angryDrivers.map(a=>a.line), busking:{playing:!buskingSong.paused,gain:buskingGain?.gain.value??0}, watsons:{playing:!watsonsSong.paused,gain:watsonsGain?.gain.value??0}, familyMart:{playing:!familyMartSong.paused,gain:familyMartGain?.gain.value??0}, masjid:{playing:!masjidSong.paused,gain:masjidGain?.gain.value??0,distance:nearestMasjidDistance(pos)}, stallVoice:{playing:!stallVoiceSong.paused,gain:stallVoiceGain?.gain.value??0,distance:nearestStallDistance(pos)}, trafficModels: world.traffic.map(item => item.group.userData.model), mamakMaju: { state: mamakAssetState, fallbackVisible: world.mamakProcedural.visible }, graphicsQuality, autoReduced, shadows: renderer.shadowMap.enabled, pixelRatio: renderer.getPixelRatio(), cameraZoom: zoom, cameraActualDistance:Math.hypot(camera.position.x-pos.x,camera.position.z-pos.z), cameraOrbit: orbit, iceCream: { x: iceCreamBike.position.x, z: iceCreamBike.position.z, playing: !iceCreamSong.paused, gain: iceCreamGain?.gain.value ?? 0 }, lambo: { cars: world.traffic.filter(item=>item.group.userData.model==='lamborghini').map(item=>({id:item.id,x:item.x,z:item.z,speed:item.speed,npc:item.npc})), playing: !lamboSong.paused, gain: lamboGain?.gain.value ?? 0, peak: LAMBO_PEAK, reach: LAMBO_REACH }, started, paused, riding, passengerOf, vehicle, seated, jumpHeight, punchCount, stick: { x: stickX, y: stickY }, profileScreen: (() => { const p = player.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)).project(camera); return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 }; })(), position: { x: pos.x, z: pos.z }, bridge: { onBridge, deckY }, klccLift: klccLiftRide ? { id: klccLiftRide.lift.id, phase: klccLiftRide.phase, direction: klccLiftRide.direction, y: deckY } : null, geng, lamps: streetLights.lamps.map((lamp,index)=>({x:lamp.x,z:lamp.z,lit:streetLights.lit(index)})), yaw, speed, money, bike: { x: bike.group.position.x, z: bike.group.position.z }, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, simTime, rain: rainEnabled }) });
  }
  requestAnimationFrame(frame);
  // Returning members skip the title screen once Supabase restores a valid session.
  // Calling the same entry function preserves recovery mode and all normal startup checks.
  // The world stage hands over to the city link rather than finishing: it used to announce
  // 100% "The city is ready" and hide the overlay, so the bar slid back to 74% the instant
  // entry began, which reads as the game reloading itself. Entry can still decline (expired
  // login, a Google account with no display name yet), so the overlay is only retired here
  // when entry did not take it over.
  if (session) await requestEntry();
  if (!started) {
    showLoading('Ready to lepak', 'The city is ready.', 100);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    hideLoading();
  }
}
void init().catch(error => { console.error(error); fail('The city could not finish loading. Please reload and try again.'); });
