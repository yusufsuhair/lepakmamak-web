import {test,expect} from '@playwright/test';
test('music can be muted separately and stays muted after resuming and reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.getByRole('button',{name:'Open settings'}).click();
 await page.getByLabel('Background music',{exact:true}).uncheck();
 await expect(page.getByLabel('City sounds',{exact:true})).toBeChecked();
 const paused=()=>page.locator('#background-music').evaluate((audio:HTMLAudioElement)=>audio.paused);
 expect(await paused()).toBe(true);
 await page.locator('#resume').click();expect(await paused()).toBe(true);
 await page.reload();await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.getByRole('button',{name:'Open settings'}).click();
 await expect(page.getByLabel('Background music',{exact:true})).not.toBeChecked();expect(await paused()).toBe(true);
 await page.getByLabel('City sounds',{exact:true}).uncheck();
 await page.getByLabel('Background music',{exact:true}).check();
 await expect.poll(paused).toBe(false);
 await expect(page.getByLabel('City sounds',{exact:true})).not.toBeChecked();
});
