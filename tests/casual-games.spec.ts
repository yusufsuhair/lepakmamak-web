import {test,expect} from '@playwright/test';
import {createCasualGames,fourWinner,sowCongkak,ludoMoves} from '../server/casual-games.mjs';
import {createTableLobby,COUNTDOWN} from '../server/table-lobby.mjs';
import catalog from '../shared/casual-games.json' with {type:'json'};
import chairs from '../shared/chairs.json' with {type:'json'};

function rig(kind:string,count=2,random=(_n:number)=>0) {
 let clock=100000;const out:any[]=[];
 const seats=chairs.filter(c=>c.tableId==='meja-1');
 const ps=new Map<string,any>(Array.from({length:count},(_,i)=>[String(i),{id:String(i),userId:`user-${i}`,name:`Player ${i}`,chairId:seats[i].id,ws:String(i)}]));
 const send=(ws:any,m:any)=>out.push({ws,...structuredClone(m)});
 const engine=createCasualGames(send,()=>clock,random),lobby=createTableLobby(send,engine.games,()=>clock);
 const state=(i=0)=>[...out].reverse().find(m=>m.ws===String(i)&&m.type==='casual-state')?.game;
 const shell=(i=0)=>[...out].reverse().find(m=>m.ws===String(i)&&m.type==='lobby-state')?.lobby;
 const tick=(ms:number)=>{clock+=ms;engine.tick(ps);lobby.tick(ps);};
 const start=()=>{for(const p of ps.values())lobby.handle(ps,p,{type:'lobby-join',game:kind});for(const p of ps.values())lobby.handle(ps,p,{type:'lobby-ready',ready:true});tick(COUNTDOWN+1);};
 const act=(i:number,extra:any)=>{const g=state(i);engine.handle(ps,ps.get(String(i)),{type:'casual-action',game:kind,gameId:g.id,revision:g.revision,round:g.round,...extra});};
 return {ps,engine,lobby,out,state,shell,tick,start,act};
}

test('five games use explicit Ready rosters and cannot be started by client actions',()=>{
 for(const kind of Object.keys(catalog)) {
  const f=rig(kind);const spectator={id:'spectator',name:'Spectator',chairId:'chair-2',ws:'spectator'};
  f.ps.set('spectator',spectator);
  f.engine.handle(f.ps,spectator,{type:'casual-action',game:kind,action:'start'});
  expect(f.state()).toBeUndefined();f.ps.delete('spectator');f.start();f.ps.set('spectator',spectator);
  expect(f.state().players).toHaveLength(2);expect(f.shell().phase).toBe('playing');
  f.lobby.handle(f.ps,spectator,{type:'lobby-join',game:kind});
  expect(f.engine.games[kind].canJoin(f.ps,spectator)).toBe(false);
  expect(f.out.filter(m=>m.ws==='spectator'&&m.type==='casual-state')).toHaveLength(0);
  const id=f.state().id;f.lobby.handle(f.ps,f.ps.get('0'),{type:'lobby-rematch'});expect(f.state().id).toBe(id);
 }
});

test('four-player games retain their roster and continue after a player leaves',()=>{
 for(const kind of ['ludo','bluff','quiz']){
  const f=rig(kind,4);f.start();expect(f.state().players).toHaveLength(4);
  if(kind==='bluff'){
   const hands=[0,1,2,3].map(i=>f.state(i).hand);
   expect(hands.map(h=>h.length)).toEqual([13,13,13,13]);expect(new Set(hands.flat()).size).toBe(52);
  }
  if(kind==='ludo'){f.act(0,{action:'roll'});expect(f.state().turn).toBe('user-1');}
  if(kind==='quiz'){for(let i=0;i<4;i++)f.act(i,{choice:i});expect(f.state().phase).toBe('reveal');}
  for(let i=0;i<3;i++){
   f.lobby.handle(f.ps,f.ps.get(String(i)),{type:'lobby-leave'});
   expect(f.state(3).players.filter((p:any)=>!p.left)).toHaveLength(3-i);
   expect(f.state(3).phase==='finished').toBe(i===2);
  }
  expect(f.state(3).winners).toEqual(['user-3']);
 }
 const f=rig('ludo',4);f.start();f.ps.delete('0');f.tick(1);f.tick(30000);
 expect(f.state(1).turn).toBe('user-1');expect(f.state(1).paused).toBe(false);
 expect(f.state(1).ends-f.state(1).serverTime).toBe(35000);
});

test('Empat Sebaris enforces gravity, turns, full columns, stale moves, wins and rematch',()=>{
 const f=rig('four');f.start();const initial=f.state();
 f.act(1,{column:0});expect(f.state().revision).toBe(0);
 for(const column of [-1,7,1.2,'1',null])f.act(0,{column});expect(f.state().revision).toBe(0);
 f.act(0,{column:0});expect(f.state().board[35]).toBe(0);
 f.engine.handle(f.ps,f.ps.get('1'),{type:'casual-action',game:'four',gameId:initial.id,revision:initial.revision,column:1});expect(f.state().board[36]).toBe(-1);
 for(const [i,column] of [[1,1],[0,0],[1,1],[0,0],[1,1],[0,0]])f.act(i,{column});
 expect(f.state().phase).toBe('finished');expect(f.state().winners).toEqual(['user-0']);
 f.lobby.handle(f.ps,f.ps.get('0'),{type:'lobby-rematch'});expect(f.shell().phase).toBe('lobby');
 for(const p of f.ps.values())f.lobby.handle(f.ps,p,{type:'lobby-ready',ready:true});f.tick(COUNTDOWN+1);
 expect(f.state().id).not.toBe(initial.id);expect(f.state().board.every((x:number)=>x===-1)).toBe(true);
 const b=rig('four');b.start();for(let i=0;i<6;i++)b.act(i%2,{column:0});const rev=b.state().revision;b.act(0,{column:0});expect(b.state().revision).toBe(rev);
 for(const positions of [[35,36,37,38],[14,21,28,35],[14,22,30,38],[17,23,29,35]]){const board=Array(42).fill(-1);positions.forEach(i=>board[i]=0);expect(fourWinner(board,positions.at(-1))).toBe(true);}
 const wrapped=Array(42).fill(-1);[5,6,7,8].forEach(i=>wrapped[i]=0);expect(fourWinner(wrapped,8)).toBe(false);
});

test('Congkak conserves 98 seeds through a complete game, covers relay, capture and extra turn',()=>{
 const home=Array(16).fill(0);home[6]=1;expect(sowCongkak(home,0,6)).toBe(true);expect(home[7]).toBe(1);
 const capture=Array(16).fill(0);capture[0]=1;capture[13]=5;expect(sowCongkak(capture,0,0)).toBe(false);expect(capture[7]).toBe(6);expect(capture[13]).toBe(0);
 const relay=Array(16).fill(0);relay[0]=1;relay[1]=1;expect(sowCongkak(relay,0,0)).toBe(false);expect(relay[1]).toBe(0);expect(relay[2]+relay[3]).toBe(2);
 const f=rig('congkak');f.start();f.act(0,{pit:8});expect(f.state().revision).toBe(0);
 let moves=0;
 while(f.state().phase!=='finished'&&moves++<400){const g=f.state(),i=g.players.findIndex((p:any)=>p.id===g.turn);const pits=Array.from({length:7},(_,n)=>n+i*8).filter(p=>g.pits[p]>0);f.act(i,{pit:pits[0]});expect(f.state().pits.reduce((a:number,b:number)=>a+b,0)).toBe(98);}
 expect(f.state().phase).toBe('finished');expect(f.state().pits[7]+f.state().pits[15]).toBe(98);
});

test('Ludo uses server dice, legal moves, captures and exact finishes for a complete match',()=>{
 let forced=6;const f=rig('ludo',2,n=>(forced-1)%n);f.start();
 expect(ludoMoves([-1,56,57,54],2)).toEqual([3]);expect(ludoMoves([-1,56,57,54],6)).toEqual([0]);
 f.act(0,{action:'move',piece:0});expect(f.state().tokens[0][0]).toBe(-1);
 f.act(0,{action:'roll',dice:99});expect(f.state().dice).toBe(6);f.act(0,{action:'move',piece:0});expect(f.state().tokens[0][0]).toBe(0);
 f.act(0,{action:'roll'});f.act(0,{action:'move',piece:0});forced=1;f.act(0,{action:'roll'});f.act(0,{action:'move',piece:0});
 // Opponent leaves base, traverses onto player 0 at square 7 (13 + 46 mod 52).
 forced=6;f.act(1,{action:'roll'});f.act(1,{action:'move',piece:0});
 for(let n=0;n<7;n++){f.act(1,{action:'roll'});f.act(1,{action:'move',piece:0});}
 forced=4;f.act(1,{action:'roll'});f.act(1,{action:'move',piece:0});expect(f.state().tokens[0][0]).toBe(-1);
 let moves=0;
 while(f.state().phase!=='finished'&&moves++<800){const g=f.state(),i=g.players.findIndex((p:any)=>p.id===g.turn);forced=g.tokens[i].some((s:number)=>s<0)?6:Math.min(6,57-g.tokens[i].find((s:number)=>s<57));f.act(i,{action:'roll'});const next=f.state(i);if(next.dice)f.act(i,{action:'move',piece:next.legal[0]});}
 expect(f.state().phase).toBe('finished');expect(f.state().winners).toHaveLength(1);
});

test('Bluff hides opponents cards, rejects card injection and resolves truthful/false challenges',()=>{
 for(const lie of [false,true]){
  const f=rig('bluff');f.start();const a=f.state(),b=f.state(1);
  expect(a.hand).toHaveLength(26);expect(b.hand).toHaveLength(26);expect(new Set([...a.hand,...b.hand]).size).toBe(52);
  expect(a.players.every((p:any)=>!('hand'in p))).toBe(true);
  f.act(0,{action:'play',cards:[b.hand[0]]});f.act(0,{action:'play',cards:[a.hand[0],a.hand[0]]});expect(f.state().revision).toBe(0);
  const card=a.hand.find((c:number)=>lie?c%13!==0:c%13===0);
  expect(card).toBeDefined();
  f.act(0,{action:'play',cards:[card]});expect(f.state().phase).toBe('challenge');expect(f.state(1).last).not.toHaveProperty('cards');
  f.act(0,{action:'challenge'});expect(f.state().phase).toBe('challenge');
  f.act(1,{action:'challenge'});expect(f.state().phase).toBe('playing');expect(f.state().pileCount).toBe(0);
  expect(f.state(lie?0:1).hand.length).toBe(lie?26:27);
 }
 const f=rig('bluff',2,()=>0);f.start();let rounds=0;
 while(f.state().phase!=='finished'&&rounds++<100){const g=f.state(),i=g.players.findIndex((p:any)=>p.id===g.turn);f.act(i,{action:'play',cards:f.state(i).hand.slice(0,4)});f.tick(6001);}
 expect(f.state().phase).toBe('finished');expect(f.state().winners).toHaveLength(1);
});

test('Quiz hides answers until reveal, accepts simultaneous answers and ends after ten questions',()=>{
 const f=rig('quiz',2,()=>0);f.start();const asked=new Set();
 for(let round=1;round<=10;round++){
  const g=f.state();expect(g.correct).toBeNull();expect(g).not.toHaveProperty('order');expect(g).not.toHaveProperty('answers');asked.add(g.question.text);
  f.act(0,{choice:round<=5?3:0});const answered=f.state();f.act(0,{choice:1});expect(f.state().revision).toBe(answered.revision);
  f.engine.handle(f.ps,f.ps.get('1'),{type:'casual-action',game:'quiz',gameId:g.id,revision:g.revision,round,choice:3});
  expect(f.state().phase).toBe('reveal');expect(f.state().correct).not.toBeNull();f.tick(3501);
 }
 expect(asked.size).toBe(10);expect(f.state().phase).toBe('finished');expect(f.state().winners).toEqual(['user-1']);expect(f.state().players.map((p:any)=>p.score)).toEqual([50,100]);
});

test('disconnect freezes the clock, account rejoins retain state, and timeouts/leave end games',()=>{
 const f=rig('four');f.start();f.act(0,{column:2});const g=f.state();
 const departed=f.ps.get('1');f.lobby.remove(f.ps,departed);f.ps.delete('1');f.tick(1000);expect(f.state().paused).toBe(true);
 f.tick(20000);f.ps.set('replacement',{...departed,id:'replacement'});f.tick(1);
 f.lobby.handle(f.ps,f.ps.get('replacement'),{type:'lobby-join',game:'four'});
 expect(f.state(1).id).toBe(g.id);expect(f.state(1).board).toEqual(g.board);expect(f.state().paused).toBe(false);expect(f.shell(1).phase).toBe('playing');
 const self=f.ps.get('0');f.lobby.handle(f.ps,self,{type:'lobby-leave'});expect(f.state(1).phase).toBe('finished');expect(f.state(1).winners).toEqual(['user-1']);
 for(const kind of ['four','congkak','ludo','bluff']){const t=rig(kind);t.start();t.tick(35001);expect(t.state(1).phase).toBe('finished');}
 const absent=rig('four');absent.start();absent.ps.delete('1');absent.tick(1);absent.tick(30001);expect(absent.state().phase).toBe('finished');
});

test('rooms, tables and game ids isolate actions; an old match cannot mutate a rematch',()=>{
 const f=rig('four');f.start();const g=f.state();
 const other=new Map([...f.ps].map(([id,p])=>[id,{...p}]));f.engine.games.four.start(other,other.get('0'),[...other.values()]);
 f.engine.handle(other,other.get('0'),{type:'casual-action',game:'four',gameId:g.id,revision:g.revision,column:0});
 expect(f.state().board.every((n:number)=>n===-1)).toBe(true);
 f.ps.get('0').chairId=chairs.find(c=>c.tableId==='meja-2')!.id;
 f.act(0,{column:0});expect(f.state(1).board.every((n:number)=>n===-1)).toBe(true);
});
