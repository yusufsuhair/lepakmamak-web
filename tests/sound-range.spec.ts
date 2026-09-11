import {test,expect} from '@playwright/test';

async function enter(page:any){
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Sound range');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await page.locator('#menu').click();
}

test('sound range is editable, persisted and clamped to 50–200 percent',async({page})=>{
 await enter(page);
 const range=page.locator('#sound-range');
 await range.fill('1');
 await range.dispatchEvent('input');
 await expect(range).toHaveValue('1');
 await expect(page.locator('#sound-range-value')).toHaveText('100%');
 await range.fill('1.8');
 await range.dispatchEvent('input');
 await expect(page.locator('#sound-range-value')).toHaveText('180%');
 expect(await page.evaluate(()=>(window as any).__lepak.soundRange)).toBe(1.8);
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('lepakmamak-sound-range'))).toBe('1.8');
 await page.reload();
 await enter(page);
 await expect(page.locator('#sound-range')).toHaveValue('1.8');
 await expect(page.locator('#sound-range-value')).toHaveText('180%');
 await range.fill('0.5');await range.dispatchEvent('input');
 await expect(page.locator('#sound-range-value')).toHaveText('50%');
 await range.fill('2');await range.dispatchEvent('input');
 await expect(page.locator('#sound-range-value')).toHaveText('200%');
});
