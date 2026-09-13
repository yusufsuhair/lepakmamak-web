import {test, expect, type BrowserContext, type Page} from '@playwright/test';
import {spawn} from 'node:child_process';

// The client under test is built against ws://127.0.0.1:8199 (playwright.config.ts). Every other
// spec intercepts that socket; this one puts the real dev server (no Supabase) behind it.
const API = 'http://127.0.0.1:8199';

// The dev server only answers CORS for real origins and 127.0.0.1:<port> is not one, so HTTP to
// it goes through Playwright with Origin stripped. The WebSocket connects directly.
async function throughProxy(context: BrowserContext) {
  const cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS'};
  await context.route(`${API}/**`, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: cors});
    const headers = {...route.request().headers()};
    delete headers.origin;
    const response = await route.fetch({headers});
    return route.fulfill({response, headers: {...response.headers(), ...cors}});
  });
}

async function enter(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', {name: "Jom, let's go"}).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill(name);
  await page.getByRole('button', {name: 'Enter as guest', exact: true}).click();
}

// On dev a guest's stand-in is handed its handle, so the city opens with no claim screen.
// The claim screen itself is proven in tests/handle-claim.spec.ts and, for real accounts,
// in tests/messages-socket.spec.ts.
async function inCity(page: Page) {
  await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE', {timeout: 90000});
  await expect(page.locator('#open-friends')).toBeVisible();
  await expect(page.getByRole('dialog', {name: 'Pick your @handle'})).toBeHidden();
}

test('dev guests get a handle automatically, find a friend, message them offline, see the unread chip on return, report and block', async ({browser}) => {
  test.setTimeout(420000);
  const server = spawn(process.execPath, ['server/index.mjs'], {env: {...process.env, PORT: '8199', ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SERVICE_ROLE_KEY: ''}, stdio: 'ignore'});
  const alyaContext = await browser.newContext();
  const badrulContext = await browser.newContext();
  try {
    await expect.poll(async () => { try { return (await fetch(`${API}/health`)).ok; } catch { return false; } }, {timeout: 30000}).toBe(true);
    await throughProxy(alyaContext);
    await throughProxy(badrulContext);
    const alya = await alyaContext.newPage();
    const badrul = await badrulContext.newPage();
    const badrulFrames: any[] = [];
    badrul.on('websocket', socket => socket.on('framesent', frame => { try { badrulFrames.push(JSON.parse(String(frame.payload))); } catch { /* binary */ } }));

    await enter(badrul, 'Badrul');
    await inCity(badrul);
    await enter(alya, 'Alya');
    await inCity(alya);

    // Search by handle, then the existing friend request flow.
    await alya.locator('#open-friends').click();
    await alya.getByRole('searchbox', {name: 'Search players by handle'}).fill('@bad');
    const result = alya.locator('.friend-result', {hasText: '@badrul'});
    await expect(result).toContainText('Online');
    await result.getByRole('button', {name: 'Add friend'}).click();
    await expect(result.getByRole('button', {name: 'Pending'})).toBeDisabled();

    await badrul.locator('#open-friends').click();
    await badrul.locator('#friends-incoming').getByRole('button', {name: 'Accept'}).click();
    await expect(badrul.locator('#friends-list')).toContainText('Alya');
    await badrul.getByRole('button', {name: 'Close Friends'}).click();

    // Badrul leaves. The tab keeps its stand-in for when he comes back, like a returning account.
    await badrul.goto('about:blank');
    await alya.getByRole('searchbox', {name: 'Search players by handle'}).fill('badrul');
    await expect(result).toContainText('Offline', {timeout: 15000});
    await expect(result.getByRole('button', {name: 'Friends'})).toBeDisabled();
    await result.getByRole('button', {name: 'Message'}).click();
    await expect(alya.getByRole('dialog', {name: 'Friends'})).toBeHidden();
    await alya.locator('#chat-input').fill('Jumpa esok kat mamak');
    await alya.locator('#chat-input').press('Enter');
    const alyaLog = alya.locator('.chat-log:not([hidden])');
    await expect(alyaLog.locator('p[data-key]')).toContainText(['Jumpa esok kat mamak']);
    await expect(alyaLog.locator('.chat-note')).toHaveText(["They'll see this when they're back online."]);

    // Badrul returns: no claim screen, and the conversation is waiting with its count.
    await enter(badrul, 'Badrul');
    const chip = badrul.getByRole('button', {name: 'Private messages with @alya, 1 unread'});
    await expect(chip).toBeVisible({timeout: 90000});
    await expect(badrul.getByRole('dialog', {name: 'Pick your @handle'})).toBeHidden();
    await chip.click();
    await expect(badrul.locator('.chat-log:not([hidden])')).toContainText('Jumpa esok kat mamak');

    // Report from the conversation header: the dm surface, and the server attaches the messages.
    await badrul.getByRole('button', {name: 'Report @alya'}).click();
    await expect(badrul.locator('#report-player-dialog')).toBeVisible();
    await expect(badrul.locator('#report-surface')).toHaveValue('dm');
    await badrul.getByRole('button', {name: 'Send report'}).click();
    await expect.poll(() => badrulFrames.find(frame => frame.type === 'report')).toMatchObject({surface: 'dm', userId: expect.any(String)});
    expect(Object.keys(badrulFrames.find(frame => frame.type === 'report'))).not.toContain('evidence');

    // Block, and Alya's next message is refused without revealing why.
    badrul.once('dialog', dialog => void dialog.accept());
    await badrul.getByRole('button', {name: 'Block @alya'}).click();
    await expect(badrul.getByRole('button', {name: /Private messages with @alya/})).toHaveCount(0);
    await alya.locator('#chat-compose').click();
    await alya.locator('#chat-input').fill('Hello?');
    await alya.locator('#chat-input').press('Enter');
    await expect(alyaLog.locator('.chat-note').last()).toHaveText("You can't message this player.");
  } finally {
    // Kill the server first: a context that fails to close must not leave 8199 held.
    server.kill();
    await alyaContext.close().catch(() => {});
    await badrulContext.close().catch(() => {});
  }
});
