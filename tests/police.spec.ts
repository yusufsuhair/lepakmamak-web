import {test,expect} from '@playwright/test';
import fleet from '../shared/fleet.json' with {type:'json'};
import {existsSync,readFileSync} from 'node:fs';

test('a police car patrols the city like any other traffic',()=>{
 const police=fleet.filter(car=>car.style==='police');
 expect(police.length).toBeGreaterThan(0);
 for(const car of police){
  // Patrolling, not parked, and with an officer at the wheel.
  expect(car.speed).toBeGreaterThan(0);
  expect(car.npc).toBe(true);
 }
});

// The siren is gone entirely — the police car patrols in silence. Nothing should bring it
// back, so this checks the module is absent rather than merely unused.
test('the police car makes no sound at all',()=>{
 expect(existsSync('src/siren.ts')).toBe(false);
 const main=readFileSync('src/main.ts','utf8');
 expect(main).not.toMatch(/siren/i);
});

test('the police car is built in police colours with a light bar and an officer',async({page})=>{
 await page.route('**/police-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/police-harness');
 const built=await page.evaluate(async()=>{
  const {createDriveableCar,carStyles}=await import('/src/world.ts');
  const car=createDriveableCar('police');
  let lightBar=0;
  car.group.traverse((object:any)=>{ if(object.userData?.sirenLight) lightBar++; });
  return {inStyles:carStyles.includes('police'), model:car.group.userData.model, lightBar, hasDriver:!!car.driver};
 });
 expect(built.inStyles).toBe(true);
 expect(built.model).toBe('police');
 // Two lamps, so it reads as a light bar rather than a lump on the roof.
 expect(built.lightBar).toBe(2);
 expect(built.hasDriver).toBe(true);
});

test('cilok is not blocked for the police car',async({page})=>{
 await page.route('**/cilok-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/cilok-harness');
 const traffic=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createWorld}=await import('/src/world.ts');
  const world=createWorld(new THREE.Scene());
  const police=world.traffic.filter((car:any)=>car.group.userData.model==='police');
  return {total:world.traffic.length, police:police.length, npc:police.every((car:any)=>car.npc)};
 });
 // It sits in the same traffic list the cilok reaction reads, with no special case.
 expect(traffic.police).toBeGreaterThan(0);
 expect(traffic.npc).toBe(true);
 expect(traffic.total).toBe(fleet.length);
});
