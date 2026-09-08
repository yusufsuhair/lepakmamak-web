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
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const users = new Set();
const room = `test-${randomUUID().slice(0, 12)}`;
const base = process.env.TEST_BASE_URL || 'http://localhost:4173';
const sockets = [];
const errors = [];
try {
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext(i ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', e => errors.push(e.message));
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
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.locator('#auth-panel')).toBeHidden({ timeout: 20000 });
    await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE', { timeout: 20000 });
    await page.getByRole('button', { name: 'Pause and settings' }).click();
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
  for (const page of pages) { await expect(page.locator('#player-count')).toHaveText('2 / 24'); await page.locator('#chat-toggle').click(); }
  await pages[0].getByLabel('Message to the city').fill('<img src=x onerror=alert(1)> Hello friend');
  await pages[0].getByRole('button', { name: 'Send', exact: true }).click();
  await expect(pages[1].locator('#chat-messages')).toContainText('Smoke Player 0: <img src=x onerror=alert(1)> Hello friend');
  await expect(pages[1].locator('#chat-messages img')).toHaveCount(0);
  await pages[1].getByLabel('Message to the city').fill('Hello from mobile');
  await pages[1].getByRole('button', { name: 'Send', exact: true }).click();
  await expect(pages[0].locator('#chat-messages')).toContainText('Smoke Player 1: Hello from mobile');
  await pages[1].screenshot({ path: 'test-results/registration-mobile.png' });
  await pages[0].reload();
  await pages[0].getByRole('button', { name: "Jom, let's go" }).click();
  await expect(pages[0].locator('#multiplayer-status-text')).toHaveText('CITY ONLINE', { timeout: 15000 });
  const ws = new WebSocket(`${env.VITE_MULTIPLAYER_URL}/ws`); sockets.push(ws);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Unauthenticated join was not rejected')), 10000);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', room, name: 'Impersonator' })));
    ws.on('message', raw => { const data = JSON.parse(raw); if (data.code === 'AUTH_REQUIRED') { clearTimeout(timer); resolve(); } });
    ws.on('error', reject);
  });
  expect(errors).toEqual([]);
  console.log('PASS: desktop/mobile registration, wrong-password rejection, login/logout, session restore, two-player presence, bidirectional safe-text chat, unauthenticated join rejected.');
} finally {
  sockets.forEach(ws => ws.close()); await browser.close();
  for (const id of users) { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw new Error('Failed to remove smoke-test account'); }
  console.log(`Removed ${users.size} temporary test accounts.`);
}
