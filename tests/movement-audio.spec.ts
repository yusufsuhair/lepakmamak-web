import { test, expect } from '@playwright/test';

test('movement audio triggers on footsteps, takeoff and landing and respects mute', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).movementSounds = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) {
      if (this.buffer && Math.abs(this.buffer.duration - .22) < .001) (window as any).movementSounds++;
      return start.apply(this, args);
    };
  });
  const count = () => page.evaluate(() => (window as any).movementSounds as number);
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#world').focus();
  await page.keyboard.down('s');
  await expect.poll(count).toBeGreaterThanOrEqual(2);
  await page.keyboard.up('s');
  const stopped = await count();
  await page.waitForTimeout(500);
  expect(await count()).toBe(stopped);
  await page.keyboard.press('Space');
  await expect.poll(count).toBe(stopped + 2);
  await page.waitForTimeout(500);
  expect(await count()).toBe(stopped + 2);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('City sounds').uncheck();
  await page.getByRole('button', { name: 'Back to the streets' }).click();
  await page.keyboard.press('Space');
  await page.keyboard.down('s');
  await page.waitForTimeout(1000);
  await page.keyboard.up('s');
  expect(await count()).toBe(stopped + 2);
});
