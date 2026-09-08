import { createClient } from '@supabase/supabase-js';
import catalog from '../shared/shop.json' with { type: 'json' };

export function createShop(onEquip = () => {}, services = {}) {
  const db = services.db || (process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null);
  const origins = new Set([
    'https://lepakmamak.my', 'https://lepakmamak.pages.dev', 'https://lepak-city.pages.dev',
    'http://localhost:5173', 'http://localhost:4173',
  ]);
  const check = result => { if (result.error) throw Error('Database operation failed'); return result.data; };
  const inventory = async userId => db ? check(await db.from('shop_inventory').select('sku,equipped').eq('user_id', userId)) : [];
  const accessories = async userId => (await inventory(userId)).filter(item => item.equipped).map(item => item.sku);
  const wallet = async userId => check(await db.rpc('game_wallet_get', { p_user_id: userId }));

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
    if (url.pathname === '/shop/webhook' && request.method === 'POST') { reply(200, { received: true, retired: true }); return true; }
    if (url.pathname === '/shop/catalog' && request.method === 'GET') { reply(200, { items: catalog, available: !!db }); return true; }
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

      if (url.pathname === '/shop/equip') {
        const item = catalog.find(candidate => candidate.id === input.sku);
        if (!item || typeof input.equipped !== 'boolean') { reply(400, { error: 'Invalid item.' }); return true; }
        const owned = (await inventory(userId)).some(record => record.sku === item.id);
        if (!owned) { reply(403, { error: 'You do not own this item.' }); return true; }
        if (input.equipped && item.type === 'skin') {
          const skinIds = catalog.filter(candidate => candidate.type === 'skin').map(candidate => candidate.id);
          check(await db.from('shop_inventory').update({ equipped: false }).eq('user_id', userId).in('sku', skinIds));
        }
        check(await db.from('shop_inventory').update({ equipped: input.equipped }).eq('user_id', userId).eq('sku', item.id));
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
