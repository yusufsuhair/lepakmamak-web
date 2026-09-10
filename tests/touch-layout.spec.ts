import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// `pointer` asks about the primary input. An iPad with a trackpad answers "fine", which
// switched off every rule written for tablets on the exact devices they were written for.
test('touch layout is decided by any-pointer, never by the primary pointer',()=>{
 const css=readFileSync('src/style.css','utf8');
 expect(css).not.toContain('@media (pointer: coarse)');
 expect(css.match(/@media \(any-pointer: coarse\)/g)!.length).toBeGreaterThanOrEqual(6);
});

const enter=async(page:any,name='Layout')=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill(name);
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();
};
const box=(page:any,selector:string)=>page.locator(selector).evaluate((el:Element)=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};});

for(const [label,width,height] of [['tablet portrait',820,1180],['tablet landscape',1180,820],['phone',390,844]] as const)
test(`hands own the bottom corners on ${label}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
  await enter(page);
  const chat=await box(page,'#city-chat');
  const stick=await box(page,'.touch-stick, #touch-controls > div:first-child');
  const speed=await box(page,'#speedometer');
  const actions=await box(page,'.touch-actions');
  // Chat sits clear above the thumbstick, and the speed above the action buttons.
  expect(chat.bottom).toBeLessThanOrEqual(stick.top);
  expect(speed.bottom).toBeLessThanOrEqual(actions.top);
  // Everything stays on screen.
  for(const rect of [chat,speed,actions]) { expect(rect.right).toBeLessThanOrEqual(width+1); expect(rect.left).toBeGreaterThanOrEqual(-1); }
  await page.screenshot({path:`test-results/touch-${label.replace(' ','-')}.png`});
 } finally { await context.close(); }
});

test('a phone can blow the chat up to fill the screen, and close it again',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
  await enter(page,'Fuller');
  const expand=page.getByRole('button',{name:'Expand chat to a larger window'});
  await expect(expand).toBeVisible();
  await expand.tap();
  await expect(page.locator('#city-chat')).toHaveClass(/chat-expanded/);
  const full=await box(page,'#city-chat');
  // Filling the screen, not a centred card there is no room for.
  expect(full.right-full.left).toBeGreaterThan(380);
  expect(full.bottom-full.top).toBeGreaterThan(800);
  await page.screenshot({path:'test-results/chat-fullscreen-phone.png'});
  // The same control closes it, and says so.
  const close=page.getByRole('button',{name:'Shrink chat back'});
  await expect(close).toHaveText('⤡');
  await close.tap();
  await expect(page.locator('#city-chat')).not.toHaveClass(/chat-expanded/);
 } finally { await context.close(); }
});
