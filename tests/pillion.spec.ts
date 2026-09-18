import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

// Everyone starts where the vehicle is. A first visit otherwise arrives beside a mamak table,
// too far from the kerb to board, and this spec is about seats rather than arrivals.
test('bike back seat is exclusive, follows only the driver, and releases on driver exit', async () => {
  const server = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: '8097', ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' }, stdio: 'ignore' });
  const clients: WebSocket[] = [];
  let players: any[] = [];
  try {
    await expect.poll(async () => { try { return (await fetch('http://127.0.0.1:8097/health')).ok; } catch { return false; } }).toBe(true);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const ws = new WebSocket('ws://127.0.0.1:8097/ws'); clients.push(ws);
      await new Promise<void>((resolve, reject) => {
        ws.on('error', reject);
        ws.on('open', () => ws.send(JSON.stringify({ type: 'join', room: 'pillion', resume: { x: -18, z: 52, yaw: 0 } })));
        ws.on('message', raw => { const m = JSON.parse(String(raw)); if (m.players) players = m.players; if (m.type === 'welcome') { ids.push(m.id); resolve(); } });
      });
    }
    clients[0].send(JSON.stringify({ type: 'state', x: -18, z: 52, yaw: 0, riding: true, vehicle: 'bike', speed: 0 }));
    await expect.poll(() => players.find(p => p.id === ids[0])?.riding).toBe(true);
    for (const ws of clients.slice(1)) ws.send(JSON.stringify({ type: 'passenger-join', driverId: ids[0] }));
    await expect.poll(() => players.filter(p => p.passengerOf === ids[0]).length).toBe(1);
    const passenger = players.find(p => p.passengerOf === ids[0]);
    const passengerSocket = clients[ids.indexOf(passenger.id)];
    const horns: any[] = [];
    passengerSocket.on('message', raw => { const message = JSON.parse(String(raw)); if (message.type === 'horn') horns.push(message); });
    passengerSocket.send(JSON.stringify({ type: 'horn' }));
    clients[0].send(JSON.stringify({ type: 'horn' }));
    clients[0].send(JSON.stringify({ type: 'horn' }));
    await expect.poll(() => horns.length).toBe(1);
    expect(horns[0]).toMatchObject({ id: ids[0], vehicle: 'bike' });
    await new Promise(r => setTimeout(r, 50));
    clients[0].send(JSON.stringify({ type: 'state', x: -18, z: 40, yaw: 0, riding: true, vehicle: 'bike', speed: 6 }));
    await expect.poll(() => players.find(p => p.id === passenger.id)?.z).toBeCloseTo(39.28);
    passengerSocket.send(JSON.stringify({ type: 'state', x: 100, z: 100, riding: false }));
    passengerSocket.send(JSON.stringify({ type: 'passenger-leave' }));
    await new Promise(r => setTimeout(r, 80));
    expect(players.find(p => p.id === passenger.id).passengerOf).toBe(ids[0]);
    expect(players.find(p => p.id === passenger.id).z).toBeCloseTo(39.28);
    clients[0].close();
    await expect.poll(() => players.find(p => p.id === passenger.id)?.passengerOf).toBe(null);
    expect(players.find(p => p.id === passenger.id).riding).toBe(false);
  } finally { clients.forEach(ws => ws.close()); server.kill(); }
});
