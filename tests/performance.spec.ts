import {test,expect} from '@playwright/test';
test('graphics quality switches shadows and persists across reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await page.locator('#menu').click();
 await expect(page.locator('#graphics-quality option')).toHaveText(['Low','High']);
 await expect(page.locator('#shadow-toggle')).toHaveCount(0);
 await page.locator('#graphics-quality').selectOption('low');
 expect(await page.evaluate(()=>(window as any).__lepak.shadows)).toBe(false);
 expect(await page.evaluate(()=>(window as any).__lepak.pixelRatio)).toBeLessThanOrEqual(1);
 await page.reload();await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await page.locator('#menu').click();
 await expect(page.locator('#graphics-quality')).toHaveValue('low');
 await page.locator('#graphics-quality').selectOption('high');expect(await page.evaluate(()=>(window as any).__lepak.shadows)).toBe(true);
});

for(const [old,current] of [['smooth','low'],['detailed','high'],['auto','high']])test(`migrates ${old} graphics to ${current}`,async({page})=>{
 await page.addInitScript(value=>localStorage.setItem('lepak-graphics',value),old);
 await page.goto('/');
 await expect(page.locator('#graphics-quality')).toHaveValue(current);
 expect(await page.evaluate(()=>localStorage.getItem('lepak-graphics'))).toBe(current);
});
