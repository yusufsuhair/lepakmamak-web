import {test, expect} from '@playwright/test';
import {enterAt} from './city';
import {petStyle} from '../shared/pet-style.mjs';
import petBreeds from '../shared/pet-breeds.json' with {type:'json'};
import petCoats from '../shared/pet-coats.json' with {type:'json'};

test('all breed and coat combinations validate while old styles remain supported', () => {
  for (const breed of petBreeds) {
    expect(petStyle(breed.id)?.coatId).toBe(breed.coat);
    for (const coat of petCoats) expect(petStyle(`${breed.id}:${coat.id}`)).toMatchObject({breedId:breed.id,coatId:coat.id});
  }
  for (const invalid of [null,{},'munchkin:missing','missing:blue','munchkin:blue:extra','munchkin:']) expect(petStyle(invalid)).toBeNull();
});

test('breed silhouettes survive animation and share the Blender rig', async ({page}) => {
  await page.route('**/pet-breeds', route => route.fulfill({contentType:'text/html',body:'<main style="display:grid;grid-template-columns:repeat(4,1fr);background:#18382d;color:#f6efd9;font:16px sans-serif;padding:20px;gap:12px"></main>'}));
  await page.goto('/pet-breeds');
  const result = await page.evaluate(async () => {
    const {createAnimal,animateAnimal}=await import('/src/animals.ts');
    const {createPetPreview}=await import('/src/pet-preview.ts');
    const ids=['british-shorthair:blue','maine-coon:brown-tabby','munchkin:ginger-tabby','persian:white'];
    const animals=ids.map(id=>createAnimal(true,'#ead8bd',id));
    for(const id of ids){const tile=document.createElement('section');const canvas=document.createElement('canvas');canvas.style.cssText='width:100%;aspect-ratio:1';tile.append(canvas,document.createTextNode(id.split(':')[0]));document.querySelector('main')!.append(tile);const preview=createPetPreview(canvas);preview.setPet('pet-cream','',id);preview.setAction('idle');preview.start();}
    await new Promise<void>((resolve,reject)=>{const until=Date.now()+10000;const timer=setInterval(()=>{if(animals.every(animal=>animal.parts)){clearInterval(timer);resolve();}else if(Date.now()>until){clearInterval(timer);reject(Error('Cat model did not load'));}},25);});
    for(const animal of animals){animateAnimal(animal,'lie',1);animateAnimal(animal,'walk',2);animateAnimal(animal,'idle',3);}
    return animals.map(animal=>({headWidth:animal.parts!.head.scale.x,legHeight:animal.parts!.legs[0].position.y,legScale:animal.parts!.legs[0].scale.y,fluffy:animal.parts!.visual.getObjectByName('pet-ruff--1-0')!.visible,model:animal.group.userData.catModel}));
  });
  expect(result[0].headWidth).toBeGreaterThan(result[2].headWidth);
  expect(result[2].legHeight).toBeLessThan(result[0].legHeight);
  expect(result[2].legScale).toBeLessThan(result[0].legScale);
  expect(result.map(item=>item.fluffy)).toEqual([false,true,false,true]);
  for(const canvas of await page.locator('canvas').all()) await expect(canvas).toHaveAttribute('data-model','blender');
  await page.screenshot({path:'test-results/pet-breed-lineup.png'});
});

for (const width of [1280,390]) test(`pet studio customises breeds and coats independently at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:850});
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType:'application/javascript',body:`export const session={user:{id:'owner',user_metadata:{pet_breed:'ginger-tabby'}}}; export const auth={auth:{updateUser:async({data})=>{Object.assign(session.user.user_metadata,data);return {data:{user:session.user},error:null};}}};`}));
  await page.route('**/pet-customise', route => route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><main></main>'}));
  await page.goto('/pet-customise');
  await page.evaluate(async () => {
    const {setupPetStudio}=await import('/src/pet-studio.ts');
    const state={items:[{sku:'pet-ginger',equipped:true}],balance:200};
    const studio=setupPetStudio({inventory:async()=>state,equip:async()=>state},{onBreed:value=>{document.body.dataset.style=value;}});
    (window as any).petStudio=studio;studio.open();
  });
  const modal=page.locator('#pet-studio'),canvas=modal.locator('canvas');
  await expect(modal.locator('.pet-studio-breeds button')).toHaveCount(petBreeds.length);
  await modal.getByRole('button',{name:'British Shorthair',exact:true}).click();
  await modal.getByRole('button',{name:'Blue grey',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-breed','british-shorthair:blue');
  await expect(canvas).toHaveAttribute('data-model','blender');
  await modal.getByRole('button',{name:'Maine Coon',exact:true}).click();
  await modal.getByRole('button',{name:'Black smoke',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-style','maine-coon:smoke');
  await modal.getByRole('button',{name:'Rest',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-action','lie');
  await modal.getByRole('button',{name:'Close pet studio'}).click();
  await page.evaluate(()=>(window as any).petStudio.open());
  await expect(canvas).toHaveAttribute('data-breed','maine-coon:smoke');
  await modal.getByRole('button',{name:'Munchkin',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-breed','munchkin:smoke');
  await modal.getByRole('button',{name:'Stand',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-model','blender');
  await modal.evaluate(el=>el.scrollTop=0);
  expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:`test-results/pet-revamp-${width}.png`});
});

test('pets follow, catch up after travel, change decoration and leave with their owner', async ({page}) => {
  await page.route('**/pet-harness', route => route.fulfill({contentType:'text/html', body:'<main></main>'}));
  await page.goto('/pet-harness');
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const {createPets} = await import('/src/pets.ts');
    const scene = new THREE.Scene(), pets = createPets(scene, []);
    function tick(x:number,y:number,z:number,equipment:string,name='') { pets.begin(); pets.update('owner',x,y,z,0,equipment,.04,1,name); pets.end(); }
    tick(0,0,0,'pet-ginger');
    for(let i=0;i<100;i++) tick(5,0,0,'pet-ginger');
    const followed = scene.children[0].position.distanceTo(new THREE.Vector3(5,0,0));
    tick(100,12,100,'pet-ginger,pet-collar-red');
    const traveled = scene.children[0].position.distanceTo(new THREE.Vector3(100,12,100));
    const red = scene.children[0].children[0].children.length;
    tick(100,12,100,'pet-cream,pet-collar-teal','Mochi');
    const count = scene.children.length;
    const petName = scene.children[0]?.userData.petName;
    const colors:string[]=[]; scene.traverse((object:any)=>{if(object.material) colors.push(object.material.color.getHexString());});
    tick(100,12,100,'cap');
    return {followed,traveled,red,count,colors,petName,removed:scene.children.length};
  });
  expect(result.followed).toBeLessThan(1.2);
  expect(result.traveled).toBeLessThan(1.2);
  expect(result.count).toBe(1);
  expect(result.colors).toContain('51b8ab');
  expect(result.colors).toContain('f0e8d8');
  expect(result.petName).toBe('Mochi');
  expect(result.removed).toBe(0);
});

test('pet shop buys and equips cats and decorations through the account inventory', async ({page}) => {
  const items:{sku:string;equipped:boolean}[]=[];
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType:'application/javascript', body:'export const session={access_token:"test"};'}));
  await page.route('http://shop.test/shop/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    if (path.endsWith('/buy')) items.push({sku:body.sku,equipped:false});
    if (path.endsWith('/equip')) items.find(item=>item.sku===body.sku)!.equipped=body.equipped;
    await route.fulfill({json:{available:true,balance:500,items,dailyAvailable:true},headers:{'Access-Control-Allow-Origin':'*'}});
  });
  await page.route('**/pet-shop', route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><main></main>'}));
  await page.goto('/pet-shop');
  await page.evaluate(async()=>{const {setupShop}=await import('/src/shop.ts'); setupShop((items:string[])=>{document.body.dataset.equipped=items.join(',');},'http://shop.test').open('pets');});
  await expect(page.locator('#shop-items article')).toHaveCount(3);
  const cat=page.locator('#shop-items article').filter({has:page.getByRole('heading',{name:'Lepak Cat Companion',exact:true})});
  await expect(cat.locator('canvas')).toHaveAttribute('data-preview', 'pet-3d');
  await cat.getByRole('button',{name:'Buy · 🪙 250'}).click();
  await cat.getByRole('button',{name:'Equip',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-equipped','pet-companion');
  const ribbon=page.locator('#shop-items article').filter({has:page.getByRole('heading',{name:'Red ribbon',exact:true})});
  await ribbon.getByRole('button',{name:'Buy · 🪙 60'}).click();
  await ribbon.getByRole('button',{name:'Equip',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-equipped','pet-companion,pet-collar-red');
  await page.screenshot({path:'test-results-pets/pet-shop.png'});
  await page.getByRole('button',{name:'Close shop'}).click();
  await expect(page.locator('#item-shop')).not.toBeVisible();
});

test('pet studio shows a loading state before inventory is ready', async ({page}) => {
  await page.route('**/pet-loading', route => route.fulfill({contentType:'text/html', body:'<main></main>'}));
  await page.goto('/pet-loading');
  await page.evaluate(async () => {
    const {setupPetStudio} = await import('/src/pet-studio.ts');
    setupPetStudio({inventory: () => new Promise(() => {}), equip: async () => ({items: [], balance: 0})}).open();
  });
  await expect(page.locator('#pet-studio')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#pet-studio-status')).toHaveText('Loading your companions…');
  await expect(page.locator('#pet-studio .skel')).toHaveCount(5);
  await expect(page.locator('.pet-studio-empty')).toHaveCount(0);
});

for (const width of [1280,390]) test(`cat toolbar opens pet studio at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:800});
  await enterAt(page,-18,52);
  if(width===390) await page.getByRole('button',{name:'More controls'}).click();
  await page.getByRole('button',{name:'Open pets',exact:true}).click();
  await expect(page.locator('#pet-studio')).toBeVisible();
  await expect(page.locator('.pet-studio-empty')).toContainText('No pet yet');
  await expect(page.getByRole('button',{name:'Visit Shop'})).toBeVisible();
  await page.screenshot({path:`test-results-pets/pet-toolbar-${width}.png`});
});
