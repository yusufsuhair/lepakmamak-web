import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
test('Cara main keeps reappearing until the player ticks Do not show again',async({page})=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8091',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5183','--strictPort'],{env:{...process.env,VITE_MULTIPLAYER_URL:'ws://127.0.0.1:8091',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 try{
 await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8091/health')).ok&&(await fetch('http://127.0.0.1:5183')).ok;}catch{return false;}}).toBe(true);
 const enter=async()=>{await page.goto('http://127.0.0.1:5183/?room=onboarding');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Newbie');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');};
 await enter();
 const card=page.locator('#cara-main');
 await expect(card).toBeVisible();
 await expect(card.locator('li')).toHaveCount(5);
 await expect(card).toContainText('Tap SIT on a chair');
 const skip=page.locator('#cara-main-skip-check');
 await expect(skip).not.toBeChecked();
 // Dismissing without ticking the box is not "seen" — a player who closes it by mistake, or
 // before reading it, still gets it on their next visit.
 await page.locator('#cara-main-done').click();
 await expect(card).toBeHidden();
 await enter();
 await expect(card).toBeVisible();
 await skip.check();
 await page.locator('#cara-main-done').click();
 await expect(card).toBeHidden();
 await enter();
 await expect(card).toBeHidden();
 // Reopening from Settings always works, regardless of the remembered preference.
 await page.keyboard.press('Escape');
 await page.locator('#open-cara-main').click();
 await expect(card).toBeVisible();
 }finally{vite.kill();server.kill();}
});
