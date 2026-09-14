import { test, expect } from '@playwright/test';

test('music player follows playback, skips tracks and stays above speed on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  // Exercise the real HUD and controls without requiring a live multiplayer server.
  await page.evaluate(() => { document.getElementById('hud')!.hidden = false; document.getElementById('intro')!.hidden = true; });
  const title = page.locator('.music-title');
  const first = await title.textContent();
  await page.getByRole('button', { name: 'Next song', exact: true }).click();
  await expect(title).not.toHaveText(first!);
  await page.evaluate(() => {
    const audio = document.getElementById('lofi-music') as HTMLAudioElement;
    Object.defineProperty(audio, 'paused', { configurable: true, value: false });
    audio.dispatchEvent(new Event('playing'));
  });
  await expect(page.getByRole('button', { name: 'Pause music', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause music', exact: true }).click();
  await expect(page.locator('#music-toggle')).not.toBeChecked();
  await page.locator('#speed').dispatchEvent('pointerdown');
  await expect(page.locator('#music-toggle')).not.toBeChecked();
  await page.getByRole('button', { name: 'Next song', exact: true }).click();
  await expect(title).toHaveText(first!);
  await expect(page.locator('#music-toggle')).not.toBeChecked();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const player = (await page.locator('#music-player').boundingBox())!;
    const speed = (await page.locator('#speed').boundingBox())!;
    expect(player.x).toBeGreaterThanOrEqual(0);
    expect(player.x + player.width).toBeLessThanOrEqual(width);
    expect(player.y + player.height).toBeLessThan(speed.y);
  }
});
