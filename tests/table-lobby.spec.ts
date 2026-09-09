import {test,expect} from '@playwright/test';
import {createTableLobby,LOBBY_RULES,COUNTDOWN} from '../server/table-lobby.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};

const seatsAt=(tableId:string)=>chairs.filter(c=>c.tableId===tableId).map(c=>c.id);

const rig=()=>{
 let clock=1_000_000;
 const sent:any[]=[], started:any[]=[];
 const make=(game:string)=>({handle:(_p:any,player:any,m:any)=>{started.push({game,by:player.id,type:m.type});return true;}});
 const games={lukis:make('lukis'),poker:make('poker'),uno:make('uno'),werewolf:make('werewolf')};
 const lobby=createTableLobby((ws:any,m:any)=>sent.push({ws,...m}),games,()=>clock);
 const players=new Map<string,any>();
 const seat=(id:string,chairId:string)=>{const p={id,name:id.toUpperCase(),ws:id,chairId};players.set(id,p);return p;};
 const state=(ws:string)=>[...sent].reverse().find(m=>m.ws===ws&&m.type==='lobby-state')?.lobby;
 const tick=(ms:number)=>{clock+=ms;lobby.tick(players);};
 return {lobby,players,seat,sent,started,state,tick};
};

test('a game starts only when everyone who joined has tapped sedia',()=>{
 const [a,b]=seatsAt('meja-1');
 const {lobby,players,seat,state,started,tick}=rig();
 const ali=seat('ali',a), mei=seat('mei',b);

 lobby.handle(players,ali,{type:'lobby-join',game:'lukis'});
 lobby.handle(players,mei,{type:'lobby-join',game:'lukis'});
 expect(state('ali').members).toHaveLength(2);
 expect(state('ali').phase).toBe('lobby');

 lobby.handle(players,ali,{type:'lobby-ready',ready:true});
 expect(state('mei').phase).toBe('lobby');
 expect(state('mei').members.find((m:any)=>m.id==='ali').ready).toBe(true);

 lobby.handle(players,mei,{type:'lobby-ready',ready:true});
 expect(state('ali').phase).toBe('countdown');
 expect(started).toHaveLength(0);

 tick(COUNTDOWN+50);
 expect(started).toEqual([{game:'lukis',by:'ali',type:'lukis-start'}]);
 expect(state('ali').phase).toBe('playing');
});

test('one person alone can never start, however ready they are',()=>{
 const [a]=seatsAt('meja-1');
 const {lobby,players,seat,state,started,tick}=rig();
 const ali=seat('ali',a);
 lobby.handle(players,ali,{type:'lobby-join',game:'poker'});
 lobby.handle(players,ali,{type:'lobby-ready',ready:true});
 expect(state('ali').phase).toBe('lobby');
 tick(COUNTDOWN+50);
 expect(started).toHaveLength(0);
});

test('taking sedia back stops the countdown before it fires',()=>{
 const [a,b]=seatsAt('meja-1');
 const {lobby,players,seat,state,started,tick}=rig();
 const ali=seat('ali',a), mei=seat('mei',b);
 for(const p of [ali,mei]){lobby.handle(players,p,{type:'lobby-join',game:'uno'});lobby.handle(players,p,{type:'lobby-ready',ready:true});}
 expect(state('ali').phase).toBe('countdown');

 lobby.handle(players,mei,{type:'lobby-ready',ready:false});
 expect(state('ali').phase).toBe('lobby');
 tick(COUNTDOWN+50);
 expect(started).toHaveLength(0);
});

test('each table runs its own lobby, and werewolf runs one for the whole city',()=>{
 const [a]=seatsAt('meja-1'), [b]=seatsAt('meja-2');
 const {lobby,players,seat,state}=rig();
 const ali=seat('ali',a), mei=seat('mei',b);

 lobby.handle(players,ali,{type:'lobby-join',game:'lukis'});
 lobby.handle(players,mei,{type:'lobby-join',game:'lukis'});
 // Different tables, so they are not in the same game.
 expect(state('ali').members).toHaveLength(1);
 expect(state('mei').members).toHaveLength(1);

 lobby.handle(players,ali,{type:'lobby-join',game:'werewolf'});
 lobby.handle(players,mei,{type:'lobby-join',game:'werewolf'});
 expect(state('ali').scope).toBe('city');
 expect(state('ali').members).toHaveLength(2);
 expect(state('ali').min).toBe(LOBBY_RULES.werewolf.min);
});

test('standing up, leaving or disconnecting takes you out of the lobby',()=>{
 const [a,b]=seatsAt('meja-1');
 const {lobby,players,seat,state,tick}=rig();
 const ali=seat('ali',a), mei=seat('mei',b);
 for(const p of [ali,mei]) lobby.handle(players,p,{type:'lobby-join',game:'lukis'});
 expect(state('ali').members).toHaveLength(2);

 lobby.handle(players,mei,{type:'lobby-leave'});
 expect(state('ali').members).toHaveLength(1);

 lobby.handle(players,mei,{type:'lobby-join',game:'lukis'});
 expect(state('ali').members).toHaveLength(2);
 // Standing up leaves the chair, and the seat ring has to notice on the next tick.
 mei.chairId=null;
 tick(100);
 expect(state('ali').members).toHaveLength(1);

 lobby.remove(players,ali);
 expect(state('ali')?.members ?? []).toHaveLength(0);
});

test('a reaction reaches the table and nobody else',()=>{
 const [a,b]=seatsAt('meja-1'), [c]=seatsAt('meja-2');
 const {lobby,players,seat,sent}=rig();
 const ali=seat('ali',a), mei=seat('mei',b), sara=seat('sara',c);
 for(const p of [ali,mei,sara]) lobby.handle(players,p,{type:'lobby-join',game:'lukis'});

 lobby.handle(players,ali,{type:'lobby-react',emoji:'🔥'});
 const reacts=sent.filter(m=>m.type==='lobby-react');
 expect(reacts.map(r=>r.ws).sort()).toEqual(['ali','mei']);
 expect(reacts[0].emoji).toBe('🔥');
 expect(reacts[0].name).toBe('ALI');

 // Anything that is not one of the offered reactions is dropped.
 lobby.handle(players,ali,{type:'lobby-react',emoji:'<script>'});
 expect(sent.filter(m=>m.type==='lobby-react')).toHaveLength(2);
});

test('a finished game can be run back without leaving the table',()=>{
 const [a,b]=seatsAt('meja-1');
 const {lobby,players,seat,state,started,tick}=rig();
 const ali=seat('ali',a), mei=seat('mei',b);
 for(const p of [ali,mei]){lobby.handle(players,p,{type:'lobby-join',game:'lukis'});lobby.handle(players,p,{type:'lobby-ready',ready:true});}
 tick(COUNTDOWN+50);
 expect(state('ali').phase).toBe('playing');

 lobby.handle(players,ali,{type:'lobby-rematch'});
 // Everyone is back in the lobby, nobody is pre-readied, and the game has not restarted.
 expect(state('ali').phase).toBe('lobby');
 expect(state('ali').members.every((m:any)=>!m.ready)).toBe(true);
 expect(started).toHaveLength(1);
});

test('an idle lobby stops talking instead of pushing state twenty times a second',()=>{
 const [a,b]=seatsAt('meja-1');
 const {lobby,players,seat,sent,tick}=rig();
 const ali=seat('ali',a), mei=seat('mei',b);
 for(const p of [ali,mei]) lobby.handle(players,p,{type:'lobby-join',game:'lukis'});
 const settled=sent.filter(m=>m.type==='lobby-state').length;

 // A second of the real 50ms tick with nothing happening.
 for(let i=0;i<20;i++) tick(50);
 expect(sent.filter(m=>m.type==='lobby-state').length).toBe(settled);

 // A change still gets through immediately.
 lobby.handle(players,ali,{type:'lobby-ready',ready:true});
 expect(sent.filter(m=>m.type==='lobby-state').length).toBeGreaterThan(settled);
});
