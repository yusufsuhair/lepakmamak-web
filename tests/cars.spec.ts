import { expect, test } from '@playwright/test';
import fleet from '../shared/fleet.json' with {type:'json'};

test('city traffic matches the fleet, with supercars, F1 and a patrol car', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  const models = await page.evaluate(() => (window as any).__lepak.trafficModels as string[]);
  // Counted from the fleet itself, so adding a car does not silently break this.
  expect(models).toHaveLength(fleet.length);
  expect(models).toEqual(expect.arrayContaining(['ferrari', 'lamborghini', 'f1', 'police']));
});
