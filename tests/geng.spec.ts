import {test,expect} from '@playwright/test';

const enter=async(page:any,name='Geng')=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill(name);
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();
};

test('a geng is set in settings, sticks to the device and rides above your name',async({page})=>{
 await enter(page);
 await page.getByRole('button',{name:'Open settings'}).click();
 await page.locator('#geng-name').fill('Budak Mamak');
 await page.getByRole('button',{name:'Set geng'}).click();
 await expect(page.locator('#geng-status')).toHaveText('Geng set');
 // It reaches the tag drawn above the player's head.
 expect(await page.evaluate(()=>(window as any).__lepak.geng)).toBe('Budak Mamak');

 await page.reload();
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Geng');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await page.getByRole('button',{name:'Open settings'}).click();
 await expect(page.locator('#geng-name')).toHaveValue('Budak Mamak');

 await page.getByRole('button',{name:'Clear geng'}).click();
 await expect(page.locator('#geng-status')).toHaveText('Geng cleared');
 await expect(page.locator('#geng-name')).toHaveValue('');
});

test('the geng tag is drawn above the name, and redraws only when it changes',async({page})=>{
 await page.route('**/geng-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/geng-harness');
 const result=await page.evaluate(async()=>{
  const {nameTag,updateNameTagGeng}=await import('/src/social.ts');
  const label=nameTag('Ali');
  let draws=0; const real=label.userData.drawVoice;
  label.userData.drawVoice=(...args:any[])=>{draws++;return real(...args);};
  updateNameTagGeng(label,'Budak Mamak');
  const after=draws;
  updateNameTagGeng(label,'Budak Mamak');   // same value again
  updateNameTagGeng(label,'');
  return {stored:label.userData.geng,after,total:draws};
 });
 expect(result.after).toBe(1);
 // Setting the same geng again must not repaint a canvas every frame.
 expect(result.total).toBe(2);
 expect(result.stored).toBe('');
});
