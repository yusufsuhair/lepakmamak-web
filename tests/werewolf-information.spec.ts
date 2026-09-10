import {test,expect} from '@playwright/test';
import {createWerewolf,WEREWOLF_TIMES,WEREWOLF_SIZES} from '../server/werewolf.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};

// Same shape as werewolf.spec.ts, but the size is set before the joins rather than mid-way,
// so the fixture stops encoding a workaround for the lobby's ordering.
function fixture(size=7){
 let time=100000;const events:any[]=[];
 const seats=chairs.filter(c=>c.games!==false&&!!c.tableId);
 const ps=new Map<string,any>(Array.from({length:size},(_,i)=>[String(i),{id:String(i),userId:`user-${i}`,name:`Player ${i}`,chairId:seats[i].id,ws:String(i)}]));
 const engine=createWerewolf((ws:any,m:any)=>events.push({ws,...structuredClone(m)}),()=>time,(n:number)=>n-1);
 const p=(i:number)=>ps.get(String(i));
 const state=(i:number)=>events.filter(e=>e.ws===String(i)&&e.type==='werewolf-state').at(-1).game;
 const send=(i:number,m:any)=>engine.handle(ps,p(i),m);
 send(0,{type:'werewolf-join'});
 if(size!==7)send(0,{type:'werewolf-size',size});
 for(let i=1;i<size;i++)send(i,{type:'werewolf-join'});
 send(0,{type:'werewolf-start'});
 return{ps,events,engine,p,state,send,
  act(i:number,target:string){const s=state(i);send(i,{type:'werewolf-action',gameId:s.id,revision:s.revision,target});},
  step(ms:number){time+=ms;engine.tick(ps);}};
}

test('the lobby publishes every size it can actually deal, so the panel cannot drift',()=>{
 let time=100000;const events:any[]=[];
 const seats=chairs.filter(c=>c.games!==false&&!!c.tableId);
 const ps=new Map<string,any>([['0',{id:'0',userId:'user-0',name:'Host',chairId:seats[0].id,ws:'0'}]]);
 const engine=createWerewolf((ws:any,m:any)=>events.push({ws,...structuredClone(m)}),()=>time,(n:number)=>n-1);
 engine.handle(ps,ps.get('0'),{type:'werewolf-join'});
 const lobby=events.filter(e=>e.type==='werewolf-state').at(-1).game;
 expect(lobby.phase).toBe('lobby');
 // The panel builds its size buttons from this, rather than from a hand-written list that
 // drifted away from WEREWOLF_SIZES and hid 5, 6 and 8 from every host.
 expect(lobby.sizes).toEqual(WEREWOLF_SIZES);
});

test('a village of five deals, plays and is reachable without a size workaround',()=>{
 for(const size of WEREWOLF_SIZES){
  const f=fixture(size);
  expect(f.state(0).phase).toBe('night');
  expect(f.state(0).players).toHaveLength(size);
 }
});

test('the vote shows how it is landing, by headcount, without naming the Mayor',()=>{
 const f=fixture();f.step(WEREWOLF_TIMES.night);f.step(WEREWOLF_TIMES.discussion);
 expect(f.state(4).phase).toBe('vote');
 expect(f.state(4).tally).toEqual({});
 f.act(4,'user-0');f.act(5,'user-0');f.act(6,'user-1');
 // Raw headcount, not the Mayor-weighted total advance() uses: a weighted tally would
 // reveal who the Mayor is the moment they voted.
 expect(f.state(4).tally).toEqual({'user-0':2,'user-1':1});
 expect(f.state(0).tally).toEqual({'user-0':2,'user-1':1});
 // A skip is a real position and is counted as one.
 f.act(1,'skip');
 expect(f.state(4).tally.skip).toBe(1);
});

test('the judgment shows the count, and the tally never survives into the verdict',()=>{
 const f=fixture();f.step(WEREWOLF_TIMES.night);f.step(WEREWOLF_TIMES.discussion);
 f.act(4,'user-0');f.act(5,'user-0');f.act(6,'user-0');
 f.step(WEREWOLF_TIMES.vote);f.step(WEREWOLF_TIMES.defense);
 expect(f.state(4).phase).toBe('judgment');
 f.act(4,'kill');f.act(5,'spare');
 expect(f.state(4).tally).toEqual({kill:1,spare:1});
 f.step(WEREWOLF_TIMES.judgment);
 // Roles, not blame — the end screen carries no accusation record.
 f.send(4,{type:'werewolf-leave'});f.send(5,{type:'werewolf-leave'});f.send(6,{type:'werewolf-leave'});
 expect(f.state(0).phase).toBe('finished');
 expect(f.state(0).tally).toBeNull();
});

test('the Seer keeps every night, not just the most recent one',()=>{
 const f=fixture();
 const seer=[0,1,2,3,4,5,6].find(i=>f.state(i).role==='seer')!;
 f.act(seer,'user-4');f.step(WEREWOLF_TIMES.night);
 expect(f.state(seer).inspections).toHaveLength(1);
 f.step(WEREWOLF_TIMES.discussion);f.step(WEREWOLF_TIMES.vote);
 f.act(seer,'user-5');f.step(WEREWOLF_TIMES.night);
 const book=f.state(seer).inspections;
 expect(book).toHaveLength(2);
 expect(book.map((r:any)=>r.name)).toEqual(['Player 4','Player 5']);
 expect(book[0].day).toBe(1);expect(book[1].day).toBe(2);
 // The latest reading stays where it always was, so nothing already reading it breaks.
 expect(f.state(seer).inspection).toEqual(book[1]);
 // And it is still the Seer's alone.
 const villager=[0,1,2,3,4,5,6].find(i=>f.state(i).role==='villager')!;
 expect(f.state(villager).inspections).toEqual([]);
});
