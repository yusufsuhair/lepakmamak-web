import {test,expect} from '@playwright/test';
import {SALOMA,salomaGround} from '../src/bridge';

const on=(x:number,z:number,elevated=false)=>salomaGround(x,z,elevated);
const CENTRE_X=SALOMA.x, DECK_Z=SALOMA.z;

test('open ground is open ground',()=>{
 expect(on(0,0)).toEqual({y:0,elevated:false});
 expect(on(CENTRE_X,DECK_Z-40)).toEqual({y:0,elevated:false});
});

test('walking the road underneath passes below the deck, not over it',()=>{
 // x=76 is the north-south road the bridge spans.
 expect(on(76,DECK_Z)).toEqual({y:0,elevated:false});
 expect(on(CENTRE_X,DECK_Z)).toEqual({y:0,elevated:false});
});

test('an approach ramp lifts you a step at a time and puts you on the bridge',()=>{
 const outer=on(SALOMA.westRampOuter,DECK_Z);
 expect(outer.elevated).toBe(true);
 expect(outer.y).toBeGreaterThan(0);
 expect(outer.y).toBeLessThan(SALOMA.deckY);

 const inner=on(SALOMA.westRampInner,DECK_Z,true);
 expect(inner.y).toBeGreaterThan(outer.y);
 // Both approaches work, not just the one nearest the mamak.
 expect(on(SALOMA.eastRampOuter,DECK_Z).elevated).toBe(true);
});

test('walking out from under the deck passes beneath the steps, it does not snap you up them',()=>{
 // The inner end of an approach is nearly four metres overhead from down here.
 const underInnerStep=SALOMA.westRampInner+.4;
 expect(on(underInnerStep,DECK_Z)).toEqual({y:0,elevated:false});
 // Coming the other way, off the deck, the same spot is the top of the stairs.
 expect(on(underInnerStep,DECK_Z,true).y).toBeGreaterThan(3);
});

test('once you are up, the deck carries you over the traffic',()=>{
 const deck=on(CENTRE_X,DECK_Z,true);
 expect(deck).toEqual({y:SALOMA.deckY,elevated:true});
 // Directly above the road, still up.
 expect(on(76,DECK_Z,true).y).toBe(SALOMA.deckY);
});

test('stepping off the end sets you back down on the ground',()=>{
 expect(on(CENTRE_X,DECK_Z-30,true)).toEqual({y:0,elevated:false});
 expect(on(SALOMA.westRampOuter-6,DECK_Z,true)).toEqual({y:0,elevated:false});
});

test('the deck is only walkable down its middle, so you cannot stroll off the side',()=>{
 expect(on(CENTRE_X,DECK_Z+SALOMA.walkHalfWidth-.1,true).y).toBe(SALOMA.deckY);
 expect(on(CENTRE_X,DECK_Z+SALOMA.walkHalfWidth+2,true)).toEqual({y:0,elevated:false});
});

test('the bridge is no longer a wall across the map',async({page})=>{
 await page.route('**/bridge-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/bridge-harness');
 const blocked=await page.evaluate(async([x,z])=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createWorld}=await import('/src/world.ts');
  const {overlaps}=await import('/src/physics.ts');
  const world=createWorld(new THREE.Scene());
  // Nothing may block the deck centre at ground level, or the road it spans.
  return {
   centre:world.solids.some((s:any)=>overlaps({x,z},.35,s)),
   road:world.solids.some((s:any)=>overlaps({x:76,z},.35,s)),
  };
 },[CENTRE_X,DECK_Z]);
 expect(blocked.centre).toBe(false);
 expect(blocked.road).toBe(false);
});
