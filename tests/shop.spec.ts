import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
// Exercise real HTTP authorization and fulfillment without charging a card.
test('shop rejects forged ownership, unpaid/refunded payments and invalid webhooks', async () => {
 process.env.STRIPE_WEBHOOK_SECRET='whsec_test';
 process.env.STRIPE_PRICE_SPECTACLES='price_spectacles';
 process.env.STRIPE_PRICE_CAP='price_cap';
 const {createShop}=await import('../server/shop.mjs');
 let paid=false, refunded=false, owner='u1', amount=500, grants=0;
 const rows:any[]=[];
 const db:any={auth:{getUser:async(token:string)=>({data:{user:token==='valid'?{id:'u1'}:null}})},
 from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,single:async()=>({data:{id:'order',user_id:'u1',sku:'cap'}}),then:(resolve:any)=>resolve({data:table==='shop_inventory'?rows:[]})};return q;},
 rpc:async()=>{grants++;return {data:null};}};
 const stripe:any={checkout:{sessions:{retrieve:async()=>({id:'cs_live_demo',livemode:true,mode:'payment',payment_status:paid?'paid':'unpaid',client_reference_id:owner,currency:'myr',amount_total:amount,metadata:{order_id:'order',sku:'cap'},payment_intent:'pi_demo'}),listLineItems:async()=>({data:[{price:{id:'price_cap'},quantity:1}]})}},paymentIntents:{retrieve:async()=>({status:'succeeded',latest_charge:{refunded}})},webhooks:{constructEvent:()=>{throw Error('bad signature');}}};
 const shop=createShop(()=>{}, {db,stripe});
 const server=createServer((req,res)=>void shop.handle(req,res));
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address() as any;
 const post=(path:string,body:any={},token='valid')=>fetch(`http://127.0.0.1:${address.port}/shop/${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try {
  expect((await post('equip',{sku:'cap',equipped:true})).status).toBe(403);
  expect((await post('checkout',{sku:'cap'},'bad')).status).toBe(401);
  expect((await post('checkout',{sku:'injected'})).status).toBe(400);
  expect((await post('webhook')).status).toBe(400);
  const confirm=()=>post('confirm',{session_id:'cs_live_demo'});
  expect((await (await confirm()).json()).paid).toBe(false);
  paid=true;owner='another';expect((await confirm()).status).toBe(403);
  owner='u1';amount=1;expect((await confirm()).status).toBe(500);
  amount=500;refunded=true;expect((await (await confirm()).json()).paid).toBe(false);
  expect(grants).toBe(0);
  refunded=false;expect((await (await confirm()).json()).paid).toBe(true);
  expect(grants).toBe(1);
 } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
