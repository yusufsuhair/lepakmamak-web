import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import catalog from '../shared/shop.json' with { type: 'json' };
export function createShop(onEquip = () => {}, services = {}) {
 const secret = process.env.STRIPE_SECRET_KEY;
 const stripe = services.stripe || (secret ? new Stripe(secret) : null);
 const db = services.db || (process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false, autoRefreshToken:false } }) : null);
 const prices = { spectacles: process.env.STRIPE_PRICE_SPECTACLES, cap: process.env.STRIPE_PRICE_CAP };
 const origin = process.env.SHOP_ORIGIN || 'https://lepakmamak.my';
 const origins = new Set([origin,'https://lepakmamak.pages.dev','https://lepak-city.pages.dev','http://localhost:5173','http://localhost:4173']);
 const ready = !!(stripe && db && process.env.STRIPE_WEBHOOK_SECRET && Object.values(prices).every(Boolean));
 const check = result => { if(result.error) throw Error('Database operation failed'); return result.data; };
 async function inventory(id) { return db ? check(await db.from('shop_inventory').select('sku,equipped').eq('user_id',id)) : []; }
 async function accessories(id) { return (await inventory(id)).filter(x=>x.equipped).map(x=>x.sku); }
 async function fulfill(session) {
  if(!session.metadata?.order_id || !catalog.some(i=>i.id===session.metadata?.sku)) return false;
  if(!session.livemode || session.mode!=='payment' || session.payment_status!=='paid') return false;
  const o = check(await db.from('shop_orders').select('*').eq('id',session.metadata?.order_id || '').single());
  const item = catalog.find(i=>i.id===o.sku);
  if(session.client_reference_id!==o.user_id || session.metadata?.sku!==o.sku || session.currency!=='myr' || session.amount_total!==item?.amount) throw Error('Payment mismatch');
  const lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:2});
  if(lines.data.length!==1 || lines.data[0].price.id!==prices[o.sku] || lines.data[0].quantity!==1) throw Error('Line item mismatch');
  const intent=await stripe.paymentIntents.retrieve(session.payment_intent,{expand:['latest_charge']});
  if(intent.status!=='succeeded' || !intent.latest_charge || intent.latest_charge.refunded) return false;
  check(await db.rpc('shop_fulfill',{order_id:o.id,session_id:session.id,intent_id:session.payment_intent})); return true;
 }
 async function body(req) { const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)throw Error('Request too large');chunks.push(chunk);}return Buffer.concat(chunks); }
 async function handle(req,res) {
  const url=new URL(req.url,'http://localhost'); if(!url.pathname.startsWith('/shop/'))return false;
  const requestOrigin=req.headers.origin;
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(requestOrigin && origins.has(requestOrigin)){res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
  if(req.method==='OPTIONS'){res.writeHead(origins.has(requestOrigin)?204:403);res.end();return true;}
  try {
   if(url.pathname==='/shop/webhook' && req.method==='POST') {
    if(!ready){reply(503,{error:'Shop unavailable'});return true;}
    let event;try {event=stripe.webhooks.constructEvent(await body(req),req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}catch{reply(400,{error:'Invalid webhook'});return true;}
    if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded') await fulfill(await stripe.checkout.sessions.retrieve(event.data.object.id));
    if(event.type==='charge.refunded' && event.data.object.livemode && event.data.object.refunded) {const orders=check(await db.from('shop_orders').select('user_id').eq('payment_intent',event.data.object.payment_intent));check(await db.rpc('shop_refund',{intent_id:event.data.object.payment_intent}));for(const order of orders)onEquip(order.user_id,await accessories(order.user_id));}
    if(event.type==='checkout.session.expired') check(await db.from('shop_orders').update({status:'expired'}).eq('stripe_session',event.data.object.id).eq('status','pending'));
    reply(200,{received:true});return true;
   }
   if(requestOrigin && !origins.has(requestOrigin)){reply(403,{error:'Origin not allowed'});return true;}
   if(url.pathname==='/shop/catalog' && req.method==='GET'){reply(200,{items:catalog,available:ready});return true;}
   if(!ready){reply(503,{error:'Shop is not available yet.'});return true;}
   const token=req.headers.authorization?.replace(/^Bearer /,'');
   const {data,error}=await db.auth.getUser(token || '');if(error || !data.user){reply(401,{error:'Please log in again.'});return true;}
   const user=data.user;
   if(url.pathname==='/shop/inventory' && req.method==='GET'){reply(200,{items:await inventory(user.id)});return true;}
   if(req.method!=='POST'){reply(405,{error:'Method not allowed'});return true;}
   const input=JSON.parse((await body(req)).toString());
   if(url.pathname==='/shop/equip') {
    if(!catalog.some(i=>i.id===input.sku)||typeof input.equipped!=='boolean'){reply(400,{error:'Invalid accessory'});return true;}
    const owned=(await inventory(user.id)).some(i=>i.sku===input.sku);if(!owned){reply(403,{error:'You do not own this item.'});return true;}
    check(await db.from('shop_inventory').update({equipped:input.equipped}).eq('user_id',user.id).eq('sku',input.sku));
    const equipped=await accessories(user.id);onEquip(user.id,equipped);reply(200,{items:await inventory(user.id)});return true;
   }
   if(url.pathname==='/shop/confirm') {
    if(typeof input.session_id!=='string'||!input.session_id.startsWith('cs_live_')){reply(400,{error:'Invalid checkout'});return true;}
    const session=await stripe.checkout.sessions.retrieve(input.session_id);
    if(session.client_reference_id!==user.id){reply(403,{error:'This checkout belongs to another account.'});return true;}
    const paid=await fulfill(session);reply(200,{paid,items:await inventory(user.id)});return true;
   }
   if(url.pathname==='/shop/checkout') {
    const item=catalog.find(i=>i.id===input.sku);if(!item){reply(400,{error:'Unknown item'});return true;}
    if((await inventory(user.id)).some(i=>i.sku===item.id)){reply(409,{error:'You already own this item.'});return true;}
    let order=check(await db.from('shop_orders').select('*').eq('user_id',user.id).eq('sku',item.id).eq('status','pending').maybeSingle());
    if(order && !order.stripe_session && Date.now()-Date.parse(order.created_at)>2400000){check(await db.from('shop_orders').update({status:'expired'}).eq('id',order.id));reply(409,{error:'Checkout expired. Please try again.'});return true;}
    if(!order){const inserted=await db.from('shop_orders').insert({user_id:user.id,sku:item.id}).select().single();if(inserted.error?.code==='23505')order=check(await db.from('shop_orders').select('*').eq('user_id',user.id).eq('sku',item.id).eq('status','pending').single());else order=check(inserted);}
    if(order.stripe_session){const existing=await stripe.checkout.sessions.retrieve(order.stripe_session);if(existing.status==='open'){reply(200,{url:existing.url});return true;}if(existing.payment_status==='paid'){await fulfill(existing);reply(409,{error:'Purchase completed. Refresh your inventory.'});return true;}if(existing.status==='complete'){reply(409,{error:'Payment is still processing.'});return true;}check(await db.from('shop_orders').update({status:'expired'}).eq('id',order.id));reply(409,{error:'Checkout expired. Please try again.'});return true;}
    const session=await stripe.checkout.sessions.create({mode:'payment',expires_at:Math.floor(Date.parse(order.created_at)/1000)+2100,line_items:[{price:prices[item.id],quantity:1}],client_reference_id:user.id,metadata:{order_id:order.id,sku:item.id},success_url:`${origin}/?shop=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/?shop=cancel`,integration_identifier:'lepakmamak_shop_kqmsvpta'},{idempotencyKey:`shop-${order.id}`});
    if(!session.metadata?.order_id || !catalog.some(i=>i.id===session.metadata?.sku)) return false;
  if(!session.livemode)throw Error('Expected live checkout');
    check(await db.from('shop_orders').update({stripe_session:session.id}).eq('id',order.id));reply(200,{url:session.url});return true;
   }
   reply(404,{error:'Not found'});
  } catch {reply(500,{error:'Could not complete this request. Please try again.'});}
  return true;
 }
 return {handle, accessories};
}
