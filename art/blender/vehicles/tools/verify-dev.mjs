import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const base=process.argv[2];
assert.ok(base && new URL(base).hostname.endsWith('lepakmamak-dev.pages.dev'),'Only verify the dev Pages project');
const output=path.resolve(process.argv[3] || '/tmp/astra-vehicle-dev-verification');
await fs.mkdir(output,{recursive:true});
const manifest=JSON.parse(await fs.readFile(path.join(root,'art/blender/generated/vehicles-v2/reports/runtime-manifest.json')));
for (const item of manifest) {
  const response=await fetch(`${base}/assets/models/vehicles/${item.file}?v=vehicles-v2`);
  assert.equal(response.status,200,item.file);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.file);
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/vehicles-preview.html`,{waitUntil:'networkidle'});
  const layout=await page.evaluate(()=>({margin:getComputedStyle(document.body).margin,
    header:getComputedStyle(document.querySelector('header')).position,canvasTop:document.querySelector('canvas').getBoundingClientRect().top,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
  assert.deepEqual(layout,{margin:'0px',header:'fixed',canvasTop:0,overflow:false},'Studio CSS must work under the deployed CSP');
  const styles=manifest.filter(i=>i.lod==='near').map(i=>i.style);
  const states=[];
  for (const style of styles) {
    await page.selectOption('#model',style);
    await page.waitForFunction(style=>window.__vehicleStudio?.style===style && window.__vehicleStudio?.state==='ready' && window.__vehicleStudio?.presentation?.levels===3,style);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    states.push(await page.evaluate(()=>({style:window.__vehicleStudio.style,triangles:window.__vehicleStudio.triangles,calls:window.__vehicleStudio.calls,wheels:window.__vehicleStudio.wheels})));
    await page.screenshot({path:path.join(output,`${style}-mobile.png`)});
  }
  await page.selectOption('#model','myvi');await page.click('#lighting');await page.click('#brake');
  await page.waitForFunction(()=>window.__vehicleStudio.presentation.brake===3.2);
  await page.screenshot({path:path.join(output,'myvi-mobile-night-brake.png')});
  await page.goto(base);
  await page.getByRole('button',{name:"Jom, let's go"}).click();
  await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Vehicle QA');
  await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await page.getByText('CITY ONLINE',{exact:true}).waitFor({timeout:30000});
  await page.screenshot({path:path.join(output,'dev-game-mobile.png')});
  assert.deepEqual(errors,[]);
  const report={base,verifiedAssets:manifest.length,states,errors,cityOnline:true};
  await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }
