import { test, expect } from '@playwright/test';
test('online-player dialog opens, handles offline state and closes without pausing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.getByRole('button', { name: 'Show online players' }).click();
  await expect(page.getByRole('dialog', { name: "Who's in the city?" })).toBeVisible();
  await expect(page.locator('#online-players-empty')).toContainText('not connected');
  await page.keyboard.press('Escape');
  await expect(page.locator('#online-players')).not.toBeVisible();
  await expect(page.locator('#pause')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show online players' })).toBeFocused();
});
