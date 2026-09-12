import { test, expect } from '@playwright/test';
import { enterAt } from './city';
test('ice cream song fades with distance and respects sound settings', async ({ page }) => {
  await page.addInitScript(() => { const start = performance.now(); Date.now = () => 1800000000000 + performance.now() - start; });
  // The vendor rides a shared-clock ellipse around (0,44) — 5 m wide, 18 m long — so the middle
  // of its route is the one spot that stays inside the song's 24 m reach for the whole test.
  const moveTo = await enterAt(page, 0, 44);
  const sound = () => page.evaluate(() => (window as any).__lepak.iceCream);
  await expect.poll(async () => (await sound()).playing).toBe(true);
  await expect.poll(async () => (await sound()).gain).toBeGreaterThan(.03);
  const vendorZ = await page.evaluate(() => (window as any).__lepak.iceCream.z);
  await expect.poll(() => page.evaluate(() => (window as any).__lepak.iceCream.z)).toBeGreaterThan(vendorZ + .1);
  await page.screenshot({ path: 'test-results/ice-cream-bike.png' });
  // Walking out of earshot of a bike that is itself moving took ~40 s of held keys and raced the
  // vendor. A welcome moves the player the way a reconnect does and asks the song the same
  // question. (-56,-25) is out of range of all three bikes: this one, Rembayung's and the beach's.
  moveTo(-56, -25);
  await expect.poll(async () => (await sound()).gain).toBeLessThan(.001);
  expect((await sound()).playing).toBe(false);
  moveTo(0, 44);
  await expect.poll(async () => (await sound()).gain).toBeGreaterThan(.03);
  expect((await sound()).playing).toBe(true);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('City sounds').uncheck();
  expect((await sound()).playing).toBe(false);
  await expect.poll(async () => (await sound()).gain).toBeLessThan(.001);
  await page.getByLabel('City sounds').check();
  await expect.poll(async () => (await sound()).playing).toBe(true);
});
