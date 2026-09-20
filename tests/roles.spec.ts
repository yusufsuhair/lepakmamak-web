import {test,expect} from '@playwright/test';
import {isGameMaster} from '../server/roles.mjs';
test('GM privileges require an allowlisted verified Auth ID, never client metadata',()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user={id,email:'gm@example.com',email_confirmed_at:'2026-01-01'};
 expect(isGameMaster(user,'')).toBe(false);
 expect(isGameMaster(user,` ${id} , bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb `)).toBe(true);
 expect(isGameMaster({...user,email_confirmed_at:null},id)).toBe(false);
 expect(isGameMaster({...user,is_anonymous:true},id)).toBe(false);
 expect(isGameMaster({...user,id:'other',user_metadata:{id,gameMaster:true}},id)).toBe(false);
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
