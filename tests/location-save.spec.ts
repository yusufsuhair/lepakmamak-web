import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
test('refresh restores the same guest position instead of resetting',async({page})=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8088',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5180','--strictPort'],{env:{...process.env,VITE_MULTIPLAYER_URL:'ws://127.0.0.1:8088',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 try{
 await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8088/health')).ok&&(await fetch('http://127.0.0.1:5180')).ok;}catch{return false;}}).toBe(true);
 const enter=async()=>{await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Returning Friend');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');};
 await page.goto('http://127.0.0.1:5180/?room=return-test&table=meja-1');await enter();await expect(page).not.toHaveURL(/table=/);
 await page.keyboard.down('s');await page.waitForTimeout(700);await page.keyboard.up('s');const before=await page.evaluate(()=>(window as any).__lepak.position);
 await page.reload();await enter();const after=await page.evaluate(()=>(window as any).__lepak.position);expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeLessThan(.5);
 await page.evaluate(async()=>{const {locationKey,writeLocation,readLocation}=await import('/src/location-save.ts');writeLocation(locationKey('other','guest:Other'),{x:100,z:100,yaw:0});localStorage.setItem('broken','not-json');if(readLocation('broken')!==null)throw Error('invalid storage accepted');});
 }finally{vite.kill();server.kill();}
});
