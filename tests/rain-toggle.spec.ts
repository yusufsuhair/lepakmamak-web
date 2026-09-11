import {test,expect} from '@playwright/test';

// The GM weather panel used to replace the label it sat next to, which took "Rain over KL"
// away from every player, Game Master or not.
test('the rain switch survives the GM weather panel and holds once you touch it',async({page})=>{
 await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'sunny',observedAt:Date.now(),serverTime:Date.now(),source:'Test station'}}));
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Rainer');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await page.keyboard.press('Escape');

 const rain=page.getByLabel('Rain over KL');
 await expect(rain).toBeVisible();
 await expect(rain).not.toBeChecked();
 await rain.check();
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__lepak)).rain).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds.weather.condition)).toBe('rain');

 // A live-weather refresh must not quietly switch it back off again.
 await page.waitForTimeout(400);
 await expect(rain).toBeChecked();
 expect((await page.evaluate(()=>(window as any).__lepak)).rain).toBe(true);

 await rain.uncheck();
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__lepak)).rain).toBe(false);
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds.weather.condition)).toBe('sunny');

 // The GM panel still exists; it just sits after the switch instead of on top of it.
 await expect(page.locator('#gm-weather')).toHaveCount(1);
});
