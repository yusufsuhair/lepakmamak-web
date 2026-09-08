import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

test('wardrobe saves locally, restores after reload and discards cancelled edits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  const open = async () => {
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.getByRole('button', { name: 'Wardrobe · Change clothes' }).click();
  };
  await open();
  await page.locator('#wardrobe').getByLabel('Shirt colour', { exact: true }).selectOption('#628fbb');
  await page.locator('#wardrobe').getByLabel('Trousers colour', { exact: true }).selectOption('#253a40');
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await expect(page.locator('#wardrobe')).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await open();
  await expect(page.locator('#wardrobe').getByLabel('Shirt colour', { exact: true })).toHaveValue('#628fbb');
  await expect(page.locator('#wardrobe').getByLabel('Trousers colour', { exact: true })).toHaveValue('#253a40');
  await page.locator('#wardrobe').getByLabel('Shirt colour', { exact: true }).selectOption('#c9779c');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Wardrobe · Change clothes' }).click();
  await expect(page.locator('#wardrobe').getByLabel('Shirt colour', { exact: true })).toHaveValue('#628fbb');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/wardrobe-mobile.png' });
});

test('outfit updates reach peers and preserve other appearance fields', async () => {
  const server = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: '8101', ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' }, stdio: 'ignore' });
  const clients: WebSocket[] = []; let players: any[] = []; const ids: string[] = [];
  try {
    await expect.poll(async () => { try { return (await fetch('http://localhost:8101/health')).ok; } catch { return false; } }).toBe(true);
    for (let i = 0; i < 2; i++) {
      const socket = new WebSocket('ws://localhost:8101/ws'); clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.on('error', reject); socket.on('open', () => socket.send(JSON.stringify({ type: 'join', room: 'wardrobe-test' })));
        socket.on('message', raw => { const message = JSON.parse(String(raw)); if (i === 1 && message.players) players = message.players; if (message.type === 'welcome') { ids.push(message.id); resolve(); } });
      });
    }
    clients[0].send(JSON.stringify({ type: 'outfit', shirt: '#628fbb', trousers: '#253a40', gender: 'female' }));
    await expect.poll(() => players.find(p => p.id === ids[0])?.appearance?.shirt).toBe('#628fbb');
    expect(players.find(p => p.id === ids[0]).appearance.gender).toBe('male');
    clients[0].send(JSON.stringify({ type: 'outfit', shirt: 'invalid', trousers: '#436485' }));
    await expect.poll(() => players.find(p => p.id === ids[0])?.appearance?.shirt).toBe('#ef734c');
  } finally { clients.forEach(c => c.close()); server.kill(); }
});
