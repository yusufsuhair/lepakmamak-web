import {test,expect} from '@playwright/test';

// Rain soaks the ground: the shared ground uniforms follow the weather's wet flag and take the fog's
// horizon colour for their sheen, and dry out again when the rain stops.
test('the ground goes wet when it rains and dries when it stops',async({page})=>{
 await page.route('**/wet-harness',r=>r.fulfill({contentType:'text/html',body:'<label><input id="rain-toggle" type="checkbox"></label><p id="weather-label"></p>'}));
 await page.route('**/weather',r=>r.fulfill({json:{available:false}}));
 await page.clock.install({time:'2026-09-12T08:00:00Z'});
 await page.goto('/wet-harness');
 const result=await page.evaluate(async()=>{
  const groundUrl=((await (await fetch('/src/world.ts')).text()).match(/from\s*["'](\/src\/ground\.ts[^"']*)["']/)||[])[1]||'/src/ground.ts';
  const G=await import(/* @vite-ignore */ groundUrl);
  const W=await import(/* @vite-ignore */ ((await (await fetch(groundUrl)).text()).match(/from\s*["'](\/src\/weather\.ts[^"']*)["']/)||[])[1]||'/src/weather.ts');
  const THREE=await import('/node_modules/.vite/deps/three.js' as string);
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,1,100);
  let wetSwitch=false;
  const weather=W.setupWeather(scene,new THREE.DirectionalLight(),new THREE.HemisphereLight(),'',(v:boolean)=>{wetSwitch=v;},()=>true);
  const read=(condition:string)=>{weather.preview({condition,time:'16:00'});return {wet:G.groundWeather.wet,sky:G.groundWeather.sky,fog:`#${scene.fog.color.getHexString()}`,rain:wetSwitch};};
  return {dry:read('sunny'),rain:read('rain'),after:read('cloudy')};
 });
 expect(result.dry).toMatchObject({wet:0,rain:false});
 expect(result.rain).toMatchObject({wet:1,rain:true});expect(result.rain.sky).toBe(result.rain.fog);
 expect(result.after).toMatchObject({wet:0,rain:false});
});

// The photographic ground is a skin: the boxes keep the sizes and heights gameplay and the beach's
// sea depend on, the kerbs no longer cross the east-west carriageways, the world-space shaders
// compile, and the seawall GLB takes over the sea edges from the hedge.
test('city ground keeps its surfaces, compiles its shaders and meets the sea with a seawall',async({page})=>{
 const shaderErrors:string[]=[];
 page.on('console',message=>{if(message.type()==='error'&&/WebGLProgram|Shader Error/.test(message.text()))shaderErrors.push(message.text().slice(0,400));});
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {createWorld}=await import('/src/world.ts');
  const {ROAD_Z,ROAD_HALF}=await import('/src/ground.ts');
  const scene=new THREE.Scene();const world=createWorld(scene);
  const renderer=new THREE.WebGLRenderer();renderer.setSize(320,200);renderer.shadowMap.enabled=true;
  scene.add(new THREE.HemisphereLight('#fff','#777',2));
  const camera=new THREE.PerspectiveCamera(53,1.6,.1,700);camera.position.set(20,30,60);camera.lookAt(0,0,0);
  renderer.render(scene,camera);
  const byMaterial=(name:string)=>world.group.children.filter((o:any)=>o.isMesh&&o.material.name===name);
  const extent=(name:string)=>{const b=new THREE.Box3();for(const m of byMaterial(name))b.expandByObject(m);return [b.max.x,b.max.y,b.max.z].map(v=>Math.round(v*1e4)/1e4);};
  let kerbInMouth=0;
  for(const mesh of byMaterial('ground-kerb')){
   const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i+=3){const z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;if(ROAD_Z.some((c:number)=>Math.abs(z-c)<ROAD_HALF-.01))kerbInMouth++;}
  }
  const textures=await Promise.all(['asphalt-color','asphalt-normal','pavers-color','pavers-normal','concrete-color','concrete-normal','grass-color','grass-normal','macro']
   .map(name=>fetch(`/assets/textures/ground/${name}.webp`).then(r=>r.ok&&r.headers.get('content-type')?.includes('webp'))));
  const furniture=world.group.getObjectByName('street-furniture');
  for(let i=0;i<300&&!furniture.getObjectByName('furniture');i++)await new Promise(done=>setTimeout(done,50));
  const names=new Set<string>();let hedgeOnSeaSide=0,armourCasts=0;
  furniture.getObjectByName('furniture')?.traverse((o:any)=>{if(!o.isMesh)return;names.add(o.material.name);
   if(o.material.name==='Hedge leaves'&&new THREE.Box3().setFromObject(o).max.z>156)hedgeOnSeaSide++;
   if(o.material.name==='Armour granite'&&o.castShadow)armourCasts++;});
  return {apron:extent('ground-apron'),slab:extent('ground-slab'),roads:extent('ground-asphalt'),kerbInMouth,textures:textures.every(Boolean),
   seawall:names.has('Seawall concrete'),armour:names.has('Armour granite'),hedge:names.has('Hedge leaves'),hedgeOnSeaSide,armourCasts};
 });
 expect(result.apron).toEqual([170,-.13,170]);        // the beach's sea sits on these tops (src/beach.ts)
 expect(result.slab).toEqual([159,-.05,159]);
 expect(result.roads).toEqual([156,.0365,156]);
 expect(result.kerbInMouth).toBe(0);
 expect(result.textures).toBe(true);
 expect(shaderErrors).toEqual([]);
 expect(result).toMatchObject({seawall:true,armour:true,hedge:true,hedgeOnSeaSide:0,armourCasts:0});
});
