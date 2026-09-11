import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] ?? 'http://127.0.0.1:5192/art/blender/preview/';
const output = path.join(root, 'generated');
const browser = await chromium.launch({ headless: true, ...(process.env.LM_BROWSER_CHANNEL ? { channel: process.env.LM_BROWSER_CHANNEL } : {}) });
const results = [];
try {
  for (const [name, viewport] of [['desktop', { width: 1100, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: name === 'mobile' ? 3 : 1, isMobile: name === 'mobile', hasTouch: name === 'mobile' });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(url);
    await page.waitForFunction(() => window.LM_ASSET_CHECK);
    const result = await page.evaluate(() => window.LM_ASSET_CHECK);
    assert.equal(result.loaded, true);
    result.bounds.size.forEach(v => assert.ok(Math.abs(v - 1) < 1e-5));
    assert.equal(result.assetOnly.triangles, 12);
    assert.equal(result.assetOnly.drawCalls, 3);
    assert.ok(result.pixelRatio <= 1.5);
    for (const angle of ['iso', 'front', 'right', 'top']) {
      await page.locator(`[data-view="${angle}"]`).click();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      // Read actual rendered pixels: shader failures/blank canvases must not pass.
      const pixels = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const gl = canvas.getContext('webgl2');
        const rgba = new Uint8Array(4);
        const samples = [];
        for (const [x, y] of [[.5, .5], [.03, .97]]) {
          gl.readPixels(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
          samples.push([...rgba]);
        }
        return { samples, error: gl.getError() };
      });
      assert.equal(pixels.error, 0);
      assert.notDeepEqual(pixels.samples[0], pixels.samples[1], `Blank ${angle} render`);
      await page.locator('canvas').screenshot({ path: path.join(output, `previews/three-${name}-${angle}.png`) });
    }
    assert.deepEqual(errors, []);
    results.push({ viewport: name, ...result, consoleErrors: errors, viewsChecked: 4 });
    await page.close();
  }
  await fs.writeFile(path.join(output, 'reports/browser-tests.json'), JSON.stringify({ passed: true, results }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
