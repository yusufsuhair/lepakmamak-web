import {test, expect} from '@playwright/test';
import {enterAt} from './city';

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
  await expect(page.locator('#shop-items article')).toHaveCount(4);
  const cat=page.locator('#shop-items article').filter({has:page.getByRole('heading',{name:'Oyen',exact:true})});
  await cat.getByRole('button',{name:'Beli · 🪙 250'}).click();
  await cat.getByRole('button',{name:'Pakai',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-equipped','pet-ginger');
  const ribbon=page.locator('#shop-items article').filter({has:page.getByRole('heading',{name:'Red ribbon',exact:true})});
  await ribbon.getByRole('button',{name:'Beli · 🪙 60'}).click();
  await ribbon.getByRole('button',{name:'Pakai',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-equipped','pet-ginger,pet-collar-red');
  await page.screenshot({path:'test-results-pets/pet-shop.png'});
  await page.getByRole('button',{name:'Close shop'}).click();
  await expect(page.locator('#item-shop')).not.toBeVisible();
});

for (const width of [1280,390]) test(`cat toolbar opens pet studio at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:800});
  await enterAt(page,-18,52);
  if(width===390) await page.getByRole('button',{name:'More controls'}).click();
  await page.getByRole('button',{name:'Open pets',exact:true}).click();
  await expect(page.locator('#pet-studio')).toBeVisible();
  await expect(page.locator('.pet-studio-empty')).toContainText('No pet yet');
  await expect(page.getByRole('button',{name:'Visit Kedai'})).toBeVisible();
  await page.screenshot({path:`test-results-pets/pet-toolbar-${width}.png`});
});
