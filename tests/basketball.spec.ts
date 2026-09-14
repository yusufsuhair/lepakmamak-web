import {test,expect} from '@playwright/test';
// @ts-ignore
import {createBasketball} from '../server/basketball.mjs';
import court from '../shared/basketball.json' with {type:'json'};
test('one ball owner, timed shot, authoritative points and rebound',()=>{
 let time=10000;const sent:any[]=[];const game=createBasketball((ws:any,m:any)=>sent.push({ws,...m}),()=>time);const a={id:'a',name:'Ali',ws:'a',x:court.x,z:court.z},b={id:'b',name:'Bala',ws:'b',x:court.x,z:court.z};const ps=new Map([['a',a],['b',b]]);const send=(p:any,type:string)=>game.handle(ps,p,{type});const state=()=>sent.filter(m=>m.type==='basketball-state').at(-1).game;
 send(a,'basketball-grab');send(b,'basketball-grab');expect(state().holder).toBe('a');send(b,'basketball-shoot');expect(state().holder).toBe('a');send(a,'basketball-charge');time+=800;send(a,'basketball-shoot');expect(state().shooting).toBe(true);
 time+=1200;game.tick(ps);game.tick(ps);expect(state().scores[0].points).toBe(3);time+=500;for(let i=0;i<10;i++)game.tick(ps);expect(state().scores[0].points).toBe(3);expect(state().shooting).toBe(false);
 send(b,'basketball-grab');expect(state().holder).toBeNull();b.z=state().ball.z;b.x=state().ball.x;send(b,'basketball-grab');expect(state().holder).toBe('b');b.z=0;game.tick(ps);for(let i=0;i<10;i++)game.tick(ps);expect(state().holder).toBeNull();
});
test('mistimed distance shot misses and riding player cannot collect',()=>{
 let time=10000;const sent:any[]=[];const game=createBasketball((ws:any,m:any)=>sent.push(m),()=>time);const p={id:'a',name:'A',ws:'a',x:court.x,z:court.z,riding:true};const ps=new Map([['a',p]]);game.handle(ps,p,{type:'basketball-grab'});expect(sent.length).toBe(0);p.riding=false;game.handle(ps,p,{type:'basketball-grab'});game.handle(ps,p,{type:'basketball-shoot'});time+=1700;for(let i=0;i<12;i++)game.tick(ps);expect(sent.at(-1).game.scores).toEqual([]);expect(sent.at(-1).game.shooting).toBe(false);
});
test('court placement, basketball controls and mobile charge release',async({page})=>{
 await page.goto('/');await page.evaluate(async court=>{
 const THREE=await import('/node_modules/three/build/three.module.js');const {createWorld}=await import('/src/world.ts');const {createBasketball}=await import('/src/basketball.ts');document.body.innerHTML='';const scene=new THREE.Scene();scene.background=new THREE.Color('#b4cdbb');const world=createWorld(scene);(window as any).overlaps=world.solids.filter(s=>Math.abs(s.x-court.x)<s.hx+8&&Math.abs(s.z-court.z)<s.hz+13);const game=createBasketball(scene,world);(window as any).sent=[];game.connect(m=>{(window as any).sent.push(m);return true;});game.state({holder:'a',ball:{x:court.x,y:1,z:court.z},shooting:false,scores:[],notice:'Tahan Shoot'});game.update({x:court.x,z:court.z},true,.1,true,'a');scene.add(new THREE.HemisphereLight(0xffffff,0x608070,3));const camera=new THREE.PerspectiveCamera(48,900/700,.1,500);camera.position.set(court.x+19,25,court.z+23);camera.lookAt(court.x,0,court.z);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(900,700);document.body.append(renderer.domElement);renderer.render(scene,camera);
 },court);expect(await page.evaluate(()=>(window as any).overlaps)).toEqual([]);await page.screenshot({path:'/tmp/basketball-court.png'});
 await page.setViewportSize({width:375,height:812});await page.locator('canvas').evaluate(el=>el.style.display='none');const button=page.getByRole('button',{name:'Tahan untuk Shoot'});await expect(button).toBeEnabled();const b=await button.boundingBox();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(375);await button.dispatchEvent('pointerdown',{pointerId:1});await button.dispatchEvent('pointerup',{pointerId:1});expect(await page.evaluate(()=>(window as any).sent.map((m:any)=>m.type))).toEqual(['basketball-charge','basketball-shoot']);
});
// Scoring is server-owned and keys off court.x, court.z +- hoopOffset and y=3.05. A Blender
// court that quietly moved the rim, or dropped a collider, would stop baskets registering with
// nothing else to show for it, so pin both to the swapped-in GLB and not to the fallback.
test('the Blender court keeps every collider and leaves the rim where the server scores',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 const result=await page.evaluate(async court=>{
  const THREE:any=await import('/node_modules/three/build/three.module.js');
  const {createWorld}=await import('/src/world.ts');
  const {createBasketball}=await import('/src/basketball.ts');
  document.body.innerHTML='';
  const scene=new THREE.Scene(),world=createWorld(scene);
  const snapshot=()=>JSON.stringify({solids:world.solids,chairs:world.chairs,map:world.mapBuildings});
  const game=createBasketball(scene,world);
  const before=snapshot();
  const deadline=Date.now()+60000;
  while(game.status.state==='loading'&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
  const group=scene.getObjectByName('basketball')!;group.updateMatrixWorld(true);
  const boxes:number[][]=[];
  group.traverse((o:any)=>{
   if(!o.isMesh)return;
   const names=[o.name,...(Array.isArray(o.material)?o.material:[o.material]).map((m:any)=>m?.name??'')];
   if(!names.some((n:any)=>String(n).includes('Rim orange')))return;   // not 'Backboard trim'
   const b=new THREE.Box3().setFromObject(o);boxes.push([b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z]);
  });
  // floodlights: lenses dark and pools hidden by day, both on at night (src/district-night.ts)
  const night=((await (await fetch('/src/basketball.ts')).text()).match(/from\s*["'](\/src\/district-night\.ts[^"']*)["']/)||[])[1]||'/src/district-night.ts';
  const {setDistrictNight}=await import(/* @vite-ignore */ night);
  const lights:any[]=[];group.traverse((o:any)=>{if(o.isMesh&&o.material.name.startsWith('Night'))lights.push(o);});
  const lit=()=>lights.every((m:any)=>m.material.name.startsWith('Night wash')?m.visible:m.material.emissiveIntensity>0);
  const dark=()=>lights.every((m:any)=>m.material.name.startsWith('Night wash')?!m.visible:m.material.emissiveIntensity===0);
  setDistrictNight(true);const onAtNight=lit();setDistrictNight(false);const offByDay=dark();
  return {state:game.status.state,collidersUnchanged:snapshot()===before,boxes,lights:lights.length,onAtNight,offByDay};
 },court);
 expect(result.lights).toBeGreaterThan(1);expect(result.onAtNight).toBe(true);expect(result.offByDay).toBe(true);
 expect(result.state).toBe('ready');
 expect(result.collidersUnchanged).toBe(true);
 expect(result.boxes.length).toBeGreaterThan(0);
 const [minX,minY,minZ,maxX,maxY,maxZ]=result.boxes[0];
 // the rim sits at the scoring height, on the court's centre line, at both hoop offsets
 expect(minY).toBeLessThanOrEqual(3.05);expect(maxY).toBeGreaterThanOrEqual(3.05);
 expect(maxY-minY).toBeLessThan(.2);
 expect((minX+maxX)/2).toBeCloseTo(court.x,1);
 expect(minZ).toBeLessThanOrEqual(court.z-court.hoopOffset+.4);
 expect(maxZ).toBeGreaterThanOrEqual(court.z+court.hoopOffset-.4);
 expect(errors).toEqual([]);
});
