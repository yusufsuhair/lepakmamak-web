import {test,expect} from '@playwright/test';

test('Watsons jingle fades smoothly outside the storefront',async({page})=>{
  await page.goto('/');
  const values=await page.evaluate(async()=>{const {watsonsVolume}=await import('/src/watsons.ts');return Array.from({length:31},(_,i)=>watsonsVolume(i));});
  expect(values[0]).toBe(.35);expect(values[4]).toBe(.35);expect(values[24]).toBe(0);expect(values[30]).toBe(0);
  for(let distance=5;distance<=24;distance++)expect(values[distance]).toBeLessThan(values[distance-1]);
});

test('Watsons loop starts with player interaction and obeys city sounds',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  const state=()=>page.evaluate(()=>(window as any).__lepak.watsons);
  await expect.poll(async()=>(await state()).playing).toBe(true);
  await expect.poll(async()=>(await state()).gain).toBeLessThan(.001);
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('City sounds',{exact:true}).uncheck();
  expect((await state()).playing).toBe(false);expect((await state()).gain).toBe(0);
  await page.getByLabel('City sounds',{exact:true}).check();await expect.poll(async()=>(await state()).playing).toBe(true);
});
