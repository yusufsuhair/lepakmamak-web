import {test,expect} from '@playwright/test';
import destinations from '../shared/teleports.json' with {type:'json'};
import {teleportPlayer} from '../server/teleport.mjs';
test('teleport validates destinations, releases chairs, rejects drivers/passengers and cooldown',()=>{
 const player:any={x:10,z:10,chairId:'chair-0',seated:true,danceUntil:90000};
 expect(teleportPlayer(player,{id:'fake'},10000)).toBeNull();
 expect(teleportPlayer(player,{id:'1'},10000)).toBeTruthy();expect(player.chairId).toBeNull();expect(player.seated).toBe(false);expect(player.danceUntil).toBe(0);
 expect(teleportPlayer(player,{id:'pantai-senja'},14000)).toMatchObject({id:'pantai-senja',x:97,z:132});
 expect(teleportPlayer(player,{id:'2'},11000)).toBeNull();
 player.riding=true;expect(teleportPlayer(player,{id:'2'},20000)).toBeNull();player.riding=false;player.passengerOf='driver';expect(teleportPlayer(player,{id:'2'},20000)).toBeNull();
});
test('all map arrivals avoid solid objects and map offers teleport for selected place',async({page})=>{
 await page.goto('/');const blocked=await page.evaluate(async points=>{const {createWorld}=await import('/src/world.ts');const world=createWorld({add(){}} as any);return points.filter(p=>world.solids.some(s=>Math.abs(p.x-s.x)<s.hx+.7&&Math.abs(p.z-s.z)<s.hz+.7)).map(p=>p.id);},destinations);expect(blocked).toEqual([]);
 await page.evaluate(()=>{document.querySelector<HTMLDialogElement>('#city-map')!.showModal();});
 await page.getByRole('button',{name:'1 Mamak Maju',exact:true}).click();await expect(page.getByRole('button',{name:'Teleport to Mamak Maju',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'pantai-senja Pantai Senja',exact:true}).click();await expect(page.getByRole('button',{name:'Teleport to Pantai Senja',exact:true})).toBeEnabled();
});
test('the swapped mosque and court entrances follow their new locations',()=>{
 expect(destinations).toEqual(expect.arrayContaining([
  {id:'17',x:54,z:108},
  {id:'21',x:96,z:100},
  {id:'22',x:129,z:99},
 ]));
});
test('expanded city map opens in 3D by default',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>document.querySelector<HTMLDialogElement>('#city-map')!.showModal());
 await expect(page.locator('#expanded-map')).toHaveAttribute('data-mode','3d');
 await expect(page.getByRole('button',{name:'3D',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('3D map renders actual city and preserves directory selection across view modes',async({page})=>{
 await page.goto('/');await page.evaluate(()=>document.querySelector<HTMLDialogElement>('#city-map')!.showModal());
 await page.getByRole('button',{name:'3D',exact:true}).click();
 await expect(page.getByRole('button',{name:'3D',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#expanded-map')).toHaveAttribute('data-mode','3d');
 await page.getByRole('button',{name:'1 Mamak Maju',exact:true}).click();
 await expect(page.getByRole('button',{name:'Teleport to Mamak Maju',exact:true})).toBeEnabled();
 await page.setViewportSize({width:390,height:844});
 const size=await page.locator('#expanded-map').boundingBox();expect(size!.width).toBeLessThan(390);
 await page.screenshot({path:'/tmp/lepak-3d-map.png'});
 await page.getByRole('button',{name:'2D',exact:true}).click();
 await expect(page.getByRole('button',{name:'2D',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Teleport to Mamak Maju',exact:true})).toBeEnabled();
});
