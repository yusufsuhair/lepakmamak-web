import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
interface GameState { vehicle: string; stick: { x: number; y: number }; seated: boolean; profileScreen: { x: number; y: number }; punchCount: number; jumpHeight: number; started: boolean; paused: boolean; riding: boolean; position: { x: number; z: number }; speed: number; money: number; simTime: number; rain: boolean; drawCalls: number }
const state = (page: Page) => page.evaluate(() => (window as unknown as { __lepak: GameState }).__lepak);
// A jump is an arc, so polling its instantaneous height races the apex: on a busy machine
// every sample can land on the way up or the way down. Remembering the highest reading
// asks the question the test actually means — did the jump get that high.
const resetPeak = (page: Page) => page.evaluate(() => { (window as any).__peakJump = 0; });
const peakJump = (page: Page) => page.evaluate(() => {
  const held = window as any;
  held.__peakJump = Math.max(held.__peakJump || 0, held.__lepak.jumpHeight);
  return held.__peakJump as number;
});

test('free roam supports riding, settings and no mission prompts', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.screenshot({ path: 'test-results/title-screen.png' });
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await page.locator('#world').click({ position: { x: 640, y: 400 } });
  expect((await state(page)).punchCount).toBe(1);
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(680, 400); await page.mouse.up();
  expect((await state(page)).punchCount).toBe(1);
  await page.keyboard.press('c');
  const profilePoint = (await state(page)).profileScreen;
  await page.mouse.click(profilePoint.x, profilePoint.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'View profile' }).click();
  await expect(page.locator('#profile-name')).not.toBeEmpty();
  await page.keyboard.press('Escape');
  await expect(page.locator('#player-profile')).not.toBeVisible();
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog', { name: 'City map' })).toBeVisible();
  const mapPosition = (await state(page)).position.x;
  await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).position.x).toBeGreaterThan(mapPosition + .5);
  await page.keyboard.up('d');
  const mapTime = (await state(page)).simTime;
  await expect.poll(async () => (await state(page)).simTime).toBeGreaterThan(mapTime);
  await page.screenshot({ path: 'test-results/expanded-map-desktop.png' });
  await page.keyboard.press('m');
  await expect(page.locator('#city-map')).not.toBeVisible();
  await page.keyboard.press('m');
  await page.keyboard.press('Escape');
  await expect(page.locator('#city-map')).not.toBeVisible();
  await expect(page.locator('#pause')).toBeHidden();
  await resetPeak(page);
  await page.keyboard.down('Space');
  await expect.poll(() => peakJump(page), { intervals: [30] }).toBeGreaterThan(.4);
  await expect.poll(async () => (await state(page)).jumpHeight).toBe(0);
  await page.waitForTimeout(300);
  expect((await state(page)).jumpHeight).toBe(0);
  await page.keyboard.up('Space');
  await expect(page.locator('#mission-card')).toHaveCount(0);
  await expect(page.locator('#interaction')).toBeHidden();
  // Enter opens the chat composer, which then owns the keyboard until it is dismissed.
  await page.keyboard.press('Enter');
  await expect(page.locator('#chat-form')).toBeVisible();
  await expect(page.locator('#interaction')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#chat-form')).toBeHidden();
  await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).position.x, { timeout: 15000 }).toBeGreaterThan(-9.6);
  await page.keyboard.up('d');
  await page.keyboard.press('e');
  expect((await state(page)).riding).toBe(false);
  await page.locator('#interaction').click();
  await expect.poll(async () => (await state(page)).riding).toBe(true);
  await page.keyboard.down('w');
  await expect.poll(async () => (await state(page)).position.z, { timeout: 45000 }).toBeLessThan(-82);
  await page.keyboard.up('w');
  await page.keyboard.down('Space');
  await expect.poll(async () => Math.abs((await state(page)).speed)).toBeLessThan(.4);
  await page.keyboard.up('Space');
  await page.locator('#interaction').click();
  await expect.poll(async () => (await state(page)).riding).toBe(false);
  await expect(page.locator('#money')).toHaveCount(0);
  await page.keyboard.press('Escape');
  const pausedAt = (await state(page)).simTime;
  await page.getByLabel('Rain over KL').check();
  await page.keyboard.press('w');
  await expect.poll(async () => (await state(page)).simTime).toBeGreaterThan(pausedAt);
  expect((await state(page)).rain).toBe(true);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(async () => (await state(page)).paused).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#pause')).toBeHidden();
  await expect.poll(async () => page.locator('#background-music').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(false);
  // #loading is the real readiness gate below, so there is no need to wait on every
  // font and audio file the load event covers.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await expect(page.locator('#money')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile layout exposes usable touch controls and pause recovery', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await expect(page.locator('#touch-controls')).toBeVisible();
  await page.touchscreen.tap(195, 420);
  expect((await state(page)).punchCount).toBe(1);
  const touchProfile = (await state(page)).profileScreen;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchProfile] });
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.getByRole('menuitem', { name: 'View profile' }).tap();
  // toBeEmpty passes on a hidden element, so check the dialog actually opened.
  await expect(page.locator('#player-profile')).toBeVisible();
  await expect(page.locator('#profile-name')).not.toBeEmpty();
  // Addressed by id: the role query does not settle against the modal dialog on mobile.
  // The label is still asserted, so a rename does not slip through.
  const closeProfile = page.locator('#close-profile');
  await expect(closeProfile).toHaveText('Close');
  await closeProfile.tap();
  expect((await state(page)).punchCount).toBe(1);
  await page.getByRole('button', { name: 'Open city map' }).tap();
  await expect(page.locator('#city-map')).toBeVisible();
  const mapBounds = await page.locator('#city-map').boundingBox();
  expect(mapBounds!.x).toBeGreaterThanOrEqual(0);
  expect(mapBounds!.x + mapBounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/expanded-map-mobile.png' });
  await page.getByRole('button', { name: 'Close city map' }).tap();
  await expect(page.locator('#city-map')).not.toBeVisible();
  await resetPeak(page);
  await page.getByRole('button', { name: 'Jump', exact: true }).tap();
  await expect.poll(() => peakJump(page), { intervals: [30] }).toBeGreaterThan(.3);
  await expect.poll(async () => (await state(page)).jumpHeight).toBe(0);
  await expect(page.getByRole('button', { name: 'Spam recall emote' })).toBeVisible();
  await page.getByRole('button', { name: 'Spam recall emote' }).click();
  await expect(page.locator('#toast')).toBeHidden();
  await expect(page.locator('#mission-card')).toHaveCount(0);
  // On a phone the top-right controls live behind the ⋮ until it is opened.
  if (await page.locator('#menu').isHidden()) await page.locator('#hud-more').tap();
  await page.getByRole('button', { name: 'Open settings' }).click();
  // "Return to Mamak Maju" is removed at startup (main.ts: $('reset').remove()); Resume is
  // the way out of the pause screen, and Log out is the way out of the city.
  await expect(page.getByRole('button', { name: 'Return to Mamak Maju' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('#pause')).toBeHidden();
  expect((await state(page)).money).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-game.png' });
  await context.close();
});

test('object buttons sit and stand while Enter does nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await page.keyboard.down('a');
  await expect.poll(async () => (await state(page)).position.x).toBeLessThan(-26);
  await page.keyboard.up('a');
  await page.keyboard.press('Enter');
  expect((await state(page)).seated).toBe(false);
  await expect(page.locator('#interaction')).toHaveText('Sit');
  await page.locator('#interaction').click();
  await expect.poll(async () => (await state(page)).seated).toBe(true);
  const sitting = (await state(page)).position;
  await page.keyboard.press('w');
  expect((await state(page)).position).toEqual(sitting);
  await expect(page.locator('#chat-input')).not.toBeFocused();
  await page.locator('#interaction').click();
  await expect.poll(async () => (await state(page)).seated).toBe(false);
});

test('mobile analog movement supports release and a second finger in both orientations', async ({ browser }) => {
  for (const viewport of [{ width: 360, height: 780 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
    await expect(page.locator('.touch-pad')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open city map' }).tap();
    await expect(page.locator('#city-map')).toBeVisible();
    // The map deliberately takes the screen: the stick is hidden while it is open.
    await expect(page.locator('#move-stick')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#city-map')).toBeHidden();
    const rect = (await page.locator('#move-stick').boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const point = { x: rect.x + rect.width / 2 + 25, y: rect.y + rect.height / 2, id: 1 };
    const before = (await state(page)).position.x;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await expect.poll(async () => (await state(page)).position.x).toBeGreaterThan(before + .3);
    const strength = (await state(page)).stick.x;
    expect(strength).toBeGreaterThan(.4); expect(strength).toBeLessThan(.9);
    const cameraPoint = { x: viewport.width / 2, y: viewport.height / 2, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point, cameraPoint] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point, { ...cameraPoint, x: cameraPoint.x + 30 }] });
    expect((await state(page)).stick.x).toBeCloseTo(strength);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect((await state(page)).stick).toEqual({ x: 0, y: 0 });
    expect((await state(page)).punchCount).toBe(0);
    const stopped = (await state(page)).position;
    await page.waitForTimeout(150);
    expect((await state(page)).position).toEqual(stopped);
    await page.screenshot({ path: `test-results/analog-${viewport.width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await context.close();
  }
});

test('parked car can be entered, driven, braked and exited', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await page.keyboard.down('s');
  await expect.poll(async () => (await state(page)).position.z, { timeout: 10000 }).toBeGreaterThan(63);
  await page.keyboard.up('s');
  await page.keyboard.down('d');
  // Traffic drives past the parked car and takes the prompt over with 'Cilok' while it
  // passes, so the car's own prompt has to be waited for rather than sampled once.
  await expect(page.locator('#interaction-text')).toHaveText('Enter', { timeout: 40000 });
  await page.keyboard.up('d');
  await page.locator('#interaction').click();
  expect((await state(page)).vehicle).toBe('car');
  // The seat panel now lists each seat and who is in it, rather than a bare count.
  await expect(page.locator('#vehicle-seats')).toContainText('Car · 1/4 seats');
  await expect(page.locator('#vehicle-seats')).toContainText('Driver: Tester');
  await expect(page.locator('#vehicle-seats')).toContainText('Driver:');
  expect((await state(page)).riding).toBe(true);
  const startZ = (await state(page)).position.z;
  await page.keyboard.down('w');
  await expect.poll(async () => (await state(page)).position.z, { timeout: 15000 }).toBeLessThan(startZ - 3);
  await page.keyboard.up('w');
  await page.screenshot({ path: 'test-results/driving-car.png' });
  await page.keyboard.down('Space');
  await expect.poll(async () => Math.abs((await state(page)).speed)).toBeLessThan(.4);
  await page.keyboard.up('Space');
  await page.locator('#interaction').click();
  expect((await state(page)).riding).toBe(false);
  const exitX = (await state(page)).position.x;
  await page.keyboard.down('a');
  // Stepping out of a car settles before the walk starts, so this needs longer than the
  // five seconds expect.poll allows by default.
  await expect.poll(async () => (await state(page)).position.x, { timeout: 15000 }).toBeLessThan(exitX - .5);
  await page.keyboard.up('a');
});

test('mobile object action taps sit and stand without punching', async ({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).tap();
 await page.locator('#auth-guest').tap();await page.locator('#guest-name').fill('Tester');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).tap();
 await page.keyboard.down('a');await expect.poll(async()=>(await state(page)).position.x).toBeLessThan(-26);await page.keyboard.up('a');
 const punches=(await state(page)).punchCount;
 await expect(page.locator('#interaction')).toHaveText('Sit');
 await page.screenshot({path:'test-results/mobile-object-action.png'});
 await page.locator('#interaction').tap();await expect.poll(async()=>(await state(page)).seated).toBe(true);
 await expect(page.locator('#interaction')).toHaveText('Stand');await page.locator('#interaction').tap();
 await expect.poll(async()=>(await state(page)).seated).toBe(false);expect((await state(page)).punchCount).toBe(punches);
 await expect(page.locator('#touch-interact')).toHaveCount(0);
 }finally{await context.close();}
});
