import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';

// Port 5183 is the one origin playwright.config.ts does not pre-mark as onboarded, so this is
// the only spec that meets the city the way a brand-new player does.
test('a new player is walked to a chair and into the table games, not handed six paragraphs',async({page})=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8091',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5183','--strictPort'],{env:{...process.env,VITE_MULTIPLAYER_URL:'ws://127.0.0.1:8091',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 try{
 await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8091/health')).ok&&(await fetch('http://127.0.0.1:5183')).ok;}catch{return false;}},{timeout:60000}).toBe(true);
 const enter=async(room:string)=>{await page.goto(`http://127.0.0.1:5183/?room=${room}`);await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Newbie');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await expect(page.locator('#loading')).toBeHidden();};
 const card=page.locator('#cara-main'),guide=page.locator('#explore-guide'),seen=()=>page.evaluate(()=>localStorage.getItem('lepakmamak-onboarded'));
 await enter('onboarding');
 // Nothing to read and nothing to close. They arrive beside a table, so the first thing on
 // screen is the one action that matters, and the button that does it is the one lit up.
 await expect(card).toBeHidden();
 await expect(guide).toContainText('Sit');
 await expect(page.locator('#interaction')).toHaveClass(/explore-target/);
 await expect(page.locator('#explore-teaser')).toBeHidden();
 // Leaving halfway is not finishing: the old card came back until it was read, and so does this.
 expect(await seen()).toBeNull();
 await enter('onboarding');await expect(guide).toContainText('Sit');
 await page.locator('#interaction').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.seated)).toBe(true);
 // Seated. The step nobody used to find is the table's own name, so that is what lights up.
 await expect(guide).toContainText('Meja');
 const label=page.locator('.table-label.first-step');await expect(label).toBeVisible();
 await label.click();
 await expect(page.locator('#table-social')).toBeVisible();
 await expect(guide).toBeHidden();
 expect(await seen()).toBe('1');
 // Only now does the city mention there is more of it.
 await page.locator('#close-table-social').click();
 await expect(page.locator('#explore-teaser')).toBeVisible();
 await enter('onboarding');await expect(guide).toBeHidden();await expect(page.locator('.table-label.first-step')).toHaveCount(0);

 // Someone who knows their way around can wave it off, and it stays waved off.
 await page.evaluate(()=>localStorage.removeItem('lepakmamak-onboarded'));
 await enter('onboarding-skip');await expect(guide).toContainText('Sit');
 await guide.locator('[data-dismiss]').click();
 await expect(guide).toBeHidden();expect(await seen()).toBe('1');
 await expect(page.locator('#interaction')).not.toHaveClass(/explore-target/);

 // The full write-up is still there for whoever wants it, as reference rather than a gate.
 await page.keyboard.press('Escape');
 await page.locator('#open-cara-main').click();
 await expect(card).toBeVisible();await expect(card.locator('li')).toHaveCount(6);
 await expect(page.locator('#cara-main-skip-check')).toHaveCount(0);
 await page.getByRole('button',{name:'Buy or customise pet'}).click();
 await expect(page.locator('#pet-studio')).toBeVisible();
 }finally{vite.kill();server.kill();}
});
