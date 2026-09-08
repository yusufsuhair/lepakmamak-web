import {test,expect} from '@playwright/test';
test('graphics quality switches shadows and persists across reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#menu').click();
 await page.locator('#graphics-quality').selectOption('smooth');
 expect(await page.evaluate(()=>(window as any).__lepak.shadows)).toBe(false);
 expect(await page.evaluate(()=>(window as any).__lepak.pixelRatio)).toBeLessThanOrEqual(1);
 await page.reload();await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#menu').click();
 await expect(page.locator('#graphics-quality')).toHaveValue('smooth');
 await page.locator('#graphics-quality').selectOption('detailed');expect(await page.evaluate(()=>(window as any).__lepak.shadows)).toBe(true);
});
