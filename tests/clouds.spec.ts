import {test,expect} from '@playwright/test';

for(const [condition,night,visible] of [['sunny',false,true],['cloudy',false,true],['rain',true,true],['fog',false,false],['haze',true,false]] as const) {
  test(`Blender cloud atlas follows ${condition}, night=${night}`,async({page})=>{
    const now=Date.parse(night?'2026-09-11T15:00:00Z':'2026-09-11T06:00:00Z');
    await page.route('**/weather',r=>r.fulfill({json:{available:true,condition,observedAt:now,serverTime:now,source:'Cloud test'}}));
    await page.goto('/');
    await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.state)).toBe('ready');
    await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.weather)).toEqual({condition,night});
    expect(await page.evaluate(()=>(window as any).__lepakClouds.visible)).toBe(visible);
    expect(await page.evaluate(()=>(window as any).__lepakClouds.drawCalls)).toBe(visible?1:0);
  });
}

test('reduced motion freezes drift; smooth quality caps cloud count',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('lepak-graphics','smooth'));
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.instances)).toBe(6);
  expect(await page.evaluate(()=>(window as any).__lepakClouds.rotation)).toBe(0);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  expect(await page.evaluate(()=>(window as any).__lepakClouds.rotation)).toBe(0);
});

test('cloud download failure keeps the city and Mamak usable',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/LM_SKY_Cumulus.png*',r=>r.abort());
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.state)).toBe('fallback');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.mamakMaju.state)).toBe('ready');
  expect(errors).toEqual([]);
});

test('normal motion drifts and detailed quality uses nine clear-weather cards',async({page})=>{
  const now=Date.parse('2026-09-11T06:00:00Z');
  await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'sunny',observedAt:now,serverTime:now,source:'Cloud test'}}));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>localStorage.setItem('lepak-graphics','detailed'));
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.instances)).toBe(9);
  const before=await page.evaluate(()=>(window as any).__lepakClouds.rotation);
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds.rotation)).toBeGreaterThan(before);
});
