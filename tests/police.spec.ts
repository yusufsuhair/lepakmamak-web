import {test,expect} from '@playwright/test';
import fleet from '../shared/fleet.json' with {type:'json'};
import {sirenGain,SIREN} from '../src/siren';

test('a police car patrols the city like any other traffic',()=>{
 const police=fleet.filter(car=>car.style==='police');
 expect(police.length).toBeGreaterThan(0);
 for(const car of police){
  // Patrolling, not parked, and with an officer at the wheel.
  expect(car.speed).toBeGreaterThan(0);
  expect(car.npc).toBe(true);
 }
});

test('the siren is loud beside you and silent across town',()=>{
 expect(sirenGain(0)).toBeGreaterThan(0);
 expect(sirenGain(SIREN.near)).toBeGreaterThan(sirenGain(SIREN.near+8));
 expect(sirenGain(SIREN.reach)).toBe(0);
 expect(sirenGain(SIREN.reach+50)).toBe(0);
 // It must never be audible from the far side of the map.
 expect(sirenGain(200)).toBe(0);
});

test('the siren wails between two tones rather than sitting on one',()=>{
 expect(SIREN.low).toBeGreaterThan(0);
 expect(SIREN.high).toBeGreaterThan(SIREN.low);
 expect(SIREN.wailMs).toBeGreaterThan(0);
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
