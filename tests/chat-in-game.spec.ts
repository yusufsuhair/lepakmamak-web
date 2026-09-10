import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const enter=async(page:any,name='Player')=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill(name);
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();
};
const where=(page:any)=>page.locator('#city-chat').evaluate(el=>el.parentElement?.id||el.parentElement?.tagName.toLowerCase());

for(const [label,width,height] of [['desktop',1280,800],['phone',375,812]] as const)
test(`chat is reachable while a table game is open on ${label}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},...(width<600?{isMobile:true,hasTouch:true}:{})});
 const page=await context.newPage();
 try{
  await enter(page);
  expect(await where(page)).toBe('hud');

  // A modal dialog makes the rest of the document inert, so the panel has to come with it.
  await page.evaluate(()=>(window as any).__lepak && document.querySelector<HTMLDialogElement>('#table-social')?.showModal());
  await page.evaluate(()=>{const d=document.getElementById('table-social')!;d.append(document.getElementById('city-chat')!);});
  expect(await where(page)).toBe('table-social');
  // Inside the top layer it is reachable rather than switched off by the platform.
  await expect(page.locator('#city-chat')).toBeVisible();
  await expect(page.locator('#chat-body')).toBeVisible();
  // And it flows as part of the dialog rather than floating over the game: a panel that
  // keeps its HUD position sits on the buttons and swallows every press meant for them.
  expect(await page.locator('#city-chat').evaluate(el=>getComputedStyle(el).position)).toBe('static');

  // Esc closes a modal natively and never reaches close(), which is why the restore hangs
  // off the dialog's own 'close' event.
  await page.keyboard.press('Escape');
  await expect.poll(()=>where(page)).toBe('hud');
  await expect(page.locator('#city-chat')).toBeVisible();
 } finally { await context.close(); }
});

test('the panel is restored by the close event, not only by the close button',()=>{
 const source=readFileSync('src/table-social.ts','utf8');
 // Esc, a torn-down dialog and going offline all have to put it back.
 expect(source).toContain("dialog.addEventListener('close',releaseChat)");
 expect(source).toMatch(/function close\(\)\{dialog\.close\(\);releaseChat\(\);\}/);
 expect(source).toMatch(/offline\(\)\{releaseChat\(\)/);
 // And exactly one chat panel exists — it is moved, never rebuilt.
 expect(source).not.toMatch(/setupChat\(/);
});

test('chat keeps readable text and stays above the game action prompt',async({page})=>{
 await page.route('**/chat-table-contrast-harness',(r:any)=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"></div><dialog id="table-social"></dialog><button id="interaction">Stand</button>'}));
 await page.goto('/chat-table-contrast-harness');
 await page.evaluate(async()=>{
  const {setupChat}=await import('/src/social.ts');
  (window as any).chat=setupChat(()=>true,()=>{});
  (window as any).chat.append('Ali','Jom main',undefined,false,false,'all');
  const dialog=document.getElementById('table-social')! as HTMLDialogElement;
  dialog.showModal(); dialog.append(document.getElementById('city-chat')!);
 });
 const style=await page.locator('.chat-said').evaluate(el=>({
  color:getComputedStyle(el).color,
  body:getComputedStyle(document.getElementById('chat-body')!).backgroundColor,
  zIndex:getComputedStyle(document.getElementById('city-chat')!).zIndex,
 }));
 expect(style.color).toBe('rgb(255, 248, 231)');
 expect(style.body).toBe('rgba(23, 60, 50, 0.95)');
 expect(Number(style.zIndex)).toBeGreaterThan(6);
});

test('the table tab appears on sitting down and retires on standing up',async({page})=>{
 await page.route('**/table-tab-harness',(r:any)=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>'}));
 await page.goto('/table-tab-harness');
 await page.evaluate(async()=>{
  const {setupChat}=await import('/src/social.ts');
  const held=window as any; held.sent=[];
  held.chat=setupChat((text:string,channel:string,to?:string)=>{held.sent.push({text,channel,to});return true;},()=>{});
 });
 const open=()=>page.locator('#chat-compose').click();

 await page.evaluate(()=>(window as any).chat.seated(true));
 await open();
 // Sitting down points the composer at the table, because that is who you are talking to.
 await expect(page.locator('#chat-channel')).toHaveText(/MEJA/);
 await page.locator('#chat-input').fill('jom main');
 await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>(window as any).sent)).toEqual([{text:'jom main',channel:'table',to:undefined}]);

 // A table message arriving lands in that tab.
 await page.evaluate(()=>(window as any).chat.append('Ali','ok jom',undefined,false,true,'table'));
 await expect(page.locator('.chat-log:not([hidden])')).toContainText('ok jom');

 // Standing up retires the tab and hands you back to the city.
 await page.evaluate(()=>(window as any).chat.seated(false));
 await open();
 await expect(page.locator('#chat-channel')).toHaveText(/ALL/);
 await page.locator('#chat-channel').click();
 await expect(page.getByRole('option',{name:/MEJA/})).toHaveCount(0);
});
