import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.ALLOWED_ORIGINS = 'https://app.example.com,https://game.example.com,capacitor://localhost,https://localhost';
const {origins} = await import('../shared/origins.mjs');
const {createShop} = await import('../server/shop.mjs');
const {createFriends} = await import('../server/friends.mjs');

const db={auth:{getUser:async()=>({error:{message:'No session'},data:{user:null}})}};
const shop=createShop(()=>{},{db,stripe:{},webhookSecret:'fixture-only'});
const friends=createFriends({db});
async function call(handler,url,origin,method='OPTIONS'){
  let status;const headers={};
  await handler.handle({url,method,headers:{origin}}, {
    setHeader(k,v){headers[k.toLowerCase()]=v;},writeHead(code){status=code;},end(){},
  });
  return {status,headers};
}
test('Unity custom production origin is exact and existing clients are retained',()=>{
  for(const origin of ['https://app.example.com','https://game.example.com','capacitor://localhost','https://localhost'])assert.ok(origins.has(origin));
  for(const origin of ['https://evil.test','https://app.example.com.evil.test','http://app.example.com','https://untrusted.lepakmamak-unity.pages.dev'])assert.ok(!origins.has(origin));
});
for(const [handler,path] of [[shop,'/shop/inventory'],[friends,'/friends/state']]){
  test(path+' permits Unity preflight without touching account data',async()=>{
    const r=await call(handler,path,'https://app.example.com');assert.equal(r.status,204);
    assert.equal(r.headers['access-control-allow-origin'],'https://app.example.com');
    assert.equal((await call(handler,path,'https://evil.test')).status,403);
  });
  test(path+' still requires authentication from the allowed origin',async()=>{
    assert.equal((await call(handler,path,'https://app.example.com','GET')).status,401);
  });
}
