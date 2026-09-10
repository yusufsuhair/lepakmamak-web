import './motion.css';
import './poker.css';
import {createGameAudio} from './game-audio';
type PokerState={tableId:string;hand:string;revision:number;phase:string;ends:number;pot:number;bet:number;board:number[];turnId?:string;result:string;players:{id:string;name:string;chips:number;paid:number;folded:boolean;dealer:boolean;cards:number[]}[];actions:{call:number;raise:boolean}|null};
export function setupPoker(send:(message:object)=>boolean){
 const root=document.createElement('section');root.className='poker';
 root.innerHTML=`<div class="poker-heading"><div><small>GAME MEJA · 2–3 PEMAIN</small><h3>Poker Kampung</h3></div><span aria-hidden="true">♠</span></div><p>Bluff sikit, lepak lama. 200 cip percuma setiap pusingan.</p><div class="poker-launch"><button type="button" data-open>Buka poker</button><button type="button" data-start>Jom main</button></div><p data-hint></p><div data-game hidden><div class="poker-meta"><b data-phase></b><span data-pot></span></div><div class="poker-board" aria-label="Kad komuniti"></div><div class="poker-players"></div><p data-turn role="status"></p><p data-clock></p><div class="poker-actions"><button type="button" data-action="fold">Fold</button><button type="button" data-action="call">Check</button><button type="button" data-action="raise">Raise +10</button></div></div><details><summary>Cara main</summary><p>Duduk semeja dengan member, kemudian tekan Jom main. Semua yang duduk semeja masuk pusingan. Gabungkan 2 kad anda dan 5 kad meja untuk dapatkan 5 kad terbaik.</p><p>Fold: tarik diri. Check: terus tanpa tambah cip. Call: samakan cip. Raise: tambah 10. Blinds 5/10; maksimum 40 cip setiap peringkat. Giliran 25 saat; jika masa habis, auto-check atau fold. Berdiri atau terputus sambungan akan fold.</p><p>Cip ini percuma, reset setiap pusingan dan tidak boleh dibeli, ditukar atau digunakan di kedai.</p></details>`;
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
 function card(value?:number){const node=document.createElement('span');node.className='poker-card';if(value===undefined){node.textContent='♠';node.classList.add('back');node.setAttribute('aria-label','Kad tertutup');}else{const suit=Math.floor(value/13),rank=value%13+2;node.textContent=`${rank<11?rank:({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[rank]}${['♠','♥','♣','♦'][suit]}`;if(suit===1||suit===3)node.classList.add('red');}return node;}
 function render(){
  const g=game?.tableId===table?game:null;
  el<HTMLButtonElement>('[data-open]').disabled=!enabled;
  el<HTMLButtonElement>('[data-start]').disabled=!enabled||!!g&&g.phase!=='finished'||pending;
  el('[data-start]').textContent=g?.phase==='finished'?'Main lagi':'Jom main';
  el('[data-hint]').textContent=enabled?'Kad anda hanya kelihatan kepada anda sehingga showdown.':'Duduk di meja ini untuk bermain.';
  el('[data-game]').hidden=!g;if(!g)return;
  // A new hand puts the board and the pot back to nothing, so the flop flips rather than
  // appears. This has to run before anything reads those counters, not after.
  if(g.hand!==shownHand){shownHand=g.hand;shownBoard=0;shownPot=0;}
  el('[data-phase]').textContent=({preflop:'Kad dibahagi',flop:'Flop · 3 kad',turn:'Turn · 4 kad',river:'River · 5 kad',finished:'Pusingan tamat'} as Record<string,string>)[g.phase]||g.phase;
  const pot=el('[data-pot]');pot.textContent=`Pot ${g.pot} cip`;
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
  for(const p of g.players){const row=document.createElement('div');row.className='poker-player';row.classList.toggle('active',g.turnId===p.id);row.classList.toggle('game-pulse',g.turnId===p.id&&g.phase!=='finished');row.classList.toggle('folded',p.folded);const info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');name.textContent=`${p.name}${p.id===self?' (Anda)':''}${p.dealer?' · D':''}`;meta.textContent=`${p.chips} cip · ${p.folded?'Fold':`${p.paid} di meja`}`;info.append(name,meta);const cards=document.createElement('div');cards.className='poker-hand';cards.append(card(p.cards[0]),card(p.cards[1]));row.append(info,cards);players.append(row);}
  const turn=el('[data-turn]');
  turn.textContent=g.phase==='finished'?g.result:g.turnId===self?'Giliran anda!':`Giliran ${g.players.find(p=>p.id===g.turnId)?.name||'member'}`;
  if(g.phase==='finished'&&shownPhase!=='finished'){turn.classList.add('game-burst');audio.sound(g.result.includes(myName())?'win':'fold');}
  else if(g.phase!=='finished')turn.classList.remove('game-burst');
  shownPhase=g.phase;
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-action]'))button.disabled=!enabled||pending||!g.actions||button.dataset.action==='raise'&&!g.actions.raise;
  el('[data-action="call"]').textContent=g.actions?.call?`Call ${g.actions.call}`:'Check';clock();
 }
 function clock(){el('[data-clock]').textContent=game?.tableId===table&&game.ends?`${Math.max(0,Math.ceil((game.ends-Date.now())/1000))}s · auto-check / fold bila masa habis`:'';}
 setInterval(()=>{if(root.isConnected&&root.getClientRects().length)clock();},500);
 const myName=()=>game?.players.find(p=>p.id===self)?.name||'\u0000';
 root.addEventListener('pointerdown',()=>audio.unlock());
 el('[data-open]').onclick=()=>send({type:'poker-open'});
 el('[data-start]').onclick=()=>send({type:'poker-start'});
 for(const button of root.querySelectorAll<HTMLButtonElement>('[data-action]'))button.onclick=()=>{if(!game||pending)return;if(send({type:'poker-action',hand:game.hand,revision:game.revision,action:button.dataset.action})){pending=true;render();}};
 render();
 return {root,state(value:PokerState|null,id:string){game=value;self=id;pending=false;render();},context(id:string,seated:boolean,selfId:string){const changed=table!==id||enabled!==seated||self!==selfId;table=id;enabled=seated;self=selfId;if(changed){pending=false;if(seated)send({type:'poker-open'});render();}}};
}
