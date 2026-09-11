import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`landing page stays composed at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const title = page.locator('#intro h1');
    const start = page.locator('#start');
    await expect(title).toBeVisible();
    await expect(start).toBeVisible();

    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
      };
      return {
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        title: box('#intro h1'),
        tagline: box('.intro-copy .tagline'),
        start: box('#start'),
      };
    });

    expect(layout.pageWidth).toBe(layout.viewportWidth);
    expect(layout.title.left).toBeGreaterThanOrEqual(0);
    expect(layout.title.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.tagline.top).toBeGreaterThan(layout.title.bottom);
    expect(layout.start.top).toBeGreaterThan(layout.tagline.bottom);
    expect(layout.start.bottom).toBeLessThan(viewport.height);
  });
}
