import {test,expect} from '@playwright/test';
import {isGameMaster} from '../server/roles.mjs';
test('Game Master badge requires the exact verified auth email, never client metadata',()=>{
 expect(isGameMaster({email:'yusufmohdsuhair@gmail.com',email_confirmed_at:'2026-01-01'})).toBe(true);
 expect(isGameMaster({email:'YusufMohdSuhair@gmail.com',email_confirmed_at:'2026-01-01'})).toBe(true);
 expect(isGameMaster({email:'yusufmohdsuhair@gmail.com'})).toBe(false);
 expect(isGameMaster({email:'someone@example.com',email_confirmed_at:'2026-01-01',user_metadata:{gameMaster:true,email:'yusufmohdsuhair@gmail.com'}})).toBe(false);
});
test('Game Master banner renders and shimmers while respecting reduced motion',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  // @ts-ignore Browser module import served by Vite.
  const {nameTag,updateGameMasterTag}=await import('/src/social.ts');
  const label=nameTag('Yusuf',true);
  updateGameMasterTag(label,true,1);
  const canvas=label.material.map.image;
  const before=canvas.toDataURL();updateGameMasterTag(label,true,2);
  const changed=before!==canvas.toDataURL();
  updateGameMasterTag(label,true,1,true);const still=canvas.toDataURL();updateGameMasterTag(label,true,2,true);
  const reduced=still===canvas.toDataURL();
  canvas.id='banner-preview';canvas.style.cssText='position:fixed;left:20px;top:20px;z-index:99999;background:#233d35';document.body.append(canvas);
  return {changed,reduced};
 });
 expect(result).toEqual({changed:true,reduced:true});
 await page.locator('#banner-preview').screenshot({path:'test-results/game-master-banner.png'});
});
