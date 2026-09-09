import {test,expect} from '@playwright/test';
import {WEREWOLF_SIZES,werewolfRoles} from '../server/werewolf.mjs';
import {LOBBY_RULES} from '../server/table-lobby.mjs';

test('five is enough for a village, and the lobby agrees',()=>{
 expect(WEREWOLF_SIZES).toContain(5);
 expect(LOBBY_RULES.werewolf.min).toBe(Math.min(...WEREWOLF_SIZES));
 expect(LOBBY_RULES.werewolf.max).toBe(Math.max(...WEREWOLF_SIZES));
});

test('every size the lobby can hand over has a role set of exactly that many',()=>{
 // The lobby sizes itself from whoever turned up, so six and eight must work too,
 // not just the two hand-written sets.
 for(let size=LOBBY_RULES.werewolf.min;size<=LOBBY_RULES.werewolf.max;size++){
  expect(WEREWOLF_SIZES).toContain(size);
  expect(werewolfRoles(size,()=>0)).toHaveLength(size);
 }
});

test('the wolves never start already at parity with the village',()=>{
 for(const size of WEREWOLF_SIZES){
  const roles=werewolfRoles(size,()=>0);
  const evil=roles.filter(r=>r==='werewolf'||r==='alpha').length;
  expect(evil).toBeLessThan(roles.length-evil);
 }
});

test('a small village is one wolf, and keeps both its helpers',()=>{
 for(const size of [5,6]){
  const roles=werewolfRoles(size,()=>0);
  expect(roles.filter(r=>r==='werewolf')).toHaveLength(1);
  expect(roles).toContain('seer');
  expect(roles).toContain('doctor');
  expect(roles).not.toContain('alpha');
 }
});

test('the seven and nine player games keep the shape they always had',()=>{
 const seven=werewolfRoles(7,()=>0);
 expect(seven.filter(r=>r==='werewolf')).toHaveLength(2);
 expect(seven.filter(r=>r==='villager')).toHaveLength(3);
 expect(seven).not.toContain('alpha');

 const nine=werewolfRoles(9,()=>0);
 expect(nine).toHaveLength(9);
 expect(nine).toContain('alpha');
 // Two of the four special roles join at nine, as before.
 expect(nine.filter(r=>['knight','princess','hunter','mayor'].includes(r))).toHaveLength(2);
});
