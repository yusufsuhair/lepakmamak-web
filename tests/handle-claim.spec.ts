import {test, expect} from '@playwright/test';

test('for a real account (session, not a guest), the claim screen is pre-filled, checks live, cannot be dismissed, and recovers from a lost race', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType: 'application/javascript', body: `export const session={access_token:'test',user:{id:'me'}};export let guestName='';`}));
  const claims: unknown[] = [];
  await page.route('http://handles.test/handles/check*', route => {
    const handle = new URL(route.request().url()).searchParams.get('h');
    return route.fulfill({json: handle === 'yusuf' ? {available: false} : {available: true}});
  });
  await page.route('http://handles.test/handles/claim', route => {
    claims.push(route.request().postDataJSON());
    return claims.length === 1
      ? route.fulfill({status: 409, json: {error: 'taken', message: 'That handle is taken.', suggestion: 'yusuf3'}})
      : route.fulfill({json: {handle: 'yusuf3'}});
  });
  await page.route('**/handle-harness', route => route.fulfill({contentType: 'text/html', body: `<main><script type="module">import {setupHandleClaim} from '/src/handles.ts';window.claimed=[];window.claim=setupHandleClaim('http://handles.test',handle=>window.claimed.push(handle));window.claim.require('Yusuf');</script></main>`}));
  await page.goto('/handle-harness');

  const dialog = page.getByRole('dialog', {name: 'Pick your @handle'});
  await expect(dialog).toBeVisible();
  await expect(page.locator('#handle-input')).toHaveValue('yusuf');
  await expect(page.locator('#handle-status')).toHaveText('@yusuf is taken.');
  await expect(page.getByRole('button', {name: 'Claim handle'})).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await page.locator('#handle-input').fill('Yusuf Two!');
  await expect(page.locator('#handle-input')).toHaveValue('yusuftwo');
  await expect(page.locator('#handle-status')).toHaveText('@yusuftwo is free.');
  await page.getByRole('button', {name: 'Claim handle'}).click();
  await expect(page.locator('#handle-input')).toHaveValue('yusuf3');
  await expect(page.locator('#handle-status')).toHaveText('Taken. How about @yusuf3?');
  await page.getByRole('button', {name: 'Claim handle'}).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => (window as any).claimed)).toEqual(['yusuf3']);
  expect(claims).toEqual([{handle: 'yusuftwo'}, {handle: 'yusuf3'}]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
