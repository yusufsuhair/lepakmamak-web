import { test, expect } from '@playwright/test';
test('horn is driver-only and responds to H and button while respecting mute', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).horns = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function(...args) { if (this.type === 'square' && [660,349,440].includes(this.frequency.value)) (window as any).horns++; return start.apply(this,args); };
  });
  const count = () => page.evaluate(() => (window as any).horns);
  await page.goto('/'); await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await page.keyboard.press('h'); expect(await count()).toBe(0);
  await page.keyboard.down('d');
  await expect(page.locator('#interaction-text')).toHaveText('Enter');
  await page.keyboard.up('d'); await page.locator('#interaction').click();
  await expect(page.locator('#desktop-horn')).toBeVisible();
  await expect(page.locator('#desktop-recall')).toBeHidden();
  await expect(page.locator('#touch-recall')).toBeHidden();
  await page.keyboard.press('r');
  await expect(page.locator('#toast')).toBeHidden();
  await page.keyboard.press('h'); expect(await count()).toBe(1);
  await page.waitForTimeout(450); await page.locator('#desktop-horn').click(); expect(await count()).toBe(2);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('City sounds').uncheck();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.waitForTimeout(450); await page.keyboard.press('h'); expect(await count()).toBe(2);
});
