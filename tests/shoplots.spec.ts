import {test,expect} from '@playwright/test';
import branded from '../shared/mamak-shops.json' with {type:'json'};

// The generic shophouse rows: every shop()/retail() in world.ts without a branded GLB.
const ROWS=[[-36,-12,19],[-57,-12,20],[-35,-40,18],[28,-16,21],[51,-16,20],[-35,-90,19],[-56,-90,19],[27,-40,19],[49,-40,19]];

test('the Blender shophouse kit replaces every generic row and leaves signs, colliders and the map alone',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createWorld}=await import('/src/world.ts');
  // The world's own shoplots module instance (Vite may add ?t= after an edit), so the night hook is the one it filled.
  const url=((await (await fetch('/src/world.ts')).text()).match(/from\s*["'](\/src\/shoplots\.ts[^"']*)["']/)||[])[1]||'/src/shoplots.ts';
  const {setShoplotNight}=await import(/* @vite-ignore */ url);
  const world:any=createWorld(new THREE.Scene());
  const fallback=world.shoplots.fallback;
  const isSign=(o:any)=>o.isMesh&&o.material.isMeshBasicMaterial;
  const snapshot=()=>JSON.stringify({solids:world.solids,map:world.mapBuildings});
  const signBoxes=()=>fallback.children.filter(isSign).map((m:any)=>{const b=new THREE.Box3().setFromObject(m);return [...b.min.toArray(),...b.max.toArray()].map((v:number)=>+v.toFixed(3));});
  const before=snapshot(),signsBefore=signBoxes(),proceduralBefore=fallback.children.filter((o:any)=>o.isMesh&&!isSign(o)).length;
  for(let i=0;i<300&&world.shoplots.status.state==='loading';i++)await new Promise(r=>setTimeout(r,100));
  const rows=fallback.getObjectByName('LM_ENV_Shoplots');
  rows?.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  // First hit on a named surface: props, grilles and the night light planes may stand in front of it.
  const hit=(o:number[],d:number[],surface:RegExp)=>{ray.set(new THREE.Vector3(...o),new THREE.Vector3(...d));const h=ray.intersectObject(rows,true).find((h:any)=>surface.test(h.object.material.name));return h?{d:+h.distance.toFixed(2),m:h.object.material.name}:null;};
  const lots=world.shoplots.lots.map((l:any)=>({x:l.x,z:l.z,width:l.width,kind:l.kind,
   floor:hit([l.x+1.3,4,l.z+5],[0,-1,0],/tiles/),facade:hit([l.x+1,4.1,l.z+14],[0,0,-1],/render/),end:hit([l.x+l.width/2+4,6.6,l.z-4],[-1,0,0],/render/)}));
  const washes=rows?rows.children.filter((m:any)=>m.material.name==='Night wash'):[];
  const interior=rows?.children.find((m:any)=>m.material.name==='Night shop interior');
  setShoplotNight(true);const night={washes:washes.every((m:any)=>m.visible),lit:interior?.material.emissiveIntensity>0};
  setShoplotNight(false);const day={washes:washes.some((m:any)=>m.visible),lit:interior?.material.emissiveIntensity>0};
  return {status:{...world.shoplots.status},unchanged:before===snapshot(),signsBefore,signsAfter:signBoxes(),proceduralBefore,
   leftovers:fallback.children.filter((o:any)=>!isSign(o)&&o!==rows).length,draws:rows?.children.length,
   textured:rows?rows.children.filter((m:any)=>m.material.map&&m.material.normalMap).length:0,lots,night,day};
 });
 expect(result.status.state).toBe('ready');
 expect(result.unchanged).toBe(true);                      // colliders and map footprints are world.ts's
 expect(result.signsAfter).toEqual(result.signsBefore);    // every canvas sign survives, in place
 expect(result.signsBefore.length).toBeGreaterThan(9);
 expect(result.proceduralBefore).toBeGreaterThan(0);
 expect(result.leftovers).toBe(0);                         // the boxes are gone, the kit is all that remains
 expect(result.draws).toBeLessThanOrEqual(14);             // merged by material for the whole city
 expect(result.textured).toBeGreaterThanOrEqual(4);
 expect(result.status.bays).toBe(ROWS.reduce((n,[, ,w])=>n+Math.max(1,Math.round(w/6.5)),0));
 expect(result.lots.map((l:any)=>[l.x,l.z,l.width]).sort()).toEqual([...ROWS].sort());
 for(const lot of result.lots){
  expect(branded.some(b=>b.x===lot.x&&b.z===lot.z)).toBe(false);
  expect(lot.floor,`${lot.x},${lot.z}`).toMatchObject({m:'Shoplot five-foot-way tiles'});   // five-foot-way at the front
  expect(Math.abs(lot.floor.d-(4-.55))).toBeLessThan(.02);
  expect(Math.abs(lot.facade.d-(14-6))).toBeLessThan(.02);                                 // fascia beam on the front line
  expect(Math.abs(lot.end.d-4)).toBeLessThan(.02);                                         // end wall on the footprint edge
 }
 expect(result.night).toEqual({washes:true,lit:true});
 expect(result.day).toEqual({washes:false,lit:false});
});

test('a missing shophouse kit keeps the procedural rows',async({page})=>{
 await page.route('**/LM_ENV_Shoplots.glb*',route=>route.abort());
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createWorld}=await import('/src/world.ts');
  const world:any=createWorld(new THREE.Scene());
  for(let i=0;i<300&&world.shoplots.status.state==='loading';i++)await new Promise(r=>setTimeout(r,100));
  return {state:world.shoplots.status.state,boxes:world.shoplots.fallback.children.filter((o:any)=>o.isMesh&&!o.material.isMeshBasicMaterial).length};
 });
 expect(result.state).toBe('fallback');
 expect(result.boxes).toBeGreaterThan(0);
});
