import {createWeather} from './weather.mjs';
import {createFleet} from './fleet.mjs';
import {createLrt} from './lrt.mjs';
import {teleportPlayer} from './teleport.mjs';
import {createWeatherControls} from './weather-controls.mjs';
import {createLamps} from './lamps.mjs';
import {districtFor} from '../shared/districts.mjs';
import {tableOf, seatedWith} from './seating.mjs';
import { createUno } from './uno.mjs';
import { createWerewolf } from './werewolf.mjs';
import { createLukis } from './lukis.mjs';
import { createPoker } from './poker.mjs';
import { createPickleball } from './pickleball.mjs';
import { createBasketball } from './basketball.mjs';
import {createSocialProfiles} from './social-profiles.mjs';
import { createChatHistory } from './chat-history.mjs';
import { cleanProfile, publicProfile } from './profiles.mjs';
import { createTableSocial } from './tables.mjs';
import { createParty } from './party.mjs';
import { gmAnnouncement } from './announce.mjs';
import { createTableLobby } from './table-lobby.mjs';
import tableLocations from '../shared/tables.json' with { type: 'json' };
import chairs from '../shared/chairs.json' with { type: 'json' };
import http from 'node:http';
import { isGameMaster } from './roles.mjs';
import { createModeration } from './moderation.mjs';
import { filterChat } from './chat-filter.mjs';
import { createShop } from './shop.mjs';
import {createWall} from './wall.mjs';
import {createAccounts} from './account.mjs';
import {createLeaderboard} from './leaderboard.mjs';
import city from '../shared/city.json' with {type:'json'};
import voiceConfig from '../shared/voice.json' with { type: 'json' };
import vehicleSeats from '../shared/vehicle-seats.json' with { type: 'json' };
import packageInfo from '../package.json' with { type: 'json' };
const { version } = packageInfo;
import appearanceOptions from '../shared/appearance.json' with { type: 'json' };
const defaults = { gender: 'male', hairstyle: 'short', hair: '#202c2b', skin: '#b98157', shirt: '#ef734c', trousers: '#c7be9c' };
function cleanAppearance(value) { return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, Object.values(appearanceOptions[key]).includes(value?.[key]) ? value[key] : fallback])); }
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { WebSocketServer } from 'ws';
import { createMetrics } from './metrics.mjs';
import { clientKey, createConnectionCap } from './limits.mjs';

const port = Number(process.env.PORT || 8080);
const maxPlayers = city.maxPlayers;
const rooms = new Map();
const metrics = createMetrics();
const dirtyRooms = new Set();
// Coalesce movement from all players into at most one snapshot per room per tick.
setInterval(() => {
  const pending = [...dirtyRooms]; dirtyRooms.clear();
  for (const players of pending) if (players.size) broadcast(players, { type: 'players', players: snapshot(players) });
}, 50).unref();
const accountConnections = new Map();
const tableSocial = createTableSocial(send);
const party = createParty(send);
const leaderboard=createLeaderboard();
const socialProfiles=createSocialProfiles({onUnlock:(player,badges)=>send(player.ws,{type:'achievement-unlocked',badges}),onStats:(userId,name,values)=>leaderboard.record(userId,name,values).catch(()=>{})});
const uno = createUno(send);
const werewolf = createWerewolf(send);
const lukis = createLukis(send);
const poker = createPoker(send);
// The lobby starts the games; the games keep their own rules once running.
const tableLobby = createTableLobby(send, {lukis, poker, uno, werewolf});
const pickleball = createPickleball(send);
const basketball = createBasketball(send,Date.now,(player,points)=>socialProfiles.event(player,'basketball_points',points));
setInterval(()=>{for(const ps of rooms.values())basketball.tick(ps);},50).unref();
setInterval(()=>{for(const ps of rooms.values())pickleball.tick(ps);},50).unref();
setInterval(()=>{for(const ps of rooms.values())poker.tick(ps);},500).unref();
setInterval(()=>{for(const ps of rooms.values()){lukis.tick(ps);werewolf.tick(ps);uno.tick(ps);}},500).unref();
const chatHistory = createChatHistory();
const moderation = createModeration();
// Every verb that carries a player's own words, voice, drawing or display name to somebody
// else. A mute enforced inside each feature is a mute with a hole in it the day the next
// feature lands, so they are all refused at one gate before any handler sees them.
const MUTED = new Set(['chat', 'voice-audio', 'afk-note', 'geng', 'profile-refresh', 'lukis-ink', 'lukis-line', 'lukis-guess']);
const SURFACES = new Set(['voice', 'chat', 'wall', 'drawing', 'name', 'behaviour']);
const REASONS = new Set(['harassment', 'sexual', 'hate', 'threat', 'scam', 'child-safety', 'other']);
function penaltyNotice(status) {
  const until = status.until ? ` until ${new Date(status.until).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}` : '';
  return `Your account is suspended from LepakMamak${until}.${status.reason ? ` Reason: ${status.reason}` : ''}`;
}
// A penalty lands while the player is already in the city, and Railway's rooms know nothing
// about Supabase, so the city asks rather than the console pushing to it. The door check
// below is what makes a ban stick; this only has to catch whoever is already inside.
setInterval(async () => {
  const connected = new Map();
  for (const players of rooms.values()) for (const person of players.values()) if (person.userId) connected.set(person.userId, person);
  if (!connected.size) return;
  let statuses;
  // A failed sweep leaves everyone exactly as they were and the next one corrects it.
  try { statuses = await moderation.statuses([...connected.keys()]); } catch { return; }
  for (const [userId, person] of connected) {
    const status = statuses.get(userId);
    person.muted = !!status?.muted;
    if (!status?.banned) continue;
    send(person.ws, { type: 'error', code: 'BANNED', message: penaltyNotice(status) });
    person.ws.close(4003, 'Banned');
  }
}, 15000).unref();
const shop = createShop((userId, accessories) => { for (const players of rooms.values()) { for (const player of players.values()) if (player.userId === userId) player.accessories = accessories; broadcast(players, { type: 'players', players: snapshot(players) }); } });
const accounts=createAccounts({onDeleted:userId=>accountConnections.get(userId)?.ws.close(4001,'Account deleted')});
const wall=createWall({onPost:post=>{for(const players of rooms.values())broadcast(players,{type:'wall-new',post});}});
const palette = ['#dafa8e', '#f4a06c', '#72c8ba', '#e4bd66', '#d58ca0', '#9cace0'];
const authUrl = process.env.SUPABASE_URL;
const authKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if ((!authUrl || !authKey) && process.env.ALLOW_GUESTS !== 'true') throw new Error('Supabase configuration is required. ALLOW_GUESTS=true is for local development only.');

async function identify(token, guest = false, guestName) {
  if (guest === true && !token) {
    if (process.env.ALLOW_GUESTS !== 'true') throw new Error('Guest access is disabled.');
    if (typeof guestName !== 'string') throw new Error('Enter a guest name.');
    const name = guestName.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0,18);
    if (name.length < 2 || filterChat(name) === '***') throw new Error('Choose another guest name.');
    return { name, guest: true, gameMaster: false, accessories: [], expiresAt: Date.now() + 86400000 };
  }
  if (!authUrl || !authKey) return { name: 'Local guest', expiresAt: Date.now() + 3600000 };
  if (typeof token !== 'string' || token.length > 3500) throw new Error('Log in to join the city.');
  const result = await fetch(`${authUrl}/auth/v1/user`, { headers: { apikey: authKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!result.ok) throw new Error('Your session expired. Please log in again.');
  const user = await result.json();
  if (!user.id || user.is_anonymous) throw new Error('Register to join the city.');
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) throw new Error('Your session expired.');
  return { profile: cleanProfile(user.user_metadata?.profile), userId: user.id, gameMaster: isGameMaster(user), accessories: await shop.accessories(user.id), appearance: cleanAppearance(user.user_metadata?.appearance), name: String(user.user_metadata?.display_name || 'Player').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 18) || 'Player', expiresAt: claims.exp * 1000 };
}

// Standing announcements live here, keyed by room name: roomFor() returns a fresh object
// each call, so a banner stored on that object would vanish the moment it went out of scope.
const announcements = new Map();

function roomFor(name) {
  const roomName = String(name || 'kampung').slice(0, 24) || 'kampung';
  if (!rooms.has(roomName)) rooms.set(roomName, new Map());
  return { name: roomName, players: rooms.get(roomName) };
}

function finiteNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function followDriver(passenger, driver) {
  const [x, z] = vehicleSeats[driver.vehicle][passenger.seatIndex || 0];
  passenger.x = driver.x + Math.cos(driver.yaw) * x + Math.sin(driver.yaw) * z; passenger.z = driver.z - Math.sin(driver.yaw) * x + Math.cos(driver.yaw) * z;
  passenger.yaw = driver.yaw; passenger.speed = driver.speed; passenger.riding = true; passenger.vehicle = driver.vehicle; passenger.seated = false; passenger.jumpHeight = 0;
}
function releasePassenger(passenger, reset = false) {
  passenger.passengerOf = null; passenger.seatIndex = null; passenger.riding = false; passenger.speed = 0;
  passenger.x = reset ? -18 : Math.max(-151, Math.min(151, passenger.x + Math.cos(passenger.yaw) * 2.4));
  passenger.z = reset ? 52 : Math.max(-151, Math.min(151, passenger.z - Math.sin(passenger.yaw) * 2.4));
}
function snapshot(players) {
  return [...players.values()].map(({ ws: _ws, userId: _userId, chairStand: _chairStand, profile: _profile, muted: _muted, ...player }) => player);
}

function send(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify(message));
}

// Railway's edge strips permessage-deflate, so a compressed snapshot has to travel as an
// ordinary binary frame the proxy has no opinion about. The room snapshot repeats every
// player's name, appearance and accessories 20 times a second and gives back about 96%.
// Built at most once per broadcast, and only for clients that told us they can inflate.
const PACK_THRESHOLD = 1024;
// Opus costs about a tenth of the raw PCM this used to relay, but the server cannot
// transcode, so the room drops to PCM if a single player cannot decode it. One old browser
// therefore costs everyone the saving.
// ponytail: room-wide codec, encode both formats on the speaker if mixed rooms turn out common
function voiceCodecFor(players) {
  for (const player of players.values()) if (!player.opus) return 'pcm';
  return 'opus';
}
function syncVoiceCodec(players) {
  if (players.size) broadcast(players, { type: 'voice-codec', codec: voiceCodecFor(players) });
}
function broadcast(players, message) {
  if (message.type === 'players') tableSocial.sync(players);
  const payload = JSON.stringify(message);
  let packed;
  for (const player of players.values()) {
    if (player.ws.readyState !== 1) continue;
    if(message.type==='fleet'&&player.ws.bufferedAmount>=65536){metrics.countDrop();continue;}
    if (message.type === 'players' && player.ws.bufferedAmount >= 65536) { metrics.countDrop(); dirtyRooms.add(players); continue; }
    if (player.deflate && payload.length >= PACK_THRESHOLD) {
      packed ||= zlib.deflateSync(payload, { level: 1 });
      player.ws.send(packed);
    } else player.ws.send(payload);
  }
}

const weather=createWeather();
const fleet=createFleet(send,broadcast);
const lrt=createLrt(send);
setInterval(()=>{for(const players of rooms.values()){tableLobby.tick(players);lrt.sync(players);if([...players.values()].some(p=>p.lrtId!=null))dirtyRooms.add(players);}},50).unref();
setInterval(()=>{for(const players of rooms.values())fleet.tick(players,.1);},100).unref();
const weatherControls=createWeatherControls(send,broadcast);
const lamps=createLamps(send,broadcast);
const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if(request.url==='/weather' && request.method==='GET'){
    const report=await weather();
    response.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'});
    response.end(JSON.stringify({...report,serverTime:Date.now()}));return;
  }
  response.setHeader('Cache-Control', 'no-store');
  if (await shop.handle(request, response)) return;
  if (await socialProfiles.handle(request,response)) return;
  if (await wall.handle(request,response)) return;
  if (await accounts.handle(request,response)) return;
  if (await leaderboard.handle(request,response)) return;
  if (request.url === '/health' || request.url === '/') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(metrics.report({ rooms, sockets: webSocketServer.clients.size, version })));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });
// The total is the real protection and holds whatever the headers claim. The per-address
// share must stay clear of a legitimately full city: every player shares one key when the
// proxy stops forwarding addresses, and they already do on localhost, so anything near
// maxPlayers locks the city instead of an attacker — and it would refuse them at the
// socket, losing the reason the city turned them away. Room capacity is what should stop
// the hundred-and-first player, not this. Env-tunable because the proxy's shape is a
// deployment fact the code cannot see from here.
const connections = createConnectionCap({
  perKey: Number(process.env.WS_MAX_PER_ADDRESS || maxPlayers * 2),
  total: Number(process.env.WS_MAX_CONNECTIONS || maxPlayers * 10),
});
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  const release = connections.take(clientKey(request));
  if (!release) { socket.destroy(); return; }
  // The socket outlives a failed upgrade as well as a closed session, so releasing on
  // its close covers both without double-counting; release() is idempotent.
  socket.once('close', release);
  webSocketServer.handleUpgrade(request, socket, head, ws => webSocketServer.emit('connection', ws, request));
});

webSocketServer.on('connection', ws => {
  // Every byte this process sends leaves through ws.send, so it gets counted once, here,
  // rather than at each of the three places that call it.
  const sendFrame = ws.send.bind(ws);
  ws.send = (data, ...rest) => { metrics.countOut(typeof data === 'string' ? Buffer.byteLength(data) : data.length, ws.roomName); sendFrame(data, ...rest); };
  // Registered before the handler below so bytes count even for messages that get dropped.
  ws.on('message', raw => metrics.countIn(raw.length));
  let currentRoom = null;
  let player = null;
  let lastStateAt = 0;
  let lastRecallAt = 0;
  let lastPunchAt = 0;
  let lastHornAt = 0;
  let joining = false;
  let lastChatAt = 0, lastProfileAt = 0, lastProfileViewAt = 0, lastReportAt = 0;
  const reported = new Set();
  let expiresAt = 0;
  let voiceTokens = 30, voiceAt = Date.now(), lastAudienceAt = 0;
  const joinTimeout = setTimeout(() => { if (!player) ws.close(1008, 'Join timeout'); }, 15000);

  function removePlayer() {
    clearTimeout(joinTimeout);
    if (!player || !currentRoom) return;
    fleet.release(currentRoom.players,player);
    if (accountConnections.get(player.userId)?.ws === ws) accountConnections.delete(player.userId);
    for (const passenger of currentRoom.players.values()) if (passenger.passengerOf === player.id) releasePassenger(passenger);
    tableLobby.remove(currentRoom.players, player);
    party.remove(currentRoom.players, player);
    currentRoom.players.delete(player.id);
    ws.roomName = null;
    broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) });
    syncVoiceCodec(currentRoom.players);
    if (!currentRoom.players.size) { rooms.delete(currentRoom.name); announcements.delete(currentRoom.name); }
    player = null; currentRoom = null;
  }

  ws.on('message', async raw => {
    if (ws.readyState !== 1) return;
    if (raw.length > 4096) return;
    let message;
    try { message = JSON.parse(raw.toString()); } catch { send(ws, { type: 'error', message: 'Send JSON messages only.' }); return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'join') {
      if (player || joining) return;
      joining = true;
      let identity;
      try { identity = await identify(message.accessToken, message.guest, message.name); }
      catch { send(ws, { type: 'error', code: 'AUTH_REQUIRED', message: message.guest ? 'Choose a different guest name and try again.' : 'Please log in again to join the city.' }); ws.close(1008, 'Authentication required'); return; }
      if (ws.readyState !== 1) return;
      expiresAt = identity.expiresAt;
      clearTimeout(joinTimeout);
      // Fails open deliberately: a Supabase blip must not lock the whole city out. The
      // sweep re-checks everyone inside every 15 seconds, so an outage widens the gap only
      // for as long as it lasts and then closes it without anyone doing anything.
      let penalty = { banned: false, muted: false, until: null, reason: '' };
      try { penalty = await moderation.status(identity.userId); } catch { /* the sweep catches up */ }
      if (penalty.banned) { send(ws, { type: 'error', code: 'BANNED', message: penaltyNotice(penalty) }); ws.close(4003, 'Banned'); return; }
      if (ws.readyState !== 1) return;
      let room = roomFor(message.room);
      const previous = identity.userId ? accountConnections.get(identity.userId) : null;
      const replacingInRoom = previous?.room.name === room.name ? 1 : 0;
      if (room.players.size - replacingInRoom >= maxPlayers) { send(ws, { type: 'error', code: 'ROOM_FULL', message: 'This room is full. Try again in a moment.' }); ws.close(1008, 'Room full'); return; }
      if (previous) {
        send(previous.ws, { type: 'error', code: 'SESSION_REPLACED', message: 'Your account joined from another tab or device. This session has ended.' });
        previous.ws.close(4002, 'Session replaced');
        previous.remove();
        room = roomFor(message.room);
      }
      let recentChat = [];
      try { recentChat = await chatHistory.recent(room.name); }
      catch { /* Joining remains available if chat storage is temporarily unavailable. */ }
      const id = crypto.randomUUID();
      const number = room.players.size;
      player = {
        id,
        ws,
        name: identity.name, guest: !!identity.guest, gameMaster: !!identity.gameMaster, userId: identity.userId, accessories: identity.accessories || [],
        muted: penalty.muted,
        appearance: cleanAppearance(identity.appearance), profile: identity.profile || null,
        color: palette[number % palette.length],
        x: -18,
        z: 52,
        yaw: Math.PI,
        riding: false, vehicle: 'bike', passengerOf: null, seatIndex: null,
        speed: 0,
        jumpHeight: 0, seated: false, chairId: null,
        mic: false, speaker: false,
        deflate: message.deflate === true,
        opus: message.opus === true,
        supermanUntil: 0,
        updatedAt: Date.now(),
      };
      const resume=message.resume;
      if(resume && [resume.x,resume.z,resume.yaw].every(Number.isFinite) && Math.abs(resume.x)<=151 && Math.abs(resume.z)<=151){
        player.x=resume.x;player.z=resume.z;player.yaw=finiteNumber(resume.yaw,Math.PI,-Math.PI*4,Math.PI*4);
      }
      const invitedTable = tableLocations.find(t => t.id === message.tableId);
      if (invitedTable) { player.x = invitedTable.arrivalX; player.z = invitedTable.arrivalZ; }
      // The capacity check above runs before `await chatHistory.recent`, so a crowd that
      // arrives together all clear it against the same count and the room overshoots. This
      // is the check that decides: from here to players.set nothing awaits, so nothing can
      // be admitted in between. The same window let one account join twice, so the seat it
      // already holds is given up here rather than left running beside the new one.
      const settled = identity.userId ? accountConnections.get(identity.userId) : null;
      if (settled) {
        send(settled.ws, { type: 'error', code: 'SESSION_REPLACED', message: 'Your account joined from another tab or device. This session has ended.' });
        settled.ws.close(4002, 'Session replaced');
        settled.remove();
        room = roomFor(message.room);
      }
      if (room.players.size >= maxPlayers) { send(ws, { type: 'error', code: 'ROOM_FULL', message: 'This room is full. Try again in a moment.' }); ws.close(1008, 'Room full'); return; }
      currentRoom = room;
      ws.roomName = room.name;
      room.players.set(id, player);
      socialProfiles.event(player,'sessions',1,true);
      if (identity.userId) accountConnections.set(identity.userId, { ws, room, remove: removePlayer });
      // The version travels with the welcome so a page left open across a deploy finds out
      // it is stale without polling anything.
      send(ws, { type: 'welcome', id, room: room.name, version, players: snapshot(room.players) });
      weatherControls.sync(room.players,ws);
      lamps.sync(room.players,ws);
      fleet.sync(room.players,ws);
      send(ws,{type:'lrt-clock',serverTime:Date.now()});
      send(ws, { type: 'chat-history', messages: recentChat });
      tableSocial.sync(room.players, true);
    const standing = announcements.get(room.name);
    if (standing) send(ws, standing);
      broadcast(room.players, { type: 'players', players: snapshot(room.players) });
      syncVoiceCodec(room.players);
      return;
    }

    if (!player || !currentRoom) { send(ws, { type: 'error', message: 'Join a room first.' }); return; }
    if (message.type === 'leave-city') {
      uno.handle(currentRoom.players, player, {type:'uno-leave'});
      werewolf.handle(currentRoom.players, player, {type:'werewolf-leave'});
      removePlayer(); ws.close(1000, 'Left city'); return;
    }
    if (message.type === 'leave-game-seat') {
      uno.handle(currentRoom.players, player, {type:'uno-leave'});
      werewolf.handle(currentRoom.players, player, {type:'werewolf-leave'});
      tableLobby.remove(currentRoom.players, player);
      const stand=player.chairStand;
      if(stand){player.x=stand.x;player.z=stand.z;}
      player.chairId=null;player.seated=false;delete player.chairStand;
      broadcast(currentRoom.players,{type:'players',players:snapshot(currentRoom.players)});
      return;
    }
    if (Date.now() >= expiresAt) { ws.close(4001, 'Session expired'); return; }
    if (player.muted && MUTED.has(message.type)) { send(ws, { type: 'notice', message: 'You are muted, so this did not go out. You can still walk around the city.' }); return; }
    if (message.type === 'report') {
      const now = Date.now();
      if (now - lastReportAt < 60000) { send(ws, { type: 'notice', message: 'You just filed a report. Give it a minute.' }); return; }
      const target = currentRoom.players.get(message.id);
      if (!target || target.id === player.id) { send(ws, { type: 'notice', message: 'That player is no longer in the city.' }); return; }
      if (reported.has(target.id)) { send(ws, { type: 'notice', message: 'You have already reported this player. It is with the moderators.' }); return; }
      const surface = SURFACES.has(message.surface) ? message.surface : 'behaviour';
      const reason = REASONS.has(message.reason) ? message.reason : 'other';
      // Deliberately not run through filterChat: this note is read by a moderator, never
      // broadcast, and 'he called me a babi' censored down to *** destroys the evidence.
      const note = typeof message.note === 'string' ? message.note.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) : '';
      // Nobody records the room's audio, so what makes a voice report reviewable is who
      // else was close enough to have heard it. Names only, and only those in earshot.
      const witnesses = [...currentRoom.players.values()]
        .filter(other => other.id !== player.id && other.id !== target.id && Math.hypot(other.x - target.x, other.z - target.z) < voiceConfig.hearingRadius)
        .slice(0, 10).map(other => other.name);
      try {
        await moderation.report({
          reporterUserId: player.userId, reporterName: player.name,
          reportedUserId: target.userId, reportedName: target.name,
          room: currentRoom.name, surface, reason, note, witnesses,
        });
      } catch { send(ws, { type: 'notice', message: 'Could not file that report. Please try again in a moment.' }); return; }
      // Only a report that actually landed spends the cooldown.
      lastReportAt = now; reported.add(target.id);
      send(ws, { type: 'notice', message: 'Report sent. A moderator will look at it.' });
      return;
    }
    if(lrt.handle(currentRoom.players,player,message)){dirtyRooms.add(currentRoom.players);return;}
    if(fleet.handle(currentRoom.players,player,message))return;
    if(lamps.handle(currentRoom.players,player,message))return;
    if (message.type === 'profile-view') {
      if (Date.now() - lastProfileViewAt < 250) return;
      lastProfileViewAt = Date.now();
      const target = currentRoom.players.get(message.id);
      send(ws, { type: 'profile', profile: target?.userId ? await socialProfiles.profile(target.userId,publicProfile(target)) : target ? publicProfile(target) : null, id: message.id }); return;
    }
    if (message.type === 'profile-refresh') {
      if (!player.userId || player.guest || Date.now() - lastProfileAt < 1500) return;
      lastProfileAt = Date.now(); const requestingPlayer = player;
      try {
        const identity = await identify(message.accessToken);
        if (player !== requestingPlayer || identity.userId !== player.userId) return;
        player.profile = identity.profile; player.name = identity.name;
        broadcast(currentRoom.players, { type: 'profile', profile: publicProfile(player), id: player.id });
        broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) });
      } catch { send(ws, { type: 'notice', message: 'Profile saved to your account. Rejoin to refresh its public card.' }); }
      return;
    }
    if (uno.handle(currentRoom.players, player, message)) return;
    if (werewolf.handle(currentRoom.players, player, message)) return;
    if (lukis.handle(currentRoom.players, player, message)) return;
    if (poker.handle(currentRoom.players, player, message)) return;
    if (pickleball.handle(currentRoom.players, player, message)) return;
    if (basketball.handle(currentRoom.players, player, message)) return;
    if (tableLobby.handle(currentRoom.players, player, message)) return;
    const partied = party.handle(currentRoom.players, player, message);
    // Only a real membership change is worth a room-wide snapshot; an unknown party-* verb
    // must not be a cheap way to make the server fan out to everyone.
    if (partied) { if (partied === 'changed') broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return; }
    if (tableSocial.handle(currentRoom.players, player, message)) return;
    if(message.type==='teleport'){
      const destination=teleportPlayer(player,message);
      if(!destination){send(ws,{type:'teleport-denied',message:'Leave your vehicle first, or wait a moment before teleporting again.'});return;}
      send(ws,{type:'teleported',id:destination.id});
      broadcast(currentRoom.players,{type:'players',players:snapshot(currentRoom.players)});return;
    }
    if (message.type === 'passenger-join') {
      if((player.danceUntil||0)>Date.now())return;
      const driver = currentRoom.players.get(message.driverId);
      if(driver?.lrtId!=null)return;
      const occupied = [...currentRoom.players.values()].filter(p => p.passengerOf === message.driverId);
      const seatIndex = driver ? vehicleSeats[driver.vehicle].findIndex((_, i) => !occupied.some(p => p.seatIndex === i)) : -1;
      if (player.riding || player.seated || player.jumpHeight > 0 || !driver || driver === player || driver.passengerOf || Number(driver.supermanUntil) > Date.now() || !driver.riding || Math.abs(driver.speed) >= 1.5 || Math.hypot(driver.x - player.x, driver.z - player.z) > 3.8 || seatIndex < 0) {
        send(ws, { type: 'notice', message: 'The vehicle must be nearby, stopped, and have a free passenger seat.' }); return;
      }
      player.passengerOf = driver.id; player.seatIndex = seatIndex; followDriver(player, driver);
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return;
    }
    if (message.type === 'passenger-leave') {
      if (!player.passengerOf) return;
      if (Math.abs(player.speed) >= 1.5 && !message.reset) { send(ws, { type: 'notice', message: 'Wait for the driver to stop before getting off.' }); return; }
      releasePassenger(player, message.reset === true);
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return;
    }
    if (message.type === 'chair-sit') {
      if((player.danceUntil||0)>Date.now())return;
      const chair = chairs.find(c => c.id === message.chairId);
      const occupied = [...currentRoom.players.values()].some(p => p.chairId === message.chairId);
      if (!chair || occupied || player.riding || player.seated || player.jumpHeight > 0 || Math.hypot(player.x - chair.x, player.z - chair.z) > 2.2) {
        send(ws, { type: 'notice', message: occupied ? 'This chair is occupied.' : 'Move closer to an available chair.' }); return;
      }
      player.chairStand = { x: player.x, z: player.z };
      player.chairId = chair.id; player.seated = true;
      player.x = chair.x; player.z = chair.z; player.yaw = chair.yaw; player.speed = 0; player.jumpHeight = 0;
      socialProfiles.event(player,'tables_sat');
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return;
    }
    if (message.type === 'chair-stand') {
      if (!player.chairId) return;
      const stand = message.reset === true ? { x: -18, z: 52 } : player.chairStand;
      if (stand) { player.x = stand.x; player.z = stand.z; }
      player.chairId = null; player.seated = false; delete player.chairStand;
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return;
    }
    if (message.type === 'geng') {
      if (typeof message.text !== 'string') return;
      // Filtered like any other text a stranger has to read above someone's head.
      player.geng = filterChat(message.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 18));
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return;
    }
    if (message.type === 'afk-note') {
      if (typeof message.text !== 'string') return;
      player.afkNote = filterChat(message.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60));
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return;
    }
    if (message.type === 'outfit') {
      player.appearance = cleanAppearance({ ...player.appearance, shirt: message.shirt, trousers: message.trousers });
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return;
    }
    if (message.type === 'ping') { send(ws, { type: 'pong', t: message.t }); return; }
    if (message.type === 'voice-state') {
      player.mic = message.mic === true; player.speaker = message.speaker === true;
      player.micScope = message.micScope === 'party' ? 'party' : 'all';
      player.speakerScope = message.speakerScope === 'party' ? 'party' : 'all';
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) });
      return;
    }
    if (message.type === 'voice-audio') {
      // A dead villager who keeps talking hands the game away, and no filter can read
      // speech. Their microphone is closed for the rest of the match, and they are told.
      if (werewolf.silenced(currentRoom.players, player)) {
        if (!player.voiceNoticeAt || Date.now() - player.voiceNoticeAt > 15000) {
          player.voiceNoticeAt = Date.now();
          send(ws, {type: 'notice', message: 'Anda sudah mati. Mic ditutup sampai habis permainan.'});
        }
        return;
      }
      const now = Date.now(); voiceTokens = Math.min(30, voiceTokens + (now - voiceAt) * .025); voiceAt = now;
      const opus = message.codec === 'opus';
      const wellFormed = typeof message.audio === 'string' && (opus
        ? message.audio.length > 0 && message.audio.length <= 512 && /^[A-Za-z0-9+/]+={0,2}$/.test(message.audio)
        : message.audio.length === 1708 && /^[A-Za-z0-9+/]{1707}=$/.test(message.audio));
      if (!player.mic || voiceTokens < 1 || !wellFormed) return;
      voiceTokens--;
      metrics.countVoiceIn();
      const audience = [];
      for (const listener of currentRoom.players.values()) {
        const distance = Math.hypot(listener.x - player.x, listener.z - player.z);
        if (listener.id === player.id || !listener.speaker || listener.ws.readyState !== 1) continue;
        // Both ends have to agree: a party-scoped mouth only reaches the party, and a
        // party-scoped ear only opens for it. Party audio ignores distance entirely.
        const together = party.shares(player, listener);
        if (player.micScope === 'party' ? !together : distance >= voiceConfig.hearingRadius) continue;
        if (listener.speakerScope === 'party' && !together) continue;
        // Counted as a drop only down here, where this listener was going to hear it. Out of
        // earshot and backed up is not a drop, and counting it would page for silence.
        if (listener.ws.bufferedAmount >= 65536) { metrics.countDrop(); continue; }
        const volume = player.micScope === 'party' || distance <= voiceConfig.fullVolumeRadius ? 1 : (voiceConfig.hearingRadius - distance) / (voiceConfig.hearingRadius - voiceConfig.fullVolumeRadius);
        listener.ws.send(JSON.stringify({ type: 'voice-audio', id: player.id, name: player.name, audio: message.audio, volume, codec: opus ? 'opus' : 'pcm' }));
        audience.push(listener.name);
      }
      metrics.countVoiceOut(audience.length);
      if (now - lastAudienceAt >= 750) { lastAudienceAt = now; send(ws, { type: 'voice-audience', count: audience.length, names: audience.slice(0, 3) }); }
      return;
    }
    if (message.type === 'chat') {
      if (typeof message.text !== 'string') return;
      const text = message.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
      if (!text) return;
      if (Date.now() - lastChatAt < 700) { send(ws, { type: 'notice', message: 'Give your last message a moment before sending another.' }); return; }
      lastChatAt = Date.now();
      const announcement = gmAnnouncement(player, text);
      if (announcement) {
        if (!announcement.allowed) { send(ws, { type: 'notice', message: 'Only the Game Master can announce to the city.' }); return; }
        if (announcement.clear) {
          announcements.delete(currentRoom.name);
          broadcast(currentRoom.players, { type: 'gm-announce', text: '' });
          return;
        }
        const clean = filterChat(announcement.text), at = new Date().toISOString();
        // Kept on the room so it is still there for whoever walks in afterwards.
        const banner = { type: 'gm-announce', text: clean, name: player.name, sentAt: at };
        announcements.set(currentRoom.name, banner);
        broadcast(currentRoom.players, banner);
        // The crawl scrolls away, so the same line is kept in city chat.
        try { await chatHistory.save(currentRoom.name, player, clean, at); } catch { /* The crawl still went out. */ }
        broadcast(currentRoom.players, { type: 'chat', id: player.id, name: player.name, area: districtFor(player.z), text: clean, sentAt: at, gameMaster: true, channel: 'all' });
        return;
      }
      const filtered = filterChat(text), sentAt = new Date().toISOString();
      const channel = ['party', 'dm', 'table'].includes(message.channel) ? message.channel : 'all';

      // Werewolf partitions its chat by role and Lukis hides correct guesses, and both were
      // being walked straight around: two wolves in a party during the night, a dead player
      // DMing the roles they learned, the drawer DMing the word. One gate here rather than
      // three in the games, and server-side only — the client may grey the tabs out as a
      // courtesy, but the client is not the one being trusted.
      if ((channel === 'party' || channel === 'dm') && (werewolf.live(currentRoom.players, player) || lukis.live(currentRoom.players, player))) {
        send(ws, {type: 'notice', message: 'Party dan DM ditutup masa main. Guna chat meja.'});
        return;
      }
      // Where they were standing when they said it, stamped once per message rather than
      // streamed per frame.
      const payload = { type: 'chat', id: player.id, name: player.name, area: districtFor(player.z), text: filtered, sentAt, gameMaster: !!player.gameMaster, channel };

      if (channel === 'party') {
        const members = party.members(currentRoom.players, player);
        if (!members.length) { send(ws, { type: 'notice', message: 'You are not in a party yet.' }); return; }
        for (const member of members) send(member.ws, payload);
        return;
      }
      if (channel === 'table') {
        // Only the people on the chairs around this table, and never written to history:
        // the public channel is the only one the room keeps.
        const tableId = tableOf(player);
        if (!tableId) { send(ws, {type: 'notice', message: 'Duduk di meja dahulu untuk chat meja.'}); return; }
        for (const seated of seatedWith(currentRoom.players, tableId)) send(seated.ws, {...payload, tableId});
        return;
      }
      if (channel === 'dm') {
        const target = typeof message.to === 'string' ? currentRoom.players.get(message.to) : undefined;
        if (!target || target.id === player.id) { send(ws, { type: 'notice', message: 'That player is no longer in the city.' }); return; }
        const thread = { ...payload, to: target.id, toName: target.name };
        send(target.ws, thread); send(ws, thread);
        return;
      }

      // Only the public channel belongs in the room's saved history.
      try { await chatHistory.save(currentRoom.name, player, filtered, sentAt); }
      catch { send(ws, { type: 'notice', message: 'Message sent live, but chat history could not save it.' }); }
      if (!player || !currentRoom || ws.readyState !== 1) return;
      broadcast(currentRoom.players, payload);
      return;
    }
    if (message.type === 'state') {
      const now = Date.now();
      if (now - lastStateAt < 35) return;
      lastStateAt = now;
      if (player.passengerOf || player.chairId || (player.danceUntil||0)>Date.now()) return;
      if(player.fleetId&&message.fleetId!==player.fleetId)return;
      player.x = finiteNumber(message.x, player.x, -153, 153);
      player.z = finiteNumber(message.z, player.z, -153, 153);
      player.y = finiteNumber(message.y, 0, 0, 6);
      player.yaw = finiteNumber(message.yaw, player.yaw, -Math.PI * 4, Math.PI * 4);
      player.speed = finiteNumber(message.speed, 0, -5, 24);
      player.riding = Boolean(message.riding);
      player.vehicle = message.vehicle === 'car' ? 'car' : 'bike';
      fleet.updatePlayer(currentRoom.players,player);
      if(!player.fleetId)player.carStyle='myvi';
      if (!player.riding || player.vehicle !== 'bike') player.supermanUntil = 0;
      player.seated = false; // Only chair-sit can claim a seat.
      player.jumpHeight = player.riding || player.seated ? 0 : finiteNumber(message.jumpHeight, 0, 0, 1.3);
      player.updatedAt = now;
      for (const passenger of currentRoom.players.values()) if (passenger.passengerOf === player.id) {
        if (player.riding && player.vehicle === passenger.vehicle) followDriver(passenger, player); else releasePassenger(passenger);
      }
      dirtyRooms.add(currentRoom.players);
      return;
    }
    if (message.type === 'horn') {
      const now = Date.now();
      if (!player.riding || player.passengerOf || now - lastHornAt < 400) return;
      lastHornAt = now;
      for (const listener of currentRoom.players.values()) {
        if (Math.hypot(listener.x - player.x, listener.z - player.z) < 35) send(listener.ws, { type: 'horn', id: player.id, vehicle: player.vehicle });
      }
      return;
    }
    if (message.type === 'superman-cancel') {
      if (player.supermanUntil) { player.supermanUntil = 0; dirtyRooms.add(currentRoom.players); } return;
    }
    if (message.type === 'superman') {
      const now = Date.now();
      if (!player.riding || player.passengerOf || player.vehicle !== 'bike' || player.seated || Number(player.supermanUntil) > now) return;
      player.supermanUntil = now + 6000; dirtyRooms.add(currentRoom.players); return;
    }
    if(message.type==='dance-cancel'){
      if(player.danceUntil){player.danceUntil=0;dirtyRooms.add(currentRoom.players);}return;
    }
    if(message.type==='dance'){
      const now=Date.now();if(player.riding||player.seated||player.passengerOf||player.jumpHeight>0||(player.danceUntil||0)>now)return;
      player.danceUntil=now+10000;player.speed=0;socialProfiles.event(player,'dances');dirtyRooms.add(currentRoom.players);return;
    }
    if (message.type === 'punch') {
      if((player.danceUntil||0)>Date.now())return;
      const now = Date.now();
      if (player.riding || player.seated || now - lastPunchAt < 350) return;
      lastPunchAt = now;
      socialProfiles.event(player,'punches');
      broadcast(currentRoom.players, { type: 'punch', id: player.id }); return;
    }
    if (message.type === 'recall') {
      if((player.danceUntil||0)>Date.now())return;
      const now = Date.now();
      if (player.riding || player.passengerOf || now - lastRecallAt < 90) return;
      lastRecallAt = now;
      socialProfiles.event(player,'recalls');
      broadcast(currentRoom.players, { type: 'recall', id: player.id });
      return;
    }
    if(weatherControls.handle(currentRoom.players,player,message))return;
    if (message.type === 'ping') send(ws, { type: 'pong', now: Date.now() });
  });

  ws.on('close', removePlayer);
});

server.listen(port, '0.0.0.0', () => console.log(`LepakMamak realtime server listening on ${port}`));
