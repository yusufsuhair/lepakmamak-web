import {test,expect} from '@playwright/test';
import {attractions,lands} from '../src/legoland-data';

test('every resort zone has playable attractions and unique destinations',()=>{
 expect(lands).toHaveLength(10);
 expect(new Set(attractions.map(a=>a.name)).size).toBe(attractions.length);
 for(let land=0;land<lands.length;land++)expect(attractions.some(a=>a.land===land)).toBe(true);
 for(const a of attractions){expect(a.x).toBeGreaterThan(-160);expect(a.x).toBeLessThan(280);expect(a.z).toBeGreaterThan(-155);expect(a.z+13).toBeLessThan(165);}
});

test('build workshop awards one persistent stamp and can be exited',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/legoland.html');
 await expect(page.locator('#park-error')).toHaveCount(0);
 const workshop=attractions.find(a=>a.name==='Build & Test')!;
 await page.locator('#park-destination').selectOption(String(workshop.id));
 await expect(page.locator('#park-title')).toHaveText(workshop.name);
 await page.locator('#park-action').click();
 await expect(page.locator('#park-destination')).toBeDisabled();
 await page.locator('#park-build').click();await page.locator('#park-undo').click();
 await expect(page.locator('#park-status')).toHaveText('Binaan 0 / 8 blok');
 for(let i=0;i<8;i++)await page.locator('#park-build').click();
 await expect(page.locator('#park-pass')).toHaveText(`1 / ${attractions.length}`);
 await page.locator('#park-build').click();
 await expect(page.locator('#park-pass')).toHaveText(`1 / ${attractions.length}`);
 await page.locator('#park-exit').click();
 await expect(page.locator('#park-destination')).toBeEnabled();
 await page.reload();await expect(page.locator('#park-pass')).toHaveText(`1 / ${attractions.length}`);
 expect(errors).toEqual([]);
});

test('ride completes, awards a stamp and exits using Escape',async({page})=>{
 await page.goto('/legoland.html');
 const ride=attractions.find(a=>a.name==='The Dragon')!;
 await page.locator('#park-destination').selectOption(String(ride.id));
 await expect(page.locator('#park-title')).toHaveText(ride.name);
 await page.locator('#park-action').click();
 await expect(page.locator('#park-pass')).toHaveText(`1 / ${attractions.length}`,{timeout:65000});
 await page.keyboard.press('Escape');await expect(page.locator('#park-exit')).toBeHidden();
});

test('mobile map and touch controls are available; guide pauses activity',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/legoland.html');
 await expect(page.locator('#park-map')).toBeHidden();
 await page.locator('#park-map-toggle').click();await expect(page.locator('#park-map')).toBeVisible();
 await page.locator('#park-destination').selectOption(String(attractions.find(a=>a.name==='Ocean Tunnel')!.id));
 await expect(page.locator('#park-title')).toHaveText('Ocean Tunnel');
 await page.locator('#park-map-toggle').click();await page.locator('#park-action').click();
 await expect(page.locator('#park-collect')).toBeVisible();
 await expect(page.getByRole('button',{name:'Maju',exact:true})).toBeVisible();
 await page.locator('#park-guide').click();await expect(page.locator('#park-help')).toBeVisible();
 await page.locator('#park-help-close').click();await page.locator('#park-exit').click();
 await page.screenshot({path:'test-results-legoland/mobile.png'});
});

test('target game registers real canvas hits and awards a stamp',async({page})=>{
 await page.goto('/legoland.html');
 const ride=attractions.find(a=>a.name==='LEGO NINJAGO The Ride')!;
 await page.locator('#park-destination').selectOption(String(ride.id));
 await expect(page.locator('#park-title')).toHaveText(ride.name);
 await page.locator('#park-action').click();await page.waitForTimeout(800);
 for(let i=0;i<8;i++){
  const point=await page.evaluate((index)=>(window as any).__legoland.targets[index],i);
  await page.mouse.click(point.screenX,point.screenY);
 }
 await expect(page.locator('#park-pass')).toHaveText(`1 / ${attractions.length}`);
});

test('driving requires ordered checkpoints and exploring requires nearby collection',async({page})=>{
 await page.goto('/legoland.html');
 for(const name of ['Driving School','MINILAND Asia']){
  const a=attractions.find(a=>a.name===name)!;
  await page.locator('#park-destination').selectOption(String(a.id));
  await expect(page.locator('#park-title')).toHaveText(name);await page.locator('#park-action').click();
  for(let index=0;index<5;index++){
   for(let attempt=0;attempt<100;attempt++){
    const state=await page.evaluate(()=>(window as any).__legoland);
    const target=state.targets[index],dx=target.x-state.position.x,dz=target.z-state.position.z;
    if(Math.hypot(dx,dz)<2.2)break;
    const codes=[dx>1?'KeyD':dx< -1?'KeyA':'',dz>1?'KeyS':dz< -1?'KeyW':''].filter(Boolean);
    for(const code of codes)await page.keyboard.down(code);
    await page.waitForTimeout(90);
    for(const code of codes)await page.keyboard.up(code);
   }
   if(a.kind==='explore')await page.locator('#park-collect').click();
   await expect.poll(()=>page.evaluate(()=>(window as any).__legoland.score)).toBe(index+1);
  }
  await page.locator('#park-exit').click();
 }
 await expect(page.locator('#park-pass')).toHaveText(`2 / ${attractions.length}`);
});
