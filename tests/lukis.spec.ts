import {test,expect} from '@playwright/test';
import {createLukis} from '../server/lukis.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};
test('Lukis hides answers, enforces drawer permissions and awards a correct guess once',()=>{
 const seats=chairs.filter(c=>c.tableId==='meja-1');const events:any[]=[];const game=createLukis((ws:any,m:any)=>events.push({ws,...structuredClone(m)}));const a={id:'a',name:'A',chairId:seats[0].id,ws:'a'},b={id:'b',name:'B',chairId:seats[1].id,ws:'b'};const ps=new Map([['a',a],['b',b]]);
 game.handle(ps,a,{type:'lukis-start'});const answer=events.find(e=>e.ws==='a').game.word;expect(events.find(e=>e.ws==='b').game.word).not.toBe(answer);
 const line=[0,0,1,1,'#20382e',7];events.length=0;game.handle(ps,b,{type:'lukis-line',line});expect(events).toHaveLength(0);game.handle(ps,a,{type:'lukis-line',line});expect(events.filter(e=>e.type==='lukis-line')).toHaveLength(2);
 game.handle(ps,b,{type:'lukis-guess',text:answer});const state=events.filter(e=>e.type==='lukis-state').at(-1).game;expect(state.phase).toBe('reveal');expect(state.scores.find((s:any)=>s.id==='b').score).toBeGreaterThanOrEqual(100);events.length=0;game.handle(ps,b,{type:'lukis-guess',text:answer});expect(events).toHaveLength(0);
 ps.delete('a');game.tick(ps);expect(events.at(-1).game).toBeNull();
});
test('Lukis canvas supports drawing and safe player names',async({page})=>{await page.goto('/');await page.evaluate(async()=>{const {setupLukis}=await import('/src/lukis.ts');const ui=setupLukis(m=>{(window as any).sent=m;return true;});document.body.replaceChildren(ui.root);ui.state({phase:'drawing',drawer:'a',round:1,total:2,ends:Date.now()+60000,word:'kucing',scores:[{name:'<img src=x>',score:0}],lines:[],solved:[]},'a');});await expect(page.getByText('Lukis: kucing')).toBeVisible();expect(await page.locator('img').count()).toBe(0);const r=await page.locator('canvas').boundingBox();await page.mouse.move(r!.x+20,r!.y+20);await page.mouse.down();await page.mouse.move(r!.x+100,r!.y+80,{steps:6});await page.mouse.up();expect(await page.evaluate(()=>(window as any).sent.type)).toBe('lukis-line');});
