import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

test('bike rider can start and cancel a synchronized Superman stunt', async ({ page }) => {
  const server = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: '8102', ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' }, stdio: 'ignore' });
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5182', '--strictPort'], { env: { ...process.env, VITE_MULTIPLAYER_URL: 'ws://127.0.0.1:8102', VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' }, stdio: 'ignore' });
  let observer: WebSocket | undefined, players: any[] = [];
  try {
    await expect.poll(async () => { try { return (await fetch('http://127.0.0.1:8102/health')).ok && (await fetch('http://127.0.0.1:5182')).ok; } catch { return false; } }).toBe(true);
    observer = new WebSocket('ws://127.0.0.1:8102/ws'); observer.on('open', () => observer!.send(JSON.stringify({ type: 'join', guest: true, name: 'Watcher', room: 'superman-test' }))); observer.on('message', raw => { const message = JSON.parse(String(raw)); if (message.players) players = message.players; });
    await page.goto('http://127.0.0.1:5182/?room=superman-test'); await page.getByRole('button', { name: "Jom, let's go" }).click(); await page.locator('#auth-guest').click(); await page.locator('#guest-name').fill('Stunt Rider'); await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
    await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');
    await page.keyboard.down('d'); await expect(page.locator('#interaction-text')).toHaveText('Enter'); await page.keyboard.up('d'); await page.locator('#interaction').click();
    await expect(page.locator('#desktop-superman')).toBeVisible(); await expect(page.locator('#desktop-recall')).toBeHidden();
    await page.locator('#desktop-superman').click();
    await expect.poll(() => players.find(player => player.name === 'Stunt Rider')?.supermanUntil || 0).toBeGreaterThan(Date.now());
    await expect.poll(() => page.evaluate(() => (window as any).__lepak.superman)).toBe(true);
    await expect(page.locator('#desktop-superman')).toHaveText('STOP');
    await page.screenshot({ path: 'test-results/superman-bike.png' });
    await page.locator('#desktop-superman').click(); await expect.poll(() => page.evaluate(() => (window as any).__lepak.superman)).toBe(false);
    await expect.poll(() => players.find(player => player.name === 'Stunt Rider')?.supermanUntil || 0).toBe(0);
  } finally { observer?.close(); vite.kill(); server.kill(); }
});

test('Superman pose makes the rider horizontal and restores the seated rig', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { createPerson } = await import('/src/world.ts'); const { supermanPose } = await import('/src/stunts.ts');
    const rider = createPerson('#ef734c', true), start = { y: rider.group.position.y, x: rider.group.rotation.x, leg: rider.leftLeg.rotation.x };
    supermanPose(rider, true, 1); const active = { y: rider.group.position.y, x: rider.group.rotation.x, leg: rider.leftLeg.rotation.x };
    supermanPose(rider, false); const restored = { y: rider.group.position.y, x: rider.group.rotation.x, leg: rider.leftLeg.rotation.x };
    return { start, active, restored };
  });
  expect(result.active.x).toBeGreaterThan(1.4); expect(result.active.y).toBeGreaterThan(1);
  expect(result.restored).toEqual(result.start);
});
