import {test,expect} from '@playwright/test';

test('FamilyMart song fades smoothly outside the storefront',async({page})=>{
  await page.goto('/');
  const values=await page.evaluate(async()=>{const {familyMartVolume}=await import('/src/familymart.ts');return Array.from({length:31},(_,i)=>familyMartVolume(i));});
  expect(values[0]).toBe(.3);expect(values[4]).toBe(.3);expect(values[24]).toBe(0);expect(values[30]).toBe(0);
  for(let distance=5;distance<=24;distance++)expect(values[distance]).toBeLessThan(values[distance-1]);
});

test('FamilyMart loop starts with player interaction and obeys city sounds',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();
  const state=()=>page.evaluate(()=>(window as any).__lepak.familyMart);
  await expect.poll(async()=>(await state()).playing).toBe(true);
  await expect.poll(async()=>(await state()).gain).toBeLessThan(.001);
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('City sounds',{exact:true}).uncheck();
  expect((await state()).playing).toBe(false);expect((await state()).gain).toBe(0);
  await page.getByLabel('City sounds',{exact:true}).check();await expect.poll(async()=>(await state()).playing).toBe(true);
});
