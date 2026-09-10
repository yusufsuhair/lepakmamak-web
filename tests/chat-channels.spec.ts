import {test,expect} from '@playwright/test';

const mount=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {setupChat}=await import('/src/social.ts');
  (window as any).sent=[];
  (window as any).chat=setupChat((text:string,channel:string,to?:string)=>{(window as any).sent.push({text,channel,to});return true;},()=>{});
 });
};
const openComposer=(page:any)=>page.locator('#chat-compose').click();

test('the channel selector lives inside the composer and opens upward',async({page})=>{
 await mount(page,'selector-harness');
 // Nothing above the log: the old tab strip is gone.
 await expect(page.locator('#chat-tabs')).toHaveCount(0);
 await openComposer(page);

 const selector=page.locator('#chat-channel');
 await expect(selector).toBeVisible();
 await expect(selector).toHaveText(/ALL/);
 // It sits before the text field, not after it.
 const order=await page.evaluate(()=>{
  const form=document.getElementById('chat-form')!;
  const kids=[...form.querySelectorAll('#chat-channel, #chat-input')].map(e=>e.id);
  return kids;
 });
 expect(order).toEqual(['chat-channel','chat-input']);

 await expect(page.locator('#chat-channel-menu')).toBeHidden();
 await selector.click();
 await expect(page.locator('#chat-channel-menu')).toBeVisible();
 await expect(selector).toHaveAttribute('aria-expanded','true');
 // Drop-up: the menu sits above the button it belongs to.
 const above=await page.evaluate(()=>{
  const menu=document.getElementById('chat-channel-menu')!.getBoundingClientRect();
  const button=document.getElementById('chat-channel')!.getBoundingClientRect();
  return menu.bottom<=button.top+1;
 });
 expect(above).toBe(true);
});

test('party appears in the list only while you are in one, and choosing it routes the message',async({page})=>{
 await mount(page,'route-harness');
 await openComposer(page);
 await page.locator('#chat-channel').click();
 await expect(page.getByRole('option',{name:/PARTY/})).toHaveCount(0);

 await page.evaluate(()=>(window as any).chat.party([{id:'a',name:'Ali'}]));
 await expect(page.getByRole('option',{name:/PARTY/})).toBeVisible();
 await page.getByRole('option',{name:/PARTY/}).click();
 await expect(page.locator('#chat-channel')).toHaveText(/PARTY/);
 await expect(page.locator('#chat-channel-menu')).toBeHidden();

 await page.locator('#chat-input').fill('geng only');
 await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>(window as any).sent)).toEqual([{text:'geng only',channel:'party'}]);
});

test('a private thread gets its own chip, and never a slot in the broadcast list',async({page})=>{
 await mount(page,'dm-harness');
 await page.evaluate(()=>(window as any).chat.openDm('u1','Aina'));
 await expect(page.locator('.dm-chip')).toHaveCount(1);
 await expect(page.locator('.dm-chip.on')).toContainText('Aina');
 await openComposer(page);

 // The pill states the recipient and stops being a menu, so a private line cannot be
 // handed to the whole city by a mis-tap.
 await expect(page.locator('#chat-channel')).toHaveText(/@Aina/);
 await expect(page.locator('#chat-channel')).toBeDisabled();

 await page.locator('#chat-input').fill('psst');
 await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>(window as any).sent)).toEqual([{text:'psst',channel:'dm',to:'u1'}]);

 // Closing the conversation from its chip hands you back to the city, and the list that
 // decides who sees a message only ever offers the broadcast channels.
 await page.evaluate(()=>(window as any).chat.party([{id:'a',name:'Ali'}]));
 await page.getByRole('button',{name:'Close chat with Aina'}).click();
 await expect(page.locator('.dm-chip')).toHaveCount(0);
 await expect(page.locator('#chat-channel')).toHaveText(/ALL/);
 await expect(page.locator('#chat-channel')).toBeEnabled();
 await openComposer(page);
 await page.locator('#chat-channel').click();
 await expect(page.getByRole('option')).toHaveCount(2);
 await expect(page.getByRole('option',{name:/@Aina/})).toHaveCount(0);
});

test('unread piles up per channel and shows against its entry in the list',async({page})=>{
 await mount(page,'unread-harness');
 await page.evaluate(()=>{
  const chat=(window as any).chat;
  chat.party([{id:'a',name:'Ali'}]);
  chat.append('Ali','geng talk',undefined,false,true,'party');
  chat.append('Aina','private hello',undefined,false,true,'dm',{id:'u1',name:'Aina'});
 });
 await expect(page.locator('#chat-messages')).not.toContainText('geng talk');

 await expect(page.getByRole('button',{name:/Private messages with Aina, 1 unread/})).toBeVisible();
 await openComposer(page);
 await page.locator('#chat-channel').click();
 await expect(page.getByRole('option',{name:/PARTY/})).toContainText('1');
 await expect(page.getByRole('option',{name:/@Aina/})).toHaveCount(0);

 await page.getByRole('option',{name:/PARTY/}).click();
 await expect(page.locator('.chat-log:not([hidden])')).toContainText('Ali: geng talk');
 await page.locator('#chat-channel').click();
 await expect(page.getByRole('option',{name:/PARTY/})).not.toContainText('1');
});

test('the chat blows up into a bigger window on any screen',async({page})=>{
 await mount(page,'expand-harness');
 await expect(page.locator('#city-chat')).not.toHaveClass(/chat-expanded/);
 await page.getByRole('button',{name:'Expand chat to a larger window'}).click();
 await expect(page.locator('#city-chat')).toHaveClass(/chat-expanded/);

 // The point of it is a bigger reading area.
 const grew=await page.evaluate(()=>document.querySelector('.chat-log')!.getBoundingClientRect().height>260);
 expect(grew).toBe(true);

 await page.getByRole('button',{name:'Shrink chat back'}).click();
 await expect(page.locator('#city-chat')).not.toHaveClass(/chat-expanded/);

 // A phone gets it too — a small panel is hardest to read exactly there. Covered in full
 // by touch-layout.spec, which checks it fills the screen rather than becoming a card.
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole('button',{name:'Expand chat to a larger window'})).toBeVisible();
});
