import {test,expect} from '@playwright/test';
import {createUno,unoPoints} from '../server/uno.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};

function fixture(seed=123,count=3){
 let t=100000,random=seed;const events:any[]=[];
 const seats=chairs.filter(c=>c.tableId==='meja-1');
 const ps=new Map<string,any>(Array.from({length:count},(_,i)=>[String(i),{id:String(i),userId:`u${i}`,name:`P${i}`,chairId:seats[i%seats.length].id,ws:String(i)}]));
 const engine=createUno((ws:any,m:any)=>events.push({ws,...structuredClone(m)}),()=>t,(n:number)=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random%n;});
 const state=(i=0)=>events.filter(e=>e.ws===String(i)).at(-1)?.game;
 const send=(i:number,m:any)=>engine.handle(ps,ps.get(String(i)),m);
 const act=(i:number,type:string,extra:any={})=>{const g=state(i);send(i,{type,gameId:g.id,revision:g.revision,...extra});};
 for(let i=0;i<count;i++)send(i,{type:'uno-join'});
 send(0,{type:'uno-start'});
 const step=(ms:number)=>{t+=ms;engine.tick(ps);};step(3200);
 return {ps,engine,events,state,send,act,step,count};
}
function playStep(f:ReturnType<typeof fixture>,call=true){
 const g=f.state();if(!g.turn)return;
 const i=Number(g.turn.slice(1)),s=f.state(i);
 const card=s.hand.find((c:any)=>s.playable.includes(c.id)&&c.color!=='wild')||s.hand.find((c:any)=>s.playable.includes(c.id));
 if(card)f.act(i,'uno-play',{cardId:card.id,color:'red',uno:call});else f.act(i,s.drawn?'uno-pass':'uno-draw');
}

test('the match target follows the headcount instead of asking two people for eighteen rounds',()=>{
 // 500 is the official target for a full table. Two players reach it in ~18 rounds, which
 // is over an hour, and nobody comes back tomorrow to a match they abandoned unfinished.
 expect(fixture(1,2).state().target).toBe(200);
 expect(fixture(1,3).state().target).toBe(300);
 expect(fixture(1,4).state().target).toBe(500);
});

test('a match ends when someone passes the target for that headcount',()=>{
 const f=fixture(26,2);
 let rounds=0;
 while(f.state().phase!=='finished'&&rounds<40){
  for(let i=0;i<900&&f.state().phase==='playing';i++)playStep(f,false);
  if(f.state().phase==='round-over'){rounds++;f.send(0,{type:'uno-start'});f.step(3200);}
  else break;
 }
 const g=f.state();
 expect(g.phase).toBe('finished');
 expect(Math.max(...g.players.map((p:any)=>p.score))).toBeGreaterThanOrEqual(200);
 expect(rounds).toBeLessThan(18);
});

test('the round ends with every hand face up and the points that made the score',()=>{
 const f=fixture(26,3);
 for(let i=0;i<900&&f.state().phase==='playing';i++){
  // No hand leaks while the round is live.
  expect(f.state().breakdown).toBeNull();
  playStep(f,false);
 }
 const g=f.state();
 expect(g.phase).toBe('round-over');
 expect(g.winner).toBeTruthy();
 const losers=g.players.filter((p:any)=>p.id!==g.winner);
 expect(g.breakdown).toHaveLength(losers.length);
 for(const row of g.breakdown){
  expect(row.id).not.toBe(g.winner);
  const hand=f.state(Number(row.id.slice(1))).hand;
  expect(row.cards).toEqual(hand);
  expect(row.points).toBe(hand.reduce((n:number,c:any)=>n+unoPoints(c),0));
 }
 // The breakdown is exactly the arithmetic behind the number already shown.
 expect(g.breakdown.reduce((n:number,r:any)=>n+r.points,0)).toBe(g.roundPoints);
});
