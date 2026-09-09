import { test, expect } from '@playwright/test';

// The log is on screen by default now — the composer is what hides. The heading
// still collapses the whole panel for players who want a clear screen, and that
// choice is what has to survive a reload.
test('mobile chat shows the log by default and remembers a collapse choice', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Collapse');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await expect(page.locator('#chat-body')).toBeVisible();
  await expect(page.locator('#chat-form')).toBeHidden();

  await page.locator('#chat-compose').tap();
  await page.getByLabel('Message to the city').fill('Draft message');
  await page.getByRole('button', { name: 'Collapse city chat' }).tap();
  await expect(page.locator('#chat-body')).toBeHidden();

  await page.getByRole('button', { name: 'Expand city chat' }).tap();
  await expect(page.locator('#chat-body')).toBeVisible();
  await page.locator('#chat-compose').tap();
  await expect(page.getByLabel('Message to the city')).toHaveValue('Draft message');

  await page.getByRole('button', { name: 'Collapse city chat' }).tap();
  await page.reload();
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Collapse');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await expect(page.locator('#chat-body')).toBeHidden();
  await context.close();
});

test('collapsed chat shows an unread badge for new messages and clears it on open', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/unread-chat-harness', route => route.fulfill({ contentType: 'text/html', body: '<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>' }));
  await page.goto('/unread-chat-harness');
  await page.evaluate(async () => { const { setupChat } = await import('/src/social.ts'); (window as any).chat = setupChat(() => true, () => {}); });
  await page.getByRole('button', { name: 'Collapse city chat' }).click();
  await page.evaluate(() => { const chat = (window as any).chat; chat.append('Me', 'Own message', undefined, false, false); chat.append('Aina', 'Jom mamak'); });
  await expect(page.locator('#chat-unread-badge')).toBeVisible();
  await expect(page.locator('#chat-unread-badge')).toHaveText('1');
  await expect(page.locator('#chat-heading')).toHaveAttribute('aria-label', 'Expand city chat, 1 unread messages');
  const position = await page.locator('#chat-unread-badge').evaluate(element => ({ badge: element.getBoundingClientRect().top, heading: document.querySelector('#chat-heading')!.getBoundingClientRect().top }));
  expect(position.badge).toBeLessThan(position.heading);
  await page.screenshot({ path: 'test-results/chat-unread-badge-mobile.png' });
  await page.getByRole('button', { name: 'Expand city chat, 1 unread messages' }).click();
  await expect(page.locator('#chat-unread-badge')).toBeHidden();
  await expect(page.locator('#chat-heading')).toHaveAttribute('aria-label', 'Collapse city chat');
});
