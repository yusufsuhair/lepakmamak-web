import { test, expect } from '@playwright/test';
for (const viewport of [{width:1280,height:800},{width:320,height:740},{width:844,height:390}]) {
 test(`controls and menus at ${viewport.width}x${viewport.height}`, async ({ browser }, info) => {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width !== 1280, ...(info.project.name !== 'firefox' ? {isMobile: viewport.width !== 1280} : {}) });
  const page = await context.newPage(); const errors:string[]=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**/ws',ws=>ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join')ws.send(JSON.stringify({type:'welcome',id:'hud-test',players:[]}));}));
  await page.route('**/src/auth.ts*',route=>route.fulfill({contentType:'application/javascript',body:`export const auth=null;export const session=null;export let guestName='';export function clearGuest(){}export const displayName=()=> 'HUD test';export async function setupAuth(onEnter){setTimeout(onEnter,500);return onEnter;}`}));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:"Jom, let's go"}).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('.game-brand')).toHaveCount(0);
  await expect(page.locator('#camera-in,#camera-out')).toHaveCount(0);
  expect(await page.locator('#multiplayer-status-text').evaluate(el=>getComputedStyle(el).clipPath)).toBe('inset(50%)');
  const minimap=await page.locator('#minimap').boundingBox();expect(minimap!.x).toBeLessThan(viewport.width/2);
  await page.evaluate(()=>{ document.querySelector('canvas')!.dispatchEvent(new WheelEvent('wheel',{deltaY:200,bubbles:true,cancelable:true})); });
  expect(await page.evaluate(()=> (window as any).__lepak.cameraZoom)).toBeGreaterThan(9);
  await page.getByRole('button',{name:'Centre camera',exact:true}).click();
  expect(await page.evaluate(()=> (window as any).__lepak.cameraZoom)).toBe(9);
  for (const selector of ['#menu','#camera-reset','#chat-heading']) {
   const box=await page.locator(selector).boundingBox();
   expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0);
   expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);
   expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);
  }
  if (viewport.width!==1280) {
   await page.locator('#world').evaluate(el=>{el.setPointerCapture=()=>{};for(const [id,x] of [[81,100],[82,200]])el.dispatchEvent(new PointerEvent('pointerdown',{pointerId:id,pointerType:'touch',clientX:x,clientY:200,bubbles:true}));el.dispatchEvent(new PointerEvent('pointermove',{pointerId:82,pointerType:'touch',clientX:250,clientY:200,bubbles:true}));for(const id of [81,82])el.dispatchEvent(new PointerEvent('pointerup',{pointerId:id,pointerType:'touch',bubbles:true}));});
   expect(await page.evaluate(()=>(window as any).__lepak.cameraZoom)).toBeLessThan(9);
   await page.locator('#chat-heading').click();
   await page.locator('#chat-input').focus();
   await expect(page.locator('body')).toHaveClass(/chat-typing/);
   await expect(page.locator('#touch-controls')).toBeHidden();
   await page.locator('#chat-input').evaluate((el:HTMLInputElement)=>el.blur());
   await expect(page.locator('#touch-controls')).toBeVisible();
   await page.locator('#chat-heading').click();
  }
  await page.screenshot({path:`test-results/${info.project.name}-${viewport.width}.png`});
  await page.locator('#menu').click(); await expect(page.locator('#pause')).toBeVisible();
  await expect(page.locator('#reset')).toHaveCount(0);
  await page.locator('#resume').click(); await expect(page.locator('#pause')).toBeHidden();
  expect(errors).toEqual([]); await context.close();
 });
}
