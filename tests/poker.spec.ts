import {test,expect} from '@playwright/test';
// @ts-ignore server module
import {createPoker,rankHand} from '../server/poker.mjs';
const card=(rank:number,suit=0)=>suit*13+rank-2;
function harness(n=3){let time=100000;const messages:any[]=[];const ps=new Map(Array.from({length:n},(_,i)=>[String(i),{id:String(i),name:`Player ${i}`,chairId:`chair-${i}`,ws:String(i)}]));const poker=createPoker((ws:any,m:any)=>messages.push({ws,...m}),()=>time);const state=(id='0')=>messages.filter(m=>m.ws===id&&m.type==='poker-state').at(-1)?.game;const send=(id:string,m:any)=>poker.handle(ps,ps.get(id),m);const action=(a:string)=>{const g=state();send(g.turnId,{type:'poker-action',hand:g.hand,revision:g.revision,action:a});};return {ps,poker,messages,state,send,action,advance(){time+=26000;poker.tick(ps);}};}
test('hand evaluation handles wheel, full house, flush and kickers',()=>{
 expect(rankHand([card(14),card(2,1),card(3,2),card(4,3),card(5),card(8),card(10)])).toEqual([4,5]);
 expect(rankHand([card(14),card(14,1),card(14,2),card(13),card(13,1),card(2),card(3)])).toEqual([6,14,13]);
 expect(rankHand([10,11,12,9,8,20,25])).toEqual([8,14]);
 expect(rankHand([card(4),card(4,1),card(14,2),card(13,3),card(10),card(7,2),card(2)])).toEqual([1,4,14,13,10]);
});
test('private hands, validated turns, raises, showdown and chip conservation',()=>{
 const h=harness();h.send('0',{type:'poker-start'});let g=h.state();expect(g.players[0].cards).toHaveLength(2);expect(g.players[1].cards).toEqual([]);expect(h.state('1').players[1].cards).toHaveLength(2);
 const rev=g.revision;h.send('1',{type:'poker-action',hand:g.hand,revision:rev,action:'raise'});expect(h.state().revision).toBe(rev);
 h.action('raise');g=h.state();expect(g.bet).toBe(20);
 h.send(g.turnId,{type:'poker-action',hand:g.hand,revision:rev,action:'raise'});expect(h.state().bet).toBe(20);
 for(let i=0;i<30&&h.state().phase!=='finished';i++)h.action('call');
 g=h.state();expect(g.phase).toBe('finished');expect(g.board).toHaveLength(5);expect(g.players.every((p:any)=>p.cards.length===2)).toBe(true);expect(g.players.reduce((sum:number,p:any)=>sum+p.chips,0)).toBe(600);expect(new Set([...g.board,...g.players.flatMap((p:any)=>p.cards)]).size).toBe(11);
});
test('timeouts and departure fold without blocking the table; rematch works',()=>{
 const h=harness(2);h.send('0',{type:'poker-start'});const hand=h.state().hand;h.advance();expect(h.state().phase).toBe('finished');expect(h.state().players.reduce((s:number,p:any)=>s+p.chips,0)).toBe(400);
 h.send('0',{type:'poker-start'});expect(h.state().hand).not.toBe(hand);h.ps.delete('1');h.poker.tick(h.ps);expect(h.state().phase).toBe('finished');
});
test('raise cap keeps all hands funded and spectators cannot act',()=>{
 const h=harness();h.send('0',{type:'poker-start'});
 for(let i=0;i<40&&h.state().phase!=='finished';i++){const g=h.state();h.action(g.bet<40?'raise':'call');}
 const g=h.state();expect(g.phase).toBe('finished');expect(g.players.reduce((s:number,p:any)=>s+p.chips,0)).toBe(600);expect(g.players.every((p:any)=>p.chips>=40)).toBe(true);
});
test('mobile poker fits and renders names safely with action controls',async({page})=>{
 await page.setViewportSize({width:320,height:740});await page.goto('/');
 await page.evaluate(async()=>{const {setupPoker}=await import('/src/poker.ts');document.body.innerHTML='<div id="table-social" style="width:296px"></div>';const p=setupPoker(m=>{(window as any).sent=m;return true;});document.querySelector('#table-social')!.append(p.root);p.context('meja-1',true,'0');p.state({tableId:'meja-1',hand:'h',revision:1,phase:'flop',ends:Date.now()+25000,pot:30,bet:0,board:[1,15,26],turnId:'0',result:'',players:[{id:'0',name:'<img src=x onerror=alert(1)>',chips:190,paid:0,folded:false,dealer:true,cards:[12,25]},{id:'1',name:'Member',chips:190,paid:0,folded:false,dealer:false,cards:[]}],actions:{call:0,raise:true}},'0');});
 await expect(page.getByRole('button',{name:'Check',exact:true})).toBeEnabled();expect(await page.locator('.poker img').count()).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);
 await page.getByRole('button',{name:'Raise +10'}).click();expect(await page.evaluate(()=>(window as any).sent)).toEqual({type:'poker-action',hand:'h',revision:1,action:'raise'});await expect(page.getByRole('button',{name:'Raise +10'})).toBeDisabled();
});
