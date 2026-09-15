import { test, expect } from '@playwright/test';

test('online-player dialog opens, handles offline state and closes without pausing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await page.getByRole('button', { name: 'Show online players' }).click();
  await expect(page.getByRole('dialog', { name: "Who's in the city?" })).toBeVisible();
  await expect(page.locator('#online-players-empty')).toContainText('not connected');
  await page.keyboard.press('Escape');
  await expect(page.locator('#online-players')).not.toBeVisible();
  await expect(page.locator('#pause')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show online players' })).toBeFocused();
});

test('online-player names open View Profile', async ({ page }) => {
  await page.routeWebSocket('**/ws', ws => {
    ws.onMessage(raw => {
      const message = JSON.parse(String(raw));
      if (message.type === 'join') ws.send(JSON.stringify({type: 'welcome', id: 'self', players: [
        {id: 'self', name: 'Tester', color: '#72c8ba', x: -18, z: 52, yaw: Math.PI, riding: false, speed: 0, guest: true},
        {id: 'friend-player', name: 'Aina', color: '#d58ca0', x: -10, z: 48, yaw: 0, riding: false, speed: 0, guest: true},
      ]}));
      if (message.type === 'ping') ws.send(JSON.stringify({type: 'pong', t: message.t}));
      if (message.type === 'profile-view') ws.send(JSON.stringify({type: 'profile', id: message.id, profile: {id: message.id, name: 'Aina', registered: false, details: null}}));
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: "Jom, let's go" }).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Tester');
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show online players' })).toBeVisible();
  await page.getByRole('button', { name: 'Show online players' }).click();
  await page.getByRole('button', { name: 'View profile of Aina' }).click();
  await expect(page.locator('#player-profile')).toBeVisible();
  await expect(page.locator('#profile-name')).toHaveText('Aina');
});
