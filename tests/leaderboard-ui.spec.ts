import {test,expect} from '@playwright/test';

test('the Wall shows this week board on open, and reads it once rather than pushing',async({page})=>{
 let reads=0;
 await page.route('**/leaderboard',route=>{
  reads++;
  return route.fulfill({json:{weekStart:'2026-09-14',boards:{
   basketball_points:[{name:'Ali',value:12},{name:'Mei',value:7}],
   tables_sat:[{name:'Ravi',value:9}],
  }}});
 });
 await page.route('**/wall/posts',route=>route.fulfill({json:{posts:[]}}));
 await page.route('**/board-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"><i id="wall-unread" hidden></i></div>'}));
 await page.goto('/board-harness');
 await page.evaluate(async()=>{
  const {setupWall}=await import('/src/wall.ts');
  (window as any).wall=setupWall('ws://127.0.0.1:9/ws',()=>{});
  (window as any).wall.open();
 });

 await expect(page.locator('#wall-board-week')).toContainText('Isnin');
 await expect(page.locator('.wall-board-column').first()).toContainText('Basketball');
 await expect(page.locator('.wall-board-column').first().locator('li').first()).toContainText('Ali');
 await expect(page.locator('.wall-board-column').first().locator('li').first()).toContainText('12');
 await expect(page.locator('.wall-board-column').nth(1)).toContainText('Ravi');

 // Nothing is farmable-and-public: only the two ranked counters appear anywhere.
 const body=await page.locator('#wall-board').textContent();
 for(const dropped of ['punch','Punch','recall','Recall','dance','Dance']) expect(body).not.toContain(dropped);

 await page.waitForTimeout(1200);
 expect(reads).toBe(1);
 await page.screenshot({path:'test-results/wall-board.png'});
});

test('a board that cannot be read says so instead of showing an empty ranking',async({page})=>{
 await page.route('**/leaderboard',route=>route.fulfill({status:500,json:{error:'nope'}}));
 await page.route('**/wall/posts',route=>route.fulfill({json:{posts:[]}}));
 await page.route('**/fail-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"><i id="wall-unread" hidden></i></div>'}));
 await page.goto('/fail-harness');
 await page.evaluate(async()=>{
  const {setupWall}=await import('/src/wall.ts');
  setupWall('ws://127.0.0.1:9/ws',()=>{}).open();
 });
 await expect(page.locator('#wall-board-week')).toContainText('tidak dapat dimuatkan');
});
