import {test} from 'node:test';
import assert from 'node:assert/strict';
import {origins} from '../shared/origins.mjs';
import {createShop} from '../server/shop.mjs';
import {createFriends} from '../server/friends.mjs';

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
  for(const origin of ['https://app.lepakmamak.my','https://lepakmamak.my','https://lepakmamak.pages.dev','https://lepak-city.pages.dev','capacitor://localhost','https://localhost'])assert.ok(origins.has(origin));
  for(const origin of ['https://evil.test','https://app.lepakmamak.my.evil.test','http://app.lepakmamak.my','https://untrusted.lepakmamak-unity.pages.dev'])assert.ok(!origins.has(origin));
});
for(const [handler,path] of [[shop,'/shop/inventory'],[friends,'/friends/state']]){
  test(path+' permits Unity preflight without touching account data',async()=>{
    const r=await call(handler,path,'https://app.lepakmamak.my');assert.equal(r.status,204);
    assert.equal(r.headers['access-control-allow-origin'],'https://app.lepakmamak.my');
    assert.equal((await call(handler,path,'https://evil.test')).status,403);
  });
  test(path+' still requires authentication from the allowed origin',async()=>{
    assert.equal((await call(handler,path,'https://app.lepakmamak.my','GET')).status,401);
  });
}
