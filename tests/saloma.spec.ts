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

// The photographic bridge (scripts/blender/build_saloma.py) replaces the boxes, and what a player
// stands on stays exactly where src/bridge.ts says: deck top, every step, the piers that have
// colliders, and the x=76 road left clear underneath.
async function salomaHarness(page:any){
 await page.route('**/saloma-assets',(r:any)=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/saloma-assets');
 return page.evaluate(async(S:any)=>{
  const THREE:any=await import('/node_modules/.vite/deps/three.js');
  const {createWorld,streamAllNow}:any=await import('/src/world.ts');const L:any=await import('/src/saloma.ts');
  const scene=new THREE.Scene();createWorld(scene);streamAllNow();
  const bridge=scene.getObjectByName('saloma');
  const model=()=>bridge.children.find((c:any)=>c.getObjectByName?.('saloma'));
  for(let i=0;i<600&&!model();i++)await new Promise(r=>setTimeout(r,200));
  scene.updateMatrixWorld(true);
  const meshes:any[]=[];model().traverse((o:any)=>{if(o.isMesh)meshes.push(o);});
  const ray=new THREE.Raycaster();
  const hit=(o:number[],d:number[],far=30)=>{ray.set(new THREE.Vector3(...o),new THREE.Vector3(...d).normalize());ray.far=far;return ray.intersectObjects(meshes,false)[0]||null;};
  const deck:number[]=[];for(const x of [-21,-8,0,9,21])for(const z of [-2.1,-1.3,0,1.2,2.1])deck.push(hit([S.x+x,5.9,S.z+z],[0,-1,0])?.point.y);
  const steps:{i:number;y:number}[]=[];for(const side of [-1,1])for(let i=0;i<S.steps;i++)for(const z of [-1.6,0,1.6])steps.push({i,y:hit([S.x+side*(S.rampStart+i*S.stepRun),S.stepTopY-i*S.stepRise+1.2,S.z+z],[0,-1,0])?.point.y});
  const road=[70,74,78].flatMap(x=>[1.2,3.2].map(y=>!!hit([x,y,S.z-12],[0,0,1],24)));
  const piers=[-22,-11,0,11].map(bx=>{const h=hit([S.x+bx-3,1.5,S.z+2.15],[1,0,0],6);return h?+(S.x+bx-h.point.x).toFixed(2):null;});
  const leftovers=bridge.children.filter((c:any)=>c!==model()&&!(c.isMesh&&c.material.isMeshBasicMaterial)).length;
  const diagrid=meshes.find(m=>m.material.name==='Saloma diagrid'),glow=meshes.find(m=>m.material.name==='Saloma deck glow');
  const renderer=new THREE.WebGLRenderer();renderer.setSize(320,200);const camera=new THREE.PerspectiveCamera(50,1.6,.1,500);camera.position.set(S.x+30,20,S.z+40);camera.lookAt(S.x,6,S.z);
  L.setSalomaNight(true);renderer.render(scene,camera);await new Promise(r=>setTimeout(r,50));renderer.render(scene,camera);
  const night={uniform:L.salomaShow.night.value,glow:glow.material.emissiveIntensity,shader:typeof diagrid.material.onBeforeCompile==='function',time:L.salomaShow.time.value};
  L.setSalomaNight(false);
  const day={uniform:L.salomaShow.night.value,glow:glow.material.emissiveIntensity};
  return {deck,steps,road,piers,leftovers,night,day};
 },{...SALOMA});
}

test('the Blender Saloma Link swaps in on the same deck, steps and piers, and runs its light show at night',async({page})=>{
 const out=await salomaHarness(page);
 console.log('SALOMA ASSET',JSON.stringify(out));
 expect(out.leftovers).toBe(0);
 for(const y of out.deck)expect(Math.abs(y-SALOMA.deckY)).toBeLessThan(.012);
 for(const {i,y} of out.steps)expect(y).toBeCloseTo(SALOMA.stepTopY-i*SALOMA.stepRise,2);
 // the girder spans the x=76 road with nothing standing in the lanes
 expect(out.road.every((blocked:boolean)=>!blocked)).toBe(true);
 for(const d of out.piers){expect(d).not.toBeNull();expect(Math.abs(d!)).toBeLessThan(.35);}
 expect(out.night).toMatchObject({uniform:1,shader:true});expect(out.night.glow).toBeGreaterThan(1);expect(out.night.time).toBeGreaterThan(0);
 expect(out.day).toEqual({uniform:0,glow:0});
});

test('with reduced motion the Saloma light show holds still',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const out=await salomaHarness(page);
 expect(out.night.uniform).toBe(1);expect(out.night.time).toBe(0);
});

test('a player walks up the east steps onto the Blender deck',async({page})=>{
 await page.routeWebSocket('**/ws',ws=>{const p={id:'walker',name:'Walker',color:'#72c8ba',x:SALOMA.eastRampOuter,z:SALOMA.z,yaw:0,riding:false,speed:0,seated:false};ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join')ws.send(JSON.stringify({type:'welcome',id:p.id,players:[p]}));if(m.type==='ping')ws.send(JSON.stringify({type:'pong',t:m.t}));});});
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Walker');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#loading')).toBeHidden({timeout:60000});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__lepakScene?.getObjectByName('saloma')?.children.some((c:any)=>c.getObjectByName?.('saloma'))),{timeout:90000}).toBe(true);
 // the camera faces north on arrival, so strafing left walks west, up the approach
 await page.keyboard.down('KeyA');
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.position.x),{timeout:30000,intervals:[50]}).toBeLessThan(SALOMA.x+10);
 await page.keyboard.up('KeyA');
 expect(await page.evaluate(()=>(window as any).__lepak.bridge)).toEqual({onBridge:true,deckY:SALOMA.deckY});
});
