import {test,expect} from '@playwright/test';
import {isStale,isSettled,POLL_MS,shouldOfferConnectionRestart} from '../src/refresh';

test('only a genuinely newer server counts as stale',()=>{
 expect(isStale('1.22.0','1.23.0')).toBe(true);
 expect(isStale('1.22.0','2.0.0')).toBe(true);
 expect(isStale('1.9.0','1.10.0')).toBe(true);      // not a string comparison
 expect(isStale('1.23.0','1.23.0')).toBe(false);
 // The two halves deploy separately, so a client ahead of the server must sit still rather
 // than reload itself in a circle.
 expect(isStale('1.23.0','1.22.0')).toBe(false);
 expect(isStale('1.23.1','1.23.0')).toBe(false);
 // Nothing usable means do nothing at all.
 for(const junk of ['','dev','1.x.0',undefined as any]) expect(isStale('1.23.0',junk)).toBe(false);
 expect(isStale('' ,'1.23.0')).toBe(false);
 expect(shouldOfferConnectionRestart('offline','OFFLINE')).toBe(true);
 expect(shouldOfferConnectionRestart('offline','UNAVAILABLE')).toBe(true);
 expect(shouldOfferConnectionRestart('offline','LOGIN REQUIRED')).toBe(false);
 expect(shouldOfferConnectionRestart('offline','SUSPENDED')).toBe(false);
 expect(shouldOfferConnectionRestart('connecting','RECONNECTING…')).toBe(false);
});

const mount=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {createRefresher}=await import('/src/refresh.ts');
  const held=window as any;
  held.reloads=0; held.clock=0;
  held.refresher=createRefresher(document.getElementById('hud')!,{seconds:3,reload:()=>held.reloads++,now:()=>held.clock});
 });
};
const advance=(page:any,ms:number)=>page.evaluate((by:number)=>{(window as any).clock+=by;},ms);

test('a newer server counts down and then reloads once',async({page})=>{
 await mount(page,'refresh-harness');
 expect(await page.evaluate(()=>(window as any).refresher.check('1.22.0','1.22.0'))).toBe('current');
 await expect(page.locator('#force-refresh')).toBeHidden();

 expect(await page.evaluate(()=>(window as any).refresher.check('1.22.0','1.23.0',true))).toBe('counting');
 await expect(page.locator('#force-refresh')).toBeVisible();
 await expect(page.locator('#refresh-line')).toHaveText('Update wajib dalam 3 saat');
 await expect(page.locator('#refresh-note')).toHaveText('v1.22.0 → v1.23.0');

 await advance(page,1000); await expect(page.locator('#refresh-line')).toHaveText('Update wajib dalam 2 saat');
 await advance(page,1000); await expect(page.locator('#refresh-line')).toHaveText('Update wajib dalam 1 saat');
 expect(await page.evaluate(()=>(window as any).reloads)).toBe(0);
 await advance(page,1000);
 await expect.poll(()=>page.evaluate(()=>(window as any).reloads)).toBe(1);

 // A second welcome while counting must not start a second countdown or reload twice.
 await page.evaluate(()=>(window as any).refresher.check('1.22.0','1.23.0',true));
 await advance(page,4000);
 await expect.poll(()=>page.evaluate(()=>(window as any).reloads)).toBe(1);
});

test('a backgrounded tab does not sit on 3 while its timers are throttled',async({page})=>{
 await mount(page,'throttle-harness');
 await page.evaluate(()=>(window as any).refresher.check('1.22.0','1.23.0',true));
 // One long jump, as a throttled tab produces: the countdown reads the clock, not its ticks.
 await advance(page,3000);
 await expect.poll(()=>page.evaluate(()=>(window as any).reloads)).toBe(1);
});

test('coming back still behind asks instead of reloading in a circle',async({page})=>{
 await mount(page,'loop-harness');
 // As if a previous page load had already reloaded for this very version.
 await page.evaluate(()=>sessionStorage.setItem('lepak-refreshed-for','1.23.0'));
 expect(await page.evaluate(()=>(window as any).refresher.check('1.22.0','1.23.0',true))).toBe('asking');
 await expect(page.locator('#refresh-line')).toHaveText('A NEWER VERSION IS OUT');
 await expect(page.locator('#refresh-now')).toBeVisible();
 await advance(page,5000);
 expect(await page.evaluate(()=>(window as any).reloads)).toBe(0);
 await page.locator('#refresh-now').click();
 expect(await page.evaluate(()=>(window as any).reloads)).toBe(1);
});

 test('normal server updates do not force refresh',async({page})=>{
 await mount(page,'optional-harness');
 expect(await page.evaluate(()=>(window as any).refresher.check('1.22.0','1.23.0'))).toBe('current');
 await advance(page,60000);
 expect(await page.evaluate(()=>(window as any).reloads)).toBe(0);
 });

test('a red connection state offers a responsive restart action in the update rail',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await mount(page,'connection-harness');
 await page.evaluate(()=>(window as any).refresher.showConnectionRestart());
 const notice=page.locator('#force-refresh');
 await expect(notice).toHaveClass(/refresh-optional/);
 await expect(notice).toHaveClass(/connection-recovery/);
 await expect(notice).toBeVisible();
 await expect(page.locator('#refresh-line')).toHaveText('Connection lost');
 await expect(page.locator('#refresh-note')).toHaveText('Connection to the city failed. Restart to reconnect.');
 await expect(page.locator('#refresh-now')).toHaveText('Restart');
 await expect(page.locator('#refresh-now')).toHaveAttribute('aria-label','Restart game');
 const box=await notice.boundingBox();
 expect(box).not.toBeNull();
 expect(box!.width).toBeLessThanOrEqual(320);
 expect(box!.x+box!.width).toBeLessThanOrEqual(390);
 await page.locator('#refresh-now').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).reloads)).toBe(1);
 await page.evaluate(()=>(window as any).refresher.hideConnectionRestart());
 await expect(notice).toBeHidden();
});

// A player who just loaded the page was told "Update tersedia" the moment they entered the
// city, because the first poll runs on the first welcome and Cloudflare keeps serving the
// previous index.html for a while after a deploy. Refreshing then lands on the same build.
test('a page that just loaded is never told it is out of date',()=>{
 expect(isSettled(0)).toBe(false);
 expect(isSettled(POLL_MS-1)).toBe(false);
 expect(isSettled(POLL_MS)).toBe(true);
 expect(isSettled(POLL_MS*10)).toBe(true);
});
