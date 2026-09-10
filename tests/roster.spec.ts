import {test,expect} from '@playwright/test';
import chairs from '../shared/chairs.json' with {type:'json'};
import tables from '../shared/tables.json' with {type:'json'};
import {readFileSync} from 'node:fs';

test('a table knows how many seats it has, from the chairs it actually has',()=>{
 const seats=new Map<string,number>();
 for(const chair of chairs) if(chair.tableId) seats.set(chair.tableId,(seats.get(chair.tableId)||0)+1);
 // Meja Besar is the one the old guess got wrong: nine chairs, told it had three.
 expect(seats.get('meja-9')).toBe(9);
 expect(seats.get('meja-2')).toBe(2);
 for(const table of tables) expect(seats.get(table.id)).toBeGreaterThan(0);
 // The guess is gone from the source.
 const main=readFileSync('src/main.ts','utf8');
 expect(main).not.toContain("table.id==='meja-2'?2:3");
 expect(main).toContain('seatsPerTable');
});

const mount=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {createTableShell}=await import('/src/table-shell.ts');
  const held=window as any;
  held.shell=createTableShell(()=>true);
  document.getElementById('hud')!.append(held.shell.root);
 });
};

test('a game lobby says who is in it and whether each of them is ready',async({page})=>{
 await mount(page,'roster-lobby-harness');
 await page.evaluate(()=>(window as any).shell.state({
  key:'meja-1',game:'uno',scope:'table',phase:'lobby',ends:0,serverTime:0,min:2,max:4,
  members:[{id:'a',name:'Ali',ready:true},{id:'b',name:'Mei',ready:false}],
 },'a'));

 const seats=page.locator('.table-seat.filled');
 await expect(seats).toHaveCount(2);
 await expect(seats.first()).toContainText('Ali');
 await expect(seats.nth(1)).toContainText('Mei');
 // Both states say what they are; not-ready used to be an empty element, which reads the
 // same as no information at all.
 await expect(seats.first().locator('i[data-ready]')).toHaveText('✓ Ready');
 await expect(seats.first().locator('i[data-ready]')).toHaveAttribute('data-ready','true');
 await expect(seats.nth(1).locator('i[data-ready]')).toHaveText('Waiting…');
 await expect(seats.nth(1).locator('i[data-ready]')).toHaveAttribute('data-ready','false');

 // And the empty seats are still countable.
 await expect(page.locator('.table-seat.empty')).toHaveCount(2);
});

test('the city roster shows names at a glance and hides itself when alone',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Solo');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();
 // Alone in solo mode there is nobody to list, so it says nothing rather than "0 others".
 await expect(page.locator('#roster-brief')).toBeHidden();
});
