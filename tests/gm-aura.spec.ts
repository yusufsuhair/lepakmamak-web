import {test,expect} from '@playwright/test';
import {GM_HOVER,gmHover} from '../src/gm-aura';
import {isGameMaster} from '../server/roles.mjs';

test('the float always lifts, and never drops back to the ground',()=>{
 let low=Infinity, high=-Infinity;
 for(let t=0;t<GM_HOVER.period*2;t+=.02){
  const y=gmHover(t);
  low=Math.min(low,y); high=Math.max(high,y);
 }
 // Always airborne: a hover that touches zero is a stutter, not a float.
 expect(low).toBeGreaterThan(0);
 expect(low).toBeCloseTo(GM_HOVER.lift-GM_HOVER.bob,2);
 expect(high).toBeCloseTo(GM_HOVER.lift+GM_HOVER.bob,2);
 // Gentle: a bob bigger than the lift would read as bouncing, not floating.
 expect(GM_HOVER.bob).toBeLessThan(GM_HOVER.lift);
});

test('the bob repeats on its period, so it never drifts out of phase',()=>{
 for(const t of [0,.4,1.3,2.2]){
  expect(gmHover(t)).toBeCloseTo(gmHover(t+GM_HOVER.period),6);
 }
});

test('only the Game Master account gets any of it',()=>{
 const confirmed='2026-09-01T00:00:00Z';
 expect(isGameMaster({email:'yusufmohdsuhair@gmail.com',email_confirmed_at:confirmed})).toBe(true);
 // Case and padding are normalised, so the real account is not locked out by its own typing.
 expect(isGameMaster({email:' YusufMohdSuhair@Gmail.com ',email_confirmed_at:confirmed})).toBe(true);
 // Everyone else, however close the address looks.
 expect(isGameMaster({email:'someone@example.com',email_confirmed_at:confirmed})).toBe(false);
 expect(isGameMaster({email:'yusufmohdsuhair@gmail.com.evil.test',email_confirmed_at:confirmed})).toBe(false);
 // An unconfirmed address is not proof of anything.
 expect(isGameMaster({email:'yusufmohdsuhair@gmail.com',email_confirmed_at:null})).toBe(false);
});

test('the aura is wings over a seal, and adds no light to a two-light scene',async({page})=>{
 await page.route('**/aura-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/aura-harness');
 const built=await page.evaluate(async()=>{
  const {createGmAura}=await import('/src/gm-aura.ts');
  const aura=createGmAura();
  let meshes=0, lights=0;
  aura.group.traverse((o:any)=>{ if(o.isMesh) meshes++; if(o.isLight) lights++; });
  const before=aura.group.children[0].rotation.z;
  aura.update(2.4);
  const seal=aura.group.children[2] as any;
  const buried=seal.children.some((m:any)=>m.material.depthTest||m.renderOrder===0);
  return {groups:aura.group.children.length, meshes, lights, buried, moved:aura.group.children[0].rotation.z!==before};
 });
 expect(built.groups).toBe(3);          // two wings and the seal
 expect(built.meshes).toBeGreaterThan(10);
 // Eighty street lamps taught us what happens when scenery brings its own lights.
 expect(built.lights).toBe(0);
 // The mamak floor is a slab standing proud of the road; a depth-tested seal vanishes
 // inside it the moment he walks in off the street.
 expect(built.buried).toBe(false);
 expect(built.moved).toBe(true);
});
