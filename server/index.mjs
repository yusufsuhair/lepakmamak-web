import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 8080);
const maxPlayers = 24;
const rooms = new Map();
const palette = ['#dafa8e', '#f4a06c', '#72c8ba', '#e4bd66', '#d58ca0', '#9cace0'];

function roomFor(name) {
  const roomName = String(name || 'kampung').slice(0, 24) || 'kampung';
  if (!rooms.has(roomName)) rooms.set(roomName, new Map());
  return { name: roomName, players: rooms.get(roomName) };
}

function finiteNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function snapshot(players) {
  return [...players.values()].map(({ ws: _ws, ...player }) => player);
}

function send(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify(message));
}

function broadcast(players, message) {
  const payload = JSON.stringify(message);
  for (const player of players.values()) if (player.ws.readyState === 1) player.ws.send(payload);
}

const server = http.createServer((request, response) => {
  if (request.url === '/health' || request.url === '/') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, service: 'lepak-city-realtime', rooms: rooms.size, players: [...rooms.values()].reduce((total, players) => total + players.size, 0) }));
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

  ws.on('message', raw => {
    if (raw.length > 4096) return;
    let message;
    try { message = JSON.parse(raw.toString()); } catch { send(ws, { type: 'error', message: 'Send JSON messages only.' }); return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'join') {
      if (player) return;
      const room = roomFor(message.room);
      if (room.players.size >= maxPlayers) { send(ws, { type: 'error', message: 'This room is full. Try again in a moment.' }); ws.close(1008, 'Room full'); return; }
      const id = crypto.randomUUID();
      const number = room.players.size;
      player = {
        id,
        ws,
        name: typeof message.name === 'string' && message.name.trim() ? message.name.trim().slice(0, 18) : `Guest ${number + 1}`,
        color: palette[number % palette.length],
        x: -18,
        z: 52,
        yaw: Math.PI,
        riding: false,
        speed: 0,
        updatedAt: Date.now(),
      };
      currentRoom = room;
      room.players.set(id, player);
      send(ws, { type: 'welcome', id, room: room.name, players: snapshot(room.players) });
      broadcast(room.players, { type: 'players', players: snapshot(room.players) });
      return;
    }

    if (!player || !currentRoom) { send(ws, { type: 'error', message: 'Join a room first.' }); return; }
    if (message.type === 'state') {
      const now = Date.now();
      if (now - lastStateAt < 35) return;
      lastStateAt = now;
      player.x = finiteNumber(message.x, player.x, -153, 153);
      player.z = finiteNumber(message.z, player.z, -153, 153);
      player.yaw = finiteNumber(message.yaw, player.yaw, -Math.PI * 4, Math.PI * 4);
      player.speed = finiteNumber(message.speed, 0, -5, 20);
      player.riding = Boolean(message.riding);
      player.updatedAt = now;
      broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) });
      return;
    }
    if (message.type === 'recall') {
      const now = Date.now();
      if (now - lastRecallAt < 90) return;
      lastRecallAt = now;
      broadcast(currentRoom.players, { type: 'recall', id: player.id });
      return;
    }
    if (message.type === 'ping') send(ws, { type: 'pong', now: Date.now() });
  });

  ws.on('close', () => {
    if (!player || !currentRoom) return;
    currentRoom.players.delete(player.id);
    broadcast(currentRoom.players, { type: 'players', players: snapshot(currentRoom.players) });
    if (!currentRoom.players.size) rooms.delete(currentRoom.name);
  });
});

server.listen(port, '0.0.0.0', () => console.log(`Lepak City realtime server listening on ${port}`));
