import {test,expect} from '@playwright/test';

for (const [label,width,height] of [['desktop',1280,800],['tablet',1024,768],['phone',390,844]] as const) {
  test(`speaking indicator sits above the KM/H meter on ${label}`, async ({browser}) => {
    const context = await browser.newContext({
      viewport: {width,height},
      ...(label !== 'desktop' ? {hasTouch:true} : {}),
      ...(label === 'phone' ? {isMobile:true} : {}),
    });
    const page = await context.newPage();
    try {
      await page.route('**/speaking-position-harness', (route:any) => route.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/style.css"><div id="hud"></div><div id="speedometer"><div class="speed-number">00</div><span class="speed-unit">KM/H</span><div class="speed-track"></div><small class="vehicle-label">ON FOOT</small></div>',
      }));
      await page.goto('/speaking-position-harness');
      await page.evaluate(async () => {
        const {createSpeakingList} = await import('/src/speaking.ts');
        createSpeakingList(document.getElementById('hud')!).heard('speaker-1', 'A very enthusiastic player');
      });

      const layout = await page.evaluate(() => {
        const speaking = document.getElementById('speaking')!.getBoundingClientRect();
        const meter = document.getElementById('speedometer')!.getBoundingClientRect();
        return {speaking, meter, width: innerWidth, height: innerHeight};
      });
      expect(layout.speaking.width).toBeGreaterThan(0);
      expect(layout.speaking.left).toBeGreaterThan(layout.width / 2);
      expect(layout.speaking.right).toBeLessThanOrEqual(layout.width);
      expect(layout.speaking.bottom).toBeLessThanOrEqual(layout.meter.top);
    } finally {
      await context.close();
    }
  });
}

test('speaking row glows with voice and settles dark while the player remains nearby', async ({page}) => {
  await page.route('**/speaking-state-harness', (route:any) => route.fulfill({
    contentType: 'text/html',
    body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/style.css"><div id="hud"></div>',
  }));
  await page.goto('/speaking-state-harness');
  await page.evaluate(async () => {
    const {createSpeakingList} = await import('/src/speaking.ts');
    const list = createSpeakingList(document.getElementById('hud')!);
    list.nearby('speaker-1', 'Ali', {skin:'#8b583d',hair:'#202c2b',shirt:'#62876b'});
    list.heard('speaker-1', 'Ali', .82, {skin:'#8b583d',hair:'#202c2b',shirt:'#62876b'});
  });
  const row = page.locator('#speaking .speaker');
  await expect(row).toHaveClass(/speaker-active/);
  expect(await row.evaluate(el => el.style.getPropertyValue('--voice-level'))).toBe('0.820');
  expect(await row.locator('.speaker-face').evaluate(el => getComputedStyle(el).getPropertyValue('--face-shirt').trim())).toBe('#62876b');
  await page.waitForTimeout(700);
  await expect(row).toHaveClass(/speaker-inactive/);
  expect(Number(await row.evaluate(el => getComputedStyle(el).opacity))).toBeLessThan(.8);
});
