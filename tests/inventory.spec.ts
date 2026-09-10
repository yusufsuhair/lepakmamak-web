import {test,expect} from '@playwright/test';

const mount=async(page:any,width:number)=>{
 await page.setViewportSize({width,height:844});
 await page.route('**/inventory-harness',(r:any)=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/inventory-harness');
 await page.evaluate(async()=>{
  const {setupInventory}=await import('/src/inventory.ts');
  let state={items:[{sku:'cap',equipped:false},{sku:'batik',equipped:true}],balance:500};
  const api={inventory:async()=>state,equip:async(sku:string,equipped:boolean)=>{state={...state,items:state.items.map(i=>i.sku===sku?{...i,equipped}:i)};return state;}};
  (window as any).looks=[];
  setupInventory(api,()=>{},(look:any)=>(window as any).looks.push(look)).open();
 });
};

for(const width of [390,1280])test(`one screen holds items, equipment and clothes at ${width}px`,async({page})=>{
 await mount(page,width);
 await expect(page.locator('.inventory-item')).toHaveCount(2);
 await page.locator('.inventory-item').filter({hasText:'Topi Lepak'}).click();
 await page.getByRole('button',{name:'Equip',exact:true}).click();
 await expect(page.getByRole('button',{name:'Unequip',exact:true})).toBeVisible();
 await expect(page.locator('.equipment-slots')).toContainText('Topi Lepak');

 await page.getByRole('button',{name:'Skins',exact:true}).click();
 await expect(page.locator('.inventory-item')).toHaveCount(1);

 // The wardrobe is a tab here, not a second dialog to open.
 await page.getByRole('button',{name:'Tops',exact:true}).click();
 await expect(page.getByRole('radio',{name:'Blue shirt'})).toBeVisible();
 await expect(page.locator('.inventory-stage canvas')).toHaveAttribute('data-preview','live-3d');
 await page.getByRole('radio',{name:'Blue shirt'}).click();
 await expect(page.getByRole('radio',{name:'Blue shirt'})).toHaveAttribute('aria-checked','true');
 await expect(page.locator('.inventory-stage canvas')).toHaveAttribute('data-shirt','#628fbb');
 await expect(page.locator('.outfit-slots')).toContainText('Blue');
 await expect(page.locator('.inventory-look-name')).toContainText('Blue top');
 // The world is told at once; there is no Save button to press.
 expect(await page.evaluate(()=>(window as any).looks.at(-1).shirt)).toBeTruthy();

 expect(await page.locator('#inventory').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:`test-results/character-${width}.png`});
 await page.getByRole('button',{name:'Close inventory'}).click();
 await expect(page.locator('#inventory')).not.toBeVisible();
});

test('the top bar reads wall, recentre, Kedai, character, settings',async({page})=>{
 await page.goto('/');
 const order=await page.locator('.hud-right').evaluate(el=>[...el.children].map(child=>child.id||child.className));
 // The ⋮ leads, because on a phone it is the only one showing and the rest drop under it.
 expect(order).toEqual(['hud-more','open-wall','camera-controls','open-shop','open-inventory','menu']);
 // Neither Kedai nor the wardrobe is buried in settings any more, and the wardrobe is
 // not a dialog of its own at all.
 await expect(page.locator('#pause #open-shop,#pause #open-wardrobe')).toHaveCount(0);
 await expect(page.locator('#open-wardrobe')).toHaveCount(0);
});
