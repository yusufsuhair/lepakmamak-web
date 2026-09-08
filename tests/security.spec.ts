import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

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
