import { test, expect, type Page } from '@playwright/test';
import { enterAt } from './city';

// A finite silent stream keeps source switching deterministic without relying on
// a station's availability or playing live broadcasts during regression runs.
function wave() {
  const data = Buffer.alloc(44 + 8000 * 60 * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(data.length - 44, 40); return data;
}
async function streams(page: Page) {
  await page.route('https://*.rcs.revma.com/**', route => route.fulfill({contentType:'audio/wav', headers:{'access-control-allow-origin':'*'}, body:wave()}));
}
async function picker(page: Page) {
  const hint = page.getByRole('button', {name:'Dismiss exploration hint'});
  if (await hint.isVisible()) await hint.click();
  await page.getByRole('button', {name:'Open music and radio', exact:true}).click();
}
async function audioState(page: Page) {
  return page.evaluate(() => Object.fromEntries(['lofi-music','background-music','live-radio'].map(id => {
    const a = document.getElementById(id) as HTMLAudioElement;
    return [id, {paused:a.paused, src:a.getAttribute('src')}];
  })));
}

test('switches music/radio exclusively, shares volume, stops downloads, and remembers muted selection', async ({page}) => {
  await streams(page); await enterAt(page, -18, 52);
  expect((await audioState(page))['live-radio'].src).toBeNull();
  await picker(page);
  await page.getByRole('button', {name:'Radio', exact:true}).click();
  await expect(page.locator('.music-detail-status')).toHaveText('LIVE RADIO');
  let state = await audioState(page);
  expect(state['lofi-music'].paused).toBe(true); expect(state['background-music'].paused).toBe(true);
  expect(state['live-radio'].paused).toBe(false);
  await page.getByRole('button', {name:'Hot FM Malay', exact:true}).click();
  await expect(page.locator('.music-detail-title')).toHaveText('Hot FM');
  await expect(page.locator('.music-detail-status')).toHaveText('LIVE RADIO');
  await page.getByLabel('Player volume', {exact:true}).fill('0.35');
  await expect(page.locator('#music-volume')).toHaveValue('0.35');
  await page.getByRole('button', {name:'Music', exact:true}).click();
  await expect.poll(async () => (await audioState(page))['lofi-music'].paused).toBe(false);
  expect((await audioState(page))['live-radio'].src).toBeNull();
  await page.getByRole('button', {name:'Radio', exact:true}).click();
  await expect(page.locator('.music-detail-status')).toHaveText('LIVE RADIO');
  await page.locator('.music-detail-play').click();
  state = await audioState(page);
  expect(state['live-radio'].src).toBeNull(); expect(state['live-radio'].paused).toBe(true);
  await page.getByRole('button', {name:'Close music and radio'}).click();
  await page.locator('#world').click({position:{x:400,y:300}});
  expect((await audioState(page))['live-radio'].src).toBeNull();
  await page.reload(); await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#music-toggle')).not.toBeChecked();
  await expect(page.locator('.music-title')).toHaveText('Hot FM');
  expect((await audioState(page))['live-radio'].src).toBeNull();
});

test('failed radio offers retry and switching to music, without retries on gameplay taps', async ({page}) => {
  let requests = 0;
  await page.route('https://*.rcs.revma.com/**', route => { requests++; return route.abort(); });
  await enterAt(page, -18, 52); await picker(page);
  await page.getByRole('button', {name:'Radio', exact:true}).click();
  await expect(page.locator('.music-error')).toBeVisible();
  expect((await audioState(page))['live-radio'].src).toBeNull();
  const attempts = requests;
  await page.getByRole('button', {name:'Close music and radio'}).click();
  await page.locator('#world').click({position:{x:400,y:300}});
  expect(requests).toBe(attempts);
  await picker(page); await streams(page);
  await page.getByRole('button', {name:'Retry radio'}).click();
  await expect(page.locator('.music-detail-status')).toHaveText('LIVE RADIO');
  await page.getByRole('button', {name:'Music', exact:true}).click();
  await expect(page.locator('.music-error')).toBeHidden();
  expect((await audioState(page))['live-radio'].src).toBeNull();
});

test.describe('touch layouts', () => {
  test.use({hasTouch:true, isMobile:true});
  test('mini player and picker fit portrait/landscape and preserve accessible controls', async ({page}, info) => {
    await page.setViewportSize({width:390,height:844});
    await streams(page); await enterAt(page, -18, 52);
    await expect(page.locator('#music-player')).toBeHidden();
    await page.getByRole('button',{name:'Dismiss exploration hint'}).click();
    for (const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]) {
      await page.setViewportSize(size);
      const pill = page.locator('#music-player'); await expect(pill).toBeVisible();
      const rect = (await pill.boundingBox())!;
      expect(rect.width).toBeLessThanOrEqual(160); expect(rect.height).toBeLessThanOrEqual(56);
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x+rect.width).toBeLessThanOrEqual(size.width); expect(rect.y+rect.height).toBeLessThanOrEqual(size.height);
      for (const selector of ['#move-stick','.touch-actions','#minimap-wrap','#hud-more','#menu']) {
        const target = page.locator(selector); if (!(await target.isVisible())) continue;
        const b = (await target.boundingBox())!;
        expect(rect.x+rect.width <= b.x || b.x+b.width <= rect.x || rect.y+rect.height <= b.y || b.y+b.height <= rect.y, `player overlaps ${selector}`).toBe(true);
      }
      await page.screenshot({path:info.outputPath(`mini-${size.width}.png`)});
      await picker(page);
      await page.getByRole('button',{name:'Radio',exact:true}).click();
      const dialog = (await page.locator('#music-dialog').boundingBox())!;
      expect(dialog.x).toBeGreaterThanOrEqual(0); expect(dialog.y).toBeGreaterThanOrEqual(0);
      expect(dialog.x+dialog.width).toBeLessThanOrEqual(size.width); expect(dialog.y+dialog.height).toBeLessThanOrEqual(size.height);
      for (const button of await page.locator('#music-dialog button:visible').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({path:info.outputPath(`picker-${size.width}.png`)});
      await page.getByRole('button',{name:'Close music and radio'}).click();
      await expect(page.getByRole('button',{name:'Open music and radio',exact:true})).toBeFocused();
      if (size.width <= 600) {
        await page.getByRole('button',{name:'More controls',exact:true}).click();
        await expect(pill).toBeHidden();
        await page.getByRole('button',{name:'More controls',exact:true}).click();
        await expect(pill).toBeVisible();
      }
    }
  });
});
