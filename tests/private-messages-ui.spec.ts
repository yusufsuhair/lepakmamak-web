import {test, expect, type Page} from '@playwright/test';

const mount = async (page: Page) => {
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType: 'application/javascript', body: `export const session={access_token:'tok',user:{id:'me'}};export let guestName='';export const displayName=()=>'Me';`}));
  await page.route('**/pm-harness', route => route.fulfill({contentType: 'text/html', body: '<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>'}));
  await page.goto('/pm-harness');
  await page.evaluate(async () => {
    const {setupChat} = await import('/src/social.ts');
    const {setupInbox} = await import('/src/inbox.ts');
    const w = window as any;
    w.reports = []; w.toasts = [];
    w.chat = setupChat((text: string, channel: string, to?: string) => channel === 'pm' ? w.inbox.send(to, text) : true, () => {}, {
      opened: (id: string) => void w.inbox.opened(id),
      older: (id: string) => w.inbox.older(id),
      block: (id: string) => void w.inbox.block(id),
      report: (id: string) => w.inbox.report(id),
    });
    w.inbox = setupInbox('http://pm.test', w.chat.pm, {me: () => 'Me', toast: (title: string, body: string) => w.toasts.push({title, body}), report: (peer: unknown) => w.reports.push(peer)});
  });
};
const at = (seconds: number) => new Date(Date.parse('2026-09-13T09:00:00.000Z') + seconds * 1000).toISOString();

test('unread conversations appear at login as chips; opening one loads it, marks it read, and pages older ones in', async ({page}) => {
  const read: string[] = [], pages: string[] = [];
  await page.route('http://pm.test/messages/unread', route => route.fulfill({json: {threads: [{userId: 'u-alya', handle: 'alya', name: 'Alya', unread: 2, lastAt: at(39)}]}}));
  await page.route(url => url.hostname === 'pm.test' && url.pathname.startsWith('/messages/u-alya'), route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/read')) { read.push('u-alya'); return route.fulfill({json: {}}); }
    const before = url.searchParams.get('before') || '';
    pages.push(before);
    const lines = before ? Array.from({length: 10}, (_, n) => n) : Array.from({length: 30}, (_, n) => n + 10);
    return route.fulfill({json: {more: !before, messages: lines.map(n => ({id: `m${n}`, from: n % 2 ? 'me' : 'u-alya', to: n % 2 ? 'u-alya' : 'me', body: `line ${n}`, clientId: `c${n}`, sentAt: at(n)}))}});
  });
  await mount(page);
  await page.evaluate(() => (window as any).inbox.login());

  const chip = page.getByRole('button', {name: 'Private messages with @alya, 2 unread'});
  await expect(chip).toBeVisible();
  await chip.click();
  const log = page.locator('.chat-log:not([hidden])');
  await expect(log.locator('p[data-key]')).toHaveCount(30);
  await expect(log).toContainText('line 39');
  await expect.poll(() => read).toEqual(['u-alya']);
  await expect(page.getByRole('button', {name: 'Private messages with @alya', exact: true})).toBeVisible();

  await log.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  await expect(log.locator('p[data-key]')).toHaveCount(40);
  await expect(log.locator('p[data-key]').first()).toContainText('line 0');
  expect(pages).toEqual(['', at(10)]);
});

test('sending: the offline note shows once, a lost connection keeps a retry with the same client id', async ({page}) => {
  const posts: any[] = [];
  let mode: 'offline' | 'drop' | 'blocked' = 'offline';
  await page.route('http://pm.test/messages', route => {
    const body = route.request().postDataJSON();
    posts.push(body);
    if (mode === 'drop') { mode = 'offline'; return route.abort('internetdisconnected'); }
    if (mode === 'blocked') return route.fulfill({status: 403, json: {error: "You can't message this player."}});
    return route.fulfill({json: {online: false, message: {id: `id-${posts.length}`, from: 'me', to: 'u-badrul', body: body.body, clientId: body.clientId, sentAt: new Date().toISOString()}}});
  });
  await page.route(url => url.hostname === 'pm.test' && url.pathname.startsWith('/messages/u-badrul'), route => route.fulfill({json: route.request().url().endsWith('/read') ? {} : {messages: [], more: false}}));
  await mount(page);
  await page.evaluate(() => (window as any).inbox.open({userId: 'u-badrul', handle: 'badrul', name: 'Badrul'}));
  const log = page.locator('.chat-log:not([hidden])');
  const type = async (text: string) => {
    await page.locator('#chat-compose').click();
    await page.locator('#chat-input').fill(text);
    await page.locator('#chat-input').press('Enter');
  };

  await type('jumpa esok');
  await expect(log.locator('p[data-key]')).toContainText(['jumpa esok']);
  await expect(log.locator('.chat-note')).toHaveText(["They'll see this when they're back online."]);
  await type('kat mamak');
  await expect(log.locator('p[data-key]')).toHaveCount(2);
  await expect(log.locator('.chat-note')).toHaveCount(1);

  mode = 'drop';
  await type('dah sampai?');
  const failed = log.locator('.chat-note', {hasText: 'Not sent'});
  await expect(failed).toBeVisible();
  await failed.getByRole('button', {name: 'Retry'}).click();
  await expect(log.locator('p[data-key]', {hasText: 'dah sampai?'})).toHaveCount(1);
  await expect(failed).toHaveCount(0);
  expect(posts[3]).toEqual(posts[2]);

  mode = 'blocked';
  await type('hello?');
  await expect(log.locator('.chat-note').last()).toHaveText("You can't message this player.");
});

test('a pushed message lands in its own conversation; Block and Report sit in the conversation header', async ({page}) => {
  let blocked: unknown = null;
  const message = {id: 'x1', from: 'u-chong', to: 'me', body: 'yo', clientId: 'k1', sentAt: at(1)};
  await page.route('http://pm.test/blocks', route => { blocked = route.request().postDataJSON(); return route.fulfill({json: {}}); });
  await page.route(url => url.hostname === 'pm.test' && url.pathname.startsWith('/messages/u-chong'), route => route.fulfill({json: route.request().url().endsWith('/read') ? {} : {messages: [message], more: false}}));
  await mount(page);
  await page.evaluate(m => (window as any).inbox.receive(m, {userId: 'u-chong', handle: 'chong', name: 'Chong'}), message);

  const chip = page.getByRole('button', {name: 'Private messages with @chong, 1 unread'});
  await expect(chip).toBeVisible();
  await expect(page.getByRole('button', {name: 'Block @chong'})).toBeHidden();
  await chip.click();
  await expect(page.locator('.chat-log:not([hidden]) p[data-key]')).toHaveCount(1);
  await expect(page.locator('#chat-input')).toHaveAttribute('maxlength', '500');

  await page.getByRole('button', {name: 'Report @chong'}).click();
  expect(await page.evaluate(() => (window as any).reports)).toEqual([{userId: 'u-chong', handle: 'chong', name: 'Chong'}]);

  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', {name: 'Block @chong'}).click();
  await expect(page.getByRole('button', {name: /Private messages with @chong/})).toHaveCount(0);
  expect(blocked).toEqual({userId: 'u-chong'});
  expect(await page.evaluate(() => (window as any).toasts)).toEqual([{title: 'Blocked', body: "@chong can't message you any more."}]);
});
