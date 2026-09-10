import {test,expect} from '@playwright/test';
import {createTableSocial} from '../server/tables.mjs';
test('table names are static and legacy actions do nothing',()=>{
 const messages:any[]=[];const social=createTableSocial((_ws:any,m:any)=>messages.push(m));const a={id:'a',ws:{},name:'Alice',chairId:'chair-0'};const players=new Map([['a',a]]);social.sync(players,true);
 for(const type of ['table-name','table-round','receipt','table-order','table-consume'])expect(social.handle(players,a,{type,name:'Changed'})).toBe(true);
 expect(messages).toHaveLength(1);expect(messages[0].tables.map((t:any)=>t.name)).toEqual(['Meja 1','Meja 2','Meja 3','Meja 4','Meja 5','Meja 6','Meja Besar']);expect(messages[0].tables[0]).not.toHaveProperty('cheersUntil');expect(messages[0].tables[0]).not.toHaveProperty('hostId');
 a.chairId='chair-3';social.sync(players);expect(messages.at(-1).tables[1].occupants[0].id).toBe('a');expect(messages.at(-1).tables[0].occupants).toEqual([]);
});
for(const width of [390,1280])test(`only current table and games at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.route('**/table-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css">'}));await page.goto('/table-harness');
 await page.evaluate(async()=>{const {setupTableSocial}=await import('/src/table-social.ts');const ui=setupTableSocial(()=>true,'geng',()=>{},()=>{});(window as any).tableUI=ui;ui.state([{id:'meja-2',name:'Old custom name',capacity:2,occupants:[{id:'self',name:'Yusuf',chairId:'chair-3'}]}],'self',true);ui.open('meja-1');});
 await expect(page.locator('#table-name')).toHaveText('Meja 2');await expect(page.locator('#table-seats')).toContainText('Anda duduk di Meja 2');await expect(page.locator('.table-game-grid')).toBeVisible();await expect(page.locator('.lukis')).toBeHidden();await expect(page.locator('.poker')).toBeHidden();await expect(page.locator('#table-name-form, #table-round, #get-receipt, #table-link, #table-list')).toHaveCount(0);
 await page.evaluate(()=>(window as any).tableUI.state([],'self',true));await expect(page.locator('#table-detail')).toBeHidden();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('songs duck while a table game is open and return when it closes',async({page})=>{
 await page.route('**/table-quiet',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css">'}));
 await page.goto('/table-quiet');
 await page.evaluate(async()=>{
  const {setupTableSocial}=await import('/src/table-social.ts');
  const ui=setupTableSocial(()=>true,'geng',()=>{},()=>{});(window as any).ui=ui;
  ui.state([{id:'meja-1',name:'Meja 1',capacity:3,occupants:[{id:'self',name:'Yusuf',chairId:'chair-0'}]}],'self',true);
 });
 const playing=()=>page.evaluate(()=>(window as any).ui.playing);
 expect(await playing()).toBe(false);                       // dialog shut
 await page.evaluate(()=>(window as any).ui.open('meja-1'));
 expect(await playing()).toBe(false);                       // open, but still on the game menu
 await page.locator('[data-select="lukis"]').click();
 expect(await playing()).toBe(true);                        // actually playing -> songs duck
 await page.getByText('← Semua permainan').click();
 expect(await playing()).toBe(false);                       // back to the menu -> songs return
 await page.locator('[data-select="uno"]').click();
 expect(await playing()).toBe(true);
 await page.evaluate(()=>(window as any).ui.close());
 expect(await playing()).toBe(false);                       // closed -> songs return
});
