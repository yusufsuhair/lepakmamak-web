import { test, expect } from '@playwright/test';

test('chat window icons stay centred and touch-sized inside the game dialog', async ({page}, testInfo) => {
  await page.route('**/chat-icons-harness', route => route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/ui-polish.css"><div id="hud"></div>'}));
  await page.goto('/chat-icons-harness');
  await page.evaluate(async () => {
    const {setupChat} = await import('/src/social.ts');
    const {setupTableSocial} = await import('/src/table-social.ts');
    setupChat(() => true, () => {});
    const ui = setupTableSocial(() => true, 'city', () => {}, () => {});
    ui.state([{id:'meja-4',name:'Meja 4',capacity:4,occupants:[{id:'self',name:'Ali',chairId:'chair-9'}]}], 'self', true);
    ui.open('meja-4');
  });
  await page.locator('[data-select="four"]').click();
  for (const width of [390, 920, 1280]) {
    await page.setViewportSize({width,height:767});
    const heading = (await page.locator('#chat-heading').boundingBox())!;
    const title = (await page.locator('#chat-heading b').boundingBox())!;
    for (const id of ['chat-min','chat-expand']) {
      const button = page.locator(`#${id}`), box = (await button.boundingBox())!, icon = (await button.locator('svg').boundingBox())!;
      expect(box.width).toBe(44); expect(box.height).toBe(44);
      expect(icon.width).toBe(18); expect(icon.height).toBe(18);
      expect(Math.abs(icon.x+9-box.x-22)).toBeLessThan(1);
      expect(Math.abs(icon.y+9-box.y-22)).toBeLessThan(1);
      expect(box.x).toBeGreaterThan(title.x+title.width);
      expect(box.x+box.width).toBeLessThanOrEqual(heading.x+heading.width);
      expect(box.y).toBeGreaterThanOrEqual(heading.y);
      expect(box.y+box.height).toBeLessThanOrEqual(heading.y+heading.height);
    }
    await page.screenshot({path:testInfo.outputPath(`chat-icons-${width}.png`)});
    await page.getByRole('button',{name:'Minimise city chat'}).click();
    await expect(page.locator('#chat-expand')).toBeHidden();
    await page.getByRole('button',{name:'Restore city chat'}).click();
    await expect(page.locator('#chat-body')).toBeVisible();
  }
});

// Phones start with chat out of the way; the outer tab is the explicit way back in. The
// heading still collapses the body for players who want a clear screen, and that choice
// is what has to survive a reload.
test('mobile chat is hidden by default and remembers a collapse choice', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Collapse');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await expect(page.locator('#chat-body')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show city chat' })).toBeVisible();
  await page.getByRole('button', { name: 'Show city chat' }).tap();
  await expect(page.locator('#chat-body')).toBeVisible();
  await expect(page.locator('#chat-form')).toBeHidden();

  await page.locator('#chat-compose').tap();
  await page.getByLabel('Message to the city').fill('Draft message');
  await page.getByRole('button', { name: 'Collapse city chat' }).tap();
  await expect(page.locator('#chat-body')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Expand chat to a larger window' })).toBeHidden();

  await page.getByRole('button', { name: 'Expand city chat' }).tap();
  await expect(page.locator('#chat-body')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand chat to a larger window' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Show city chat' }).click();
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

test('offline DM removes its private thread and composer target', async ({ page }) => {
  await page.route('**/dm-close-harness', route => route.fulfill({ contentType: 'text/html', body: '<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>' }));
  await page.goto('/dm-close-harness');
  await page.evaluate(async () => {
    const { setupChat } = await import('/src/social.ts');
    const chat = setupChat(() => true, () => {});
    (window as any).chat = chat;
    chat.openDm('offline-player', 'Aina');
    chat.append('Aina', 'Jumpa nanti', undefined, false, false, 'dm', {id: 'offline-player', name: 'Aina'});
    chat.open();
  });
  await expect(page.locator('#chat-dms')).toBeVisible();
  await expect(page.locator('#chat-channel')).toContainText('@Aina');
  await expect(page.locator('#chat-form')).toBeVisible();
  await page.evaluate(() => (window as any).chat.closeDm('offline-player'));
  await expect(page.locator('#chat-dms')).toBeHidden();
  await expect(page.locator('#chat-channel')).toHaveText('ALL');
  await expect(page.locator('#chat-form')).toBeHidden();
});

// The two window controls belong together in the far-right corner, the way any other
// window says it. Fullscreen uses the second control as a close button.
test('the window controls sit in the far-right corner and both still work', async ({ page }) => {
  await page.route('**/chat-controls-harness', route => route.fulfill({ contentType: 'text/html', body: '<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>' }));
  await page.goto('/chat-controls-harness');
  await page.evaluate(async () => { const { setupChat } = await import('/src/social.ts'); (window as any).chat = setupChat(() => true, () => {}); });

  const placed = await page.evaluate(() => {
    const controls = document.querySelector('#chat-controls')!.getBoundingClientRect();
    const panel = document.querySelector('#city-chat')!.getBoundingClientRect();
    const title = document.querySelector('#chat-heading b')!.getBoundingClientRect();
    return { fromLeft: controls.left - panel.left, fromRight: panel.right - controls.right, afterTitle: controls.left >= title.right };
  });
  expect(placed.fromRight).toBeLessThan(12);
  expect(placed.fromRight).toBeLessThan(placed.fromLeft);
  // The title makes room for them rather than sitting underneath.
  expect(placed.afterTitle).toBe(true);
  const panel = (await page.locator('#city-chat').boundingBox())!, tab = await page.locator('#chat-visibility-toggle').boundingBox();
  expect(tab).not.toBeNull();
  expect(tab!.x).toBeGreaterThanOrEqual(panel.x + panel.width);

  await page.getByRole('button', { name: 'Hide city chat' }).click();
  await expect(page.locator('#city-chat')).toHaveClass(/chat-hidden/);
  await expect(page.getByRole('button', { name: 'Show city chat' })).toBeVisible();
  await page.getByRole('button', { name: 'Show city chat' }).click();
  await expect(page.locator('#city-chat')).not.toHaveClass(/chat-hidden/);

  const minimise = page.getByRole('button', { name: 'Minimise city chat' });
  await minimise.click();
  await expect(page.locator('#chat-body')).toBeHidden();
  await page.getByRole('button', { name: 'Restore city chat' }).click();
  await expect(page.locator('#chat-body')).toBeVisible();

  await page.getByRole('button', { name: 'Expand chat to a larger window' }).click();
  await expect(page.locator('#city-chat')).toHaveClass(/chat-expanded/);
  await expect(page.locator('#chat-min')).toBeHidden();
  await expect(page.locator('#chat-heading')).toBeDisabled();
  await page.getByRole('button', { name: 'Shrink chat back' }).click();
  await expect(page.locator('#city-chat')).not.toHaveClass(/chat-expanded/);

  // A minimised panel exposes only its restore control. Fullscreen becomes available again
  // after the player opens the chat, so mobile never shows two competing open actions.
  await minimise.click();
  await expect(page.getByRole('button', { name: 'Expand chat to a larger window' })).toBeHidden();
  await page.getByRole('button', { name: 'Restore city chat' }).click();
  await page.getByRole('button', { name: 'Expand chat to a larger window' }).click();
  await expect(page.locator('#chat-body')).toBeVisible();
  await page.getByRole('button', { name: 'Shrink chat back' }).click();
  await expect(page.locator('#city-chat')).not.toHaveClass(/chat-expanded/);
});

test('outer chat toggle uses arrows and slides the panel left while staying reachable', async ({ page }) => {
  await page.route('**/chat-arrow-harness', route => route.fulfill({ contentType: 'text/html', body: '<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>' }));
  await page.goto('/chat-arrow-harness');
  await page.evaluate(async () => { const { setupChat } = await import('/src/social.ts'); setupChat(() => true, () => {}); });

  const panel = page.locator('#city-chat'), toggle = page.locator('#chat-visibility-toggle');
  const openPanel = (await panel.boundingBox())!;
  await expect(toggle).toHaveText('<');
  await toggle.click();
  await expect(panel).toHaveClass(/chat-hidden/);
  await expect(toggle).toHaveText('>');
  await expect.poll(async () => (await panel.boundingBox())?.x ?? 0).toBeLessThan(openPanel.x - 100);
  const hiddenToggle = (await toggle.boundingBox())!;
  expect(hiddenToggle.x).toBeGreaterThanOrEqual(0);
  expect(hiddenToggle.x).toBeLessThan(60);
  await toggle.click();
  await expect(panel).not.toHaveClass(/chat-hidden/);
  await expect(toggle).toHaveText('<');
});

test('hidden chat keeps a new-message count on the outer toggle', async ({ page }) => {
  await page.route('**/chat-hidden-unread-harness', route => route.fulfill({ contentType: 'text/html', body: '<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>' }));
  await page.goto('/chat-hidden-unread-harness');
  await page.evaluate(async () => { const { setupChat } = await import('/src/social.ts'); (window as any).chat = setupChat(() => true, () => {}); });

  const toggle = page.locator('#chat-visibility-toggle');
  await toggle.click();
  await page.evaluate(() => (window as any).chat.append('Aina', 'Jom mamak'));
  await expect(page.locator('#chat-hidden-unread-badge')).toHaveText('1');
  await expect(toggle).toHaveAttribute('aria-label', 'Show city chat, 1 unread messages');
  await toggle.click();
  await expect(page.locator('#chat-hidden-unread-badge')).toBeHidden();
});
