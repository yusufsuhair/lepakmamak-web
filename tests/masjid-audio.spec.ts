import {test,expect} from '@playwright/test';

test('the remaining mosque has one smooth location-based audio fade',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {masjidSpots,masjidVolume,nearestMasjidDistance}=await import('/src/masjid.ts');
    // Measured from the spots themselves: the first mosque used to be hardcoded at -31,112,
    // which is where the PETRONAS station now stands, so the assertion drifted with the map.
    return {spots:masjidSpots,nearFirst:nearestMasjidDistance(masjidSpots[0]),volumes:Array.from({length:41},(_,i)=>masjidVolume(i))};
  });
  expect(result.spots).toHaveLength(1);expect(result.nearFirst).toBe(0);
  expect(result.volumes[0]).toBe(.38);expect(result.volumes[6]).toBe(.38);expect(result.volumes[32]).toBe(0);expect(result.volumes[40]).toBe(0);
  for(let distance=7;distance<=32;distance++)expect(result.volumes[distance]).toBeLessThan(result.volumes[distance-1]);
});

test('mosque audio starts after entry and obeys City sounds',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  const state=()=>page.evaluate(()=>(window as any).__lepak.masjid);
  await expect.poll(async()=>(await state()).playing).toBe(true);
  await expect.poll(async()=>(await state()).gain).toBeLessThan(.001);
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('City sounds',{exact:true}).uncheck();
  expect((await state()).playing).toBe(false);expect((await state()).gain).toBe(0);
  await page.getByLabel('City sounds',{exact:true}).check();await expect.poll(async()=>(await state()).playing).toBe(true);
});
