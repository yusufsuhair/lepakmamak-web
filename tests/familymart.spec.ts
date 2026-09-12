import {test,expect} from '@playwright/test';
import {enterAt} from './city';

test('FamilyMart song fades smoothly outside the storefront',async({page})=>{
  await page.goto('/');
  const values=await page.evaluate(async()=>{const {familyMartVolume}=await import('/src/familymart.ts');return Array.from({length:31},(_,i)=>familyMartVolume(i));});
  expect(values[0]).toBe(.3);expect(values[4]).toBe(.3);expect(values[24]).toBe(0);expect(values[30]).toBe(0);
  for(let distance=5;distance<=24;distance++)expect(values[distance]).toBeLessThan(values[distance-1]);
});

test('FamilyMart loop plays within earshot of the storefront and obeys city sounds',async({page})=>{
  // Spawn is 67 m from familyMartSpot (49,43), where the song is silent and the loop is meant
  // to stay paused. Arrive at the storefront instead: the loop plays what the player can hear.
  const moveTo=await enterAt(page,49,49);
  const state=()=>page.evaluate(()=>(window as any).__lepak.familyMart);
  await expect.poll(async()=>(await state()).playing).toBe(true);
  await expect.poll(async()=>(await state()).gain).toBeGreaterThan(.05);
  moveTo(-18,52);
  await expect.poll(async()=>(await state()).playing).toBe(false);
  await expect.poll(async()=>(await state()).gain).toBeLessThan(.001);
  moveTo(49,49);
  await expect.poll(async()=>(await state()).playing).toBe(true);
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('City sounds',{exact:true}).uncheck();
  expect((await state()).playing).toBe(false);expect((await state()).gain).toBe(0);
  await page.getByLabel('City sounds',{exact:true}).check();await expect.poll(async()=>(await state()).playing).toBe(true);
});
