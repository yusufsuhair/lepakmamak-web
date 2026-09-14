import {test,expect} from '@playwright/test';

for(const [condition,night,visible] of [['sunny',false,true],['cloudy',false,true],['rain',true,true],['fog',false,false],['haze',true,false]] as const) {
  test(`procedural sky follows ${condition}, night=${night}`,async({page})=>{
    const now=Date.parse(night?'2026-09-11T15:00:00Z':'2026-09-11T06:00:00Z');
    await page.route('**/weather',r=>r.fulfill({json:{available:true,condition,observedAt:now,serverTime:now,source:'Cloud test'}}));
    await page.goto('/');
    await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.state)).toBe('ready');
    await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.weather)).toMatchObject({condition,night});
    expect(await page.evaluate(()=>(window as any).__lepakClouds.visible)).toBe(visible);
    expect(await page.evaluate(()=>(window as any).__lepakClouds.drawCalls)).toBe(1);
  });
}

test('reduced motion freezes drift; smooth quality reduces procedural layers',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('lepak-graphics','smooth'));
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.layers)).toBe(1);
  expect(await page.evaluate(()=>(window as any).__lepakClouds.rotation)).toBe(0);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  expect(await page.evaluate(()=>(window as any).__lepakClouds.rotation)).toBe(0);
});

test('procedural sky has no dependency on cloud image downloads',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let requests=0;
  await page.route('**/LM_SKY_Cumulus.png*',r=>{requests++;return r.abort();});
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.mode)).toBe('photographic-sky-v3');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.state)).toBe('ready');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.mamakMaju.state)).toBe('ready');
  expect(errors).toEqual([]);
  expect(requests).toBe(0);
});

test('normal motion drifts and detailed quality enables both cloud layers',async({page})=>{
  const now=Date.parse('2026-09-11T06:00:00Z');
  await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'sunny',observedAt:now,serverTime:now,source:'Cloud test'}}));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>localStorage.setItem('lepak-graphics','detailed'));
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.layers)).toBe(2);
  const before=await page.evaluate(()=>(window as any).__lepakClouds.rotation);
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds.rotation)).toBeGreaterThan(before);
});

// Lightning is a rare, soft sky flash in rain only: at least 20 s apart, each over in well under a
// second with a single peak (no strobing), and none at all with reduced motion.
test('storm lightning is rare, brief and off with reduced motion',async({page})=>{
  await page.route('**/lightning-harness',r=>r.fulfill({contentType:'text/html',body:'<div></div>'}));
  await page.goto('/lightning-harness');
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/.vite/deps/three.js' as string);
    const {createClouds}=await import('/src/clouds.ts' as string);
    const run=(condition:string,reducedMotion:boolean)=>{
      const clouds=createClouds(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
      clouds.setWeather({condition,night:false});
      const starts:number[]=[];let longest=0,lit=0,peaks=0,previous=0,rising=false,count=0;
      for(let step=0;step<=6000;step++){
        const t=step*.05;clouds.update(t,camera,reducedMotion,false);
        const {flashes,flash}=clouds.status.lightning;
        if(flashes>count){count=flashes;starts.push(t);}
        lit=flash>.02?lit+.05:0;longest=Math.max(longest,lit);
        if(flash<previous&&rising)peaks++;rising=flash>previous;previous=flash;
      }
      return {starts,longest,peaks};
    };
    return {storm:run('rain',false),reduced:run('rain',true),clear:run('sunny',false)};
  });
  const starts:number[]=result.storm.starts,gaps=starts.slice(1).map((t,i)=>t-starts[i]);
  expect(starts.length).toBeGreaterThanOrEqual(3);expect(starts.length).toBeLessThanOrEqual(15);   // 300 s of storm
  expect(starts[0]).toBeGreaterThanOrEqual(20);
  for(const gap of gaps)expect(gap).toBeGreaterThanOrEqual(19.9);
  expect(result.storm.longest).toBeLessThan(.7);expect(result.storm.peaks).toBe(starts.length);
  expect(result.reduced.starts).toEqual([]);expect(result.clear.starts).toEqual([]);
});
