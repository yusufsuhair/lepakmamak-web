import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {Readable} from 'node:stream';
import {createIap, nativePacks, validateApple, validateGoogle, transactionHash} from '../server/iap.mjs';
import {createShop} from '../server/shop.mjs';
const user='b4ddf73b-cc28-4e4f-8735-223e8a94d639';
const appleInput={store:'apple',productId:'my.lepakmamak.syiling500',transactionId:'12345',jws:'invalid'};
const googleInput={store:'google',productId:'syiling_500',transactionId:'token'};
const apple={bundleId:'my.lepakmamak.client',environment:'Production',transactionId:'12345',productId:appleInput.productId,
  type:'Consumable',quantity:1,inAppOwnershipType:'PURCHASED',appAccountToken:user};
const google={productLineItem:[{productId:'syiling_500',productOfferDetails:{quantity:1,refundableQuantity:1}}],
  purchaseStateContext:{purchaseState:'PURCHASED'},obfuscatedExternalAccountId:transactionHash(user)};
test('Apple evidence binds app, product, transaction, quantity, environment and account',()=>{
  validateApple(apple,appleInput,user,'Production');
  for(const change of [{bundleId:'other'},{environment:'Sandbox'},{transactionId:'678'}, {productId:'other'},
    {quantity:2},{type:'Non-Consumable'},{inAppOwnershipType:'FAMILY_SHARED'},{revocationDate:123},
    {appAccountToken:undefined},{appAccountToken:'another-account'}])
    assert.throws(()=>validateApple({...apple,...change},appleInput,user,'Production'));
});
test('Google evidence rejects pending, cancelled, refunded, multi-quantity and wrong-account purchases',()=>{
  validateGoogle(google,googleInput,user,'Production');
  for(const change of [{purchaseStateContext:{purchaseState:'CANCELLED'}}, {testPurchaseContext:{}},
    {obfuscatedExternalAccountId:'wrong'}, {obfuscatedExternalAccountId:undefined}, {productLineItem:[]},
    {productLineItem:[...google.productLineItem,...google.productLineItem]},
    {productLineItem:[{productId:'other',productOfferDetails:{quantity:1,refundableQuantity:1}}]},
    {productLineItem:[{productId:'syiling_500',productOfferDetails:{quantity:2,refundableQuantity:2}}]},
    {productLineItem:[{productId:'syiling_500',productOfferDetails:{quantity:1,refundableQuantity:0}}]}])
    assert.throws(()=>validateGoogle({...google,...change},googleInput,user,'Production'));
  assert.throws(()=>validateGoogle({...google,purchaseStateContext:{purchaseState:'PENDING'}},googleInput,user,'Production'),{status:202});
  validateGoogle({...google,testPurchaseContext:{}},googleInput,user,'Sandbox');
  assert.throws(()=>validateGoogle(google,googleInput,user,'Sandbox'));
});
test('missing configuration fails closed, products retain established prices',async()=>{
  const iap=createIap({});
  assert.equal(iap.applePaymentsAvailable,false);assert.equal(iap.googlePaymentsAvailable,false);
  await assert.rejects(iap.verify(googleInput,user),{status:503});
  for(const input of [null,{}, {...googleInput,productId:'invented'}, {...googleInput,transactionId:'x'.repeat(4097)}])
    await assert.rejects(iap.verify(input,user),{status:400});
  assert.throws(()=>createIap({APPLE_IAP_ENABLED:'true'}));
  assert.throws(()=>createIap({GOOGLE_IAP_ENABLED:'true'}));
  assert.deepEqual(nativePacks.map(p=>[p.credits,p.amount]),[[500,500],[1200,1000],[3000,2000]]);
});
async function call(shop,input,path='/shop/iap/verify',method='POST'){
  const request=Readable.from([Buffer.from(JSON.stringify(input))]);
  Object.assign(request,{url:path,method,headers:{authorization:'Bearer fixture'}});
  let status,body;
  await shop.handle(request,{setHeader(){},writeHead(value){status=value},end(value){body=JSON.parse(value)}});
  return {status,body};
}
test('HTTP fulfillment only succeeds after a committed grant and full inventory, and retries safely',async()=>{
  let credits=0,failInventory=false,failCommit=false;const claimed=new Set();
  const db={auth:{getUser:async()=>({data:{user:{id:user}}})},
    from:()=>({select:()=>({eq:async()=>({data:[],error:failInventory?{}:null})})}),
    rpc:async(name,args)=>{
      if(name==='game_wallet_get')return {data:{balance:500+credits,dailyAvailable:true,nextDailyAt:null}};
      assert.equal(name,'game_wallet_credit_iap');
      assert.equal(args.p_transaction_hash,transactionHash('token'));assert.equal(args.p_user_id,user);
      if(failCommit)return {error:{}};
      if(!claimed.has(args.p_transaction_hash)){claimed.add(args.p_transaction_hash);credits+=500;}
      return {data:{fulfilled:true}};
    }};
  const iap={googlePaymentsAvailable:true,applePaymentsAvailable:false,verify:async(input,id)=>{
    validateGoogle(google,input,id,'Production');return {environment:'Production'};
  }};
  const shop=createShop(()=>{},{db,iap});
  failCommit=true;assert.equal((await call(shop,googleInput)).status,503);assert.equal(credits,0);
  failCommit=false;failInventory=true;assert.equal((await call(shop,googleInput)).status,503);assert.equal(credits,500);
  failInventory=false;
  const result=await call(shop,googleInput);
  assert.equal(result.status,200);assert.equal(result.body.fulfilled,true);assert.equal(result.body.transactionId,'token');
  assert.equal(result.body.inventory.balance,1000);assert.equal(credits,500);
  assert.equal((await call(shop,{...googleInput,productId:'wrong'})).status,400);assert.equal(credits,500);
  const catalog=await call(shop,{},'/shop/catalog','GET');assert.equal(catalog.body.googlePaymentsAvailable,true);
  db.auth.getUser=async()=>({data:{user:null},error:{}});
  assert.equal((await call(shop,googleInput)).status,401);
});
test('verification endpoint limits untrusted request volume',async()=>{
  const shop=createShop(()=>{},{db:{auth:{getUser:async()=>({data:{user:null},error:{}})}},iap:createIap({})});
  for(let n=0;n<20;n++)assert.equal((await call(shop,googleInput)).status,401);
  assert.equal((await call(shop,googleInput)).status,429);
});

test('the actual Apple verifier rejects unsigned or malformed JWS before API calls',async()=>{
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});
  const iap=createIap({APPLE_IAP_ENABLED:'true',APPLE_IAP_ENVIRONMENT:'Sandbox',APPLE_IAP_KEY_ID:'FIXTURE',
    APPLE_IAP_ISSUER_ID:'fixture',APPLE_IAP_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'})});
  assert.equal(iap.applePaymentsAvailable,true);
  await assert.rejects(iap.verify(appleInput,user),{status:400});
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  await assert.rejects(iap.verify({...appleInput,jws:encode({alg:'none'})+'.'+encode(apple)+'.'},user),{status:400});
});
