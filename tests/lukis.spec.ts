import {test,expect} from '@playwright/test';
import {createLukis,scoreGuess} from '../server/lukis.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};
test('Lukis hides answers, enforces drawer permissions and awards a correct guess once',()=>{
 const seats=chairs.filter(c=>c.tableId==='meja-1');const events:any[]=[];const game=createLukis((ws:any,m:any)=>events.push({ws,...structuredClone(m)}));const a={id:'a',name:'A',chairId:seats[0].id,ws:'a'},b={id:'b',name:'B',chairId:seats[1].id,ws:'b'};const ps=new Map([['a',a],['b',b]]);
 game.handle(ps,a,{type:'lukis-start'});const answer=events.find(e=>e.ws==='a').game.word;expect(events.find(e=>e.ws==='b').game.word).not.toBe(answer);
 const line=[0,0,1,1,'#20382e',7];events.length=0;game.handle(ps,b,{type:'lukis-line',line});expect(events).toHaveLength(0);game.handle(ps,a,{type:'lukis-line',line});expect(events.filter(e=>e.type==='lukis-line')).toHaveLength(2);
 game.handle(ps,b,{type:'lukis-guess',text:answer});const state=events.filter(e=>e.type==='lukis-state').at(-1).game;expect(state.phase).toBe('reveal');expect(state.scores.find((s:any)=>s.id==='b').score).toBeGreaterThanOrEqual(100);events.length=0;game.handle(ps,b,{type:'lukis-guess',text:answer});expect(events).toHaveLength(0);
 ps.delete('a');game.tick(ps);expect(events.at(-1).game).toBeNull();
});
test('Lukis canvas supports drawing and safe player names',async({page})=>{await page.goto('/');await page.evaluate(async()=>{const {setupLukis}=await import('/src/lukis.ts');const ui=setupLukis(m=>{(window as any).sent=m;return true;});document.body.replaceChildren(ui.root);ui.state({phase:'drawing',drawer:'a',round:1,total:2,ends:Date.now()+60000,word:'kucing',scores:[{name:'<img src=x>',score:0}],lines:[],solved:[]},'a');});await expect(page.getByText('Draw: kucing')).toBeVisible();expect(await page.locator('img').count()).toBe(0);const r=await page.locator('canvas').boundingBox();await page.mouse.move(r!.x+20,r!.y+20);await page.mouse.down();await page.mouse.move(r!.x+100,r!.y+80,{steps:6});await page.mouse.up();expect(await page.evaluate(()=>(window as any).sent.type)).toBe('lukis-ink');});
test('time scoring, hints and undo are authoritative',()=>{
 let time=10000;const events:any[]=[];const seats=chairs.filter(c=>c.tableId==='meja-1');const a={id:'a',name:'A',chairId:seats[0].id,ws:'a'},b={id:'b',name:'B',chairId:seats[1].id,ws:'b'};const ps=new Map([['a',a],['b',b]]);const game=createLukis((ws:any,m:any)=>events.push({ws,...structuredClone(m)}),()=>time);
 game.handle(ps,a,{type:'lukis-start'});const answer=events.find(e=>e.ws==='a').game.word;
 game.handle(ps,a,{type:'lukis-line',line:[0,0,.5,.5,'#20382e',7,1]});time+=30;game.handle(ps,a,{type:'lukis-line',line:[.5,.5,1,1,'#ffffff',24,2]});
 game.handle(ps,b,{type:'lukis-undo'});game.handle(ps,a,{type:'lukis-open'});expect(events.at(-1).game.lines).toHaveLength(2);
 game.handle(ps,a,{type:'lukis-undo'});expect(events.at(-1).game.lines).toHaveLength(1);
 time+=21000;game.tick(ps);expect(events.filter(e=>e.ws==='b'&&e.type==='lukis-state').at(-1).game.word).not.toBe(answer);
 game.handle(ps,b,{type:'lukis-guess',text:answer});expect(events.some(e=>e.type==='lukis-correct')).toBeTruthy();expect(events.at(-1).game.scores.find((s:any)=>s.id==='a').score).toBeGreaterThan(100);
 expect(scoreGuess(60,1)).toBe(500);expect(scoreGuess(10,2)).toBe(215);expect(scoreGuess(0,1)).toBe(200);
});
test('seating opens game cards and one selected game on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.evaluate(async()=>{const{setupTableSocial}=await import('/src/table-social.ts');const ui=(window as any).ui=setupTableSocial(()=>true,'test',()=>{},()=>{});ui.state([{id:'meja-1',name:'Meja 1',capacity:4,occupants:[{id:'a',name:'A',chairId:'chair-1'}]}],'a',true);ui.open('meja-1');});
 const dialog=page.locator('#table-social[open]');await expect(dialog).toBeVisible();await expect(dialog.locator('.table-game-grid')).toBeVisible();await expect(dialog.locator('.lukis')).toBeHidden();await dialog.locator('[data-select="lukis"]').click();await page.evaluate(g=>(window as any).ui?.lobby({key:'meja-1',game:g,scope:g==='werewolf'?'city':'table',phase:'playing',ends:0,serverTime:0,min:2,max:9,members:[{id:'self',name:'You',ready:true},{id:'p2',name:'Kawan',ready:true}]}),'lukis');await expect(dialog.locator('.lukis')).toBeVisible();await expect(dialog.locator('.poker')).toBeHidden();await dialog.getByText('← All games').click();await dialog.locator('[data-select="poker"]').click();await page.evaluate(g=>(window as any).ui?.lobby({key:'meja-1',game:g,scope:g==='werewolf'?'city':'table',phase:'playing',ends:0,serverTime:0,min:2,max:9,members:[{id:'self',name:'You',ready:true},{id:'p2',name:'Kawan',ready:true}]}),'poker');await expect(dialog.locator('.poker')).toBeVisible();await expect(dialog.locator('.lukis')).toBeHidden();const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
});

test('Start game stays disabled until a second player sits down',async({page})=>{
 await page.goto('/');await page.waitForTimeout(300);
 const table=(...occupants:{id:string;name:string;chairId:string}[])=>[{id:'meja-1',name:'Meja 1',capacity:4,occupants}];
 await page.evaluate(async seats=>{
  document.querySelectorAll('#table-social').forEach(e=>e.remove());
  const{setupTableSocial}=await import('/src/table-social.ts');
  const ui=(window as any).ui=setupTableSocial(()=>true,'test',()=>{},()=>{});(window as any).ui=ui;
  ui.state(seats,'a',true);ui.open('meja-1');
 },table({id:'a',name:'A',chairId:'chair-0'}));
 const d=page.locator('#table-social[open]');
 await d.locator('[data-select="lukis"]').click();await page.evaluate(g=>(window as any).ui?.lobby({key:'meja-1',game:g,scope:g==='werewolf'?'city':'table',phase:'playing',ends:0,serverTime:0,min:2,max:9,members:[{id:'self',name:'You',ready:true},{id:'p2',name:'Kawan',ready:true}]}),'lukis');
 await expect(d.locator('.lukis-start')).toBeDisabled();
 await expect(d.locator('.lukis-need')).toContainText('1/2');
 await page.evaluate(seats=>(window as any).ui.state(seats,'a',true),table({id:'a',name:'A',chairId:'chair-0'},{id:'b',name:'B',chairId:'chair-1'}));
 await expect(d.locator('.lukis-start')).toBeEnabled();
 await expect(d.locator('.lukis-need')).toHaveText('');
});
