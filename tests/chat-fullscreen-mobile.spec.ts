import {test,expect} from '@playwright/test';

test('mobile fullscreen chat keeps its log scrollable and its composer at the bottom',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 await page.route('**/fullscreen-mobile-chat-harness',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/ui-polish.css"><div id="hud"></div>'}));
 await page.goto('/fullscreen-mobile-chat-harness');
 await page.evaluate(async()=>{
  const {setupChat}=await import('/src/social.ts');
  const chat=setupChat(()=>true,()=>{});
  (window as any).chat=chat;
  for(let i=0;i<80;i++)chat.append('Ali',`A message long enough to wrap on a phone ${i}`);
  document.body.classList.add('touch-device','chat-typing');
  document.documentElement.style.setProperty('--keyboard-height','260px');
  chat.open();
 });
 await page.locator('#chat-expand').click();
 await expect(page.locator('#chat-min')).toBeHidden();
 for (const width of [390, 598]) {
  await page.setViewportSize({width,height:844});
  const header=(await page.locator('#chat-heading').boundingBox())!;
  const icon=(await page.locator('#chat-expand').boundingBox())!;
  expect(icon.x).toBeGreaterThanOrEqual(header.x);
  expect(icon.y).toBeGreaterThanOrEqual(header.y);
  expect(icon.x+icon.width).toBeLessThanOrEqual(header.x+header.width);
  expect(icon.y+icon.height).toBeLessThanOrEqual(header.y+header.height);
 }
 await page.setViewportSize({width:390,height:844});


 const layout=await page.evaluate(()=>{
  const read=(selector:string)=>{
   const element=document.querySelector<HTMLElement>(selector)!;
   const rect=element.getBoundingClientRect();
   const style=getComputedStyle(element);
   return {top:rect.top,bottom:rect.bottom,height:rect.height,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,scrollTop:element.scrollTop,overflowY:style.overflowY,touchAction:style.touchAction};
  };
  return {viewport:{width:innerWidth,height:innerHeight},panel:read('#city-chat'),body:read('#chat-body'),logs:read('#chat-logs'),messages:read('#chat-messages'),form:read('#chat-form'),input:read('#chat-input')};
 });
 expect(layout.panel.top).toBeGreaterThanOrEqual(0);
 expect(layout.panel.bottom).toBeLessThanOrEqual(layout.viewport.height+1);
 expect(layout.form.bottom).toBeGreaterThan(layout.panel.bottom-100);
 expect(layout.input.bottom).toBeGreaterThan(layout.panel.bottom-100);
 expect(layout.messages.scrollHeight).toBeGreaterThan(layout.messages.clientHeight);
 expect(layout.messages.overflowY).toBe('auto');
 expect(layout.messages.touchAction).toContain('pan-y');

 await page.locator('#chat-messages').evaluate(element=>{element.scrollTop=0;});
 await page.locator('#chat-messages').evaluate(element=>element.scrollTop=element.scrollHeight);
 await expect.poll(()=>page.locator('#chat-messages').evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
 await context.close();
});
