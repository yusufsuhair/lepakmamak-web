import {test,expect} from '@playwright/test';

for(const reduced of [false,true])test(`tea steam respects reduced motion (${reduced}) and quality`,async({page})=>{
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForFunction(()=>(window as any).__lepak?.mamakMaju.state==='ready');
 await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Steam check');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakSteam.visible)).toBe(!reduced);
 expect(await page.evaluate(()=>(window as any).__lepakMamakSteam.count)).toBeGreaterThan(0);
 await page.locator('#menu').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakSteam.visible)).toBe(false);
 await page.selectOption('#graphics-quality','low');
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakSteam.visible)).toBe(false);
 expect(errors).toEqual([]);
});
