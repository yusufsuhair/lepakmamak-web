import {test,expect} from '@playwright/test';
import {createTableSocial} from '../server/tables.mjs';
import tables from '../shared/tables.json' with {type:'json'};
test('table names are static and legacy actions do nothing',()=>{
 const messages:any[]=[];const social=createTableSocial((_ws:any,m:any)=>messages.push(m));const a={id:'a',ws:{},name:'Alice',chairId:'chair-0'};const players=new Map([['a',a]]);social.sync(players,true);
 for(const type of ['table-name','table-round','receipt','table-order','table-consume'])expect(social.handle(players,a,{type,name:'Changed'})).toBe(true);
 expect(messages).toHaveLength(1);expect(messages[0].tables.map((t:any)=>t.name)).toEqual(tables.map(table=>table.name));expect(messages[0].tables[0]).not.toHaveProperty('cheersUntil');expect(messages[0].tables[0]).not.toHaveProperty('hostId');
 a.chairId='chair-3';social.sync(players);expect(messages.at(-1).tables[1].occupants[0].id).toBe('a');expect(messages.at(-1).tables[0].occupants).toEqual([]);
});

test('table snapshots retain the character appearance used by roster portraits',()=>{
 const messages:any[]=[];const social=createTableSocial((_ws:any,m:any)=>messages.push(m));
 const appearance={skin:'#8f5d3b',hair:'#172019',shirt:'#d14b3f',gender:'male',hairstyle:'short'};
 const player={id:'a',ws:{},name:'Ali',chairId:'chair-0',appearance};
 social.sync(new Map([['a',player]]),true);
 expect(messages[0].tables[0].occupants[0].appearance).toEqual(appearance);
});
for(const width of [390,1280])test(`only current table and games at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.route('**/table-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css">'}));await page.goto('/table-harness');
 await page.evaluate(async()=>{const {setupTableSocial}=await import('/src/table-social.ts');const ui=setupTableSocial(()=>true,'geng',()=>{},()=>{});(window as any).tableUI=ui;ui.state([{id:'meja-2',name:'Old custom name',capacity:2,occupants:[{id:'self',name:'Yusuf',chairId:'chair-3'}]}],'self',true);ui.open('meja-1');});
 await expect(page.locator('#table-name')).toHaveText('Meja 2');await expect(page.locator('#table-seats')).toContainText('You are sitting at Meja 2');await expect(page.locator('.table-game-grid')).toBeVisible();await expect(page.locator('.lukis')).toBeHidden();await expect(page.locator('.poker')).toBeHidden();await expect(page.locator('#table-name-form, #table-round, #get-receipt, #table-link, #table-list')).toHaveCount(0);
 await page.evaluate(()=>(window as any).tableUI.state([],'self',true));await expect(page.locator('#table-detail')).toBeHidden();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('songs duck while a table game is open and return when it closes',async({page})=>{
 await page.route('**/table-quiet',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css">'}));
 await page.goto('/table-quiet');
 await page.evaluate(async()=>{
  const {setupTableSocial}=await import('/src/table-social.ts');
  const ui=setupTableSocial(()=>true,'geng',()=>{},()=>{});(window as any).ui=ui;
  ui.state([{id:'meja-1',name:'Meja 1',capacity:4,occupants:[{id:'self',name:'Yusuf',chairId:'chair-0'}]}],'self',true);
 });
 const playing=()=>page.evaluate(()=>(window as any).ui.playing);
 expect(await playing()).toBe(false);                       // dialog shut
 await page.evaluate(()=>(window as any).ui.open('meja-1'));
 expect(await playing()).toBe(false);                       // open, but still on the game menu
 await page.locator('[data-select="lukis"]').click();
 expect(await playing()).toBe(true);                        // actually playing -> songs duck
 await page.getByText('← All games').click();
 expect(await playing()).toBe(false);                       // back to the menu -> songs return
 await page.locator('[data-select="uno"]').click();
 expect(await playing()).toBe(true);
 await page.evaluate(()=>(window as any).ui.close());
 expect(await playing()).toBe(false);                       // closed -> songs return
});

test('one list combines the unjoined lobby, game art and joined users',async({page})=>{
 await page.route('**/table-roster',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"><div id="speaking"></div></div>'}));
 await page.goto('/table-roster');
 await page.evaluate(async()=>{
  const {setupTableSocial}=await import('/src/table-social.ts');
  const ui=setupTableSocial(()=>true,'geng',()=>{},()=>{});(window as any).ui=ui;
  const ali={id:'ali',name:'Ali',chairId:'chair-0',appearance:{skin:'#8b583d',hair:'#202c2b',shirt:'#62876b',gender:'male',hairstyle:'short'}};
  const mei={id:'mei',name:'Mei',chairId:'chair-1',appearance:{skin:'#cf986c',hair:'#654331',shirt:'#628fbb',gender:'female',hairstyle:'ponytail'}};
  const joe={id:'joe',name:'Joe',chairId:'chair-2',appearance:{skin:'#b98157',hair:'#202c2b',shirt:'#ef734c',gender:'male',hairstyle:'short'}};
  ui.state([{id:'meja-1',name:'Meja 1',capacity:4,occupants:[ali,mei,joe],activeGames:[{game:'lukis',phase:'playing',members:[ali]},{game:'uno',phase:'lobby',members:[mei]}]}],'ali',true);ui.open('meja-1');
 });
 await expect(page.locator('#table-seats')).not.toContainText('Dalam:');
 await expect(page.locator('.table-roster').first()).toHaveClass(/neutral/);
 await expect(page.locator('.table-roster').first()).toContainText('TABLE LOBBY · NOT IN A GAME');
 await expect(page.locator('.table-roster').first()).toContainText('Joe');
 await expect(page.locator('.table-roster.seated .table-roster-person')).toHaveCount(1);
 await expect(page.locator('[data-select="lukis"] .game-members')).toContainText('IN GAME');
 await expect(page.locator('[data-select="lukis"] .game-member')).toContainText('Ali');
 await expect(page.locator('[data-select="uno"] .game-members')).toContainText('WAITING');
 await expect(page.locator('[data-select="uno"] .game-member')).toContainText('Mei');
 await expect(page.locator('[data-select="poker"] .game-members')).toContainText('NO PLAYERS YET');
 expect(await page.locator('[data-select="lukis"] .player-face').first().evaluate(el=>getComputedStyle(el).getPropertyValue('--face-shirt').trim())).toBe('#62876b');
 await expect(page.locator('#table-social > #speaking')).toHaveCount(1);
 await page.evaluate(()=>(window as any).ui.close());
 await expect(page.locator('#hud > #speaking')).toHaveCount(1);
});

test('a running game stays visible and the table chat has a clean bottom edge',async({page})=>{
 await page.route('**/table-chat-edge',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"><aside id="voice-panel"><div id="voice-audience"></div></aside></div>'}));
 await page.goto('/table-chat-edge');
 await page.evaluate(async()=>{
  const {setupChat}=await import('/src/social.ts');setupChat(()=>true,()=>{});
  const {setupTableSocial}=await import('/src/table-social.ts');
  const ui=setupTableSocial(()=>true,'geng',()=>{},()=>{},()=>true,()=>document.getElementById('voice-panel'));
  (window as any).ui=ui;ui.state([{id:'meja-1',name:'Meja 1',capacity:4,occupants:[{id:'self',name:'Yusuf',chairId:'chair-0'}]}],'self',true);ui.open('meja-1');
 });
 const dialog=page.locator('#table-social[open]');await dialog.locator('[data-select="lukis"]').click();
 await expect(dialog.locator('#table-minimize')).toHaveCount(0);
 await expect(dialog).not.toHaveClass(/game-minimized/);await expect(dialog.locator('#table-detail')).toBeVisible();
 await expect(dialog.locator('#city-chat')).toHaveCount(1);await expect(dialog.locator('#voice-panel')).toBeVisible();
 expect(await dialog.locator('#city-chat').evaluate(element=>element.parentElement?.id)).toBe('table-social');
 const border=await dialog.locator('#chat-heading').evaluate(element=>{const style=getComputedStyle(element);return {width:style.borderBottomWidth,color:style.borderBottomColor,radius:style.borderTopLeftRadius};});
 expect(border.width).toBe('1px');expect(border.color).not.toBe('rgba(0, 0, 0, 0)');expect(border.radius).toBe('12px');
});

// A bare #table-social{display:flex} would outrank the UA sheet's dialog:not([open]){display:
// none} by specificity, leaving the empty dialog visible over the whole page before anyone
// ever opens a table.
test('the table dialog stays hidden until a table is actually opened',async({page})=>{
 await page.route('**/table-hidden',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"><aside id="voice-panel"><div id="voice-audience"></div></aside><div id="city-chat"></div></div>'}));
 await page.goto('/table-hidden');
 await page.evaluate(async()=>{
  const {setupTableSocial}=await import('/src/table-social.ts');
  (window as any).ui=setupTableSocial(()=>true,'geng',()=>{},()=>{},()=>true,()=>document.getElementById('voice-panel'));
 });
 await expect(page.locator('#table-social')).toBeHidden();
 await page.evaluate(()=>{(window as any).ui.state([{id:'meja-1',name:'Meja 1',capacity:4,occupants:[{id:'self',name:'Yusuf',chairId:'chair-0'}]}],'self',true);(window as any).ui.open('meja-1');});
 await expect(page.locator('#table-social[open]')).toBeVisible();
});
