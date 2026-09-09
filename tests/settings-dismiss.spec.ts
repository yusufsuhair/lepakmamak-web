import {test,expect} from '@playwright/test';

const enter=async(page:any,name='Dismisser')=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill(name);
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();
};

test('a tap on the darkness closes settings, a drag out of the panel does not',async({page})=>{
 await enter(page);
 await page.getByRole('button',{name:'Open settings'}).click();
 await expect(page.locator('#pause')).toBeVisible();

 // A press that starts inside the panel and drifts out is a text or scroll gesture.
 const panel=await page.locator('.pause-panel').boundingBox();
 await page.mouse.move(panel!.x+panel!.width/2,panel!.y+40);
 await page.mouse.down();
 await page.mouse.move(8,8);
 await page.mouse.up();
 await expect(page.locator('#pause')).toBeVisible();

 await page.mouse.click(8,8);
 await expect(page.locator('#pause')).toBeHidden();

 // The panel itself still swallows its own clicks.
 await page.getByRole('button',{name:'Open settings'}).click();
 await page.locator('.pause-panel h2').click();
 await expect(page.locator('#pause')).toBeVisible();
 await page.getByRole('button',{name:'Resume'}).click();
 await expect(page.locator('#pause')).toBeHidden();
});
