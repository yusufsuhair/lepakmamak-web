import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('premium UI layer is loaded after feature styles', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const polish = readFileSync('src/ui-polish.css', 'utf8');
  expect(main.lastIndexOf("import './ui-polish.css'"))
    .toBeGreaterThan(main.lastIndexOf("import './style.css'"));
  for (const token of ['--ui-panel', '--ui-line', '--ui-lime', '--ui-radius-lg', '--ui-shadow-deep']) {
    expect(polish).toContain(token);
  }
  expect(polish).toContain('@media (any-pointer: coarse) and (min-width: 601px)');
});

test('account entry reveals only the current onboarding step', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await expect(page.locator('#auth-guest')).toBeVisible();
  await expect(page.locator('#auth-email')).toBeVisible();
  await expect(page.locator('#auth-password')).toBeVisible();
  await expect(page.locator('#avatar-fields')).toBeHidden();
  await expect(page.locator('#name-field')).toBeHidden();
});

test('mobile game chrome stays inside the viewport', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await page.getByRole('button', { name: "Jom, let's go" }).click();
    await page.locator('#auth-guest').tap();
    await page.locator('#guest-name').fill('UI Check');
    await page.getByRole('button', { name: 'Enter as guest', exact: true }).tap();
    await expect(page.locator('#hud')).toBeVisible();
    const selectors = ['#minimap-wrap', '#hud-more', '#city-chat', '#speedometer', '.touch-actions'];
    for (const selector of selectors) {
      const rect = await page.locator(selector).evaluate(element => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      });
      expect(rect.left, selector).toBeGreaterThanOrEqual(-1);
      expect(rect.right, selector).toBeLessThanOrEqual(391);
      expect(rect.top, selector).toBeGreaterThanOrEqual(-1);
      expect(rect.bottom, selector).toBeLessThanOrEqual(845);
    }
  } finally {
    await context.close();
  }
});
