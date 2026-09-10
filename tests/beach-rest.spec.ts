import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

const PORT = '8274';
type Peer = {ws: WebSocket; id: string; snapshots: any[]};

const connect = (name: string, peers: WebSocket[]) => new Promise<Peer>((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`); peers.push(ws);
  const peer: Peer = {ws, id: '', snapshots: []};
  ws.on('error', reject);
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
    if (message.players) peer.snapshots.push(message.players);
    if (message.type === 'welcome') { peer.id = message.id; resolve(peer); }
  });
  ws.on('open', () => ws.send(JSON.stringify({type: 'join', room: 'beach-rest', guest: true, name})));
});

const state = (peer: Peer, x: number, z: number, resting: 'sunbed'|'hammock'|null, restSpotId: string|null) =>
  peer.ws.send(JSON.stringify({type: 'state', x, z, yaw: 0, riding: false, speed: 0, jumpHeight: 0, seated: false, resting, restSpotId, vehicle: 'bike'}));

test('Pantai Senja exposes three sunbeds and two hammocks', async ({page}) => {
  await page.goto('/');
  const spots = await page.evaluate(async () => (await import('/src/beach.ts')).BEACH_REST_SPOTS);
  expect(spots.map(spot => spot.kind)).toEqual(['sunbed', 'sunbed', 'sunbed', 'hammock', 'hammock']);
  expect(spots.map(spot => spot.id)).toEqual(['sunbed-1', 'sunbed-2', 'sunbed-3', 'hammock-1', 'hammock-2']);
});

test('a beach rest spot is reserved for one player at a time', async () => {
  test.setTimeout(30000);
  const server = spawn(process.execPath, ['server/index.mjs'], {env: {...process.env, PORT, ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SERVICE_ROLE_KEY: ''}, stdio: 'ignore'});
  const sockets: WebSocket[] = [];
  try {
    await expect.poll(async () => { try { return (await fetch(`http://127.0.0.1:${PORT}/health`)).ok; } catch { return false; } }, {timeout: 10000}).toBe(true);
    const first = await connect('Beach One', sockets);
    const second = await connect('Beach Two', sockets);
    state(first, 119, 148, null, null); state(second, 130, 148, null, null);
    await new Promise(resolve => setTimeout(resolve, 120));
    state(first, 119, 148, 'sunbed', 'sunbed-1');
    await expect.poll(() => first.snapshots.at(-1)?.find((player: any) => player.id === first.id)?.resting, {timeout: 10000}).toBe('sunbed');
    state(second, 119, 148, 'sunbed', 'sunbed-1');
    await expect.poll(() => second.snapshots.at(-1)?.find((player: any) => player.id === second.id)?.x, {timeout: 10000}).toBe(119);
    const secondState = second.snapshots.at(-1)?.find((player: any) => player.id === second.id);
    expect(secondState.resting).toBeNull();
    expect(secondState.restSpotId).toBeNull();
  } finally {
    sockets.forEach(socket => socket.close()); server.kill();
  }
});
