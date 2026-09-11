import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const output=path.resolve(process.argv[2] ?? 'art/blender/generated/street-props');
await fs.mkdir(path.join(output,'previews'),{recursive:true});
await fs.mkdir(path.join(output,'reports'),{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const results=[];
try {
  for (const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport,isMobile:name==='mobile',hasTouch:name==='mobile'});
    const page=await context.newPage();
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.LM_BASE_URL ?? 'http://127.0.0.1:5192/');
    await page.waitForFunction(()=>window.__lepakStreets?.state==='ready');
    await page.getByRole('button',{name:"Jom, let's go"}).click();
    await page.locator('#auth-guest').click();
    await page.locator('#guest-name').fill('Mamak Walk');
    await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
    await page.waitForFunction(()=>window.__lepak.started);
    // Walk through the courtyard gap to inspect the west-side benches and palm.
    for (const [key,axis,target,direction] of [['s','z',56.5,1],['a','x',-42,-1]]) {
      await page.keyboard.down(key);
      try { await page.waitForFunction(([axis,target,direction])=>
        (window.__lepak.position[axis]-target)*direction>=0,[axis,target,direction],{timeout:15000}); }
      finally { await page.keyboard.up(key); }
    }
    await page.screenshot({path:path.join(output,'previews',`game-${name}.png`)});
    const state=await page.evaluate(()=>({...window.__lepakStreets,position:window.__lepak.position,worldDraws:window.__lepak.drawCalls}));
    assert.equal(state.state,'ready'); assert.equal(state.fallbackVisible,false); assert.deepEqual(errors,[]);
    results.push({viewport:name,...state,pageErrors:errors});
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(output,'reports/browser-tests.json'),JSON.stringify({passed:true,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
