import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {createUno} from '../server/uno.mjs';
import {createTableLobby,COUNTDOWN} from '../server/table-lobby.mjs';
import {createHouseBots,WAIT_MS} from '../server/house-bot.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};

const seatsAt=(tableId:string)=>chairs.filter(c=>c.tableId===tableId);

// The real engine and the real lobby on a clock the test owns. Every player, the bot
// included, only ever sees what arrives on its socket and only ever acts by sending messages.
const rig=()=>{
 let clock=1_000_000;const now=()=>clock;
 const send=(ws:any,m:any)=>{if(ws.readyState===1)ws.send(JSON.stringify(m));};
 const uno=createUno(send,now);
 const lobby=createTableLobby(send,{uno},now);
 const players=new Map<string,any>();
 let changes=0;
 const bots=createHouseBots({tableLobby:lobby,uno,now,changed:()=>{changes++;}});
 const human=(id:string,chair:any)=>{
  const heard:any[]=[];
  const player:any={id,name:id,userId:null,guest:false,chairId:chair.id,seated:true,x:chair.x,z:chair.z,ws:{readyState:1,bufferedAmount:0,send:(text:string)=>heard.push(JSON.parse(text)),close(){}}};
  players.set(id,player);
  return Object.assign(player,{last:(type:string)=>[...heard].reverse().find(m=>m.type===type)});
 };
 const advance=(ms:number,step=250)=>{for(let t=0;t<ms;t+=step){clock+=step;lobby.tick(players);uno.tick(players);bots.tick(players);}};
 const bot=()=>[...players.values()].find(p=>p.bot);
 return {lobby,uno,players,human,advance,bot,changes:()=>changes};
};

test('someone alone in an UNO lobby is joined by Ah Meng, who sits down and readies up',()=>{
 const {lobby,players,human,advance,bot,changes}=rig(),[a]=seatsAt('meja-1');
 const ali=human('ali',a);
 lobby.handle(players,ali,{type:'lobby-join',game:'uno'});
 // Long enough for a friend to walk over first. A bot that pounces is a bot nobody asked for.
 advance(WAIT_MS-500);expect(players.size).toBe(1);
 advance(1000);expect(players.size).toBe(2);
 const meng=bot();
 expect(meng).toMatchObject({name:'Ah Meng · AI',bot:true,seated:true,userId:null});
 const chair=seatsAt('meja-1').find(c=>c.id===meng.chairId)!;
 expect(chair.id).not.toBe(a.id);expect([meng.x,meng.z]).toEqual([chair.x,chair.z]);
 const state=ali.last('lobby-state').lobby;
 expect(state.members.map((m:any)=>[m.id,m.ready])).toEqual([['ali',false],[meng.id,true]]);
 expect(changes()).toBe(1);
});

test('Ah Meng plays a whole round by the same rules and messages as everybody else',()=>{
 const {lobby,uno,players,human,advance,bot}=rig(),[a]=seatsAt('meja-1');
 const ali=human('ali',a);
 lobby.handle(players,ali,{type:'lobby-join',game:'uno'});advance(WAIT_MS+500);
 lobby.handle(players,ali,{type:'lobby-ready',ready:true});advance(COUNTDOWN+500);
 const meng=bot();let botMoves=0,stuck=0,seen=0,revision=-1;
 for(let i=0;i<4000;i++){
  advance(250);
  const game=ali.last('uno-state')?.game;
  if(!game||['round-over','finished'].includes(game.phase))break;
  if(game.event&&game.event.id!==seen){seen=game.event.id;if(game.event.who===meng.id)botMoves++;}
  // He answers within a couple of seconds. With two players a Skip or Draw 2 hands the turn
  // straight back, so a long turn is fine; a turn where nothing changes is not. That would
  // mean he sent something the engine refused and is waiting out the 25 s clock.
  stuck=game.turn===meng.id&&game.revision===revision?stuck+250:0;revision=game.revision;expect(stuck).toBeLessThan(5000);
  if(game.phase!=='playing'||game.turn!=='ali')continue;
  const act=(m:any)=>uno.handle(players,ali,{gameId:game.id,revision:game.revision,...m});
  if(game.playable.length)act({type:'uno-play',cardId:game.playable[0],color:'red',uno:true});
  else if(!game.drawn)act({type:'uno-draw'});else act({type:'uno-pass'});
 }
 const end=ali.last('uno-state').game;
 expect(['round-over','finished']).toContain(end.phase);
 expect(botMoves).toBeGreaterThan(0);
});

test('two people do not get a bot, and neither does a table with no chair to spare',()=>{
 const {lobby,players,human,advance}=rig(),[a,b]=seatsAt('meja-1');
 const ali=human('ali',a),mei=human('mei',b);
 lobby.handle(players,ali,{type:'lobby-join',game:'uno'});lobby.handle(players,mei,{type:'lobby-join',game:'uno'});
 advance(WAIT_MS*2);expect(players.size).toBe(2);
 // Alone in the lobby, but the other three chairs are taken by people just sitting.
 const full=rig(),[w,x,y,z]=seatsAt('meja-2');
 const solo=full.human('solo',w);full.human('p',x);full.human('q',y);full.human('r',z);
 full.lobby.handle(full.players,solo,{type:'lobby-join',game:'uno'});
 full.advance(WAIT_MS*2);expect(full.players.size).toBe(4);expect(full.bot()).toBeUndefined();
});

test('Ah Meng gives the chair back as soon as nobody is left to play with',()=>{
 const {lobby,players,human,advance,bot,changes}=rig(),[a]=seatsAt('meja-1');
 const ali=human('ali',a);
 lobby.handle(players,ali,{type:'lobby-join',game:'uno'});advance(WAIT_MS+500);expect(bot()).toBeTruthy();
 lobby.handle(players,ali,{type:'lobby-leave'});advance(1000);
 expect(bot()).toBeUndefined();expect(players.size).toBe(1);expect(changes()).toBe(2);
 // And mid-match: the person disconnects, the bot does not sit at an empty table playing itself.
 lobby.handle(players,ali,{type:'lobby-join',game:'uno'});advance(WAIT_MS+500);
 lobby.handle(players,ali,{type:'lobby-ready',ready:true});advance(COUNTDOWN+3000);
 expect(['dealing','playing']).toContain(ali.last('uno-state').game.phase);
 lobby.remove(players,ali);players.delete('ali');advance(1000);
 expect(players.size).toBe(0);
});

// The same thing through the real server and a real socket, as a browser meets it.
test('the city sees Ah Meng arrive at the table of someone waiting alone',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8197',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 let ws:WebSocket|undefined;
 try{
  await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8197/health')).ok;}catch{return false;}}).toBe(true);
  const heard:any[]=[];ws=new WebSocket('ws://127.0.0.1:8197/ws');
  ws.on('message',raw=>{try{heard.push(JSON.parse(String(raw)));}catch{/* packed snapshots are not for this client */}});
  await new Promise<void>((resolve,reject)=>{ws!.on('error',reject);ws!.on('open',()=>{ws!.send(JSON.stringify({type:'join',room:'house-bot',guest:true,name:'Newbie'}));resolve();});});
  await expect.poll(()=>heard.some(m=>m.type==='welcome')).toBe(true);
  // A first visit arrives within reach of a chair at Meja 1, so sitting needs no walking.
  const me=heard.find(m=>m.type==='welcome'),chair=seatsAt('meja-1').find(c=>Math.hypot(c.x-me.players[0].x,c.z-me.players[0].z)<2.2)!;
  ws.send(JSON.stringify({type:'chair-sit',chairId:chair.id}));
  await expect.poll(()=>[...heard].reverse().find(m=>m.type==='players')?.players.find((p:any)=>p.id===me.id)?.seated).toBe(true);
  ws.send(JSON.stringify({type:'lobby-join',game:'uno'}));
  await expect.poll(()=>[...heard].reverse().find(m=>m.type==='players')?.players.find((p:any)=>p.bot),{timeout:WAIT_MS+6000}).toMatchObject({name:'Ah Meng · AI',seated:true,bot:true});
  const lobby=[...heard].reverse().find(m=>m.type==='lobby-state').lobby;
  expect(lobby.members).toHaveLength(2);expect(lobby.members[1].ready).toBe(true);
  // Nothing of his private state rides along in the room snapshot.
  const meng=[...heard].reverse().find(m=>m.type==='players').players.find((p:any)=>p.bot);
  expect(Object.keys(meng)).not.toContain('ws');expect(JSON.stringify(meng)).not.toContain('hand');
 }finally{ws?.close();server.kill();}
});
