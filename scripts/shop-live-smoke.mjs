// Explicit live integration check. Creates and expires checkout; never pays.
import Stripe from 'stripe';
import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref','sbzvvhzibqpozqvojzhe','--output','json'],{encoding:'utf8'}));
const admin=createClient('https://sbzvvhzibqpozqvojzhe.supabase.co',keys.find(k=>k.name==='service_role').api_key,{auth:{persistSession:false}});
const client=createClient('https://sbzvvhzibqpozqvojzhe.supabase.co',keys.find(k=>k.name==='anon').api_key,{auth:{persistSession:false}});
const email=`shop-smoke-${randomUUID()}@example.com`,password=randomUUID()+'Aa9!';
let user,checkout,browser;
const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
try {
 user=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Shop Check'}})).user;
 const login=check(await client.auth.signInWithPassword({email,password}));
 const request=async(path,body)=>{const response=await fetch('https://lepak-city-realtime-production.up.railway.app/shop/'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${login.session.access_token}`,'Content-Type':'application/json',Origin:'https://lepakmamak.my'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
 expect((await request('catalog')).data.available).toBe(true);
 expect((await request('equip',{sku:'cap',equipped:true})).status).toBe(403);
 const result=await request('checkout',{sku:'cap'});expect(result.status).toBe(200);
 const order=check(await admin.from('shop_orders').select('*').eq('user_id',user.id).single());
 checkout=await stripe.checkout.sessions.retrieve(order.stripe_session);
 expect(checkout.livemode).toBe(true);expect(checkout.amount_total).toBe(500);expect(checkout.currency).toBe('myr');
 expect((await request('checkout',{sku:'cap'})).data.url).toBe(result.data.url);
 expect((await request('confirm',{session_id:checkout.id})).data.paid).toBe(false);
 expect((await request('inventory')).data.items).toEqual([]);
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();await page.goto(result.data.url);
 await expect(page.getByText('Lepak Cap',{exact:true}).first()).toBeVisible({timeout:30000});
 await page.screenshot({path:'test-results/live-shop-checkout.png',fullPage:true});
 // Verify database idempotency and refund replay on this disposable account only.
 check(await admin.rpc('shop_fulfill',{order_id:order.id,session_id:checkout.id,intent_id:'pi_local_verification'}));
 check(await admin.rpc('shop_fulfill',{order_id:order.id,session_id:checkout.id,intent_id:'pi_local_verification'}));
 expect((await request('inventory')).data.items).toHaveLength(1);
 expect((await request('equip',{sku:'cap',equipped:true})).status).toBe(200);
 const forged=await client.from('shop_inventory').insert({user_id:user.id,sku:'spectacles'});expect(forged.error).toBeTruthy();
 check(await admin.rpc('shop_refund',{intent_id:'pi_local_verification'}));
 expect((await request('inventory')).data.items).toEqual([]);
 check(await admin.rpc('shop_refund',{intent_id:'pi_local_verification'}));
 console.log('PASS: live RM5 checkout, duplicate reuse, unpaid protection, equipment ownership, RLS, fulfillment idempotency and refunds. No charge made.');
} finally {
 if(checkout?.status==='open')await stripe.checkout.sessions.expire(checkout.id);
 if(browser)await browser.close();
 if(user)await admin.auth.admin.deleteUser(user.id);
}
