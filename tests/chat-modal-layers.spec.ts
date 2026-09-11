import {test,expect} from '@playwright/test';

for(const mobile of [false,true])test(`settings and nested dialogs cover chat on ${mobile?'mobile':'desktop'}`,async({browser})=>{
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();
 await page.route('**/layers-harness',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/ui-polish.css"><section id="hud"></section><section id="pause" hidden><div class="pause-panel"><button id="resume">Resume</button><button id="nested">Security</button></div></section><dialog id="security"><button id="done">Done</button></dialog>`}));
 await page.goto('/layers-harness');
 await page.evaluate(async()=>{const {setupChat}=await import('/src/social.ts');const chat=setupChat(()=>true,()=>{});chat.append('Ali','Keep this message');chat.open();document.getElementById('nested')!.onclick=()=>{(document.getElementById('security') as HTMLDialogElement).showModal();};document.getElementById('done')!.onclick=()=>{(document.getElementById('security') as HTMLDialogElement).close();};});
 for(const expanded of [false,true]){
  if(expanded)await page.locator('#chat-expand').click();
  await page.locator('#pause').evaluate(el=>el.hidden=false);
  // Hit-test inside the chat: Settings must intercept the pointer even over fullscreen chat.
  expect(await page.locator('#city-chat').evaluate(el=>{const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pause');})).toBe(true);
  await page.locator('#nested').click();await page.locator('#done').click();
  await page.locator('#resume').click();await page.locator('#pause').evaluate(el=>el.hidden=true);
  expect(await page.locator('#city-chat').evaluate(el=>el.classList.contains('chat-expanded'))).toBe(expanded);
  await expect(page.locator('#chat-messages')).toContainText('Keep this message');
  await page.locator('#chat-input').fill('Chat works after closing settings');
 }
 await context.close();
});
