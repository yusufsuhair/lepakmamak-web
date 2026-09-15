import catalog from '../shared/casual-games.json';
import './casual-games.css';

export type CasualState = {
  id:string;kind:keyof typeof catalog;tableId:string;revision:number;phase:string;self:string;turn:string;
  ends:number;serverTime:number;notice:string;winners:string[];paused:boolean;
  players:{id:string;name:string;left:boolean;online:boolean;score:number;count?:number}[];
  board?:number[];pits?:number[];tokens?:number[][];dice?:number|null;legal?:number[];
  hand?:number[];rank?:string;pileCount?:number;last?:{by:string;count:number;rank:string}|null;
  question?:{text:string;options:string[]};round?:number;total?:number;answered?:string[];answer?:number|null;correct?:number|null;
};
const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const suits=['♠','♥','♣','♦'];
const route=[[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
const lanes=[Array.from({length:6},(_,i)=>[7,i+1]),Array.from({length:6},(_,i)=>[i+1,7]),Array.from({length:6},(_,i)=>[7,13-i]),Array.from({length:6},(_,i)=>[13-i,7])];
const bases=[[2,2],[2,11],[11,11],[11,2]];
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',cls='')=>{const el=document.createElement(tag);el.textContent=text;el.className=cls;return el;};

export function setupCasualGames(send:(message:object)=>boolean) {
  const root=element('section','','casual-game');root.hidden=true;
  const title=element('h3'),rules=element('details'),summary=element('summary','Cara main'),instructions=element('p');
  rules.append(summary,instructions);
  const roster=element('div','','casual-roster'),status=element('p','','casual-status'),clock=element('span','','casual-clock');
  status.setAttribute('role','status');const board=element('div','','casual-board');
  const feedback=element('p','','casual-feedback');feedback.setAttribute('role','status');
  root.append(title,rules,roster,status,clock,board,feedback);
  let state:CasualState|null=null,anchor=0,waiting=false,selected=new Set<number>(),handKey='';
  let active='',timer:ReturnType<typeof setInterval>|undefined;
  function button(label:string,run:()=>void,disabled=false,cls='') {
    const b=element('button',label,cls);b.type='button';b.disabled=disabled;b.onclick=run;return b;
  }
  function action(extra:object) {
    if(!state||waiting)return;
    if(send({type:'casual-action',game:state.kind,gameId:state.id,revision:state.revision,round:state.round,...extra})) {
      waiting=true;feedback.textContent='Menghantar…';
      for(const b of board.querySelectorAll('button'))b.disabled=true;
    }else feedback.textContent='Connection terputus. Cuba selepas sambung semula.';
  }
  function timerText() {
    if(!state)return;
    clock.textContent=state.paused?'Menunggu pemain kembali ke meja (30 saat).':state.ends?`${Math.max(0,Math.ceil((state.ends-state.serverTime-(performance.now()-anchor))/1000))} saat`:'';
  }
  function render() {
    root.hidden=!state||state.kind!==active;if(!state||root.hidden)return;
    const g=state,meta=catalog[g.kind],me=g.players.findIndex(p=>p.id===g.self);
    const live=g.phase!=='finished'&&!g.paused&&!waiting&&me>=0&&!g.players[me].left,turn=live&&g.turn===g.self;
    title.textContent=meta.title;instructions.textContent=meta.rules+' Terputus connection: duduk semula di meja dan pilih game dalam 30 saat. Keluar game menyerah; giliran biasa tamat selepas 35 saat. Had perlawanan 30 minit.';
    roster.replaceChildren();
    g.players.forEach((p,i)=>{const item=element('span',`${i+1}. ${p.name}${p.id===g.self?' (Anda)':''}${p.left?' · Keluar':!p.online?' · Reconnecting':''}${g.kind==='quiz'?` · ${p.score} mata`:p.count!=null?` · ${p.count} kad`:''}`,'casual-player');item.dataset.player=String(i);item.classList.toggle('current',p.id===g.turn);roster.append(item);});
    status.textContent=g.phase==='finished'?(g.winners.length?`Menang: ${g.players.filter(p=>g.winners.includes(p.id)).map(p=>p.name).join(', ')}. Tekan Play again untuk rematch.`:'Seri. Tekan Play again untuk rematch.')
      :g.kind==='quiz'?`Soalan ${g.round}/${g.total}${g.phase==='reveal'?' · Jawapan':''}`
      :g.phase==='challenge'?'Peluang panggil Tipu!':turn?'Giliran anda':`Giliran ${g.players.find(p=>p.id===g.turn)?.name||'pemain'}`;
    feedback.textContent=g.notice;timerText();board.replaceChildren();board.className=`casual-board ${g.kind}-board`;
    if(g.kind==='four') {
      const controls=element('div','','four-controls');
      for(let col=0;col<7;col++)controls.append(button(`↓ ${col+1}`,()=>action({column:col}),!turn||g.board![col]>=0));
      const grid=element('div','','four-grid');grid.setAttribute('role','img');grid.setAttribute('aria-label','Papan Empat Sebaris, 6 baris dan 7 lajur');
      g.board!.forEach((p,i)=>{const cell=element('span',p<0?'':String(p+1),'four-cell');cell.dataset.player=String(p);cell.setAttribute('aria-label',`Baris ${Math.floor(i/7)+1}, lajur ${i%7+1}: ${p<0?'kosong':g.players[p].name}`);grid.append(cell);});
      board.append(controls,grid);
    } else if(g.kind==='congkak') {
      const surface=element('div','','congkak-surface');
      surface.append(element('div',`${g.players[1].name}: ${g.pits![15]}`,'congkak-home'));
      const villages=element('div','','congkak-villages');
      for(const pit of [14,13,12,11,10,9,8,0,1,2,3,4,5,6]) {
        const owner=pit<7?0:1,b=button(String(g.pits![pit]),()=>action({pit}),!turn||owner!==me||g.pits![pit]===0,'congkak-pit');
        b.setAttribute('aria-label',`Kampung ${pit<7?pit+1:pit-7}, ${g.players[owner].name}: ${g.pits![pit]} guli`);b.dataset.player=String(owner);villages.append(b);
      }
      surface.append(villages,element('div',`${g.players[0].name}: ${g.pits![7]}`,'congkak-home'));board.append(surface);
      board.append(element('p','Baris bawah: pemain 1 · Baris atas: pemain 2'));
    } else if(g.kind==='ludo') {
      const surface=element('div','','ludo-surface');surface.setAttribute('aria-label','Papan Ludo');
      const cell=(r:number,c:number,text:string,cls:string,player=-1)=>{const el=element('span',text,cls);el.style.gridRow=String(r+1);el.style.gridColumn=String(c+1);el.dataset.player=String(player);surface.append(el);return el;};
      route.forEach(([r,c],i)=>cell(r,c,[0,8,13,21,26,34,39,47].includes(i)?'★':'','ludo-cell'));
      g.players.forEach((_,i)=>lanes[i].forEach(([r,c])=>cell(r,c,'','ludo-cell ludo-home',i)));
      g.tokens!.forEach((tokens,i)=>tokens.forEach((step,piece)=>{
        const [r,c]=step<0?[bases[i][0]+Math.floor(piece/2),bases[i][1]+piece%2]:step<52?route[(i*13+step)%52]:lanes[i][step-52];
        const token=cell(r,c,String(piece+1),'ludo-token',i);token.style.transform=`translate(${piece%2?12:-12}%,${piece>1?12:-12}%)`;
        token.title=`${g.players[i].name}, buah ${piece+1}: ${step<0?'pangkalan':step===57?'tamat':`langkah ${step}`}`;
      }));board.append(surface);
      board.append(button(g.dice?`Dadu: ${g.dice}`:'Baling dadu',()=>action({action:'roll'}),!turn||g.dice!=null,'casual-primary'));
      if(me>=0){const pieces=element('div','','casual-actions');g.tokens![me].forEach((step,piece)=>pieces.append(button(`Buah ${piece+1} · ${step<0?'Pangkalan':step===57?'Tamat':step}`,()=>action({action:'move',piece}),!turn||!g.legal?.includes(piece))));board.append(pieces);}
    } else if(g.kind==='bluff') {
      board.append(element('p',`Rank giliran: ${g.rank} · Longgokan: ${g.pileCount} kad`));
      if(g.last)board.append(button('Tipu!',()=>action({action:'challenge'}),!live||g.last.by===g.self,'casual-primary'));
      const hand=element('div','','bluff-hand');
      const play=button(`Letak ${selected.size} kad sebagai ${g.rank}`,()=>action({action:'play',cards:[...selected]}),!turn||g.phase!=='playing'||selected.size===0,'casual-primary');
      for(const c of g.hand||[]) {
        const card=button(`${ranks[c%13]}${suits[Math.floor(c/13)]}`,()=>{
          if(selected.has(c))selected.delete(c);else if(selected.size<4)selected.add(c);
          card.setAttribute('aria-pressed',String(selected.has(c)));play.textContent=`Letak ${selected.size} kad sebagai ${g.rank}`;play.disabled=selected.size===0;
        },!turn||g.phase!=='playing','bluff-card');
        card.setAttribute('aria-pressed',String(selected.has(c)));hand.append(card);
      }
      board.append(hand,play);
    } else if(g.kind==='quiz') {
      board.append(element('h4',g.question!.text));
      g.question!.options.forEach((option,choice)=>{const b=button(`${'ABCD'[choice]}. ${option}`,()=>action({choice}),!live||g.phase!=='playing'||g.answer!=null,'quiz-option');b.setAttribute('aria-pressed',String(g.answer===choice));if(g.correct===choice)b.classList.add('correct');board.append(b);});
      board.append(element('p',`${g.answered?.length||0}/${g.players.filter(p=>!p.left).length} sudah jawab`));
    }
  }
  return {root,
    state(value:CasualState|null){
      if(value&&state?.id===value.id&&value.revision<state.revision)return;
      const key=value?`${value.id}:${value.phase}:${value.hand?.join(',')}`:'';
      if(key!==handKey){selected.clear();handKey=key;}
      state=value;anchor=performance.now();waiting=false;render();
    },
    show(kind:string){active=kind;if(timer)clearInterval(timer);if(kind)timer=setInterval(timerText,250);render();}
  };
}
