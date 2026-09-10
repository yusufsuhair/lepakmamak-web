import { test, expect } from '@playwright/test';
test('ice cream song fades with distance and respects sound settings', async ({ page }) => {
  await page.addInitScript(() => { const start = performance.now(); Date.now = () => 1800000000000 + performance.now() - start; });
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  const sound = () => page.evaluate(() => (window as any).__lepak.iceCream);
  await expect.poll(async () => (await sound()).playing).toBe(true);
  await expect.poll(async () => (await sound()).gain).toBeGreaterThan(.03);
  const vendorZ = await page.evaluate(() => (window as any).__lepak.iceCream.z);
  await expect.poll(() => page.evaluate(() => (window as any).__lepak.iceCream.z)).toBeGreaterThan(vendorZ + .1);
  await page.screenshot({ path: 'test-results/ice-cream-bike.png' });
  await page.locator('#world').focus();
  await page.keyboard.down('s');
  await expect.poll(async () => (await sound()).gain, { timeout: 18000 }).toBeLessThan(.001);
  await page.keyboard.up('s');
  // Walking back is what brings the song back. This used to press "Return to Mamak Maju",
  // which main.ts removes at startup ($('reset').remove()) — so the step had been teleporting
  // nobody, and the song never returned.
  await page.locator('#world').focus();
  await page.keyboard.down('w');
  await expect.poll(async () => (await sound()).gain, { timeout: 25000 }).toBeGreaterThan(.03);
  await page.keyboard.up('w');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('City sounds').uncheck();
  expect((await sound()).playing).toBe(false);
  await expect.poll(async () => (await sound()).gain).toBeLessThan(.001);
  await page.getByLabel('City sounds').check();
  await expect.poll(async () => (await sound()).playing).toBe(true);
});
