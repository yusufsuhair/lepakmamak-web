import { test, expect } from '@playwright/test';

test('Mamak Maju Blender GLB loads and hides only its procedural visual fallback', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as any).__lepak?.mamakMaju?.state)).toBe('ready');
  await expect.poll(() => page.evaluate(() => (window as any).__lepak?.mamakMaju?.fallbackVisible)).toBe(false);
  const response = await page.request.get('/assets/models/environment/LM_ENV_MamakMaju.glb');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('model/gltf-binary');
  expect(Number(response.headers()['content-length'])).toBeGreaterThan(60000);
});
