import {test,expect} from '@playwright/test';

const enter=async(page:any)=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Tapper');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();
};
// A guest gets Kedai too: Cuba needs no account, and every Beli inside it stays disabled.
const items=['Open Lepak Wall','Centre camera','Open inventory','Open Kedai','Open settings'];

test('on a phone the top-right controls fold into one ⋮ that drops them underneath',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
  await enter(page);
  const more=page.getByRole('button',{name:'More controls'});
  await expect(more).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded','false');
  for(const name of items) await expect(page.getByRole('button',{name,exact:true})).toBeHidden();

  await more.tap();
  await expect(more).toHaveAttribute('aria-expanded','true');
  for(const name of items) await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
  // What that Kedai contains for a guest is shop-try.spec's business, not this layout test's.

  // They drop below the ⋮ rather than beside it, and stay on screen.
  const dots=(await more.boundingBox())!;
  const settings=(await page.getByRole('button',{name:'Open settings',exact:true}).boundingBox())!;
  expect(settings.y).toBeGreaterThan(dots.y+dots.height-1);
  expect(settings.x+settings.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/hud-more-open.png'});

  // Choosing something ends the choosing.
  await page.getByRole('button',{name:'Open inventory',exact:true}).tap();
  await expect(more).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:'Close inventory'}).tap();

  // So does a tap anywhere outside the tray.
  await more.tap();
  await expect(more).toHaveAttribute('aria-expanded','true');
  await page.locator('#world').dispatchEvent('pointerdown');
  await expect(more).toHaveAttribute('aria-expanded','false');
 } finally { await context.close(); }
});

test('on a wider screen the row stays a row and the ⋮ never appears',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await enter(page);
 await expect(page.getByRole('button',{name:'More controls'})).toBeHidden();
 for(const name of items) await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
});
