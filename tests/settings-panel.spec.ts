import {test,expect} from '@playwright/test';

const enter=async(page:any,name='Setter')=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill(name);
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();
};

test('settings is titled Settings, keeps the version and closes from its own X',async({page})=>{
 await enter(page);
 await page.getByRole('button',{name:'Open settings'}).click();
 await expect(page.locator('#pause')).toBeVisible();
 await expect(page.locator('#pause-title')).toHaveText('Settings');
 await expect(page.locator('#app-version')).toContainText('LepakMamak v');
 // The filler is gone.
 await expect(page.locator('#pause')).not.toContainText('Ambil rehat dulu');
 await expect(page.locator('#pause')).not.toContainText('The city keeps moving');

 const close=page.getByRole('button',{name:'Close settings'});
 const title=await page.locator('#pause-title').boundingBox();
 const x=await close.boundingBox();
 // Top right of the panel: level with the title, and to the right of it.
 expect(x!.x).toBeGreaterThan(title!.x+title!.width);
 expect(x!.y).toBeLessThan(title!.y+title!.height);
 await close.click();
 await expect(page.locator('#pause')).toBeHidden();
});

test('the settings button is a gear',async({page})=>{
 await enter(page,'Gear');
 // One path is the cog body, the other its teeth; two bars were neither.
 expect(await page.locator('#menu svg path').count()).toBe(2);
 expect(await page.locator('#menu span').count()).toBe(0);
});

test('keyboard hints show on desktop and never on a touch device',async({browser})=>{
 const desktop=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await desktop.newPage();
 await enter(page);
 await expect(page.locator('#controls-bar')).toBeVisible();
 await desktop.close();

 // A tablet with a trackpad reports a fine primary pointer, which is how these kept
 // appearing on iPads; the detector asks about touch points too.
 for(const viewport of [{width:390,height:844},{width:820,height:1180}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});
  const touchPage=await context.newPage();
  await enter(touchPage);
  await expect(touchPage.locator('#controls-bar')).toBeHidden();
  await context.close();
 }

 const tabletBrowser=await browser.newContext({viewport:{width:833,height:667}});
 const tabletPage=await tabletBrowser.newPage();
 await enter(tabletPage,'Tablet browser');
 await expect(tabletPage.locator('#controls-bar')).toBeHidden();
 await tabletBrowser.close();
});
