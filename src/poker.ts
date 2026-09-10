import './motion.css';
import './poker.css';
import {createGameAudio} from './game-audio';
type PokerState={tableId:string;hand:string;revision:number;phase:string;ends:number;pot:number;bet:number;board:number[];turnId?:string;result:string;players:{id:string;name:string;chips:number;paid:number;folded:boolean;dealer:boolean;cards:number[]}[];actions:{call:number;raise:boolean}|null};
export function setupPoker(send:(message:object)=>boolean){
 const root=document.createElement('section');root.className='poker';
 root.innerHTML=`<div class="poker-heading"><div><small>TABLE GAME · 2–3 PLAYERS</small><h3>Poker Kampung</h3></div><span aria-hidden="true">♠</span></div><p>Bluff a little, stay a while. 200 free chips every hand.</p><div class="poker-launch"><button type="button" data-open>Open poker</button><button type="button" data-start>Play</button></div><p data-hint></p><div data-game hidden><div class="poker-meta"><b data-phase></b><span data-pot></span></div><div class="poker-board" aria-label="Community cards"></div><div class="poker-players"></div><p data-turn role="status"></p><p data-clock></p><div class="poker-actions"><button type="button" data-action="fold">Fold</button><button type="button" data-action="call">Check</button><button type="button" data-action="raise">Raise +10</button></div></div><details><summary>How to play</summary><p>Sit at a table with your friends, then press Play. Everyone sitting at the table joins the hand. Combine your 2 cards with the 5 community cards to make your best 5-card hand.</p><p>Fold: leave the hand. Check: continue without adding chips. Call: match the current bet. Raise: add 10. Blinds are 5/10; the maximum bet is 40 per street. Each turn lasts 25 seconds; when time runs out, the game auto-checks or folds. Standing up or disconnecting folds your hand.</p><p>These chips are free, reset every hand, and cannot be bought, traded, or used in the shop.</p></details>`;
 const el=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 let game:PokerState|null=null,self='',table='',enabled=false,pending=false;
 // What the table has already shown. render() rebuilds every card and every seat from
 // scratch, so without this the whole board would re-deal itself on every state update —
 // motion on everything is worse than motion on nothing.
 let shownBoard=0,shownPot=0,shownHand='',shownPhase='';
 const audio=createGameAudio('poker',{
  // A card landing on felt, then the next.
  deal:({swish,now})=>{for(let i=0;i<3;i++)swish(now+i*.08);},
  // Chips: two clicks of stack against stack.
  chip:({note,now})=>{note(740,now,.05);note(560,now+.045,.06);},
  // Folding is a slide, not a click.
  fold:({swish,now})=>swish(now,.13),
  // The pot coming your way.
  win:({note,now})=>[392,523,659,784].forEach((f,i)=>note(f,now+i*.1,.24)),
 });
 function card(value?:number){const node=document.createElement('span');node.className='poker-card';if(value===undefined){node.textContent='♠';node.classList.add('back');node.setAttribute('aria-label','Face-down card');}else{const suit=Math.floor(value/13),rank=value%13+2;node.textContent=String(rank<11?rank:({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[rank])+['♠','♥','♣','♦'][suit];if(suit===1||suit===3)node.classList.add('red');}return node;}
 function render(){
  const g=game?.tableId===table?game:null;
  el<HTMLButtonElement>('[data-open]').disabled=!enabled;
  el<HTMLButtonElement>('[data-start]').disabled=!enabled||!!g&&g.phase!=='finished'||pending;
  el('[data-start]').textContent=g?.phase==='finished'?'Play again':'Play';
  el('[data-hint]').textContent=enabled?'Your cards are visible only to you until the showdown.':'Sit at this table to play.';
  el('[data-game]').hidden=!g;if(!g)return;
  // A new hand puts the board and the pot back to nothing, so the flop flips rather than
  // appears. This has to run before anything reads those counters, not after.
  if(g.hand!==shownHand){shownHand=g.hand;shownBoard=0;shownPot=0;}
  el('[data-phase]').textContent=({preflop:'Cards dealt',flop:'Flop · 3 cards',turn:'Turn · 4 cards',river:'River · 5 cards',finished:'Hand over'} as Record<string,string>)[g.phase]||g.phase;
  const pot=el('[data-pot]');pot.textContent='Pot '+g.pot+' chips';
  if(g.pot>shownPot&&shownPot>0){pot.classList.remove('game-burst');void pot.offsetWidth;pot.classList.add('game-burst');audio.sound('chip');}
  shownPot=g.pot;
  const board=el('.poker-board');board.replaceChildren();
  for(let i=0;i<5;i++){
   const node=card(g.board[i]);
   // Only the cards turned over since the last render move; the rest are already on felt.
   if(g.board[i]!==undefined&&i>=shownBoard){node.classList.add('game-flip');node.style.animationDelay=`${(i-shownBoard)*90}ms`;}
   board.append(node);
  }
  if(g.board.length>shownBoard){audio.sound('deal');shownBoard=g.board.length;}
  const players=el('.poker-players');players.replaceChildren();
  for(const p of g.players){const row=document.createElement('div');row.className='poker-player';row.classList.toggle('active',g.turnId===p.id);row.classList.toggle('game-pulse',g.turnId===p.id&&g.phase!=='finished');row.classList.toggle('folded',p.folded);const info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');name.textContent=p.name+(p.id===self?' (you)':'')+(p.dealer?' · D':'');meta.textContent=p.chips+' chips · '+(p.folded?'Fold':p.paid+' in pot');info.append(name,meta);const cards=document.createElement('div');cards.className='poker-hand';cards.append(card(p.cards[0]),card(p.cards[1]));row.append(info,cards);players.append(row);}
  const turn=el('[data-turn]');
  const turnName=g.players.find(p=>p.id===g.turnId)?.name||'player';turn.textContent=g.phase==='finished'?g.result:g.turnId===self?'Your turn!':turnName+"'s turn";
  if(g.phase==='finished'&&shownPhase!=='finished'){turn.classList.add('game-burst');audio.sound(g.result.includes(myName())?'win':'fold');}
  else if(g.phase!=='finished')turn.classList.remove('game-burst');
  shownPhase=g.phase;
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-action]'))button.disabled=!enabled||pending||!g.actions||button.dataset.action==='raise'&&!g.actions.raise;
  el('[data-action="call"]').textContent=g.actions?.call?`Call ${g.actions.call}`:'Check';clock();
 }
 function clock(){el('[data-clock]').textContent=game?.tableId===table&&game.ends?String(Math.max(0,Math.ceil((game.ends-Date.now())/1000)))+'s · auto-check / fold when time runs out':'';}
 setInterval(()=>{if(root.isConnected&&root.getClientRects().length)clock();},500);
 const myName=()=>game?.players.find(p=>p.id===self)?.name||'\u0000';
 root.addEventListener('pointerdown',()=>audio.unlock());
 el('[data-open]').onclick=()=>send({type:'poker-open'});
 el('[data-start]').onclick=()=>send({type:'poker-start'});
 for(const button of root.querySelectorAll<HTMLButtonElement>('[data-action]'))button.onclick=()=>{if(!game||pending)return;if(send({type:'poker-action',hand:game.hand,revision:game.revision,action:button.dataset.action})){pending=true;render();}};
 render();
 return {root,state(value:PokerState|null,id:string){game=value;self=id;pending=false;render();},context(id:string,seated:boolean,selfId:string){const changed=table!==id||enabled!==seated||self!==selfId;table=id;enabled=seated;self=selfId;if(changed){pending=false;if(seated)send({type:'poker-open'});render();}}};
}
