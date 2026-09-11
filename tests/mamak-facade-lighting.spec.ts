import {test,expect} from '@playwright/test';

for(const mobile of [false,true])test(`facade wash improves night sign only; day is unchanged (${mobile?'mobile':'desktop'})`,async({page},info)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/WebGL|shader|THREE/i.test(message.text()))errors.push(message.text());});
  if(mobile)await page.setViewportSize({width:390,height:844});
  await page.goto('/mamak-facade-preview.html');
  await expect.poll(()=>page.evaluate(()=>(window as any).__mamakFacadePreview.state().state)).toBe('ready');
  await page.waitForTimeout(300);
  const sample=async(night:boolean,enabled:boolean)=>page.evaluate(({night,enabled})=>{
    const api=(window as any).__mamakFacadePreview;api.setNight(night);api.setWashEnabled(enabled);
    return {probe:api.probe(),state:api.state()};
  },{night,enabled});
  const dayOff=await sample(false,false),dayOn=await sample(false,true);
  expect(dayOn.state.washIntensity).toBe(0);
  expect(dayOn.probe).toEqual(dayOff.probe);
  const nightOff=await sample(true,false);
  await page.screenshot({path:info.outputPath('night-before-wash.png')});
  const nightOn=await sample(true,true);
  await page.screenshot({path:info.outputPath('night-with-wash.png')});
  expect(nightOn.state.washIntensity).toBe(2);
  expect(nightOn.state.washMaterials).toBeGreaterThan(0);
  expect(nightOn.state.draws).toBe(5);
  expect(nightOn.state.renderCalls).toBe(nightOff.state.renderCalls);
  expect(nightOn.probe.sign.pixels).toBeGreaterThan(0);
  expect(nightOn.probe.sign.luminance).toBeGreaterThan(nightOff.probe.sign.luminance*1.25);
  if(!mobile)expect(nightOn.probe.plaque.luminance).toBeGreaterThan(nightOff.probe.plaque.luminance*1.25);
  for(const area of ['table','window'])expect(nightOn.probe[area]).toEqual(nightOff.probe[area]);
  const restored=await sample(false,true);expect(restored.probe).toEqual(dayOff.probe);
  await page.evaluate(()=>(window as any).__mamakFacadePreview.setNight(true));
  const hidden=await page.evaluate(()=>{const api=(window as any).__mamakFacadePreview;api.setBefore(true);api.probe();return api.state();});
  expect(hidden.washIntensity).toBe(0);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({viewport:mobile?'mobile':'desktop',dayOff,dayOn,nightOff,nightOn,restored}));
});

test('failed kit cannot illuminate the base site at night',async({page})=>{
  const time=Date.parse('2026-09-11T15:00:00Z');
  await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'sunny',observedAt:time,serverTime:time,source:'fixture'}}));
  await page.route('**/LM_ENV_MamakFacade.glb*',r=>r.abort());
  await page.goto('/');
  // The optional request intentionally starts only after the large base GLB is ready.
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.mamakMaju?.state),{timeout:30000}).toBe('ready');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakMamakFacade)).toMatchObject({state:'unavailable',night:true,washIntensity:0,washMaterials:0});
  expect(await page.evaluate(()=>(window as any).__lepak.mamakMaju)).toEqual({state:'ready',fallbackVisible:false});
});
