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

test('the party tab appears only while you are in a party',async({page})=>{
 await mount(page,'tabs-harness');
 await expect(page.getByRole('tab',{name:'ALL'})).toBeVisible();
 await expect(page.getByRole('tab',{name:'PARTY'})).toBeHidden();

 await page.evaluate(()=>(window as any).chat.party([{id:'a',name:'Ali'},{id:'b',name:'Mei'}]));
 await expect(page.getByRole('tab',{name:'PARTY'})).toBeVisible();

 await page.evaluate(()=>(window as any).chat.party(null));
 await expect(page.getByRole('tab',{name:'PARTY'})).toBeHidden();
});

test('the active tab decides where a message goes',async({page})=>{
 await mount(page,'route-harness');
 await page.evaluate(()=>(window as any).chat.party([{id:'a',name:'Ali'}]));

 await page.locator('#chat-compose').click();
 await page.locator('#chat-input').fill('to everyone');
 await page.keyboard.press('Enter');

 await page.getByRole('tab',{name:'PARTY'}).click();
 await page.locator('#chat-compose').click();
 await page.locator('#chat-input').fill('geng only');
 await page.keyboard.press('Enter');

 await page.evaluate(()=>(window as any).chat.openDm('u1','Aina'));
 await page.getByRole('tab',{name:'@Aina'}).click();
 await page.locator('#chat-compose').click();
 await page.locator('#chat-input').fill('psst');
 await page.keyboard.press('Enter');

 expect(await page.evaluate(()=>(window as any).sent)).toEqual([
  {text:'to everyone',channel:'all'},
  {text:'geng only',channel:'party'},
  {text:'psst',channel:'dm',to:'u1'},
 ]);
});

test('an incoming message lands in its own tab and counts as unread there',async({page})=>{
 await mount(page,'incoming-harness');
 await page.evaluate(()=>{
  const chat=(window as any).chat;
  chat.party([{id:'a',name:'Ali'}]);
  chat.append('Ali','geng talk',undefined,false,true,'party');
  chat.append('Aina','private hello',undefined,false,true,'dm',{id:'u1',name:'Aina'});
 });

 // ALL is still the active tab, so neither message is showing yet.
 await expect(page.locator('#chat-messages')).not.toContainText('geng talk');
 await expect(page.getByRole('tab',{name:/PARTY/})).toContainText('1');
 await expect(page.getByRole('tab',{name:/@Aina/})).toContainText('1');

 await page.getByRole('tab',{name:/PARTY/}).click();
 await expect(page.locator('.chat-log:not([hidden])')).toContainText('Ali: geng talk');
 await expect(page.getByRole('tab',{name:/PARTY/})).not.toContainText('1');

 await page.getByRole('tab',{name:/@Aina/}).click();
 await expect(page.locator('.chat-log:not([hidden])')).toContainText('Aina: private hello');
});

test('a private thread can be closed, and the public tab can never be',async({page})=>{
 await mount(page,'close-harness');
 await page.evaluate(()=>(window as any).chat.openDm('u1','Aina'));
 await expect(page.getByRole('tab',{name:'@Aina'})).toBeVisible();
 await page.getByRole('button',{name:'Close chat with Aina'}).click();
 await expect(page.getByRole('tab',{name:'@Aina'})).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'ALL'})).toBeVisible();
 await expect(page.getByRole('button',{name:/Close chat with ALL/})).toHaveCount(0);
});
