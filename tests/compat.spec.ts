import { test, expect } from '@playwright/test';
for (const viewport of [{width:1280,height:800},{width:320,height:740},{width:844,height:390}]) {
 test(`controls and menus at ${viewport.width}x${viewport.height}`, async ({ browser }, info) => {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width !== 1280, ...(info.project.name !== 'firefox' ? {isMobile: viewport.width !== 1280} : {}) });
  const page = await context.newPage(); const errors:string[]=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:"Jom, let's go"}).click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.getByRole('button',{name:'Zoom camera out'}).click();
  expect(await page.evaluate(()=> (window as any).__lepak.cameraZoom)).toBe(11);
  await page.getByRole('button',{name:'Centre camera',exact:true}).click();
  expect(await page.evaluate(()=> (window as any).__lepak.cameraZoom)).toBe(9);
  for (const selector of ['#menu','#camera-reset','#chat-heading']) {
   const box=await page.locator(selector).boundingBox();
   expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0);
   expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);
   expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);
  }
  if (viewport.width!==1280) {
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
  await page.locator('#reset').scrollIntoViewIfNeeded(); await expect(page.locator('#reset')).toBeInViewport();
  await page.locator('#resume').click(); await expect(page.locator('#pause')).toBeHidden();
  expect(errors).toEqual([]); await context.close();
 });
}
