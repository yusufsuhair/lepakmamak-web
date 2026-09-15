import {test,expect} from '@playwright/test';

async function harness(page:any) {
 await page.route('**/character-module-harness', (route:any)=>route.fulfill({contentType:'text/html',body:'<canvas style="width:320px;height:420px"></canvas>'}));
 await page.goto('/character-module-harness');
}

test('every catalog style loads on both bodies, with palette channels and hidden hair under tudung', async({page})=>{
 await harness(page);
 const consoleProblems:string[]=[];page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('THREE.'))consoleProblems.push(m.text());});
 const result=await page.evaluate(async()=>{
  const {createPerson,applyAppearance}=await import('/src/world.ts');
  const {whenCharacterReady,disposeCharacter}=await import('/src/character-assets.ts');
  const {characterStyles,defaultAppearance}=await import('/src/appearance.ts');
  const p=createPerson();const slots=[p.leftLeg,p.rightLeg,p.leftArm,p.rightArm];const failures:string[]=[];let checked=0;
  for(const gender of ['male','female'])for(const style of characterStyles){
   const look={...defaultAppearance,gender,shirt:'#628fbb',hair:'#654331',...(style.kind==='hair'?{hairstyle:style.id,tudung:'none'}:{tudung:style.id})};
   applyAppearance(p.group,look);await whenCharacterReady(p.group);checked++;
   let triangles=0,meshes=0;const colors:Record<string,string>={};
   p.group.traverseVisible((o:any)=>{if(o.isMesh){if(!o.userData.keepUnbatched)failures.push('batchable avatar mesh');meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;colors[o.material.name]=o.material.color.getHexString();}});
   if(p.group.userData.assetState!=='ready'||triangles>15000||meshes>13||colors.LM_shirt!=='628fbb')failures.push(gender+'/'+style.id+':'+JSON.stringify({triangles,meshes,colors,state:p.group.userData.assetState,error:p.group.userData.assetError}));
   if(style.kind==='tudung'&&p.group.getObjectByName('avatar-hair')!.visible)failures.push('visible hair '+style.id);
   if(!slots.every(s=>s.parent===p.group))failures.push('replaced limb');
  }
  disposeCharacter(p.group);return {checked,failures};
 });
 expect(result).toEqual({checked:72,failures:[]});expect(consoleProblems).toEqual([]);
});

test('late asset loads respect the newest look and keep dance anchors and held props intact',async({page})=>{
 await harness(page);
 let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/hair-braid.glb?*',async route=>{await gate;await route.continue();});
 const action=page.evaluate(async()=>{
  const {createPerson,applyAppearance,applyAccessories}=await import('/src/world.ts');
  const {whenCharacterReady}=await import('/src/character-assets.ts');const {dancePose}=await import('/src/dance.ts');
  const {defaultAppearance}=await import('/src/appearance.ts');const p=createPerson();await whenCharacterReady(p.group);
  const parts=[...p.group.children],forearm=p.leftArm.children[1];
  const THREE=await import('/node_modules/three/build/three.module.js');const prop=new THREE.Group();prop.name='held-test-racket';p.rightArm.add(prop);
  applyAccessories(p.group,['cap','spectacles']);const accessories=p.group.getObjectByName('shop-accessories');
  dancePose(p,8000,2.2);
  applyAppearance(p.group,{...defaultAppearance,hairstyle:'braid'});const stale=whenCharacterReady(p.group);
  applyAppearance(p.group,{...defaultAppearance,gender:'female',tudung:'bawal-labuh'});await whenCharacterReady(p.group);
  const key=p.group.userData.assetKey;const capHidden=!p.group.getObjectByName('shop-cap')!.visible;
  (window as any).latestReady=true;await stale;
  const bent=forearm.parent!==p.leftArm;dancePose(p,0,10);
  return {key,finalKey:p.group.userData.assetKey,capHidden,bent,restored:parts.every(x=>x.parent===p.group)&&forearm.parent===p.leftArm,propPreserved:prop.parent===p.rightArm,accessoriesSame:p.group.getObjectByName('shop-accessories')===accessories};
 });
 await page.waitForFunction(()=>(window as any).latestReady);release();
 expect(await action).toEqual({key:'female/tudung-bawal-labuh',finalKey:'female/tudung-bawal-labuh',capHidden:true,bent:true,restored:true,propPreserved:true,accessoriesSame:true});
});

test('failed style download can retry, and disposing a preview does not dispose shared geometry',async({page})=>{
 await harness(page);let first=true;
 await page.route('**/hair-pixie.glb?*',route=>{if(first){first=false;return route.abort();}return route.continue();});
 const result=await page.evaluate(async()=>{
  const {createPerson,applyAppearance}=await import('/src/world.ts');const {defaultAppearance}=await import('/src/appearance.ts');
  const {whenCharacterReady,disposeCharacter}=await import('/src/character-assets.ts');
  const p=createPerson(),other=createPerson();await Promise.all([whenCharacterReady(p.group),whenCharacterReady(other.group)]);
  const shirt=(group:any)=>{let material:any;group.traverse((o:any)=>{if(o.isMesh&&o.material.name==='LM_shirt')material=o.material;});return material;};
  const sharedPalette=shirt(p.group)===shirt(other.group);applyAppearance(p.group,{...defaultAppearance,shirt:'#628fbb'});
  const isolatedPalette=shirt(p.group)!==shirt(other.group)&&shirt(other.group).color.getHexString()===defaultAppearance.shirt.slice(1);
  let disposed=0;other.group.traverse((o:any)=>{if(o.isMesh)o.geometry.addEventListener('dispose',()=>disposed++);});
  const look={...defaultAppearance,hairstyle:'pixie'};applyAppearance(p.group,look);await whenCharacterReady(p.group);const failed=p.group.userData.assetState;
  applyAppearance(p.group,look);await whenCharacterReady(p.group);const retried=p.group.userData.assetState;
  disposeCharacter(p.group);return {failed,retried,disposed,otherReady:other.group.userData.assetState,sharedPalette,isolatedPalette};
 });
 expect(result).toEqual({failed:'fallback',retried:'ready',disposed:0,otherReady:'ready',sharedPalette:true,isolatedPalette:true});
});

for(const width of [390,1280])test(`wardrobe exposes 36 styles and persists the latest complete appearance at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await harness(page);
 await page.evaluate(async()=>{
  document.body.innerHTML='';await import('/src/style.css');const {setupInventory}=await import('/src/inventory.ts');
  (window as any).wardrobe=setupInventory({inventory:async()=>({items:[],balance:0}),equip:async()=>({items:[],balance:0})},()=>{});
  (window as any).wardrobe.open();
 });
 await expect(page.locator('.inventory-stage canvas')).toHaveAttribute('data-asset-state','ready');
 await page.getByRole('button',{name:'Hair',exact:true}).click();await expect(page.locator('.inventory-grid [role=radio]')).toHaveCount(12);
 await page.getByRole('button',{name:'Perempuan',exact:true}).click();await expect(page.locator('.inventory-grid [role=radio]')).toHaveCount(12);
 await page.getByRole('button',{name:'Semua',exact:true}).click();await expect(page.locator('.inventory-grid [role=radio]')).toHaveCount(24);
 await page.getByRole('radio',{name:'Tocang hairstyle',exact:true}).click();
 await page.getByRole('button',{name:'Body',exact:true}).click();await page.getByRole('radio',{name:'Female gender',exact:true}).click();
 await page.getByRole('button',{name:'Tudung',exact:true}).click();await expect(page.locator('.inventory-grid [role=radio]')).toHaveCount(13);
 await page.getByRole('radio',{name:'Bawal labuh tudung',exact:true}).click();
 await expect(page.locator('.inventory-status')).toHaveText('Outfit saved.');
 await expect(page.locator('.inventory-stage canvas')).toHaveAttribute('data-asset-state','ready');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('lepak-wardrobe')!));expect(saved).toMatchObject({gender:'female',hairstyle:'braid',tudung:'bawal-labuh'});
 await page.getByRole('button',{name:'Close inventory'}).click();await page.evaluate(()=>(window as any).wardrobe.open());
 await expect(page.locator('.inventory-stage canvas')).toHaveAttribute('data-gender','female');await expect(page.locator('.inventory-stage canvas')).toHaveAttribute('data-tudung','bawal-labuh');
 await page.getByRole('button',{name:'Hair',exact:true}).click();await page.getByRole('radio',{name:'Pixie hairstyle',exact:true}).click();
 await expect(page.locator('.inventory-stage canvas')).toHaveAttribute('data-tudung','none');
 await expect(page.locator('.inventory-stage canvas')).toHaveAttribute('data-asset-state','ready');
 for(const img of await page.locator('.inventory-style-preview img').all()){await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);}
 await page.getByRole('radio',{name:'Pixie hairstyle',exact:true}).scrollIntoViewIfNeeded();
 expect(await page.locator('#inventory').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 if(width===390){const preview=await page.locator('.inventory-stage canvas').boundingBox();expect(preview!.y).toBeGreaterThanOrEqual(0);expect(preview!.y+preview!.height).toBeLessThan(844);}
 await page.screenshot({path:`art/blender/generated/character-module-v1/review/wardrobe-${width}.png`,fullPage:true});
});

test('loaded Blender characters preserve walking, seated and dance poses',async({page})=>{
 await page.setViewportSize({width:1200,height:760});await harness(page);
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {createPerson,applyAccessories}=await import('/src/world.ts');
  const {whenCharacterReady}=await import('/src/character-assets.ts');const {defaultAppearance}=await import('/src/appearance.ts');const {dancePose}=await import('/src/dance.ts');
  document.body.style.cssText='margin:0;background:#163b32';
  const canvas=document.querySelector('canvas')!;canvas.style.cssText='width:1200px;height:760px;display:block';
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,760);renderer.setPixelRatio(1);renderer.setClearColor('#163b32');renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff4dc','#4c725f',2.3));
  const light=new THREE.DirectionalLight('#fff3d4',3);light.position.set(-3,6,5);scene.add(light);const fill=new THREE.DirectionalLight('#bbe6d1',1.8);fill.position.set(3,3,-3);scene.add(fill);
  const camera=new THREE.PerspectiveCamera(35,1200/760,.1,30);camera.position.set(3.2,3.2,9);camera.lookAt(0,1.1,0);
  const looks=[{...defaultAppearance,hairstyle:'quiff'}, {...defaultAppearance,gender:'female',hairstyle:'braid',shirt:'#628fbb'}, {...defaultAppearance,gender:'female',tudung:'bawal-labuh',shirt:'#6fa58d'}];
  const people=looks.map((look,i)=>{const p=createPerson(look.shirt,i===1,look);p.group.position.x=(i-1)*2;scene.add(p.group);return p;});
  await Promise.all(people.map(p=>whenCharacterReady(p.group)));
  people[0].leftLeg.rotation.x=.38;people[0].rightLeg.rotation.x=-.38;people[0].leftArm.rotation.x=-.35;people[0].rightArm.rotation.x=.35;
  applyAccessories(people[0].group,['spectacles']);dancePose(people[2],8000,2.2);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#234d3d',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.09;scene.add(floor);
  scene.updateMatrixWorld(true);const legBounds=new THREE.Box3().setFromObject(people[1].leftLeg);
  const bounds=people.map(p=>{const b=new THREE.Box3().setFromObject(p.group);return [...b.min.toArray(),...b.max.toArray()].every(Number.isFinite);});renderer.render(scene,camera);
  const label=document.createElement('div');label.style.cssText='position:absolute;top:30px;left:40px;color:#f5e6c9;font:600 25px system-ui';label.textContent='LEPAKMAMAK · BLENDER CHARACTERS';document.body.append(label);
  const sub=document.createElement('div');sub.style.cssText='position:absolute;bottom:30px;left:80px;right:80px;display:flex;justify-content:space-around;color:#f5e6c9;font:500 20px system-ui';sub.innerHTML='<span>Berjalan · Quiff</span><span>Duduk · Tocang</span><span>Menari · Bawal labuh</span>';document.body.append(sub);
  return {states:people.map(p=>p.group.userData.assetState),bounds,seatedForward:legBounds.max.z,elbowBent:people[2].leftArm.children[1]?.name!=='left-forearm'};
 });
 expect(result.states).toEqual(['ready','ready','ready']);expect(result.bounds).toEqual([true,true,true]);expect(result.seatedForward).toBeGreaterThan(.3);expect(result.elbowBent).toBe(true);
 await page.screenshot({path:'art/blender/generated/character-module-v1/review/poses.png'});
});
