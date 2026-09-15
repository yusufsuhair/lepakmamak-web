import {test,expect} from '@playwright/test';
test('graphics quality switches shadows and persists across reload',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('lepak-graphics','low'));
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await page.locator('#menu').click();
 await expect(page.locator('#graphics-quality option')).toHaveText(['Lowest','Low','High']);
 await expect(page.locator('#shadow-toggle')).toHaveCount(0);
 await page.locator('#graphics-quality').selectOption('low');
 expect(await page.evaluate(()=>(window as any).__lepak.shadows)).toBe(false);
 expect(await page.evaluate(()=>(window as any).__lepak.pixelRatio)).toBeLessThanOrEqual(1);
 await page.waitForTimeout(500);expect(await page.evaluate(()=>(window as any).__lepakPetronas.state)).toBe('idle');
 await page.reload();await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await page.locator('#menu').click();
 await expect(page.locator('#graphics-quality')).toHaveValue('low');
 await page.locator('#graphics-quality').selectOption('high');expect(await page.evaluate(()=>(window as any).__lepak.shadows)).toBe(true);
 await page.locator('#graphics-quality').selectOption('lowest');
 expect(await page.evaluate(()=>(window as any).__lepak)).toMatchObject({graphicsQuality:'lowest',shadows:false,pixelRatio:.75});
});

test('touch ignores high saved by an earlier browser session',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844}}),page=await context.newPage();
 await page.addInitScript(()=>localStorage.setItem('lepak-graphics','high'));await page.goto('/');
 await expect(page.locator('#graphics-quality')).toHaveValue('low');
 await page.locator('#graphics-quality').evaluate((select:HTMLSelectElement)=>{select.value='high';select.dispatchEvent(new Event('change'));});
 await page.reload();await expect(page.locator('#graphics-quality')).toHaveValue('high');await context.close();
});

for(const [old,current] of [['smooth','low'],['detailed','high'],['auto','high']])test(`migrates ${old} graphics to ${current}`,async({page})=>{
 await page.addInitScript(value=>localStorage.setItem('lepak-graphics',value),old);
 await page.goto('/');
 await expect(page.locator('#graphics-quality')).toHaveValue(current);
 expect(await page.evaluate(()=>localStorage.getItem('lepak-graphics'))).toBe(current);
});
