import { test, expect } from '@playwright/test';
test('punch sound plays once per allowed punch and respects mute', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).punchSounds = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) {
      if (this.buffer && Math.abs(this.buffer.duration - .16) < .001) (window as any).punchSounds++;
      return start.apply(this, args);
    };
  });
  const count = () => page.evaluate(() => (window as any).punchSounds as number);
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#world').click({ position: { x: 640, y: 400 } });
  await expect.poll(count).toBe(1);
  await page.locator('#world').click({ position: { x: 640, y: 400 } });
  expect(await count()).toBe(1);
  await page.waitForTimeout(450);
  await page.locator('#world').click({ position: { x: 640, y: 400 } });
  expect(await count()).toBe(2);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('City sounds').uncheck();
  await page.getByRole('button', { name: 'Back to the streets' }).click();
  await page.waitForTimeout(450);
  await page.locator('#world').click({ position: { x: 640, y: 400 } });
  expect(await count()).toBe(2);
  expect(await page.evaluate(() => (window as any).__lepak.punchCount)).toBe(3);
});
