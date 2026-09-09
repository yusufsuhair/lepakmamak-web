import {test,expect} from '@playwright/test';
import destinations from '../shared/teleports.json' with {type:'json'};
import {teleportPlayer} from '../server/teleport.mjs';
test('teleport validates destinations, releases chairs, rejects drivers/passengers and cooldown',()=>{
 const player:any={x:10,z:10,chairId:'chair-0',seated:true,danceUntil:90000};
 expect(teleportPlayer(player,{id:'fake'},10000)).toBeNull();
 expect(teleportPlayer(player,{id:'1'},10000)).toBeTruthy();expect(player.chairId).toBeNull();expect(player.seated).toBe(false);expect(player.danceUntil).toBe(0);
 expect(teleportPlayer(player,{id:'2'},11000)).toBeNull();
 player.riding=true;expect(teleportPlayer(player,{id:'2'},20000)).toBeNull();player.riding=false;player.passengerOf='driver';expect(teleportPlayer(player,{id:'2'},20000)).toBeNull();
});
test('all map arrivals avoid solid objects and map offers teleport for selected place',async({page})=>{
 await page.goto('/');const blocked=await page.evaluate(async points=>{const {createWorld}=await import('/src/world.ts');const world=createWorld({add(){}} as any);return points.filter(p=>world.solids.some(s=>Math.abs(p.x-s.x)<s.hx+.7&&Math.abs(p.z-s.z)<s.hz+.7)).map(p=>p.id);},destinations);expect(blocked).toEqual([]);
 await page.evaluate(()=>{document.querySelector<HTMLDialogElement>('#city-map')!.showModal();});
 await page.locator('#city-directory button').filter({hasText:'Mamak Maju'}).click();await expect(page.getByRole('button',{name:'Teleport to Mamak Maju',exact:true})).toBeEnabled();
});
