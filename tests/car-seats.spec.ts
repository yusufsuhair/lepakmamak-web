import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
test('car allows three passengers, reuses seats and releases everyone when driver leaves', async () => {
  const server = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: '8102', ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' }, stdio: 'ignore' });
  const clients: WebSocket[] = [], ids: string[] = []; let players: any[] = [];
  try {
    await expect.poll(async () => { try { return (await fetch('http://localhost:8102/health')).ok; } catch { return false; } }).toBe(true);
    for (let i = 0; i < 5; i++) {
      const ws = new WebSocket('ws://localhost:8102/ws'); clients.push(ws);
      await new Promise<void>((resolve, reject) => { ws.on('error', reject); ws.on('open', () => ws.send(JSON.stringify({ type: 'join', room: 'car-seats' }))); ws.on('message', raw => { const m = JSON.parse(String(raw)); if (m.players) players = m.players; if (m.type === 'welcome') { ids.push(m.id); resolve(); } }); });
    }
    const drive = (z: number, speed = 0) => clients[0].send(JSON.stringify({ type: 'state', x: -18, z, yaw: 0, riding: true, vehicle: 'car', speed }));
    const passengers = () => players.filter(p => p.passengerOf === ids[0]);
    drive(52); await expect.poll(() => players.find(p => p.id === ids[0])?.riding).toBe(true);
    for (const ws of clients.slice(1)) ws.send(JSON.stringify({ type: 'passenger-join', driverId: ids[0] }));
    await expect.poll(() => passengers().length).toBe(3);
    expect(new Set(passengers().map(p => p.seatIndex)).size).toBe(3);
    expect(passengers().every(p => p.vehicle === 'car')).toBe(true);
    drive(42, 5); await expect.poll(() => passengers().every(p => p.z < 43)).toBe(true);
    const first = passengers()[0];
    clients[ids.indexOf(first.id)].send(JSON.stringify({ type: 'passenger-leave' }));
    await new Promise(r => setTimeout(r, 60)); expect(passengers().length).toBe(3);
    drive(52); await expect.poll(() => passengers().every(p => p.speed === 0)).toBe(true);
    clients[ids.indexOf(first.id)].send(JSON.stringify({ type: 'passenger-leave' }));
    await expect.poll(() => passengers().length).toBe(2);
    const waiting = players.find(p => p.id !== ids[0] && p.id !== first.id && !p.passengerOf);
    clients[ids.indexOf(waiting.id)].send(JSON.stringify({ type: 'passenger-join', driverId: ids[0] }));
    await expect.poll(() => passengers().length).toBe(3);
    expect(players.find(p => p.id === waiting.id).seatIndex).toBe(first.seatIndex);
    clients[0].close(); await expect.poll(() => passengers().length).toBe(0);
    expect(players.filter(p => p.id !== ids[0]).every(p => !p.riding)).toBe(true);
  } finally { clients.forEach(ws => ws.close()); server.kill(); }
});
