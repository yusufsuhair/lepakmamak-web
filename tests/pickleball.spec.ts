import {test,expect} from '@playwright/test';
// @ts-ignore server module
import {createPickleball,inCourt} from '../server/pickleball.mjs';
import court from '../shared/pickleball.json' with {type:'json'};
test('court eligibility and server-owned serve, rally miss and distance checks',()=>{
 const sent:any[]=[];const game=createPickleball((ws:any,m:any)=>sent.push({ws,...m}));const a={id:'a',ws:'a',x:court.x,z:court.z-5,yaw:0},b={id:'b',ws:'b',x:court.x,z:court.z+5,yaw:Math.PI},outside={id:'c',ws:'c',x:0,z:0};const ps=new Map([['a',a],['b',b],['c',outside]]);
 expect(inCourt(a)).toBe(true);expect(inCourt({...a,riding:true})).toBe(false);expect(inCourt(outside)).toBe(false);
 game.handle(ps,outside,{type:'pickleball-hit'});expect(sent).toHaveLength(0);
 game.handle(ps,a,{type:'pickleball-hit'});expect(sent.find(m=>m.type==='pickleball-state').game.ball).toBeTruthy();expect(sent.some(m=>m.ws==='c')).toBe(false);
 const count=sent.length;game.handle(ps,b,{type:'pickleball-hit'});expect(sent.length).toBe(count);
 for(let i=0;i<100;i++)game.tick(ps);const final=sent.filter(m=>m.type==='pickleball-state').at(-1).game;expect(final.ball).toBeNull();expect(final.score).toEqual([1,0]);
 a.z=90;b.z=90;game.tick(ps);game.tick(ps);expect(sent.filter(m=>m.type==='pickleball-state').at(-1).game.score).toEqual([0,0]);
});
test('court is clear, rackets equip and stow, mobile HUD fits',async({page})=>{
 await page.goto('/');await page.evaluate(async court=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {createWorld,createPerson}=await import('/src/world.ts');const {createPickleball}=await import('/src/pickleball.ts');document.body.innerHTML='';
  const scene=new THREE.Scene();scene.background=new THREE.Color('#bfd6ce');const world=createWorld(scene);const overlaps=world.solids.filter(s=>Math.abs(s.x-court.x)<s.hx+6&&Math.abs(s.z-court.z)<s.hz+10);(window as any).overlaps=overlaps;
  const gameCourt=createPickleball(scene,world),person=createPerson();person.group.position.set(court.x-1,.15,court.z-4);scene.add(person.group);gameCourt.equip(person,true);(window as any).racketVisible=person.rightArm.children.at(-1)?.visible;gameCourt.equip(person,false);(window as any).racketHidden=!person.rightArm.children.at(-1)?.visible;gameCourt.equip(person,true);
  const other=createPerson('#75a2d7');other.group.position.set(court.x,.15,court.z+4);other.group.rotation.y=Math.PI;scene.add(other.group);gameCourt.equip(other,true);
  scene.add(new THREE.HemisphereLight(0xffffff,0x668877,3));const camera=new THREE.PerspectiveCamera(48,900/700,.1,500);camera.position.set(court.x+15,22,court.z+20);camera.lookAt(court.x,0,court.z);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(900,700);document.body.append(renderer.domElement);renderer.render(scene,camera);gameCourt.update({x:court.x,z:court.z-4},true,.1,true);
 },court);expect(await page.evaluate(()=>(window as any).overlaps)).toEqual([]);expect(await page.evaluate(()=>(window as any).racketVisible&&(window as any).racketHidden)).toBe(true);
 await page.screenshot({path:'/tmp/pickleball-court.png'});
 await page.setViewportSize({width:375,height:812});await page.locator('canvas').evaluate(el=>el.style.display='none');await expect(page.getByRole('button',{name:'Serve / Pukul'})).toBeVisible();const box=await page.locator('#pickleball-hud').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(375);
});
// The server reads the net as the line z=court.z, |x|<3.5, y<1.1 and bounces the ball at y=.22. The
// Blender court (scripts/blender/build_courts.py) must keep its net there, its surface under the
// bounce, the collider and the canvas sign, and switch its floodlights on only after dark.
test('the Blender pickleball court keeps the net line and surface the server plays on, and lights up at night',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 const result=await page.evaluate(async court=>{
  const source=await (await fetch('/src/pickleball.ts')).text();
  const three=(source.match(/from\s*["'](\/node_modules\/\.vite\/deps\/three\.js[^"']*)["']/)||[])[1];
  const night=(source.match(/from\s*["'](\/src\/district-night\.ts[^"']*)["']/)||[])[1]||'/src/district-night.ts';
  const THREE:any=await import(/* @vite-ignore */ three);
  const {setDistrictNight}=await import(/* @vite-ignore */ night);
  const {createWorld}=await import('/src/world.ts');const {createPickleball}=await import('/src/pickleball.ts');
  document.body.innerHTML='';const scene=new THREE.Scene(),world=createWorld(scene);
  const snapshot=()=>JSON.stringify({solids:world.solids,chairs:world.chairs,map:world.mapBuildings});
  const game=createPickleball(scene,world);const before=snapshot();
  for(let i=0;i<600&&game.status.state==='loading';i++)await new Promise(done=>setTimeout(done,100));
  const group=scene.getObjectByName('pickleball');group.updateMatrixWorld(true);
  const meshes:any[]=[];group.traverse((o:any)=>{if(o.isMesh)meshes.push(o);});
  const bounds=(name:string)=>{const b=new THREE.Box3();for(const m of meshes)if(m.material.name===name)b.union(new THREE.Box3().setFromObject(m));return b;};
  const net=bounds('Net cord'),surface=bounds('Ground acrylic');
  const washes=meshes.filter(m=>m.material.name.startsWith('Night wash')),glows=meshes.filter(m=>m.material.name.startsWith('Night glow'));
  const state=()=>({washes:washes.every(m=>m.visible),dark:glows.every(m=>m.material.emissiveIntensity===0)});
  setDistrictNight(false);const day=state();setDistrictNight(true);const lit=state();setDistrictNight(false);
  return {state:game.status.state,unchanged:snapshot()===before,signs:group.children.filter((c:any)=>c.isMesh&&c.material.isMeshBasicMaterial).length,
   net:{z:(net.min.z+net.max.z)/2-court.z,depth:net.max.z-net.min.z,halfWidth:Math.max(court.x-net.min.x,net.max.x-court.x),top:net.max.y},
   surfaceTop:surface.max.y,washes:washes.length,glows:glows.length,day,lit};
 },court);
 expect(result.state).toBe('ready');
 expect(result.unchanged).toBe(true);
 expect(result.signs).toBe(1);
 expect(Math.abs(result.net.z)).toBeLessThan(.05);expect(result.net.depth).toBeLessThan(.1);
 expect(result.net.halfWidth).toBeLessThan(3.5);expect(result.net.top).toBeLessThan(1.1);
 expect(result.surfaceTop).toBeLessThan(.22);
 expect(result.washes).toBeGreaterThan(0);expect(result.glows).toBeGreaterThan(0);
 expect(result.day).toEqual({washes:false,dark:true});
 expect(result.lit).toEqual({washes:true,dark:false});
 expect(errors).toEqual([]);
});
