// Explicit live smoke test. Creates and removes one temporary account; never prints keys or tokens.
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {env} from './live-test-env.mjs';
const admin=createClient(env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`profile-${randomUUID()}@example.com`,password=randomUUID()+'Aa9!';let userId,browser;
try{
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Profile Check',appearance:{shirt:'#ef734c'}}});if(created.error)throw created.error;userId=created.data.user.id;
 browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=env.TEST_BASE_URL;await page.goto(`${base}/?room=profile-smoke`);await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-mode').click();await page.locator('#auth-email').fill(email);await page.locator('#auth-password').fill(password);await page.locator('#auth-submit').click();await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE',{timeout:20000});
 await page.locator('#menu').click();await page.locator('#open-edit-profile').click();await page.locator('#profile-bio').fill('Here for good company');await page.locator('#profile-hometown').fill('Shah Alam');await page.locator('#profile-socialMedia').fill('@tehtarikfan');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.locator('#edit-profile')).not.toBeVisible({timeout:15000});
 const stored=await admin.auth.admin.getUserById(userId);expect(stored.data.user.user_metadata.profile.bio).toBe('Here for good company');expect(stored.data.user.user_metadata.appearance.shirt).toBe('#ef734c');
 await page.reload();await page.getByRole('button',{name:"Jom, let's go"}).click();await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE',{timeout:20000});await page.locator('#menu').click();await page.locator('#open-edit-profile').click();await expect(page.locator('#profile-bio')).toHaveValue('Here for good company');await expect(page.locator('#profile-socialMedia')).toHaveValue('@tehtarikfan');expect(errors).toEqual([]);
 console.log('Live mobile profile save, Supabase persistence, reload and preserved appearance verified.');
}finally{await browser?.close();if(userId){const result=await admin.auth.admin.deleteUser(userId);if(result.error)throw result.error;}}
