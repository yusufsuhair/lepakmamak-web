import { expect, test } from '@playwright/test';

test('city traffic includes twelve cars with supercars and F1', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  const models = await page.evaluate(() => (window as any).__lepak.trafficModels as string[]);
  expect(models).toHaveLength(12);
  expect(models).toEqual(expect.arrayContaining(['ferrari', 'lamborghini', 'f1']));
});
