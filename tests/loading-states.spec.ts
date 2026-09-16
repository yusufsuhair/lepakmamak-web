import {test, expect} from '@playwright/test';

// Both panels used to fill the gap before their first response with zeroes: no coins, nothing
// equipped, nothing owned, every item offered for sale. Every one of those is a claim about
// the account, and all of them were wrong for as long as the request was in flight. These
// tests hold the response open so the gap can be looked at.

const blank = async (page: any, width: number) => {
  await page.setViewportSize({width, height: 900});
  await page.route('**/loading-harness', (route: any) => route.fulfill({contentType: 'text/html', body: '<div id="hud"></div>'}));
  await page.goto('/loading-harness');
};

test('the character screen says what it knows and no more while the collection is in flight', async ({page}) => {
  await blank(page, 1280);
  await page.evaluate(async () => {
    const {setupInventory} = await import('/src/inventory.ts');
    let land: (value: unknown) => void = () => {};
    (window as any).land = () => land({items: [{sku: 'cap', equipped: true}, {sku: 'batik', equipped: false}], balance: 1250});
    const api = {inventory: () => new Promise(resolve => {land = resolve;}), equip: async () => ({items: [], balance: 0})};
    setupInventory(api as any, () => {}).open();
  });

  const balance = page.locator('.inventory-balance');
  await expect(balance.locator('.skel')).toHaveCount(1);
  // The old screen said "🪙 0" here, which reads as an empty wallet rather than an unread one.
  await expect(balance).not.toContainText('🪙 0');
  await expect(page.locator('.equipment-slots')).not.toContainText('Empty');
  await expect(page.locator('.equipment-slots')).toContainText('Head');
  await expect(page.locator('.inventory-grid .skel').first()).toBeVisible();
  await expect(page.locator('.inventory-status')).toHaveText('Loading inventory…');
  await page.screenshot({path: 'test-results/loading-inventory-desktop.png'});

  await page.evaluate(() => (window as any).land());
  await expect(balance).toHaveText('1,250 Lepak Coin');
  // Nothing shimmering once the answer is in.
  await expect(page.locator('#inventory .skel')).toHaveCount(0);
  await expect(page.locator('.equipment-slots')).toContainText('Lepak Cap');
});

test('the character screen keeps its placeholders honest on a phone', async ({page}) => {
  await blank(page, 390);
  await page.evaluate(async () => {
    const {setupInventory} = await import('/src/inventory.ts');
    const api = {inventory: () => new Promise(() => {}), equip: async () => ({items: [], balance: 0})};
    setupInventory(api as any, () => {}).open();
  });
  await expect(page.locator('.inventory-balance .skel')).toHaveCount(1);
  await page.screenshot({path: 'test-results/loading-inventory-mobile.png'});
});

test('the shop offers nothing for sale until it knows what is already owned', async ({page}) => {
  await blank(page, 1280);
  let open: () => void = () => {};
  const held = new Promise<void>(resolve => {open = resolve;});
  await page.route('**/shop/catalog', async (route: any) => {
    await held;
    await route.fulfill({contentType: 'application/json', body: JSON.stringify({available: true, paymentsAvailable: false})});
  });
  await page.route('**/shop/inventory', (route: any) =>
    route.fulfill({contentType: 'application/json', body: JSON.stringify({items: [{sku: 'cap', equipped: false}], balance: 900, dailyAvailable: true, nextDailyAt: null})}));
  await page.evaluate(async () => {
    await import('/src/style.css');
    const {setupShop} = await import('/src/shop.ts');
    setupShop(() => {}, 'http://shop.test').open();
  });

  await expect(page.locator('#shop-balance .skel')).toHaveCount(1);
  await expect(page.locator('#shop-balance')).not.toContainText('🪙 0');
  await expect(page.locator('#shop-daily .skel')).toHaveCount(1);
  // Every card used to say Buy while the inventory was still loading, including for items
  // already paid for.
  await expect(page.locator('#shop-items button', {hasText: 'Buy'})).toHaveCount(0);
  await expect(page.locator('#shop-items .skel').first()).toBeVisible();
  // The parts that come from the bundled catalogue are known immediately and are not hidden.
  await expect(page.locator('#shop-items')).toContainText('Lepak Cap');
  await expect(page.locator('#shop-message')).toHaveText('Loading shop…');
  await page.screenshot({path: 'test-results/loading-shop-desktop.png'});

  open();
  // Nobody is signed in here, so the catalogue lands but no wallet does. A zero would be a
  // claim about an account that does not exist; the dash is the truth.
  await expect(page.locator('#shop-balance')).toHaveText('🪙 —');
  await expect(page.locator('#shop-daily')).toHaveText('Claim daily · +100');
  await expect(page.locator('#item-shop .skel')).toHaveCount(0);
  // Prices come from the bundled catalogue, so they are shown even signed out.
  await expect(page.locator('#shop-items button', {hasText: 'Buy'}).first()).toBeVisible();
});
