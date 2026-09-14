import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {SKY,skyTravel,skyHeight} from '../shared/sky-dining.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};

test('lift rejects distant players and swimming preserves rooftop height',()=>{
 const p:any={x:0,z:0};expect(skyTravel(p)).toBe(false);Object.assign(p,SKY.entry,{riding:true});expect(skyTravel(p)).toBe(false);
 p.riding=false;expect(skyTravel(p)).toBe(true);expect(p.y).toBe(44);expect(skyHeight(SKY.pool)).toBeCloseTo(42.85);expect(skyTravel(p)).toBe(true);expect(p.y).toBe(0);
});

test('server owns lift, swimming, rooftop seats and leaving the rooftop',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8247',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 let ws:WebSocket|undefined;
 try{
  await expect.poll(async()=>{try{return (await fetch('http://127.0.0.1:8247/health')).ok;}catch{return false;}}).toBe(true);
  ws=new WebSocket('ws://127.0.0.1:8247/ws');const messages:any[]=[];ws.on('message',raw=>messages.push(JSON.parse(String(raw))));
  await new Promise<void>(r=>ws!.on('open',r));const send=(m:any)=>ws!.send(JSON.stringify(m));
  send({type:'join',room:'sky-test',name:'Sky guest',guest:true});await expect.poll(()=>messages.some(m=>m.type==='welcome')).toBe(true);
  const id=messages.find(m=>m.type==='welcome').id;const self=()=>messages.filter(m=>m.players).at(-1)?.players.find((p:any)=>p.id===id);
  const move=async(x:number,z:number)=>{await new Promise(r=>setTimeout(r,70));send({type:'state',x,z,y:999,yaw:0});await expect.poll(()=>self()?.x).toBe(x);};
  const c=chairs.find(c=>c.id==='sky-1-chair-0')!;
  await move(c.x,c.z);send({type:'chair-sit',chairId:c.id});await expect.poll(()=>messages.some(m=>m.type==='notice')).toBe(true);expect(self()?.chairId).toBeFalsy();
  await move(SKY.entry.x,SKY.entry.z);send({type:'sky-lift'});await expect.poll(()=>self()?.skyDining).toBe(true);expect(self().y).toBe(44);
  await move(SKY.pool.x,SKY.pool.z);await expect.poll(()=>self()?.y).toBeCloseTo(42.85);
  await move(c.x,c.z);send({type:'chair-sit',chairId:c.id});await expect.poll(()=>self()?.chairId).toBe(c.id);expect(self().y).toBe(44);
  send({type:'chair-stand'});await expect.poll(()=>self()?.chairId).toBeFalsy();await move(SKY.landing.x,SKY.landing.z);send({type:'sky-lift'});await expect.poll(()=>self()?.skyDining).toBe(false);expect(self().y).toBe(0);
 }finally{ws?.close();server.kill();}
});

test('rooftop renders with clear walking routes, pool and game seats',async({page},info)=>{
 await page.route('**/sky-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('/sky-preview');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {createWorld}=await import('/src/world.ts');const {createSkyDining}=await import('/src/sky-dining.ts');const {overlaps}=await import('/src/physics.ts');const {SKY}=await import('/shared/sky-dining.mjs');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#141b35');const world=createWorld(scene);const sky=createSkyDining(scene);sky.update(4,true,true);
  scene.add(new THREE.HemisphereLight('#a0b9ff','#b99177',2.4));const sun=new THREE.DirectionalLight('#ead9ff',3);sun.position.set(-50,100,20);scene.add(sun);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);const camera=new THREE.PerspectiveCamera(48,1.6,.1,600);camera.position.set(-76,72,79);camera.lookAt(-106,44,34);renderer.render(scene,camera);
  document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';(window as any).skyPreview={renderer,scene,camera};
  return {seats:world.chairs.filter(c=>c.id.startsWith('sky-')).length,landingBlocked:sky.solids.some(s=>overlaps(SKY.landing,.46,s)),entryBlocked:world.solids.some(s=>overlaps({...SKY.entry,z:59},.46,s))};
 });
 expect(result).toEqual({seats:37,landingBlocked:false,entryBlocked:false});await page.screenshot({path:info.outputPath('wet-deck.png')});
 await page.evaluate(()=>{const{renderer,scene,camera}=(window as any).skyPreview;camera.position.set(-114,47.5,35);camera.lookAt(-20,66,-122);renderer.render(scene,camera);});await page.screenshot({path:info.outputPath('klcc-view.png')});
});

test('player can swim out of the pool without falling to street level',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket('**/ws',ws=>{let p:any={id:'swimmer',name:'Swimmer',color:'#72c8ba',...SKY.pool,y:42.85,yaw:Math.PI,skyDining:true,riding:false,speed:0,seated:false};ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join')ws.send(JSON.stringify({type:'welcome',id:p.id,players:[p]}));if(m.type==='state'){p={...p,...m,y:skyHeight(m)};ws.send(JSON.stringify({type:'players',players:[p]}));}});});
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Swimmer');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.swimming)).toBe(true);
 await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.swimming)).toBe(false);await page.keyboard.up('KeyW');
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.bridge.deckY)).toBe(44);
 expect(await page.evaluate(()=>(window as any).__lepak.skyDining)).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('pool-playtest.png')});
});

test('street lift button takes the player to the lounge and back',async({page})=>{
 await page.routeWebSocket('**/ws',ws=>{const p:any={id:'visitor',name:'Visitor',color:'#72c8ba',...SKY.entry,yaw:Math.PI,riding:false,speed:0,seated:false,skyDining:false};ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join')ws.send(JSON.stringify({type:'welcome',id:p.id,players:[p]}));if(m.type==='sky-lift'&&skyTravel(p)){ws.send(JSON.stringify({type:'sky-arrived',upstairs:p.skyDining}));ws.send(JSON.stringify({type:'players',players:[p]}));}});});
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Visitor');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#interaction')).toHaveText('Naik Wet Deck');await page.locator('#interaction').click();await expect(page.locator('#interaction')).toHaveText('Turun Wet Deck');await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.bridge.deckY)).toBe(44);
 const clearPoint=await page.evaluate(()=>{for(let y=200;y<600;y+=60)for(let x=350;x<1100;x+=60)if(document.elementFromPoint(x,y)?.id==='world')return{x,y};throw Error('No exposed city canvas');});
 await page.mouse.move(clearPoint.x,clearPoint.y);await page.mouse.wheel(0,900);
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.cameraZoom)).toBe(17);
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.cameraActualDistance)).toBeGreaterThan(16);
 await page.locator('#interaction').click();await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.skyDining)).toBe(false);await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.bridge.deckY)).toBe(0);
});

// The photographic venue (scripts/blender/build_skydining.py) swaps in without moving anything a
// player stands on or swims in: deck tops stay at y 0, the basin void stays open down to its floor,
// the pool steps keep their treads, colliders stay put, and the lounge ceiling hides while visiting.
test('the Blender Wet Deck swaps in over the same deck, pool and steps, and lights for the night',async({page})=>{
 await page.route('**/sky-assets',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('/sky-assets');
 const out=await page.evaluate(async(SKY:any)=>{
  const THREE:any=await import('/node_modules/.vite/deps/three.js');
  const {createWorld,streamAllNow}:any=await import('/src/world.ts');const D:any=await import('/src/sky-dining.ts');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#9fc3dd');createWorld(scene);const sky=D.createSkyDining(scene);const solidsBefore=JSON.stringify(sky.solids);streamAllNow();
  const venue=scene.getObjectByName('sky-dining');
  for(let i=0;i<600&&!venue.getObjectByName('skydining');i++)await new Promise(r=>setTimeout(r,200));
  sky.update(2,false,false);scene.updateMatrixWorld(true);
  const model=venue.getObjectByName('skydining');const meshes:any[]=[];model.traverse((o:any)=>{if(o.isMesh)meshes.push(o);});
  const ray=new THREE.Raycaster();
  const down=(x:number,z:number,from=2.5)=>{ray.set(new THREE.Vector3(SKY.x+x,SKY.y+from,SKY.z+z),new THREE.Vector3(0,-1,0));ray.far=10;const h=ray.intersectObjects(meshes,false)[0];return h?+(h.point.y-SKY.y).toFixed(3):null;};
  const deck=[[0,-2],[11.5,-13],[-11.5,-13],[0,-15.2],[5,0],[-10,6],[10,5],[-3,-15.4]].map(([x,z])=>down(x,z));
  const basin=[-8,-5,-2.5,2.5,5,8].flatMap(x=>[-13.2,-11,-9].map(z=>down(x,z)));
  const treads=[0,1,2,3].map(i=>down(0,-6.05-i*.65));
  const ceiling=model.getObjectByName('ceiling');
  const leftovers=venue.children.filter((c:any)=>c!==model.parent&&c!==model&&!(c.isMesh&&c.material.isMeshBasicMaterial)).length;
  const root=scene.getObjectByName('Wet Deck · Sky Dining');const water=root.getObjectByName('Swimming pool');
  const floorShown=root.children.some((c:any)=>c.isMesh&&c.visible&&Math.abs(c.position.y+1.8)<.01);
  sky.update(2,false,true);const hiddenWhileVisiting=!ceiling.visible;sky.update(2,false,false);const shownFromStreet=ceiling.visible;
  const intensity=(name:string)=>meshes.find(m=>m.material.name===name).material.emissiveIntensity;
  D.setSkyDiningNight(true);const night={warm:intensity('Warm glow'),pool:intensity('Pool light glow'),mosaic:intensity('Pool mosaic'),strand:intensity('Strand blue')};
  D.setSkyDiningNight(false);const day={warm:intensity('Warm glow'),pool:intensity('Pool light glow'),mosaic:intensity('Pool mosaic'),strand:intensity('Strand blue')};
  return {deck,basin,treads,leftovers,floorShown,hiddenWhileVisiting,shownFromStreet,night,day,solidsKept:JSON.stringify(sky.solids)===solidsBefore,
   water:{transparent:water.material.transparent,opacity:water.material.opacity,sky:water.material.onBeforeCompile!==undefined}};
 },SKY);
 console.log('SKY ASSET',JSON.stringify(out));
 for(const y of out.deck){expect(y).not.toBeNull();expect(y!).toBeGreaterThanOrEqual(-.001);expect(y!).toBeLessThan(.016);}
 // nothing solid between the deck and the basin floor anywhere a swimmer goes
 for(const y of out.basin)expect(y).toBeCloseTo(-1.675,2);
 out.treads.forEach((y:number,i:number)=>expect(y).toBeCloseTo(-i*.34,1));
 expect(out.leftovers).toBe(0);expect(out.floorShown).toBe(false);expect(out.solidsKept).toBe(true);
 expect(out.hiddenWhileVisiting).toBe(true);expect(out.shownFromStreet).toBe(true);
 expect(out.water.transparent).toBe(true);expect(out.water.opacity).toBeLessThan(.5);
 expect(out.day.warm).toBe(0);expect(out.day.pool).toBe(0);expect(out.night.warm).toBeGreaterThan(1);expect(out.night.pool).toBeGreaterThan(1);
 expect(out.night.mosaic).toBeGreaterThan(out.day.mosaic);expect(out.night.strand).toBeGreaterThan(out.day.strand);expect(out.day.strand).toBeGreaterThan(0);
});
