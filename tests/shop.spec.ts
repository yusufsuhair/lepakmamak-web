import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';

test('currency shop authorizes accounts and uses server-owned wallet operations', async () => {
  const rows: {sku:string;equipped:boolean}[] = [];
  const rpcCalls: {name:string;params:any}[] = [];
  const updates: {values:any;filters:Record<string,unknown>;inside?:string[]}[] = [];
  let insufficient = false, equippedBroadcast: string[] = [];
  let credited = false;
  const db:any = {
    auth: { getUser: async (token:string) => ({ data: { user: token === 'valid' ? { id: 'u1', email: 'player@example.com', is_anonymous: false } : null }, error: token === 'valid' ? null : {} }) },
    rpc: async (name:string, params:any) => {
      rpcCalls.push({name,params});
      if (name === 'game_wallet_get') return { data: { balance: credited ? 1000 : 500, dailyAvailable: true, nextDailyAt: null }, error: null };
      if (name === 'game_wallet_claim_daily') return { data: { claimed: true, balance: 600, dailyAvailable: false, nextDailyAt: '2026-09-09T00:00:00Z' }, error: null };
      if (name === 'game_shop_buy') {
        if (insufficient) return { data: { purchased: false, reason: 'insufficient', balance: 10 }, error: null };
        if (!rows.some(row => row.sku === params.p_sku)) rows.push({ sku: params.p_sku, equipped: false });
        return { data: { purchased: true, balance: 350 }, error: null };
      }
      if (name === 'game_pet_equip') {
        const slot = params.p_sku.startsWith('pet-collar-') ? ['pet-collar-red','pet-collar-teal'] : ['pet-ginger','pet-cream'];
        for (const row of rows) if (slot.includes(row.sku)) row.equipped = row.sku === params.p_sku && params.p_equipped;
        return {data:null,error:null};
      }
      if (name === 'game_wallet_credit_stripe') { const first = !credited; credited = true; return { data: { credited: first, balance: 1000 }, error: null }; }
      return { data: null, error: {} };
    },
    from: (table:string) => {
      const filters:Record<string,unknown> = {}; let values:any = null, inside:string[]|undefined;
      const query:any = {
        select: () => query,
        update: (next:any) => { values = next; return query; },
        eq: (key:string, value:unknown) => { filters[key] = value; return query; },
        in: (_key:string, value:string[]) => { inside = value; return query; },
        then: (resolve:any) => {
          if (values && table === 'shop_inventory') {
            updates.push({values,filters:{...filters},inside});
            for (const row of rows) if ((!filters.user_id || filters.user_id === 'u1') && (!filters.sku || filters.sku === row.sku) && (!inside || inside.includes(row.sku))) Object.assign(row, values);
          }
          const data = table === 'shop_inventory' ? rows.filter(row => !filters.sku || filters.sku === row.sku) : [];
          resolve({ data, error: null });
        },
      };
      return query;
    },
  };
  const paidSession = { id: 'cs_paid_123', payment_status: 'paid', client_reference_id: 'u1', metadata: { user_id: 'u1', pack_id: 'lepak-500', credits: '500' } };
  const stripe:any = {
    checkout: { sessions: { create: async (input:any) => ({ id: 'cs_new', url: 'https://checkout.stripe.com/c/pay/cs_new', input }), retrieve: async () => paidSession } },
    webhooks: { constructEventAsync: async () => ({ type: 'checkout.session.completed', data: { object: paidSession } }) },
  };
  const { createShop } = await import('../server/shop.mjs');
  const shop = createShop((_userId:string, items:string[]) => { equippedBroadcast = items; }, { db, stripe, webhookSecret: 'whsec_test' });
  const server = createServer((request, response) => void shop.handle(request, response));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const call = (path:string, method='GET', body:any=undefined, token='valid') => fetch(`http://127.0.0.1:${address.port}/shop/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const catalog = await (await call('catalog')).json();
    expect(catalog.items).toHaveLength(8); expect(catalog.packs).toHaveLength(3); expect(catalog.paymentsAvailable).toBe(true);
    expect(catalog.items.every((item:any) => Number.isInteger(item.price) && !('amount' in item))).toBe(true);
    expect((await call('webhook', 'POST', {}, 'bad')).status).toBe(400);
    expect((await call('inventory', 'GET', undefined, 'bad')).status).toBe(401);
    expect(await (await call('inventory')).json()).toMatchObject({ balance: 500, dailyAvailable: true, items: [] });
    expect((await call('buy', 'POST', { sku: 'forged' })).status).toBe(400);
    expect(await (await call('buy', 'POST', { sku: 'cap' })).json()).toMatchObject({ purchased: true, balance: 350, items: [{sku:'cap',equipped:false}] });
    insufficient = true; expect(await (await call('buy', 'POST', { sku: 'batik' })).json()).toMatchObject({ reason: 'insufficient', balance: 10 });
    rows.push({sku:'batik',equipped:false},{sku:'harimau',equipped:true});
    expect((await call('equip', 'POST', { sku: 'batik', equipped: true })).status).toBe(200);
    expect(rows.find(row => row.sku === 'harimau')?.equipped).toBe(false); expect(rows.find(row => row.sku === 'batik')?.equipped).toBe(true);
    expect(equippedBroadcast).toEqual(['batik']); expect(updates.some(update => update.inside?.includes('harimau'))).toBe(true);
    expect((await call('equip', 'POST', {sku:'pet-ginger',equipped:true})).status).toBe(403);
    rows.push({sku:'pet-ginger',equipped:true},{sku:'pet-cream',equipped:false},{sku:'pet-collar-red',equipped:true},{sku:'pet-collar-teal',equipped:false});
    expect((await call('equip', 'POST', {sku:'pet-cream',equipped:true})).status).toBe(200);
    expect(rows.find(row=>row.sku==='pet-ginger')?.equipped).toBe(false);
    expect((await call('equip', 'POST', {sku:'pet-collar-teal',equipped:true})).status).toBe(200);
    expect(equippedBroadcast).toEqual(['batik','pet-cream','pet-collar-teal']);
    expect(rpcCalls.filter(call=>call.name==='game_pet_equip')).toHaveLength(2);
    expect(await (await call('daily', 'POST', {})).json()).toMatchObject({ claimed: true, balance: 600 });
    const checkout = await (await call('checkout', 'POST', { packId: 'lepak-500' })).json();
    expect(checkout.url).toContain('checkout.stripe.com');
    expect((await call('checkout', 'POST', { packId: 'forged' })).status).toBe(400);
    expect(await (await call('checkout-status', 'POST', { sessionId: 'cs_paid_123' })).json()).toMatchObject({ balance: 1000, items: expect.arrayContaining([{ sku: 'cap', equipped: false }]) });
    const webhook = await fetch(`http://127.0.0.1:${address.port}/shop/webhook`, { method: 'POST', headers: { 'stripe-signature': 'signed' }, body: '{}' });
    expect(webhook.status).toBe(200); expect(await webhook.json()).toEqual({ received: true });
    expect(rpcCalls.filter(call => call.name === 'game_wallet_credit_stripe')).toHaveLength(2);
    expect(rpcCalls.map(call => call.name)).toContain('game_shop_buy');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('shop UI offers Stripe Lepak Coin top-ups', async ({ page }) => {
  await page.route('**/src/auth.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const session={access_token:"test"};' }));
  await page.route('http://shop.test/shop/catalog', route => route.fulfill({ json: { available: true, paymentsAvailable: true, items: [] }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('http://shop.test/shop/inventory', route => route.fulfill({ json: { balance: 500, dailyAvailable: true, nextDailyAt: null, items: [] }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/currency-shop', route => route.fulfill({ contentType: 'text/html', body: '<link rel="stylesheet" href="/src/style.css"><main></main>' }));
  await page.goto('/currency-shop');
  await page.evaluate(async () => { const { setupShop } = await import('/src/shop.ts'); setupShop(() => {}, 'http://shop.test').open(); });
  await expect(page.locator('#item-shop')).toBeVisible();
  await expect(page.locator('#shop-balance')).toContainText('🪙 500');
  await expect(page.getByText('Add Lepak Coin')).toBeVisible();
  await expect(page.locator('#coin-packs button')).toHaveCount(3);
  await expect(page.locator('#coin-packs')).toContainText('RM 5.00');
  await expect(page.locator('#coin-packs')).toContainText('RM 20.00');
  await expect(page.getByRole('button', { name: /Buy · 🪙/ })).toHaveCount(8);
  await expect(page.locator('#item-shop')).toContainText('STRIPE CHECKOUT');
});

test('purchased Malaysian skins add their distinct outfit materials', async ({ page }) => {
  await page.route('**/skin-harness', route => route.fulfill({ contentType: 'text/html', body: '<main></main>' }));
  await page.goto('/skin-harness');
  const colors = await page.evaluate(async () => {
    const { createPerson, applyAccessories } = await import('/src/world.ts');
    const person = createPerson();
    const inspect = () => {
      const found:string[] = [];
      person.group.getObjectByName('shop-accessories')!.traverse((object:any) => { const hex = object.material?.color?.getHexString?.(); if (hex) found.push(hex); });
      return found;
    };
    applyAccessories(person.group, ['batik']); const batik = inspect();
    applyAccessories(person.group, ['harimau']); const harimau = inspect();
    return { batik, harimau };
  });
  expect(colors.batik).toEqual(expect.arrayContaining(['244f75', 'e2b94e']));
  expect(colors.harimau).toEqual(expect.arrayContaining(['efc62f', '202b2d']));
  expect(colors.harimau).not.toContain('244f75');
});
