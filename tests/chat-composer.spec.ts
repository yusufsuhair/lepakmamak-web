import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';

// The composer is the input row only. The message log stays on screen while it is
// closed, so a player can read the city without a text field stealing their keys.
test('the composer opens on demand, closes after sending and leaves the log on screen',async({page})=>{
 await page.route('**/composer-harness',route=>route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/composer-harness');
 await page.evaluate(async()=>{const {setupChat}=await import('/src/social.ts');(window as any).sent=[];const chat=setupChat((text:string)=>{(window as any).sent.push(text);return true;},()=>{});chat.append('Ali','Apa khabar');});
 await expect(page.locator('#chat-messages')).toBeVisible();
 await expect(page.locator('#chat-messages')).toContainText('Ali: Apa khabar');
 await expect(page.locator('#chat-form')).toBeHidden();
 await expect(page.locator('#chat-compose')).toBeVisible();

 await page.locator('#chat-compose').click();
 await expect(page.locator('#chat-form')).toBeVisible();
 await expect(page.locator('#chat-input')).toBeFocused();

 await page.locator('#chat-input').fill('Jom lepak');
 await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>(window as any).sent)).toEqual(['Jom lepak']);
 await expect(page.locator('#chat-form')).toBeHidden();
 await expect(page.locator('#chat-compose')).toBeVisible();
 await expect(page.locator('#chat-messages')).toBeVisible();
 await expect(page.locator('#chat-messages')).toContainText('Ali: Apa khabar');
});

test('Escape closes the composer and keeps the draft, and an empty Enter just closes it',async({page})=>{
 await page.route('**/draft-harness',route=>route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/draft-harness');
 await page.evaluate(async()=>{const {setupChat}=await import('/src/social.ts');(window as any).sent=[];const chat=setupChat((text:string)=>{(window as any).sent.push(text);return true;},()=>{});chat.open();});
 await expect(page.locator('#chat-input')).toBeFocused();
 await page.locator('#chat-input').fill('Separuh siap');
 await page.keyboard.press('Escape');
 await expect(page.locator('#chat-form')).toBeHidden();

 await page.locator('#chat-compose').click();
 await expect(page.locator('#chat-input')).toHaveValue('Separuh siap');
 await page.locator('#chat-input').fill('');
 await page.keyboard.press('Enter');
 await expect(page.locator('#chat-form')).toBeHidden();
 expect(await page.evaluate(()=>(window as any).sent)).toEqual([]);
});

test('a message that cannot be delivered keeps the composer open with the text intact',async({page})=>{
 await page.route('**/offline-harness',route=>route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/offline-harness');
 await page.evaluate(async()=>{const {setupChat}=await import('/src/social.ts');const chat=setupChat(()=>false,()=>{});chat.open();});
 await page.locator('#chat-input').fill('Hantar masa offline');
 await page.keyboard.press('Enter');
 await expect(page.locator('#chat-form')).toBeVisible();
 await expect(page.locator('#chat-input')).toHaveValue('Hantar masa offline');
 await expect(page.locator('#chat-status')).toContainText('Reconnecting');
});

test('Enter opens the composer in the city and sending collapses it again',async({page})=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8123',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5186','--strictPort'],{env:{...process.env,VITE_MULTIPLAYER_URL:'ws://127.0.0.1:8123',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 try{
  await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8123/health')).ok&&(await fetch('http://127.0.0.1:5186')).ok;}catch{return false;}},{timeout:30000}).toBe(true);
  await page.goto('http://127.0.0.1:5186/?room=chat-composer');
  await page.getByRole('button',{name:"Jom, let's go"}).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Composer');
  await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');

  await expect(page.locator('#chat-body')).toBeVisible();
  await expect(page.locator('#chat-form')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(page.locator('#chat-form')).toBeVisible();
  await expect(page.locator('#chat-input')).toBeFocused();

  await page.locator('#chat-input').fill('Salam semua');
  await page.keyboard.press('Enter');
  await expect(page.locator('#chat-form')).toBeHidden();
  await expect(page.locator('#chat-messages')).toContainText('Salam semua');
  // Movement keys belong to the world again the moment the composer closes.
  await expect(page.locator('body')).not.toHaveClass(/chat-typing/);
 } finally { vite.kill(); server.kill(); }
});

test('mobile taps the composer open and collapses it after sending, log still readable',async({browser})=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8124',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5187','--strictPort'],{env:{...process.env,VITE_MULTIPLAYER_URL:'ws://127.0.0.1:8124',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
  await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8124/health')).ok&&(await fetch('http://127.0.0.1:5187')).ok;}catch{return false;}},{timeout:30000}).toBe(true);
  await page.goto('http://127.0.0.1:5187/?room=chat-composer-mobile');
  await page.getByRole('button',{name:"Jom, let's go"}).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Mobile');
  await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');

  // The log is readable on a phone without opening anything.
  await expect(page.locator('#chat-body')).toBeVisible();
  await expect(page.locator('#chat-form')).toBeHidden();
  await page.locator('#chat-compose').tap();
  await expect(page.locator('#chat-form')).toBeVisible();
  await page.locator('#chat-input').fill('Hai dari telefon');
  await page.getByRole('button',{name:'Send'}).tap();
  await expect(page.locator('#chat-form')).toBeHidden();
  await expect(page.locator('#chat-messages')).toBeVisible();
  await expect(page.locator('#chat-messages')).toContainText('Hai dari telefon');
 } finally { await context.close(); vite.kill(); server.kill(); }
});
