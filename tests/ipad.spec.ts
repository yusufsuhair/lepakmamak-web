import {test,expect} from '@playwright/test';

const IPAD={width:820,height:1180}, IPAD_LANDSCAPE={width:1180,height:820};

const enter=async(page:any)=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Tablet');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
};

test('a tablet is treated as a touch device, not a small desktop',async({browser})=>{
 const context=await browser.newContext({viewport:IPAD,hasTouch:true});
 const page=await context.newPage();
 await page.goto('/');
 // The whole design rests on this: an iPad reports a coarse pointer despite being wide.
 expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true);
 expect(await page.evaluate(()=>innerWidth)).toBeGreaterThan(600);
 await context.close();
});

test('nobody is told to press keys they do not have',async({browser})=>{
 const context=await browser.newContext({viewport:IPAD,hasTouch:true});
 const page=await context.newPage();
 await page.goto('/');
 // The title screen should not sell a keyboard to someone holding a tablet.
 await expect(page.locator('.intro-hint')).not.toContainText('Best with a keyboard');

 await enter(page);
 await expect(page.locator('body')).toHaveClass(/touch-device/);
 // The W A S D strip is keyboard-only furniture.
 await expect(page.locator('#controls-bar')).toBeHidden();
 await context.close();
});

test('a keyboard player still gets the hints',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();
 await page.goto('/');
 await expect(page.locator('.intro-hint')).toContainText('Best with a keyboard');
 await enter(page);
 await expect(page.locator('#controls-bar')).toBeVisible();
 await context.close();
});

for(const [name,viewport] of [['portrait',IPAD],['landscape',IPAD_LANDSCAPE]] as const){
 test(`touch targets are thumb sized on an iPad in ${name}`,async({browser})=>{
  const context=await browser.newContext({viewport,hasTouch:true});
  const page=await context.newPage();
  await enter(page);
  await expect(page.locator('#multiplayer-status-text')).toBeVisible();

  // Apple's own floor for a tap target is 44pt; mouse-sized buttons miss it.
  const small=await page.evaluate(()=>{
   const targets=[...document.querySelectorAll('.touch-actions button, #interaction, #chat-compose, .hud-top button')];
   return targets.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44;})
                 .map(el=>`${(el as HTMLElement).id||el.className}:${Math.round(el.getBoundingClientRect().height)}`);
  });
  expect(small).toEqual([]);
  await context.close();
 });
}

test('the chat window fits the tablet rather than the desktop it was sized for',async({browser})=>{
 const context=await browser.newContext({viewport:IPAD,hasTouch:true});
 const page=await context.newPage();
 await enter(page);
 await page.getByRole('button',{name:'Expand chat to a larger window'}).click();
 const fits=await page.evaluate(()=>{
  const panel=document.getElementById('city-chat')!.getBoundingClientRect();
  return {inside:panel.left>=0&&panel.right<=innerWidth, wide:panel.width>innerWidth*.5};
 });
 expect(fits.inside).toBe(true);
 expect(fits.wide).toBe(true);
 await context.close();
});

const overlaps=(a:any,b:any)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);

test('the tablet HUD does not stack controls on top of each other',async({browser})=>{
 const context=await browser.newContext({viewport:IPAD,hasTouch:true});
 const page=await context.newPage();
 await enter(page);
 await expect(page.locator('#multiplayer-status-text')).toBeVisible();
 const boxes=await page.evaluate(()=>{
  const box=(sel:string)=>{const el=document.querySelector(sel);if(!el)return null;const r=el.getBoundingClientRect();return r.width&&r.height?{left:r.left,right:r.right,top:r.top,bottom:r.bottom}:null;};
  return {stick:box('#stick-thumb'),actions:box('.touch-actions'),chat:box('#city-chat'),speed:box('#speedometer')};
 });
 // The thumb stick and the action buttons are where your hands live; nothing may sit on them.
 for (const other of ['chat','speed'] as const) {
  for (const control of ['stick','actions'] as const) {
   if (!boxes[other] || !boxes[control]) continue;
   expect({pair:`${control} vs ${other}`,hit:overlaps(boxes[control],boxes[other])}).toEqual({pair:`${control} vs ${other}`,hit:false});
  }
 }
 await context.close();
});
