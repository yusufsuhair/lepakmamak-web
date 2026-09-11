import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome'});
const results=[];
try {
 for(const mobile of [false,true]) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
  await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'sunny',serverTime:Date.parse('2026-09-11T06:00:00Z'),observedAt:Date.parse('2026-09-11T06:00:00Z')}}));
  await page.goto(process.env.LM_BASE_URL||'http://127.0.0.1:5252');
  await page.waitForFunction(()=>window.__lepak?.mamakMaju.state==='ready');
  await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Performance');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await page.waitForFunction(()=>window.__lepak?.started);
  const sample=await page.evaluate(()=>new Promise(resolve=>{
   const durations=[],draws=[];let previous=0,warmup=120;
   function tick(now){if(warmup>0)warmup--;else if(previous){durations.push(now-previous);draws.push(window.__lepak.drawCalls);}
    previous=now;if(durations.length<240)requestAnimationFrame(tick);else{durations.sort((a,b)=>a-b);resolve({medianMs:durations[120],p95Ms:durations[228],meanDraws:draws.reduce((a,b)=>a+b)/draws.length,quality:window.__lepak.graphicsQuality,autoReduced:window.__lepak.autoReduced});}}
   requestAnimationFrame(tick);
  }));results.push({mobile,...sample});await page.close();
 }
}finally{await browser.close();}
console.log(JSON.stringify(results,null,2));
if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(results,null,2)+'\n');
