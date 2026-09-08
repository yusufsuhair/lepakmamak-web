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

test('verified Game Master messages have a compact gold banner in live and restored chat',async({page})=>{
 await page.route('**/gm-chat-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>'}));
 await page.goto('/gm-chat-harness');
 await page.evaluate(async()=>{const {setupChat}=await import('/src/social.ts');const chat=setupChat(()=>true,()=>{});chat.append('Yusuf','Selamat datang','2026-09-08T07:42:00.000Z',true);chat.append('Ali','Hello','2026-09-08T07:43:00.000Z');});
 await expect(page.locator('.game-master-chat')).toHaveCount(1);
 await expect(page.locator('.game-master-chat')).toContainText('✦ GM · Yusuf: Selamat datang');
 await expect(page.locator('#chat-messages p').nth(1)).not.toHaveClass(/game-master-chat/);
 const style=await page.locator('.game-master-chat').evaluate(el=>({width:el.getBoundingClientRect().width,panel:el.parentElement!.getBoundingClientRect().width,border:getComputedStyle(el).borderTopColor}));
 expect(style.width).toBeLessThanOrEqual(style.panel);expect(style.border).toBe('rgb(255, 217, 120)');
});
