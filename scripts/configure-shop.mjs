// Run with a live restricted key supplied through STRIPE_SECRET_KEY; never write it to source.
import Stripe from 'stripe';
import { execFileSync } from 'node:child_process';
import catalog from '../shared/shop.json' with { type:'json' };
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
const account=await stripe.accounts.retrieve();
if(account.id!=='acct_1UDMDa7gnqJbc36b'||!account.charges_enabled)throw Error('Expected enabled LepakMamak account');
const set=(key,value)=>execFileSync('railway',['variables','set',key,'--stdin','--skip-deploys','--service','9a776d22-a5d8-4151-8059-300149fce72c'],{input:value,stdio:['pipe','pipe','pipe']});
for(const item of catalog){
 const lookup=`lepak_${item.id}_myr_500`;
 let price=(await stripe.prices.list({lookup_keys:[lookup],limit:1})).data[0];
 if(!price){const product=await stripe.products.create({name:item.name,description:item.description,metadata:{app:'lepakmamak',sku:item.id}},{idempotencyKey:`lepak-product-${item.id}`});price=await stripe.prices.create({product:product.id,unit_amount:item.amount,currency:'myr',lookup_key:lookup},{idempotencyKey:`lepak-price-${lookup}`});}
 if(!price.livemode||price.unit_amount!==500||price.currency!=='myr')throw Error('Price mismatch');
 set(`STRIPE_PRICE_${item.id.toUpperCase()}`,price.id);console.log(`${item.name}: live RM 5 price ready`);
}
const webhookUrl='https://lepak-city-realtime-production.up.railway.app/shop/webhook';
const existing=(await stripe.webhookEndpoints.list({limit:100})).data.find(e=>e.url===webhookUrl);
if(!existing){const endpoint=await stripe.webhookEndpoints.create({url:webhookUrl,enabled_events:['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','charge.refunded'],description:'LepakMamak accessory purchases'});set('STRIPE_WEBHOOK_SECRET',endpoint.secret);console.log('Signed live webhook configured');}
set('STRIPE_SECRET_KEY',process.env.STRIPE_SECRET_KEY);
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref','sbzvvhzibqpozqvojzhe','--output','json'],{encoding:'utf8'}));
set('SUPABASE_SERVICE_ROLE_KEY',keys.find(k=>k.name==='service_role').api_key);
set('SHOP_ORIGIN','https://lepakmamak.my');console.log('Railway shop secrets configured without deployment');
