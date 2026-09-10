import {randomInt, randomUUID} from 'node:crypto';
import {tableOf} from './seating.mjs';

const labels=['High card','One pair','Two pair','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush'];
const compare=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;};
function five(cards){
 const ranks=cards.map(c=>c%13+2).sort((a,b)=>b-a),counts=new Map();
 for(const r of ranks)counts.set(r,(counts.get(r)||0)+1);
 const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),flush=cards.every(c=>Math.floor(c/13)===Math.floor(cards[0]/13));
 const unique=[...new Set(ranks)];if(unique[0]===14)unique.push(1);
 let straight=0;for(let i=0;i<=unique.length-5;i++)if(unique[i]-unique[i+4]===4){straight=unique[i];break;}
 if(flush&&straight)return [8,straight];
 if(groups[0][1]===4)return [7,groups[0][0],groups[1][0]];
 if(groups[0][1]===3&&groups[1][1]===2)return [6,groups[0][0],groups[1][0]];
 if(flush)return [5,...ranks];if(straight)return [4,straight];
 if(groups[0][1]===3)return [3,...groups.map(g=>g[0])];
 if(groups[0][1]===2&&groups[1][1]===2)return [2,...groups.map(g=>g[0])];
 if(groups[0][1]===2)return [1,...groups.map(g=>g[0])];return [0,...ranks];
}
export function rankHand(cards){
 let best=[];for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){const rank=five([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(compare(rank,best)>0)best=rank;}return best;
}
// Casual fixed-limit Hold'em: 200 fresh free chips per hand, 5/10 blinds,
// four 10-chip increases per street. Maximum contribution is 160, so no side pots.
export function createPoker(send,now=Date.now){
 const rooms=new WeakMap(),subscriptions=new WeakMap();
 const members=(ps,id)=>[...ps.values()].filter(p=>tableOf(p)===id);
 const mapFor=ps=>{if(!rooms.has(ps))rooms.set(ps,new Map());return rooms.get(ps);};
 function view(g,p){const own=g.players.find(q=>q.id===p.id),turn=g.players[g.turn];return {tableId:g.tableId,hand:g.hand,revision:g.revision,phase:g.phase,ends:g.ends,pot:g.pot,bet:g.bet,board:g.board,turnId:turn?.id,result:g.result,
  players:g.players.map(q=>({id:q.id,name:q.name,chips:q.chips,paid:q.paid,folded:q.folded,dealer:q.id===g.dealer,cards:q.id===p.id||(g.phase==='finished'&&!q.folded)?q.cards:[]})),
  actions:g.phase!=='finished'&&turn?.id===p.id?{call:g.bet-own.paid,raise:g.bet<40}:null};}
 function publish(ps,g){g.revision++;for(const p of members(ps,g.tableId))send(p.ws,{type:'poker-state',game:view(g,p)});}
 function finish(g){
  const live=g.players.filter(p=>!p.folded);let winners=live;
  if(!live.length){g.phase='finished';g.turn=-1;g.ends=0;g.result='Pusingan tamat · semua pemain telah keluar';return;}
  if(live.length>1){const ranked=live.map(p=>({p,rank:rankHand([...p.cards,...g.board])})).sort((a,b)=>compare(b.rank,a.rank));winners=ranked.filter(x=>compare(x.rank,ranked[0].rank)===0).map(x=>x.p);g.result=labels[ranked[0].rank[0]];}else g.result='Semua lawan fold';
  const share=Math.floor(g.pot/winners.length),remainder=g.pot%winners.length;
  winners.forEach((p,i)=>p.chips+=share+(i<remainder?1:0));
  g.result=`${winners.map(p=>p.name).join(' & ')} menang ${g.pot} cip · ${g.result}`;g.phase='finished';g.turn=-1;g.ends=0;
 }
 function advance(g){
  if(g.players.filter(p=>!p.folded).length<=1){finish(g);return;}
  if(g.players.filter(p=>!p.folded).every(p=>p.acted&&p.paid===g.bet)){
   if(g.phase==='river'){finish(g);return;}
   g.deck.pop();const n=g.phase==='preflop'?3:1;for(let i=0;i<n;i++)g.board.push(g.deck.pop());
   g.phase={preflop:'flop',flop:'turn',turn:'river'}[g.phase];g.bet=0;g.players.forEach(p=>{p.paid=0;p.acted=false;});g.turn=g.players.findIndex(p=>p.id===g.dealer);
  }
  do{g.turn=(g.turn+1)%g.players.length;}while(g.players[g.turn].folded);g.ends=now()+25000;
 }
 function act(g,action){const p=g.players[g.turn];if(action==='fold')p.folded=true;else {if(action==='raise'){g.bet+=10;g.players.forEach(q=>q.acted=false);}const cost=g.bet-p.paid;p.chips-=cost;p.paid=g.bet;g.pot+=cost;}p.acted=true;advance(g);}
 function startGame(ps,p,roster){
  tick(ps);
  const id=tableOf(p);if(!id){send(p.ws,{type:'notice',message:'Duduk di meja bersama member untuk Poker Kampung.'});return true;}
  subscriptions.set(p,id);const map=mapFor(ps);let g=map.get(id);
  if(g&&g.phase!=='finished')return true;
  if(g&&now()-g.finishedStartedAt<3000)return true;
  const people=(roster||members(ps,id)).filter(q=>ps.get(q.id)===q&&tableOf(q)===id);
  if(people.length<2){send(p.ws,{type:'notice',message:'Poker perlukan 2 atau 3 orang duduk semeja.'});return true;}
  const deck=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
  const previous=g?.dealer,index=(people.findIndex(q=>q.id===previous)+1)%people.length;
  g={tableId:id,hand:randomUUID(),revision:0,phase:'preflop',board:[],deck,players:people.map(q=>({id:q.id,name:q.name,cards:[deck.pop(),deck.pop()],chips:200,paid:0,folded:false,acted:false})),dealer:people[index].id,bet:10,pot:15,turn:0,ends:now()+25000,result:'',finishedStartedAt:now()};
  const small=people.length===2?index:(index+1)%people.length,big=(small+1)%people.length;
  g.players[small].paid=5;g.players[small].chips-=5;g.players[big].paid=10;g.players[big].chips-=10;g.turn=(big+1)%people.length;
  map.set(id,g);for(const q of people)subscriptions.set(q,id);publish(ps,g);return true;
 }
 function tick(ps){
  const map=rooms.get(ps);if(!map)return;
  for(const [id,g] of map){const people=members(ps,id);if(!people.length){map.delete(id);continue;}if(g.phase==='finished')continue;
   let changed=false;for(const p of g.players)if(!p.folded&&!people.some(q=>q.id===p.id)){p.folded=true;changed=true;}
   if(changed){if(g.players.filter(p=>!p.folded).length<=1)finish(g);else if(g.players[g.turn].folded||g.players.filter(p=>!p.folded).every(p=>p.acted&&p.paid===g.bet))advance(g);}
   if(g.phase!=='finished'&&now()>=g.ends){act(g,g.players[g.turn].paid===g.bet?'call':'fold');changed=true;}if(changed)publish(ps,g);
  }
  for(const p of ps.values()){const old=subscriptions.get(p);if(old&&old!==tableOf(p)){subscriptions.delete(p);send(p.ws,{type:'poker-state',game:null});}}
 }
 return {tick,start(ps,p,roster){return startGame(ps,p,roster)},handle(ps,p,m){
  if(!['poker-open','poker-start','poker-action'].includes(m.type))return false;tick(ps);
  const id=tableOf(p);if(!id){send(p.ws,{type:'notice',message:'Duduk di meja bersama member untuk Poker Kampung.'});return true;}
  if(m.type==='poker-start')return startGame(ps,p);
  subscriptions.set(p,id);const map=mapFor(ps);let g=map.get(id);
  if(m.type==='poker-open'){send(p.ws,{type:'poker-state',game:g?view(g,p):null});return true;}
  if(!g||g.phase==='finished'||g.players[g.turn]?.id!==p.id||m.hand!==g.hand||m.revision!==g.revision)return true;
  if(!['fold','call','raise'].includes(m.action)||m.action==='raise'&&g.bet>=40)return true;
  act(g,m.action);publish(ps,g);return true;
 }};
}
