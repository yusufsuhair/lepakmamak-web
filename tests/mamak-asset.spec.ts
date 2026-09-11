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
  expect(document.nodes[0].extras.lm_version).toBe(3);
});

test('failed Mamak download retains the complete procedural site and playable seating', async ({ page }) => {
  await page.route('**/LM_ENV_MamakMaju.glb*', route => route.abort());
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as any).__lepak?.mamakMaju)).toEqual({ state: 'fallback', fallbackVisible: true });
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Fallback Guest');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await page.keyboard.down('a');
  await expect.poll(() => page.evaluate(() => (window as any).__lepak.position.x)).toBeLessThan(-26);
  await page.keyboard.up('a');
  await page.locator('#interaction').click();
  await expect.poll(() => page.evaluate(() => (window as any).__lepak.seated)).toBe(true);
});
