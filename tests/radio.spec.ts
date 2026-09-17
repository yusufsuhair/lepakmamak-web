import { test, expect } from '@playwright/test';

test('stalled streams time out, pause cancels pending work, and unknown station IDs are ignored', async ({page}) => {
  await page.route('**/radio-harness', r => r.fulfill({contentType:'text/html',body:'<button>Play</button>'}));
  await page.route('https://*.rcs.revma.com/**', () => {});
  await page.goto('/radio-harness'); await page.clock.install();
  await page.evaluate(async () => {
    const {createRadio} = await import('/src/radio.ts');
    (window as any).radio = createRadio(() => {});
    document.querySelector('button')!.onclick = () => (window as any).radio.play();
  });
  const state = () => page.evaluate(() => {
    const r = (window as any).radio;
    return {status:r.status,station:r.station.id,src:r.audio.getAttribute('src')};
  });
  await page.getByRole('button').click();
  expect((await state()).status).toBe('connecting');
  await page.evaluate(() => { (window as any).radio.select('hot'); (window as any).radio.play(); });
  await page.clock.runFor(14000);
  expect((await state()).status).toBe('connecting');
  await page.evaluate(() => (window as any).radio.pause());
  await page.clock.runFor(2000);
  expect(await state()).toEqual({status:'paused',station:'hot',src:null});
  await page.evaluate(() => (window as any).radio.select('javascript:alert(1)'));
  expect((await state()).station).toBe('hot');
  await page.getByRole('button').click();
  await page.clock.runFor(15001);
  expect(await state()).toEqual({status:'error',station:'hot',src:null});
});
