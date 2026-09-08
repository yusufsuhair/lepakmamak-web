import { test, expect } from '@playwright/test';
test('mobile chat starts compact and remembers expand and collapse choices', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await expect(page.locator('#chat-body')).toBeHidden();
  await page.getByRole('button', { name: 'Expand city chat' }).tap();
  await expect(page.locator('#chat-body')).toBeVisible();
  await page.getByLabel('Message to the city').fill('Draft message');
  await page.getByRole('button', { name: 'Collapse city chat' }).tap();
  await expect(page.locator('#chat-body')).toBeHidden();
  await page.getByRole('button', { name: 'Expand city chat' }).tap();
  await expect(page.getByLabel('Message to the city')).toHaveValue('Draft message');
  await page.reload();
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await expect(page.locator('#chat-body')).toBeVisible();
  await context.close();
});
