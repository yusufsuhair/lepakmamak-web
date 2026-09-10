import {test,expect} from '@playwright/test';
import {createTableLobby,COUNTDOWN} from '../server/table-lobby.mjs';
import {createLukis} from '../server/lukis.mjs';
import {createUno} from '../server/uno.mjs';
import {createPoker} from '../server/poker.mjs';
import {createWerewolf} from '../server/werewolf.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};

function fixture(game:string){
 let time=100000;
 const events:any[]=[];
 const seats=chairs.filter(c=>c.tableId==='meja-9');
 const count=game==='werewolf'?5:2;
 const players=new Map<string,any>(Array.from({length:count},(_,i)=>[String(i),{id:String(i),name:`P${i}`,ws:String(i),chairId:seats[i].id}]));
 const send=(ws:any,m:any)=>events.push({ws,...structuredClone(m)});
 const factory={lukis:createLukis,uno:createUno,poker:createPoker,werewolf:createWerewolf}[game]!;
 const engine=factory(send,()=>time);
 const lobby=createTableLobby(send,{[game]:engine},()=>time);
 const state=(type='lobby-state')=>events.filter(e=>e.ws==='0'&&e.type===type).at(-1);
 const message=(id:string,m:any)=>lobby.handle(players,players.get(id),m);
 const ready=()=>{for(const id of players.keys())message(id,{type:'lobby-join',game});for(const id of players.keys())message(id,{type:'lobby-ready',ready:true});};
 const step=(ms:number)=>{time+=ms;lobby.tick(players);engine.tick(players);};
 return {players,engine,lobby,events,state,message,ready,step};
}

for(const game of ['lukis','uno','poker','werewolf']){
 test(`${game}: departure at countdown deadline cancels an undersized start`,()=>{
  const f=fixture(game);f.ready();expect(f.state().lobby.phase).toBe('countdown');
  // chair-stand clears the chair; lobby cleanup occurs on the following 50ms tick.
  f.players.get('1').chairId=null;f.step(COUNTDOWN);
  expect(f.state().lobby.phase,'A lobby below minimum must not advertise an active game').toBe('lobby');
  const g=f.state(`${game}-state`)?.game;
  expect(g==null||g.phase==='lobby').toBe(true);
 });
 test(`${game}: premature Main Lagi cannot reset an active table shell`,()=>{
  const f=fixture(game);f.ready();f.step(COUNTDOWN);f.step(3300);
  expect(f.state().lobby.phase).toBe('playing');
  f.message('1',{type:'lobby-rematch'});
  expect(f.state().lobby.phase,'A peer must not kick everyone back to SEDIA mid-game').toBe('playing');
 });
}

test('Lukis: rematch keeps an unjoined bystander out of the next roster',()=>{
 const f=fixture('lukis');f.ready();f.step(COUNTDOWN);
 for(let i=0;i<30&&f.state('lukis-state').game.phase!=='finished';i++)f.step(61000);
 expect(f.state('lukis-state').game.phase).toBe('finished');
 const chair=chairs.filter(c=>c.tableId==='meja-9')[2];
 f.players.set('bystander',{id:'bystander',name:'Bystander',ws:'bystander',chairId:chair.id});
 f.message('0',{type:'lobby-rematch'});
 expect(f.state('lukis-state').game.scores.map((p:any)=>p.id)).toEqual(['0','1']);
});
