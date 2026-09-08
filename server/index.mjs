import http from 'node:http';
import { filterChat } from './chat-filter.mjs';
import { createShop } from './shop.mjs';
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
const accountConnections = new Map();
const shop = createShop((userId, accessories) => { for (const players of rooms.values()) { for (const player of players.values()) if (player.userId === userId) player.accessories = accessories; broadcast(players, { type: 'players', players: snapshot(players) }); } });
const palette = ['#dafa8e', '#f4a06c', '#72c8ba', '#e4bd66', '#d58ca0', '#9cace0'];
const authUrl = process.env.SUPABASE_URL;
const authKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if ((!authUrl || !authKey) && process.env.ALLOW_GUESTS !== 'true') throw new Error('Supabase configuration is required. ALLOW_GUESTS=true is for local development only.');

async function identify(token) {
  if (!authUrl || !authKey) return { name: 'Local guest', expiresAt: Date.now() + 3600000 };
  if (typeof token !== 'string' || token.length > 3500) throw new Error('Log in to join the city.');
  const result = await fetch(`${authUrl}/auth/v1/user`, { headers: { apikey: authKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!result.ok) throw new Error('Your session expired. Please log in again.');
  const user = await result.json();
  if (!user.id || user.is_anonymous) throw new Error('Register to join the city.');
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) throw new Error('Your session expired.');
  return { userId: user.id, accessories: await shop.accessories(user.id), appearance: cleanAppearance(user.user_metadata?.appearance), name: String(user.user_metadata?.display_name || 'Player').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 18) || 'Player', expiresAt: claims.exp * 1000 };
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
  return [...players.values()].map(({ ws: _ws, userId: _userId, ...player }) => player);
}

function send(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify(message));
}

function broadcast(players, message) {
  const payload = JSON.stringify(message);
  for (const player of players.values()) if (player.ws.readyState === 1) player.ws.send(payload);
}

const server = http.createServer(async (request, response) => {
  if (await shop.handle(request, response)) return;
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
  let lastChatAt = 0;
  let expiresAt = 0;
  let voiceTokens = 30, voiceAt = Date.now();
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
      try { identity = await identify(message.accessToken); }
      catch { send(ws, { type: 'error', code: 'AUTH_REQUIRED', message: 'Please log in again to join the city.' }); ws.close(1008, 'Authentication required'); return; }
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
      const id = crypto.randomUUID();
      const number = room.players.size;
      player = {
        id,
        ws,
        name: identity.name, userId: identity.userId, accessories: identity.accessories || [],
        appearance: cleanAppearance(identity.appearance),
        color: palette[number % palette.length],
        x: -18,
        z: 52,
        yaw: Math.PI,
        riding: false, vehicle: 'bike', passengerOf: null, seatIndex: null,
        speed: 0,
        jumpHeight: 0, seated: false,
        mic: false, speaker: false,
        updatedAt: Date.now(),
      };
      currentRoom = room;
      room.players.set(id, player);
      if (identity.userId) accountConnections.set(identity.userId, { ws, room, remove: removePlayer });
      send(ws, { type: 'welcome', id, room: room.name, players: snapshot(room.players) });
      broadcast(room.players, { type: 'players', players: snapshot(room.players) });
      return;
    }

    if (!player || !currentRoom) { send(ws, { type: 'error', message: 'Join a room first.' }); return; }
    if (Date.now() >= expiresAt) { ws.close(4001, 'Session expired'); return; }
    if (message.type === 'passenger-join') {
      const driver = currentRoom.players.get(message.driverId);
      const occupied = [...currentRoom.players.values()].filter(p => p.passengerOf === message.driverId);
      const seatIndex = driver ? vehicleSeats[driver.vehicle].findIndex((_, i) => !occupied.some(p => p.seatIndex === i)) : -1;
      if (player.riding || player.seated || player.jumpHeight > 0 || !driver || driver === player || driver.passengerOf || !driver.riding || Math.abs(driver.speed) >= 1.5 || Math.hypot(driver.x - player.x, driver.z - player.z) > 3.8 || seatIndex < 0) {
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
      const payload = JSON.stringify({ type: 'voice-audio', id: player.id, name: player.name, audio: message.audio });
      for (const listener of currentRoom.players.values()) {
        if (listener.id !== player.id && listener.speaker && listener.ws.readyState === 1 && listener.ws.bufferedAmount < 65536) listener.ws.send(payload);
      }
      return;
    }
    if (message.type === 'chat') {
      if (typeof message.text !== 'string') return;
      const text = message.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
      if (!text) return;
      if (Date.now() - lastChatAt < 700) { send(ws, { type: 'notice', message: 'Give your last message a moment before sending another.' }); return; }
      lastChatAt = Date.now();
      broadcast(currentRoom.players, { type: 'chat', id: player.id, name: player.name, text: filterChat(text) });
      return;
    }
    if (message.type === 'state') {
      const now = Date.now();
      if (now - lastStateAt < 35) return;
      lastStateAt = now;
      if (player.passengerOf) return;
      player.x = finiteNumber(message.x, player.x, -153, 153);
      player.z = finiteNumber(message.z, player.z, -153, 153);
      player.yaw = finiteNumber(message.yaw, player.yaw, -Math.PI * 4, Math.PI * 4);
      player.speed = finiteNumber(message.speed, 0, -5, 24);
      player.riding = Boolean(message.riding);
      player.vehicle = message.vehicle === 'car' ? 'car' : 'bike';
      player.seated = !player.riding && message.seated === true;
      player.jumpHeight = player.riding || player.seated ? 0 : finiteNumber(message.jumpHeight, 0, 0, 1.3);
      player.updatedAt = now;
      for (const passenger of currentRoom.players.values()) if (passenger.passengerOf === player.id) {
        if (player.riding && player.vehicle === passenger.vehicle) followDriver(passenger, player); else releasePassenger(passenger);
      }
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) });
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
    if (message.type === 'punch') {
      const now = Date.now();
      if (player.riding || player.seated || now - lastPunchAt < 350) return;
      lastPunchAt = now;
      broadcast(currentRoom.players, { type: 'punch', id: player.id }); return;
    }
    if (message.type === 'recall') {
      const now = Date.now();
      if (player.riding || player.passengerOf || now - lastRecallAt < 90) return;
      lastRecallAt = now;
      broadcast(currentRoom.players, { type: 'recall', id: player.id });
      return;
    }
    if (message.type === 'ping') send(ws, { type: 'pong', now: Date.now() });
  });

  ws.on('close', removePlayer);
});

server.listen(port, '0.0.0.0', () => console.log(`LepakMamak realtime server listening on ${port}`));
