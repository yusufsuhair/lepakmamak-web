import { test, expect } from '@playwright/test';

test('Mamak Maju Blender GLB loads and hides only its procedural visual fallback', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as any).__lepak?.mamakMaju?.state)).toBe('ready');
  await expect.poll(() => page.evaluate(() => (window as any).__lepak?.mamakMaju?.fallbackVisible)).toBe(false);
  const response = await page.request.get('/assets/models/environment/LM_ENV_MamakMaju.glb');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('model/gltf-binary');
  expect(Number(response.headers()['content-length'])).toBeGreaterThan(60000);
  const bytes = await response.body();
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  expect(document.nodes[0].extras.lm_sign_text).toBe('MAMAK MAJU');
});
