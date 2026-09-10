import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

test('clothes are picked in the character screen and survive a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  // One screen: the wardrobe is a pair of tabs in the inventory, not a dialog behind it.
  const open = async () => {
    await page.getByRole('button', { name: 'Open inventory' }).click();
    await expect(page.locator('#inventory')).toBeVisible();
  };
  await open();
  await expect(page.locator('#wardrobe')).toHaveCount(0);

  await page.getByRole('button', { name: 'Tops', exact: true }).click();
  await page.getByRole('radio', { name: 'Blue shirt' }).click();
  await page.getByRole('button', { name: 'Bottoms', exact: true }).click();
  await page.getByRole('radio', { name: 'Black trousers' }).click();
  // Picking is applying: there is no Save button, so the status line is the confirmation.
  await expect(page.locator('.inventory-status')).toHaveText('Outfit saved.');
  await expect(page.locator('.outfit-slots')).toContainText('Black');
  await page.screenshot({ path: 'test-results/character-desktop.png' });
  await page.getByRole('button', { name: 'Close inventory' }).click();

  await page.reload();
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await open();
  await page.getByRole('button', { name: 'Tops', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Blue shirt' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Bottoms', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Black trousers' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#inventory select')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/character-mobile.png' });
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
