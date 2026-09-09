import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {clientKey,createRateLimiter,createConnectionCap} from '../server/limits.mjs';

test('Cloudflare security headers enforce a strict content policy',()=>{
 const headers=readFileSync('public/_headers','utf8');
 expect(headers).toContain("default-src 'self'");
 expect(headers).toContain("object-src 'none'");
 expect(headers).toContain("frame-ancestors 'none'");
 expect(headers).toContain('X-Content-Type-Options: nosniff');
 expect(headers).not.toContain("'unsafe-eval'");
 expect(headers).not.toContain("'unsafe-inline'");
});

test('chat renders SQL and HTML attack strings only as plain text',async({page})=>{
 await page.route('**/security-harness',route=>route.fulfill({contentType:'text/html',body:'<main id="hud"></main>'}));
 await page.goto('/security-harness');
 const attack=`Robert'); DROP TABLE chat_messages;-- <img src=x onerror="window.pwned=1"><script>window.pwned=2</script>`;
 await page.evaluate(async value=>{const{setupChat}=await import('/src/social.ts');const chat=setupChat(()=>true,()=>{});chat.append('Attacker',value);},attack);
 await expect(page.locator('#chat-messages')).toContainText(attack);
 await expect(page.locator('#chat-messages img, #chat-messages script')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).pwned)).toBeUndefined();
});

test('the caller key trusts the leftmost forwarded address, then the socket',()=>{
 expect(clientKey({headers:{'x-forwarded-for':'203.0.113.7, 10.0.0.1'},socket:{remoteAddress:'10.0.0.1'}})).toBe('203.0.113.7');
 expect(clientKey({headers:{},socket:{remoteAddress:'198.51.100.4'}})).toBe('198.51.100.4');
 expect(clientKey({headers:{}})).toBe('unknown');
});

test('the rate limiter spends a window, then reopens it',async()=>{
 const allow=createRateLimiter({limit:3,windowMs:60});
 expect([allow('a'),allow('a'),allow('a')]).toEqual([true,true,true]);
 expect(allow('a')).toBe(false);
 expect(allow('b')).toBe(true); // one caller's flood does not spend another's budget
 await new Promise(resolve=>setTimeout(resolve,80));
 expect(allow('a')).toBe(true);
});

test('the rate limiter drops whole generations instead of growing without bound',async()=>{
 const allow=createRateLimiter({limit:1,windowMs:20,maxKeys:50});
 // A flood of unique callers must not grow memory without bound, and must not cost an
 // O(n) scan per call — the attack the limiter exists to stop.
 for(let i=0;i<5000;i++)allow(`caller-${i}`);
 await new Promise(resolve=>setTimeout(resolve,40));
 expect(allow('fresh')).toBe(true);
 expect(allow('fresh')).toBe(false);
 // Within one window the map stops taking on new keys, so forged addresses cannot grow
 // it: an already-counted caller keeps its budget, an untracked one is let through
 // rather than locked out.
 const bounded=createRateLimiter({limit:1,windowMs:60000,maxKeys:50});
 for(let i=0;i<5000;i++)bounded(`caller-${i}`);
 expect(bounded('caller-0')).toBe(false);
 expect(bounded('never-seen')).toBe(true);
});

test('the connection cap holds per caller and in total, and frees on release',()=>{
 const cap=createConnectionCap({perKey:2,total:3});
 const first=cap.take('a'),second=cap.take('a');
 expect(first).toBeTruthy();expect(second).toBeTruthy();
 expect(cap.take('a')).toBeNull(); // per-caller cap
 const other=cap.take('b');
 expect(other).toBeTruthy();
 expect(cap.take('c')).toBeNull(); // total cap, which no spoofed address can dodge
 expect(cap.live).toBe(3);
 first!();first!(); // releasing twice must not hand back a slot that was never held
 expect(cap.live).toBe(2);
 expect(cap.take('c')).toBeTruthy();
});
