import {test,expect} from '@playwright/test';
import {createLukis} from '../server/lukis.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};

const CASES=10_001;
const seats=chairs.filter(chair=>chair.tableId==='meja-9');

function randomFor(seed:number){
 let value=seed>>>0;
 return (limit:number)=>{
  value=(Math.imul(value,1664525)+1013904223)>>>0;
  return limit?value%limit:0;
 };
}

function runScenario(seed:number){
 const random=randomFor(seed),count=2+(seed%4),events:any[]=[];
 let clock=1_000_000;
 const players=new Map<string,any>();
 for(let i=0;i<count;i++)players.set(`socket-${i}`,{id:`socket-${i}`,userId:`account-${i}`,name:`Player ${i}`,chairId:seats[i].id,ws:`socket-${i}`});
 const engine=createLukis((ws:string,message:any)=>events.push({ws,...structuredClone(message)}),()=>clock,random);
 const player=(index:number)=>[...players.values()].find(p=>p.userId===`account-${index}`);
 const state=(ws:string)=>events.filter(event=>event.ws===ws&&event.type==='lukis-state').at(-1)?.game;
 const current=(index=0)=>state(player(index).ws);
 const send=(index:number,message:any)=>engine.handle(players,player(index),message);
 const act=(index:number,type:string,extra:any={})=>{const game=current(index);send(index,{type,gameId:game?.id,round:game?.round,boardVersion:game?.boardVersion,...extra});};
 const refresh=(index=0)=>send(index,{type:'lukis-open'});
 const step=(ms:number)=>{clock+=ms;engine.tick(players);};
 const fail=(code:string,detail='')=>{throw new Error(`${code}${detail?`: ${detail}`:''}`);};
 const roster=Array.from({length:count},(_,i)=>`account-${i}`).sort();
 const check=()=>{
  for(const p of players.values()){
   const game=state(p.ws);if(!game)continue;
   const ids=game.scores.map((score:any)=>score.id);
   if(new Set(ids).size!==ids.length)fail('duplicate-score-identity');
   if(ids.slice().sort().join()!==roster.join())fail('roster-mutated',ids.join(','));
   if(!['choosing','drawing','reveal','finished'].includes(game.phase))fail('invalid-phase',game.phase);
   if(!roster.includes(game.drawer))fail('drawer-outside-roster',game.drawer);
   if(game.round<1||game.round>game.total)fail('round-out-of-range',`${game.round}/${game.total}`);
   if(game.scores.some((score:any)=>!Number.isFinite(score.score)||score.score<0))fail('invalid-score');
   if(new Set(game.solved).size!==game.solved.length)fail('duplicate-solver');
   if(game.phase==='choosing'){
    const isDrawer=game.self===game.drawer;
    if((game.choices.length===3)!==isDrawer)fail('private-choice-leak');
    if(game.word!=='')fail('word-leaked-during-choice');
   }
  }
 };

 send(0,{type:'lukis-start',version:2,rounds:1});
 check();
 const opening=current(),gameId=opening.id,drawer=roster.indexOf(opening.drawer);
 // Each block of four seeds runs one behaviour with 2, 3, 4 and 5 players.
 const family=Math.floor((seed-1)/4)%12;

 if(family===0){
  send(random(count),{type:'lukis-start',version:2,rounds:1});
  if(current().id!==gameId)fail('active-rematch-replaced-game');
 }else if(family===1){
  const departed=count-1,old=player(departed);players.delete(old.id);
  const late={id:`late-${seed}`,userId:`late-account-${seed}`,name:'Late player',chairId:old.chairId,ws:`late-${seed}`};players.set(late.id,late);
  if(engine.canJoin(players,late)!==false)fail('late-player-can-join');
  engine.handle(players,late,{type:'lukis-open'});
  if(state(late.ws)!==null)fail('late-player-received-game');
  if(!events.some(e=>e.ws===late.ws&&e.type==='notice'))fail('late-player-missing-notice');
 }else if(family===2){
  const index=random(count),old=player(index);players.delete(old.id);
  const replacement={...old,id:`reconnected-${seed}`,ws:`reconnected-${seed}`};players.set(replacement.id,replacement);
  if(engine.canJoin(players,replacement)!==true)fail('original-player-cannot-rejoin');
  engine.handle(players,replacement,{type:'lukis-open'});
  if(state(replacement.ws)?.id!==gameId)fail('reconnect-lost-game');
 }else if(family===3){
  const attacker=(drawer+1)%count;
  act(attacker,'lukis-choose',{choice:random(3)});
  if(current().phase!=='choosing')fail('non-drawer-chose-word');
  act(drawer,'lukis-choose',{choice:random(3)});
  const before=current().lines.length;
  act(attacker,'lukis-ink',{seq:1,lines:[[.1,.1,.2,.2,'#20382e',7,1]]});
  act(attacker,'lukis-clear');refresh();
  if(current().lines.length!==before)fail('non-drawer-edited-board');
 }else if(family===4){
  act(drawer,'lukis-choose',{choice:random(3)});
  const before=current().lines.length;
  send(drawer,{type:'lukis-ink',gameId:'stale-game',round:opening.round,boardVersion:0,seq:1,lines:[[.1,.1,.2,.2,'#20382e',7,1]]});
  refresh();
  if(current().lines.length!==before)fail('stale-epoch-edited-board');
 }else if(family===5){
  act(drawer,'lukis-choose',{choice:random(3)});const answer=current(drawer).word;
  const guessers=Array.from({length:count},(_,i)=>i).filter(i=>i!==drawer);
  for(let i=guessers.length-1;i>0;i--){const j=random(i+1);[guessers[i],guessers[j]]=[guessers[j],guessers[i]];}
  for(const index of guessers)act(index,'lukis-guess',{text:answer});
  const solved=current().solved.slice().sort();
  if(solved.join()!==guessers.map(i=>`account-${i}`).sort().join())fail('simultaneous-correct-guess-lost',solved.join(','));
 }else if(family===6){
  act(drawer,'lukis-choose',{choice:random(3)});const answer=current(drawer).word,index=(drawer+1)%count;
  act(index,'lukis-guess',{text:answer});const score=current().scores.find((s:any)=>s.id===`account-${index}`).score;
  step(700);act(index,'lukis-guess',{text:answer});
  if(current().scores.find((s:any)=>s.id===`account-${index}`).score!==score)fail('duplicate-guess-double-scored');
 }else if(family===7){
  act(drawer,'lukis-choose',{choice:random(3)});
  for(let seq=1;seq<=3;seq++)act(drawer,'lukis-ink',{seq,lines:[[random(100)/100,random(100)/100,random(100)/100,random(100)/100,'#20382e',7,seq]]});
  refresh();
  if(current().lines.length!==3)fail('valid-ink-lost');
  act(drawer,'lukis-undo');if(current().lines.length!==2)fail('undo-failed');
  act(drawer,'lukis-redo');if(current().lines.length!==3)fail('redo-failed');
  act(drawer,'lukis-clear');if(current().lines.length!==0)fail('clear-failed');
  act(drawer,'lukis-undo');if(current().lines.length!==3)fail('undo-clear-failed');
 }else if(family===8){
  act(drawer,'lukis-choose',{choice:random(3)});const before=current().lines.length;
  const invalid=[[-.1,.1,.2,.2,'#20382e',7,1],[.1,.1,.2,.2,'#bad',7,1],[.1,.1,.2,.2,'#20382e',99,1]];
  act(drawer,'lukis-ink',{seq:1,lines:[invalid[random(invalid.length)]]});refresh();
  if(current().lines.length!==before)fail('malformed-ink-accepted');
 }else if(family===9||family===10){
  if(family===10)act(drawer,'lukis-choose',{choice:random(3)});
  const phase=current().phase,beforeRemaining=current().ends-clock;
  const absent=(drawer+1)%count;
  const removed=player(absent);for(const p of [...players.values()])if(p.userId!==opening.drawer)players.delete(p.id);
  engine.tick(players);const downtime=1+random(29_000);step(downtime);
  players.set(removed.id,removed);engine.tick(players);
  const resumed=state(removed.ws)??current(drawer);
  if(resumed.phase!==phase)fail('grace-period-advanced-phase',`${phase}->${resumed.phase}`);
  const afterRemaining=resumed.ends-clock;
  if(Math.abs(afterRemaining-beforeRemaining)>1)fail('grace-period-consumed-turn-time',`${beforeRemaining}->${afterRemaining} after ${downtime}ms`);
 }else{
  while(current().phase!=='finished'){
   const game=current();
   if(game.phase==='choosing')step(Math.max(1,game.ends-clock));
   else if(game.phase==='drawing')step(Math.max(1,game.ends-clock));
   else if(game.phase==='reveal')step(Math.max(1,game.ends-clock));
  }
  if(current().round!==count)fail('timeout-match-wrong-round-count',`${current().round}/${count}`);
 }
 check();
}

test('10,001 generated Lukis matches preserve multiplayer state for 2-5 players',()=>{
 test.setTimeout(120_000);
 const failures=new Map<string,{count:number,seeds:number[],examples:string[]}>();
 const distribution=[0,0,0,0,0,0];
 const requestedSeed=Number(process.env.LUKIS_FUZZ_SEED||0);
 const seeds=requestedSeed?[requestedSeed]:Array.from({length:CASES},(_,index)=>index+1);
 for(const seed of seeds){
  distribution[2+(seed%4)]++;
  try{runScenario(seed);}catch(error){
   const message=error instanceof Error?error.message:String(error),code=message.split(':')[0];
   const group=failures.get(code)??{count:0,seeds:[],examples:[]};group.count++;if(group.seeds.length<8)group.seeds.push(seed);if(group.examples.length<3)group.examples.push(message);failures.set(code,group);
  }
 }
 console.log(`Lukis generated cases: ${seeds.length}; players 2=${distribution[2]}, 3=${distribution[3]}, 4=${distribution[4]}, 5=${distribution[5]}`);
 console.log(`Lukis failure groups: ${JSON.stringify(Object.fromEntries(failures),null,2)}`);
 expect([...failures.entries()],`Re-run one case with LUKIS_FUZZ_SEED=<seed>. First seeds per failure are printed above.`).toEqual([]);
});
