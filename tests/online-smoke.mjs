// Explicit integration check against the configured Supabase project. Temporary users are deleted.
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import WebSocket from 'ws';
const env = Object.fromEntries(readFileSync('.env.production', 'utf8').trim().split('\n').map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const keys = JSON.parse(execFileSync('supabase', ['projects', 'api-keys', '--project-ref', ref, '--output', 'json'], { encoding: 'utf8' }));
const admin = createClient(env.VITE_SUPABASE_URL, keys.find(k => k.name === 'service_role').api_key, { auth: { persistSession: false, autoRefreshToken: false } });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const users = new Set();
const room = `test-${randomUUID().slice(0, 12)}`;
const base = process.env.TEST_BASE_URL || 'http://localhost:4173';
const sockets = [];
const errors = [];
try {
  const pages = [];
  let latestPlayers = [];
  let remoteJumpSeen = false, remotePunchSeen = false, remoteSitSeen = false, customizedPlayerSeen = false, remoteCarSeen = false;
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext(i ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
    const page = await context.newPage(); pages.push(page);
    await page.addInitScript(() => {
      window.voicePlayCount = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function(...args) { if (this.buffer?.sampleRate === 16000 && this.buffer.length === 640) window.voicePlayCount++; return start.apply(this, args); };
    });
    page.on('pageerror', e => errors.push(e.message));
    if (i === 1) page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
      const data = JSON.parse(String(payload));
      if (data.players) latestPlayers = data.players;
      if (data.players?.some(player => player.name === "Smoke Player 0" && player.seated)) remoteSitSeen = true;
      if (data.players?.some(player => player.name === "Smoke Player 0" && player.appearance?.gender === "female" && player.appearance?.hair === "#79549b" && player.appearance?.hairstyle === "bob")) customizedPlayerSeen = true;
      if (data.players?.some(player => player.name === "Smoke Player 0" && player.vehicle === "car" && player.riding)) remoteCarSeen = true;
      if (data.type === "punch") remotePunchSeen = true;
      if (data.players?.some(player => player.name === 'Smoke Player 0' && player.jumpHeight > .3)) remoteJumpSeen = true;
    }));
    page.on('response', async response => {
      if (response.url().includes('/auth/v1/signup') && response.ok()) {
        const data = await response.json(); if (data.user?.id) users.add(data.user.id);
      }
    });
    const email = `lepak-smoke-${randomUUID()}@example.com`;
    const password = randomUUID() + 'Aa9!';
    await page.goto(`${base}/?room=${room}`);
    await page.getByRole('button', { name: "Jom, let's go" }).click();
    await expect(page.locator('#auth-panel')).toBeVisible();
    await expect(page.locator('#hud')).toBeHidden();
    await page.getByLabel('Display name', { exact: true }).fill(`Smoke Player ${i}`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    if (i === 0) {
      await page.getByLabel('Gender', { exact: true }).selectOption('female');
      await page.getByLabel('Hair style', { exact: true }).selectOption('bob');
      await page.getByLabel('Hair colour', { exact: true }).selectOption('#79549b');
      await page.getByLabel('Skin tone', { exact: true }).selectOption('#593b30');
      await page.locator('#auth-panel').getByLabel('Shirt colour', { exact: true }).selectOption('#628fbb');
    }
    await page.locator('#avatar-fields').screenshot({ path: `test-results/customization-${i}.png` });
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.locator('#auth-panel')).toBeHidden({ timeout: 20000 });
    await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE', { timeout: 20000 });
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page.locator('#intro')).toBeVisible();
    await page.getByRole('button', { name: "Jom, let's go" }).click();
    await page.getByRole('button', { name: 'Already registered? Log in' }).click();
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Log in & enter' }).click();
    await expect(page.locator('#auth-message')).toContainText('Invalid', { timeout: 15000 });
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Log in & enter' }).click();
    await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE', { timeout: 15000 });
  }
  for (const page of pages) await expect(page.locator('#player-count')).toHaveText('2 / 24');
  for (const [index,page] of pages.entries()) {
    await page.getByRole('button', {name:'Open settings'}).click();
    await page.getByRole('button', {name:'Kedai · Skins & Accessories'}).click();
    await expect(page.locator('#item-shop')).toBeVisible();
    await expect(page.locator('#shop-balance')).toContainText('🪙 500');
    await expect(page.locator('#item-shop').getByRole('button', {name:/Beli · 🪙/})).toHaveCount(4);
    await expect(page.locator('#item-shop').getByRole('button', {name:/Beli · 🪙/}).first()).toBeEnabled();
    await page.locator('#item-shop').screenshot({path:`test-results/shop-${index}.png`});
    await page.getByRole('button', {name:'Close shop'}).click();
    await page.locator('#resume').click();
  }
  await expect.poll(() => customizedPlayerSeen).toBe(true);
  await pages[0].getByRole('button', { name: 'Show online players' }).click();
  await expect(pages[0].locator('#online-players-list')).toContainText('Smoke Player 0');
  await expect(pages[0].locator('#online-players-list')).toContainText('Smoke Player 1');
  await expect(pages[0].locator('#online-players-count')).toHaveText('2 online');
  await pages[0].getByRole('button', { name: 'Close online players' }).click();
  await pages[0].bringToFront();
  await pages[0].locator('#world').focus();
  await expect.poll(async () => { if (!remoteJumpSeen) await pages[0].keyboard.press('Space'); return remoteJumpSeen; }, { timeout: 10000, intervals: [1000] }).toBe(true);
  await pages[0].locator('#world').click({ position: { x: 640, y: 400 } });
  await expect.poll(() => remotePunchSeen).toBe(true);
  await pages[0].locator('#world').focus();
  await pages[0].keyboard.down('d');
  await expect(pages[0].locator('#interaction-text')).toHaveText('Enter', { timeout: 12000 });
  await pages[0].keyboard.up('d');
  await pages[0].locator('#interaction').click();
  await expect.poll(() => latestPlayers.find(p => p.name === 'Smoke Player 0')?.riding).toBe(true);
  await pages[1].bringToFront();
  await pages[1].locator('#world').focus();
  await pages[1].keyboard.down('d');
  await expect(pages[1].locator('#interaction')).toHaveText('Enter', { timeout: 12000 });
  await pages[1].keyboard.up('d');
  await pages[1].locator('#interaction').tap();
  await expect(pages[1].locator('#vehicle-label')).toHaveText('PILLION · PASSENGER');
  await expect.poll(() => !!latestPlayers.find(p => p.name === 'Smoke Player 1')?.passengerOf).toBe(true);
  await pages[0].bringToFront();
  await pages[0].locator('#world').focus();
  const bikeStart = latestPlayers.find(p => p.name === 'Smoke Player 0').z;
  await pages[0].keyboard.down('w');
  await expect.poll(() => latestPlayers.find(p => p.name === 'Smoke Player 0')?.z).toBeLessThan(bikeStart - 3);
  await pages[0].keyboard.up('w');
  await pages[0].keyboard.down('Space');
  await expect.poll(() => Math.abs(latestPlayers.find(p => p.name === 'Smoke Player 0')?.speed ?? 99)).toBeLessThan(.4);
  await pages[0].keyboard.up('Space');
  const driver = latestPlayers.find(p => p.name === 'Smoke Player 0');
  const passenger = latestPlayers.find(p => p.name === 'Smoke Player 1');
  expect(Math.hypot(driver.x - passenger.x, driver.z - passenger.z)).toBeCloseTo(.72, 1);
  await pages[0].screenshot({ path: 'test-results/two-seat-bike.png' });
  await pages[1].bringToFront();
  await pages[1].locator('#interaction').tap();
  await expect(pages[1].locator('#vehicle-label')).toHaveText('ON FOOT · TAKE IT EASY');
  for (const page of pages) {
    await page.bringToFront();
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.getByRole('button', { name: 'Return to Mamak Maju' }).click();
  }
  for (const page of pages) { await expect(page.locator('#player-count')).toHaveText('2 / 24'); if (await page.locator('#chat-body').isHidden()) await page.locator('#chat-heading').click(); await expect(page.locator('#chat-body')).toBeVisible(); }
  await pages[0].getByLabel('Message to the city').fill('<img src=x onerror=alert(1)> Hello friend');
  await pages[0].getByRole('button', { name: 'Send', exact: true }).click();
  await expect(pages[1].locator('#chat-messages')).toContainText('Smoke Player 0: <img src=x onerror=alert(1)> Hello friend');
  await expect(pages[1].locator('#chat-messages img')).toHaveCount(0);
  await expect(pages[1].locator('.speech-bubble')).toContainText('Smoke Player 0');
  await expect(pages[1].locator('.speech-bubble')).toBeVisible();
  await expect(pages[1].locator('.speech-bubble img')).toHaveCount(0);
  await pages[1].getByLabel('Message to the city').fill('Hello from mobile');
  await pages[1].getByRole('button', { name: 'Send', exact: true }).click();
  await expect(pages[0].locator('#chat-messages')).toContainText('Smoke Player 1: Hello from mobile');
  await expect(pages[0].locator('.speech-bubble').filter({ hasText: 'Hello from mobile' })).toBeVisible();
  await expect(pages[1].locator('.speech-bubble').filter({ hasText: 'Hello from mobile' })).toBeVisible();
  await pages[1].screenshot({ path: 'test-results/registration-mobile.png' });
  await expect(pages[1].locator('.speech-bubble')).toHaveCount(0, { timeout: 9000 });
  await expect(pages[1].locator('#chat-messages')).toContainText('Hello from mobile');
  await pages[1].bringToFront();
  await pages[1].locator('#voice-speaker').click();
  await pages[0].bringToFront();
  await pages[0].locator('#voice-mic').click();
  await expect(pages[0].locator('#voice-mic')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => pages[1].evaluate(() => window.voicePlayCount), { timeout: 15000 }).toBeGreaterThan(3);
  await pages[0].locator('#voice-mic').click();
  await expect(pages[0].locator('#voice-mic')).toHaveAttribute('aria-pressed', 'false');
  await pages[1].locator('#voice-speaker').click();
  await pages[0].bringToFront();
  await pages[0].locator('#world').focus();
  await pages[0].keyboard.down('s');
  await pages[0].waitForTimeout(3400);
  await pages[0].keyboard.up('s');
  await pages[0].keyboard.down('d');
  await expect(pages[0].locator('#interaction-text')).toHaveText('Enter', { timeout: 12000 });
  await pages[0].keyboard.up('d');
  await pages[0].locator('#interaction').click();
  await expect.poll(() => remoteCarSeen).toBe(true);
  await pages[0].getByRole('button', { name: 'Open settings' }).click();
  await pages[0].getByRole('button', { name: 'Return to Mamak Maju' }).click();
  await pages[0].keyboard.down('a');
  await pages[0].waitForTimeout(2500);
  await pages[0].keyboard.up('a');
  await pages[0].locator('#interaction').click();
  await expect(pages[0].locator('#interaction-text')).toHaveText('Stand');
  await expect.poll(() => remoteSitSeen).toBe(true);
  await pages[0].locator('#interaction').click();
  await pages[0].reload();
  await pages[0].getByRole('button', { name: "Jom, let's go" }).click();
  await expect(pages[0].locator('#multiplayer-status-text')).toHaveText('CITY ONLINE', { timeout: 15000 });
  const replacement = await pages[0].context().newPage();
  await replacement.goto(`${base}/?room=${room}`);
  await replacement.getByRole('button', {name: "Jom, let's go"}).click();
  await expect(replacement.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE', {timeout:15000});
  await expect(pages[0].locator('#session-replaced-message')).toBeVisible();
  await expect(pages[0].locator('#hud')).toBeHidden();
  await replacement.waitForTimeout(3500);
  await expect(replacement.locator('#player-count')).toHaveText('2 / 24');
  await expect(pages[0].locator('#session-replaced-message')).toBeVisible();
  const ws = new WebSocket(`${env.VITE_MULTIPLAYER_URL}/ws`); sockets.push(ws);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Unauthenticated join was not rejected')), 10000);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', room, name: 'Impersonator' })));
    ws.on('message', raw => { const data = JSON.parse(raw); if (data.code === 'AUTH_REQUIRED') { clearTimeout(timer); resolve(); } });
    ws.on('error', reject);
  });
  expect(errors).toEqual([]);
  console.log('PASS: desktop/mobile registration, wrong-password rejection, login/logout, session restore, two-player presence, bidirectional safe-text chat, live voice playback and mic/speaker toggles, unauthenticated join rejected.');
} finally {
  sockets.forEach(ws => ws.close()); await browser.close();
  for (const id of users) { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw new Error('Failed to remove smoke-test account'); }
  console.log(`Removed ${users.size} temporary test accounts.`);
}
