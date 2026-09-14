import {test,expect} from '@playwright/test';
import pickleball from '../shared/pickleball.json' with {type:'json'};
import basketball from '../shared/basketball.json' with {type:'json'};
test('beach seats and arrivals are reachable and share table registration',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async({pickleball,basketball})=>{
  const {createWorld}=await import('/src/world.ts');const {overlaps}=await import('/src/physics.ts');
  const tables=(await import('/shared/tables.json')).default.filter(t=>t.id.startsWith('pantai-'));
  const world=createWorld({add(){}} as any);const {createBeach}=await import('/src/beach.ts');const beach=createBeach({add(){}} as any,world);beach.update(10);const chairs=(await import('/shared/chairs.json')).default.filter(c=>c.tableId.startsWith('pantai-'));
  const courts=[{x:pickleball.x,z:pickleball.z,hx:pickleball.apronWidth,hz:pickleball.apronLength},{x:basketball.x,z:basketball.z,hx:basketball.halfWidth+1,hz:basketball.halfLength+1}];return {courtSeats:chairs.filter(c=>courts.some(s=>overlaps(c,.5,s))).map(c=>c.id),counts:tables.map(t=>chairs.filter(c=>c.tableId===t.id).length),blocked:chairs.filter(c=>world.solids.some(s=>overlaps(c,.35,s))).map(c=>c.id),arrivals:tables.filter(t=>world.solids.some(s=>overlaps({x:t.arrivalX,z:t.arrivalZ},.48,s))).map(t=>t.id)};
 },{pickleball,basketball});
 expect(result.courtSeats).toEqual([]);expect(result.counts).toEqual([4,9,9,4]);expect(result.blocked).toEqual([]);expect(result.arrivals).toEqual([]);
});

test('the Blender beach replaces the procedural props and palms and leaves the animated sea alone',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createWorld}=await import('/src/world.ts');const {createBeach,SHORE,seaY,shoreY}=await import('/src/beach.ts');
  const stub={add(){}} as any;const world=createWorld(stub);const beach=createBeach(stub,world);
  const before=JSON.stringify({solids:world.solids,chairs:world.chairs,map:world.mapBuildings});
  const group=(beach.iceCream as any).parent as any;
  const props=group.getObjectByName('beach-props');
  const fallback=props.children.length;
  for(let i=0;i<200&&!props.getObjectByName('beach');i++)await new Promise(done=>setTimeout(done,50));
  await new Promise(done=>setTimeout(done,1500));   // let the city palm batch land, and be turned away
  const sea=group.getObjectByName('beach-sea'),position=sea.geometry.attributes.position,far=60*65+32;
  beach.update(0);const rest=position.getY(far);beach.update(9);const moved=position.getY(far);
  let textured=0,terrain:any=null;
  props.getObjectByName('beach').traverse((o:any)=>{if(!o.isMesh)return;if(o.material.map&&o.material.normalMap)textured++;if(o.name.includes('terrain')&&!terrain)terrain=o;});
  // The sea mesh starts under the dry sand (z 150.8), so its edge never shows; over the nearshore
  // floor the water never drains low enough to bare the sand in a trough.
  const dryAboveWater=[0,2.3,4.7,7.1].every(t=>[95,124,150].every(x=>shoreY(150.8)>seaY(x,150.8,t)+.01));
  const floorUnderWater=[153.5,156,158.9].every(z=>[0,2.3,4.7,7.1].every(t=>[95,124,150].every(x=>seaY(x,z,t)>SHORE.nearY+.005)));
  return {unchanged:before===JSON.stringify({solids:world.solids,chairs:world.chairs,map:world.mapBuildings}),
   fallback,imported:props.children.filter((child:any)=>child.getObjectByName('beach')).length,
   signs:props.children.filter((child:any)=>child.material?.isMeshBasicMaterial).length,
   cityPalms:!!props.getObjectByName('LM_TREE_CoconutPalm'),textured,
   terrain:{colours:!!terrain?.geometry.attributes.color,map:!!terrain?.material.map,casts:terrain?.castShadow},
   foam:group.children.filter((child:any)=>child.name==='beach-foam').length,swash:group.children.filter((child:any)=>child.name==='beach-swash').length,
   waveMoved:rest!==moved,dryAboveWater,floorUnderWater};
 });
 expect(result.imported).toBe(1);            // the GLB arrived and took over
 expect(result.signs).toBe(4);               // PANTAI SENJA, KELAPA SEGAR and both WEREWOLF boards stay the game's
 expect(result.fallback).toBeGreaterThan(4); // and the procedural batches it replaced are gone
 expect(result.cityPalms).toBe(false);       // the Blender palms stand alone
 expect(result.textured).toBeGreaterThan(20);// PBR sets survived loading (a blocked WebP would drop them silently)
 expect(result.terrain).toEqual({colours:true,map:true,casts:false});
 expect(result.unchanged).toBe(true);        // colliders, chairs and map footprints untouched
 expect(result.foam).toBe(8);expect(result.swash).toBe(2);expect(result.waveMoved).toBe(true); // the animated sea is outside the swap
 expect(result.dryAboveWater).toBe(true);expect(result.floorUnderWater).toBe(true);           // and meets the sand without holes
});

// The depth colours are daylight turquoise; the sky's light (weather.ts) scales the water body and the
// foam, so dusk reads warm and dim and night blue-black, while the fresnel still takes the background.
test('the sea and its foam darken with the sky: warm at dusk, blue-black at night',async({page})=>{
 await page.route('**/sea-harness',r=>r.fulfill({contentType:'text/html',body:'<label><input id="rain-toggle" type="checkbox"></label><p id="weather-label"></p>'}));
 await page.route('**/weather',r=>r.fulfill({json:{available:false}}));
 await page.clock.install({time:'2026-09-12T05:00:00Z'});
 await page.goto('/sea-harness');
 const result=await page.evaluate(async()=>{
  const beachUrl=((await (await fetch('/src/world.ts')).text()).match(/from\s*["'](\/src\/beach\.ts[^"']*)["']/)||[])[1]||'/src/beach.ts';
  const B=await import(/* @vite-ignore */ beachUrl);
  const W=await import(/* @vite-ignore */ ((await (await fetch(beachUrl)).text()).match(/from\s*["'](\/src\/weather\.ts[^"']*)["']/)||[])[1]||'/src/weather.ts');
  const THREE=await import('/node_modules/.vite/deps/three.js' as string);
  const {createWorld}=await import('/src/world.ts');
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,1,100);
  const beach=B.createBeach(scene,createWorld(new THREE.Scene()));
  const group=(beach.iceCream as any).parent,sea=group.getObjectByName('beach-sea'),foam=group.children.filter((c:any)=>c.name==='beach-foam'||c.name==='beach-swash');
  const weather=W.setupWeather(scene,new THREE.DirectionalLight(),new THREE.HemisphereLight(),'',()=>{},()=>true);
  const read=(time:string,condition='sunny')=>{weather.preview({condition,time});return {sea:sea.userData.light.toArray(),foam:foam.map((f:any)=>f.material.color.getHex()),background:scene.background.isColor===true};};
  return {noon:read('13:00'),dusk:read('19:05'),night:read('21:00'),rain:read('13:00','rain')};
 });
 const lum=([r,g,b]:number[])=>r*.2126+g*.7152+b*.0722;
 expect(lum(result.noon.sea)).toBeGreaterThan(.9);
 expect(lum(result.dusk.sea)).toBeLessThan(lum(result.noon.sea)*.6);expect(result.dusk.sea[0]).toBeGreaterThan(result.dusk.sea[2]);   // warm and dim
 expect(lum(result.night.sea)).toBeLessThan(.1);expect(result.night.sea[2]).toBeGreaterThan(result.night.sea[0]);                     // blue-black
 expect(lum(result.rain.sea)).toBeLessThan(lum(result.noon.sea));
 expect(new Set(result.night.foam).size).toBe(1);expect(result.night.foam[0]).toBeLessThan(result.noon.foam[0]);
 for(const state of Object.values(result))expect(state.background).toBe(true);
});
