import {test,expect} from '@playwright/test';
test('chat displays Malaysia time and retains the latest 50 messages',async({page})=>{
 await page.route('**/timestamp-harness',route=>route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/timestamp-harness');
 await page.evaluate(async()=>{const {setupChat}=await import('/src/social.ts');const chat=setupChat(()=>true,()=>{});chat.open();for(let i=0;i<55;i++)chat.append('Friend',`Message ${i}`,'2026-09-08T07:42:00.000Z');});
 await expect(page.locator('#chat-messages p')).toHaveCount(50);
 await expect(page.locator('#chat-messages p').first()).toContainText('Message 5');
 await expect(page.locator('time').first()).toHaveText('15:42');
 await expect(page.locator('time').first()).toHaveAttribute('datetime','2026-09-08T07:42:00.000Z');
 await expect(page.locator('time').first()).toHaveAttribute('title',/MYT/);
});

test('restored chat history replaces stale rows, keeps timestamps and does not count as unread',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/history-harness',route=>route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/history-harness');
 await page.evaluate(async()=>{const {setupChat}=await import('/src/social.ts');const chat=setupChat(()=>true,()=>{});chat.append('Old','Not from this room');chat.history([{name:'Ali',text:'Assalamualaikum','sentAt':'2026-09-08T07:42:00.000Z'},{name:'Mei',text:'Waalaikumsalam','sentAt':'2026-09-08T07:43:00.000Z'}]);});
 await expect(page.locator('#chat-messages p')).toHaveCount(2);
 await expect(page.locator('#chat-messages')).not.toContainText('Not from this room');
 await expect(page.locator('#chat-messages')).toContainText('Ali: Assalamualaikum');
 await expect(page.locator('#chat-heading')).toHaveAttribute('aria-label','Expand city chat');
});
