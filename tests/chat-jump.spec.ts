import {test,expect} from '@playwright/test';

const mount=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {setupChat}=await import('/src/social.ts');
  (window as any).chat=setupChat(()=>true,()=>{});
 });
};
const say=(page:any,count:number,from='line')=>page.evaluate(([n,tag]:[number,string])=>{
 for(let i=0;i<n;i++)(window as any).chat.append('Ali',`${tag} ${i}`);
},[count,from] as [number,string]);

test('reading back holds its place, and the arrow brings you to the newest line',async({page})=>{
 await mount(page,'jump-harness');
 const jump=page.locator('#chat-jump'), log=page.locator('#chat-messages');

 // A log that already sits at the bottom keeps following along, so the arrow stays away.
 await say(page,30);
 await expect(jump).toBeHidden();
 expect(await log.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(24);

 await log.evaluate(el=>{el.scrollTop=0;});
 await expect(jump).toBeVisible();

 // Nothing yanks you back down while you are reading history.
 await say(page,5,'later');
 expect(await log.evaluate(el=>el.scrollTop)).toBe(0);
 await expect(jump).toBeVisible();

 await jump.click();
 await expect(jump).toBeHidden();
 expect(await log.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(24);
 await expect(log.locator('p').last()).toContainText('later 4');
});

test('a collapsed panel never floats an arrow over the city',async({page})=>{
 await mount(page,'jump-collapsed-harness');
 await say(page,30);
 await page.locator('#chat-messages').evaluate(el=>{el.scrollTop=0;});
 await expect(page.locator('#chat-jump')).toBeVisible();
 await page.getByRole('button',{name:/Collapse city chat/}).click();
 await expect(page.locator('#chat-jump')).toBeHidden();
});

test('a message carries where it was said, and the bar has no minimize button of its own',async({page})=>{
 await mount(page,'area-harness');
 await page.evaluate(()=>{
  const chat=(window as any).chat;
  chat.append('Ali','jom teh tarik',undefined,false,true,'all',undefined,'Kampung Maju');
  chat.append('Mei','no area on this one');
 });
 const rows=page.locator('#chat-messages p');
 await expect(rows.first().locator('.chat-area')).toHaveText('Kampung Maju');
 await expect(rows.first()).toContainText('Ali:');
 await expect(rows.first()).toContainText('jom teh tarik');
 // Nothing to show means nothing is shown, rather than an empty line under the name.
 await expect(rows.nth(1).locator('.chat-area')).toHaveCount(0);

 // The header is the control; a separate minimize glyph beside it was redundant.
 await expect(page.locator('#chat-toggle-label')).toHaveCount(0);
 await expect(page.locator('#chat-min')).toHaveCount(0);
 await expect(page.locator('#chat-body')).toBeVisible();
 await page.getByRole('button',{name:/Collapse city chat/}).click();
 await expect(page.locator('#chat-body')).toBeHidden();
 await page.getByRole('button',{name:/Expand city chat/}).click();
 await expect(page.locator('#chat-body')).toBeVisible();
});
