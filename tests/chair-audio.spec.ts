import { test, expect } from '@playwright/test';
test('chair sounds play on sit and stand and respect mute', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).chairSounds = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function(...args) {
      if (this.type === 'sawtooth') (window as any).chairSounds++;
      return start.apply(this, args);
    };
  });
  const count = () => page.evaluate(() => (window as any).chairSounds as number);
  const seated = () => page.evaluate(() => (window as any).__lepak.seated);
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.keyboard.down('a');
  await expect.poll(() => page.evaluate(() => (window as any).__lepak.position.x)).toBeLessThan(-26);
  await page.keyboard.up('a');
  await page.locator('#interaction').click();
  await expect.poll(seated).toBe(true);
  expect(await count()).toBe(1);
  await page.waitForTimeout(350);
  expect(await count()).toBe(1);
  await page.locator('#interaction').click();
  await expect.poll(seated).toBe(false);
  expect(await count()).toBe(2);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('City sounds').uncheck();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.locator('#interaction').click();
  await expect.poll(seated).toBe(true);
  await page.locator('#interaction').click();
  await expect.poll(seated).toBe(false);
  expect(await count()).toBe(2);
});
