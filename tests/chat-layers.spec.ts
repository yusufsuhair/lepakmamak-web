import {test,expect} from '@playwright/test';
import {enterAt} from './city';

// Overlays sit above the HUD, but most are translucent, so the city chat read through the
// loading screen, settings and every dialog. It must stay out of sight until they close.
test('city chat stays out of sight under loading, settings and dialogs',async({page})=>{
 await enterAt(page,-18,52);const chat=page.locator('#city-chat');
 await expect(chat).toBeVisible();
 await page.getByRole('button',{name:'Open settings'}).click();await expect(page.locator('#pause')).toBeVisible();await expect(chat).toBeHidden();
 await page.getByRole('button',{name:'Resume'}).click();await expect(chat).toBeVisible();
 await page.locator('#multiplayer-status').click();await expect(page.locator('#online-players')).toBeVisible();await expect(chat).toBeHidden();
 await page.locator('#close-online-players').click();await expect(chat).toBeVisible();
 await page.evaluate(()=>{document.getElementById('loading')!.hidden=false;});await expect(chat).toBeHidden();
});
