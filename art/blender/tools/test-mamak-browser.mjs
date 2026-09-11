import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const output = path.resolve(process.argv[2] ?? 'art/blender/generated/mamak-maju');
const baseURL = process.env.LM_BASE_URL ?? 'http://127.0.0.1:5192';
await fs.mkdir(path.join(output, 'previews'), { recursive: true });
await fs.mkdir(path.join(output, 'reports'), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  for (const [name, viewport] of [['desktop', {width:1440,height:900}], ['mobile', {width:390,height:844}]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: name === 'mobile', hasTouch: name === 'mobile' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL);
    await page.waitForFunction(() => window.__lepak?.mamakMaju?.state === 'ready');
    await page.getByRole('button', {name: "Jom, let's go"}).click();
    await page.locator('#auth-guest').click();
    await page.locator('#guest-name').fill('Mamak Guest');
    await page.getByRole('button', {name:'Enter as guest',exact:true}).click();
    await page.waitForFunction(() => window.__lepak?.started);
    await page.screenshot({path:path.join(output,'previews',`game-${name}.png`)});
    const stats = await page.evaluate(() => ({...window.__lepak.mamakMaju, drawCalls:window.__lepak.drawCalls, triangles:window.__lepak.triangles}));
    assert.equal(stats.fallbackVisible, false);
    if (name === 'desktop') {
      await page.keyboard.down('a');
      await page.waitForFunction(() => window.__lepak.position.x < -26);
      await page.keyboard.up('a');
      await page.locator('#interaction').click();
      await page.waitForFunction(() => window.__lepak.seated);
      await page.screenshot({path:path.join(output,'previews','game-seated.png')});
      await page.locator('#interaction').click();
      await page.waitForFunction(() => !window.__lepak.seated);
    }
    assert.deepEqual(errors, []);
    results.push({viewport:name,...stats,pageErrors:errors,sitStand:name==='desktop'?'passed':'not exercised'});
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(output,'reports','browser-tests.json'), JSON.stringify({passed:true,baseURL,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
