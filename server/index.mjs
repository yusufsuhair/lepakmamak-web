import {createWeather} from './weather.mjs';
import {teleportPlayer} from './teleport.mjs';
import {createWeatherControls} from './weather-controls.mjs';
import { createUno } from './uno.mjs';
import { createWerewolf } from './werewolf.mjs';
import { createLukis } from './lukis.mjs';
import { createPoker } from './poker.mjs';
import { createPickleball } from './pickleball.mjs';
import { createBasketball } from './basketball.mjs';
import {createSocialProfiles} from './social-profiles.mjs';
import {createStalls} from './stalls.mjs';
const handleStall=createStalls(send);
import { createChatHistory } from './chat-history.mjs';
import { cleanProfile, publicProfile } from './profiles.mjs';
import { createTableSocial } from './tables.mjs';
import tableLocations from '../shared/tables.json' with { type: 'json' };
import chairs from '../shared/chairs.json' with { type: 'json' };
import http from 'node:http';
import { isGameMaster } from './roles.mjs';
import { filterChat } from './chat-filter.mjs';
import { createShop } from './shop.mjs';
import {createWall} from './wall.mjs';
import voiceConfig from '../shared/voice.json' with { type: 'json' };
import vehicleSeats from '../shared/vehicle-seats.json' with { type: 'json' };
import packageInfo from '../package.json' with { type: 'json' };
const { version } = packageInfo;
import appearanceOptions from '../shared/appearance.json' with { type: 'json' };
const defaults = { gender: 'male', hairstyle: 'short', hair: '#202c2b', skin: '#b98157', shirt: '#ef734c', trousers: '#c7be9c' };
function cleanAppearance(value) { return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, Object.values(appearanceOptions[key]).includes(value?.[key]) ? value[key] : fallback])); }
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 8080);
const maxPlayers = 24;
const rooms = new Map();
const dirtyRooms = new Set();
// Coalesce movement from all players into at most one snapshot per room per tick.
setInterval(() => {
  const pending = [...dirtyRooms]; dirtyRooms.clear();
  for (const players of pending) if (players.size) broadcast(players, { type: 'players', players: snapshot(players) });
}, 50).unref();
const accountConnections = new Map();
const tableSocial = createTableSocial(send);
const socialProfiles=createSocialProfiles({onUnlock:(player,badges)=>send(player.ws,{type:'achievement-unlocked',badges})});
const uno = createUno(send);
const werewolf = createWerewolf(send);
const lukis = createLukis(send);
const poker = createPoker(send);
const pickleball = createPickleball(send);
const basketball = createBasketball(send,Date.now,(player,points)=>socialProfiles.event(player,'basketball_points',points));
setInterval(()=>{for(const ps of rooms.values())basketball.tick(ps);},50).unref();
setInterval(()=>{for(const ps of rooms.values())pickleball.tick(ps);},50).unref();
setInterval(()=>{for(const ps of rooms.values())poker.tick(ps);},500).unref();
setInterval(()=>{for(const ps of rooms.values()){lukis.tick(ps);werewolf.tick(ps);uno.tick(ps);}},500).unref();
const chatHistory = createChatHistory();
const shop = createShop((userId, accessories) => { for (const players of rooms.values()) { for (const player of players.values()) if (player.userId === userId) player.accessories = accessories; broadcast(players, { type: 'players', players: snapshot(players) }); } });
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
  return [...players.values()].map(({ ws: _ws, userId: _userId, chairStand: _chairStand, profile: _profile, ...player }) => player);
}

function send(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify(message));
}

function broadcast(players, message) {
  if (message.type === 'players') tableSocial.sync(players);
  const payload = JSON.stringify(message);
  for (const player of players.values()) {
    if (player.ws.readyState !== 1) continue;
    if (message.type === 'players' && player.ws.bufferedAmount >= 65536) { dirtyRooms.add(players); continue; }
    player.ws.send(payload);
  }
}

const weather=createWeather();
const weatherControls=createWeatherControls(send,broadcast);
const server = http.createServer(async (request, response) => {
  if(request.url==='/weather' && request.method==='GET'){
    const report=await weather();
    response.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'});
    response.end(JSON.stringify({...report,serverTime:Date.now()}));return;
  }
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  if (await shop.handle(request, response)) return;
  if (await socialProfiles.handle(request,response)) return;
  if (await wall.handle(request,response)) return;
  if (request.url === '/health' || request.url === '/') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, version, service: 'lepak-city-realtime', rooms: rooms.size, players: [...rooms.values()].reduce((total, players) => total + players.size, 0) }));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  webSocketServer.handleUpgrade(request, socket, head, ws => webSocketServer.emit('connection', ws, request));
});

webSocketServer.on('connection', ws => {
  let currentRoom = null;
  let player = null;
  let lastStateAt = 0;
  let lastRecallAt = 0;
  let lastPunchAt = 0;
  let lastHornAt = 0;
  let joining = false;
  let lastChatAt = 0, lastProfileAt = 0, lastProfileViewAt = 0;
  let expiresAt = 0;
  let voiceTokens = 30, voiceAt = Date.now(), lastAudienceAt = 0;
  const joinTimeout = setTimeout(() => { if (!player) ws.close(1008, 'Join timeout'); }, 15000);

  function removePlayer() {
    clearTimeout(joinTimeout);
    if (!player || !currentRoom) return;
    if (accountConnections.get(player.userId)?.ws === ws) accountConnections.delete(player.userId);
    for (const passenger of currentRoom.players.values()) if (passenger.passengerOf === player.id) releasePassenger(passenger);
    currentRoom.players.delete(player.id);
    broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) });
    if (!currentRoom.players.size) rooms.delete(currentRoom.name);
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
      let room = roomFor(message.room);
      const previous = identity.userId ? accountConnections.get(identity.userId) : null;
      const replacingInRoom = previous?.room.name === room.name ? 1 : 0;
      if (room.players.size - replacingInRoom >= maxPlayers) { send(ws, { type: 'error', message: 'This room is full. Try again in a moment.' }); ws.close(1008, 'Room full'); return; }
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
        appearance: cleanAppearance(identity.appearance), profile: identity.profile || null,
        color: palette[number % palette.length],
        x: -18,
        z: 52,
        yaw: Math.PI,
        riding: false, vehicle: 'bike', passengerOf: null, seatIndex: null,
        speed: 0,
        jumpHeight: 0, seated: false, chairId: null,
        mic: false, speaker: false,
        supermanUntil: 0,
        updatedAt: Date.now(),
      };
      const resume=message.resume;
      if(resume && [resume.x,resume.z,resume.yaw].every(Number.isFinite) && Math.abs(resume.x)<=151 && Math.abs(resume.z)<=151){
        player.x=resume.x;player.z=resume.z;player.yaw=finiteNumber(resume.yaw,Math.PI,-Math.PI*4,Math.PI*4);
      }
      const invitedTable = tableLocations.find(t => t.id === message.tableId);
      if (invitedTable) { player.x = invitedTable.arrivalX; player.z = invitedTable.arrivalZ; }
      currentRoom = room;
      room.players.set(id, player);
      socialProfiles.event(player,'sessions',1,true);
      if (identity.userId) accountConnections.set(identity.userId, { ws, room, remove: removePlayer });
      send(ws, { type: 'welcome', id, room: room.name, players: snapshot(room.players) });
      weatherControls.sync(room.players,ws);
      send(ws, { type: 'chat-history', messages: recentChat });
      tableSocial.sync(room.players, true);
      broadcast(room.players, { type: 'players', players: snapshot(room.players) });
      return;
    }

    if (!player || !currentRoom) { send(ws, { type: 'error', message: 'Join a room first.' }); return; }
    if (Date.now() >= expiresAt) { ws.close(4001, 'Session expired'); return; }
    if(handleStall(currentRoom.players,player,message)){dirtyRooms.add(currentRoom.players);return;}
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
        player.profile = identity.profile;
        broadcast(currentRoom.players, { type: 'profile', profile: publicProfile(player), id: player.id });
      } catch { send(ws, { type: 'notice', message: 'Profile saved to your account. Rejoin to refresh its public card.' }); }
      return;
    }
    if (uno.handle(currentRoom.players, player, message)) return;
    if (werewolf.handle(currentRoom.players, player, message)) return;
    if (lukis.handle(currentRoom.players, player, message)) return;
    if (poker.handle(currentRoom.players, player, message)) return;
    if (pickleball.handle(currentRoom.players, player, message)) return;
    if (basketball.handle(currentRoom.players, player, message)) return;
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
    if (message.type === 'afk-note') {
      if (typeof message.text !== 'string') return;
      player.afkNote = filterChat(message.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60));
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return;
    }
    if (message.type === 'outfit') {
      player.appearance = cleanAppearance({ ...player.appearance, shirt: message.shirt, trousers: message.trousers });
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) }); return;
    }
    if (message.type === 'voice-state') {
      player.mic = message.mic === true; player.speaker = message.speaker === true;
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) });
      return;
    }
    if (message.type === 'voice-audio') {
      const now = Date.now(); voiceTokens = Math.min(30, voiceTokens + (now - voiceAt) * .025); voiceAt = now;
      if (!player.mic || voiceTokens < 1 || typeof message.audio !== 'string' || message.audio.length !== 1708 || !/^[A-Za-z0-9+/]{1707}=$/.test(message.audio)) return;
      voiceTokens--;
      const audience = [];
      for (const listener of currentRoom.players.values()) {
        const distance = Math.hypot(listener.x - player.x, listener.z - player.z);
        if (listener.id === player.id || !listener.speaker || distance >= voiceConfig.hearingRadius || listener.ws.readyState !== 1 || listener.ws.bufferedAmount >= 65536) continue;
        const volume = distance <= voiceConfig.fullVolumeRadius ? 1 : (voiceConfig.hearingRadius - distance) / (voiceConfig.hearingRadius - voiceConfig.fullVolumeRadius);
        listener.ws.send(JSON.stringify({ type: 'voice-audio', id: player.id, name: player.name, audio: message.audio, volume }));
        audience.push(listener.name);
      }
      if (now - lastAudienceAt >= 750) { lastAudienceAt = now; send(ws, { type: 'voice-audience', count: audience.length, names: audience.slice(0, 3) }); }
      return;
    }
    if (message.type === 'chat') {
      if (typeof message.text !== 'string') return;
      const text = message.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
      if (!text) return;
      if (Date.now() - lastChatAt < 700) { send(ws, { type: 'notice', message: 'Give your last message a moment before sending another.' }); return; }
      lastChatAt = Date.now();
      const filtered = filterChat(text), sentAt = new Date().toISOString();
      try { await chatHistory.save(currentRoom.name, player, filtered, sentAt); }
      catch { send(ws, { type: 'notice', message: 'Message sent live, but chat history could not save it.' }); }
      if (!player || !currentRoom || ws.readyState !== 1) return;
      broadcast(currentRoom.players, { type: 'chat', id: player.id, name: player.name, text: filtered, sentAt, gameMaster: !!player.gameMaster });
      return;
    }
    if (message.type === 'state') {
      const now = Date.now();
      if (now - lastStateAt < 35) return;
      lastStateAt = now;
      if (player.passengerOf || player.chairId || (player.danceUntil||0)>Date.now()) return;
      player.x = finiteNumber(message.x, player.x, -153, 153);
      player.z = finiteNumber(message.z, player.z, -153, 153);
      player.yaw = finiteNumber(message.yaw, player.yaw, -Math.PI * 4, Math.PI * 4);
      player.speed = finiteNumber(message.speed, 0, -5, 24);
      player.riding = Boolean(message.riding);
      player.vehicle = message.vehicle === 'car' ? 'car' : 'bike';
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
