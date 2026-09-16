import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import catalog from '../shared/shop.json' with { type: 'json' };
import currencyPacks from '../shared/currency-packs.json' with { type: 'json' };
import crypto from 'node:crypto';
import { origins } from '../shared/origins.mjs';

export function createShop(onEquip = () => {}, services = {}) {
  const db = services.db || (process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null);
  const stripe = services.stripe || (process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-07-29.dahlia' })
    : null);
  const webhookSecret = services.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
  const check = result => { if (result.error) throw Error('Database operation failed'); return result.data; };
  const inventory = async userId => db ? check(await db.from('shop_inventory').select('sku,equipped').eq('user_id', userId)) : [];
  const accessories = async userId => (await inventory(userId)).filter(item => item.equipped).map(item => item.sku);
  const wallet = async userId => check(await db.rpc('game_wallet_get', { p_user_id: userId }));
  const creditSession = async session => {
    if (session.payment_status !== 'paid') return null;
    const pack = currencyPacks.find(candidate => candidate.id === session.metadata?.pack_id);
    if (!pack || String(pack.credits) !== session.metadata?.credits || !session.metadata?.user_id || !session.id?.startsWith('cs_')) throw Error('Invalid Checkout Session metadata');
    return check(await db.rpc('game_wallet_credit_stripe', { p_user_id: session.metadata.user_id, p_amount: pack.credits, p_session_id: session.id }));
  };

  async function readBody(request) {
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 65536) throw Error('Request too large'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith('/shop/')) return false;
    const requestOrigin = request.headers.origin;
    const reply = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
    };
    if (requestOrigin && origins.has(requestOrigin)) {
      response.setHeader('Access-Control-Allow-Origin', requestOrigin); response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') { response.writeHead(origins.has(requestOrigin) ? 204 : 403); response.end(); return true; }
    if (requestOrigin && !origins.has(requestOrigin)) { reply(403, { error: 'Origin not allowed' }); return true; }
    if (url.pathname === '/shop/webhook' && request.method === 'POST') {
      if (!stripe || !webhookSecret || !db) { reply(503, { error: 'Payments are not configured.' }); return true; }
      try {
        const signature = request.headers['stripe-signature'];
        if (typeof signature !== 'string') throw Error('Missing signature');
        const chunks = []; let size = 0;
        for await (const chunk of request) { size += chunk.length; if (size > 1048576) throw Error('Request too large'); chunks.push(chunk); }
        const event = await stripe.webhooks.constructEventAsync(Buffer.concat(chunks), signature, webhookSecret);
        if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') await creditSession(event.data.object);
        reply(200, { received: true });
      } catch { reply(400, { error: 'Invalid webhook.' }); }
      return true;
    }
    if (url.pathname === '/shop/catalog' && request.method === 'GET') { reply(200, { items: catalog, packs: currencyPacks, available: !!db, paymentsAvailable: !!db && !!stripe }); return true; }
    if (!db) { reply(503, { error: 'The shop is not available yet.' }); return true; }

    try {
      const token = request.headers.authorization?.replace(/^Bearer /, '');
      const { data, error } = await db.auth.getUser(token || '');
      if (error || !data.user || data.user.is_anonymous) { reply(401, { error: 'Please log in again.' }); return true; }
      const userId = data.user.id;
      if (url.pathname === '/shop/inventory' && request.method === 'GET') {
        reply(200, { items: await inventory(userId), ...(await wallet(userId)) }); return true;
      }
      if (request.method !== 'POST') { reply(405, { error: 'Method not allowed' }); return true; }
      const input = await readBody(request);

      if (url.pathname === '/shop/buy') {
        const item = catalog.find(candidate => candidate.id === input.sku);
        if (!item) { reply(400, { error: 'Unknown item.' }); return true; }
        const result = check(await db.rpc('game_shop_buy', { p_user_id: userId, p_sku: item.id }));
        if (!result.purchased) {
          reply(409, { error: result.reason === 'insufficient' ? 'Not enough Syiling Lepak.' : 'You already own this item.', ...result }); return true;
        }
        reply(200, { ...result, items: await inventory(userId) }); return true;
      }

      if (url.pathname === '/shop/daily') {
        const result = check(await db.rpc('game_wallet_claim_daily', { p_user_id: userId }));
        reply(result.claimed ? 200 : 409, { ...result, ...(!result.claimed ? { error: 'Daily reward already claimed.' } : {}) }); return true;
      }

      if (url.pathname === '/shop/checkout') {
        if (!stripe) { reply(503, { error: 'Stripe Checkout is not available.' }); return true; }
        const pack = currencyPacks.find(candidate => candidate.id === input.packId);
        if (!pack) { reply(400, { error: 'Unknown Syiling Lepak pack.' }); return true; }
        const origin = requestOrigin && origins.has(requestOrigin) ? requestOrigin : 'https://lepakmamak.my';
        const checkout = await stripe.checkout.sessions.create({
          mode: 'payment',
          integration_identifier: `lepakmamak_${crypto.randomBytes(8).toString('hex').slice(0, 8).replace(/[0-9]/g, 'a')}`,
          client_reference_id: userId,
          customer_email: data.user.email || undefined,
          line_items: [{ quantity: 1, price_data: { currency: 'myr', unit_amount: pack.amount, product_data: { name: `${pack.credits.toLocaleString('en-MY')} Syiling Lepak`, description: `${pack.name} untuk akaun LepakMamak` } } }],
          metadata: { user_id: userId, pack_id: pack.id, credits: String(pack.credits) },
          success_url: `${origin}/?coins=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/?coins=cancelled`,
        });
        reply(200, { url: checkout.url }); return true;
      }

      if (url.pathname === '/shop/checkout-status') {
        if (!stripe || typeof input.sessionId !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(input.sessionId)) { reply(400, { error: 'Invalid Checkout Session.' }); return true; }
        const checkout = await stripe.checkout.sessions.retrieve(input.sessionId);
        if (checkout.client_reference_id !== userId || checkout.metadata?.user_id !== userId) { reply(403, { error: 'This payment belongs to another account.' }); return true; }
        const credited = await creditSession(checkout);
        if (!credited) { reply(202, { pending: true, ...(await wallet(userId)) }); return true; }
        reply(200, { ...credited, ...(await wallet(userId)), items: await inventory(userId) }); return true;
      }

      if (url.pathname === '/shop/equip') {
        const item = catalog.find(candidate => candidate.id === input.sku);
        if (!item || typeof input.equipped !== 'boolean') { reply(400, { error: 'Invalid item.' }); return true; }
        const owned = (await inventory(userId)).some(record => record.sku === item.id);
        if (!owned) { reply(403, { error: 'You do not own this item.' }); return true; }
        if (item.type.startsWith('pet')) {
          check(await db.rpc('game_pet_equip', { p_user_id: userId, p_sku: item.id, p_equipped: input.equipped }));
        } else {
          if (input.equipped && item.type === 'skin') {
            const skinIds = catalog.filter(candidate => candidate.type === 'skin').map(candidate => candidate.id);
            check(await db.from('shop_inventory').update({ equipped: false }).eq('user_id', userId).in('sku', skinIds));
          }
          check(await db.from('shop_inventory').update({ equipped: input.equipped }).eq('user_id', userId).eq('sku', item.id));
        }
        const equipped = await accessories(userId); onEquip(userId, equipped);
        reply(200, { items: await inventory(userId), ...(await wallet(userId)) }); return true;
      }

      reply(404, { error: 'Not found' });
    } catch {
      reply(500, { error: 'Could not complete this request. Please try again.' });
    }
    return true;
  }

  return { handle, accessories };
}
