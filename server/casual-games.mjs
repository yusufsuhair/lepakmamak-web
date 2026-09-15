import {randomInt, randomUUID} from 'node:crypto';
import catalog from '../shared/casual-games.json' with {type:'json'};
import {tableOf} from './seating.mjs';
import {questions} from './mamak-questions.mjs';

const identity = p => p.userId || p.standInId || p.id;
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const safeSquares = new Set([0,8,13,21,26,34,39,47]);
const shuffle = (items, pick) => {
  const copy = [...items];
  for (let i=copy.length-1;i>0;i--) { const j=pick(i+1); [copy[i],copy[j]]=[copy[j],copy[i]]; }
  return copy;
};

export function fourWinner(board, at) {
  const row=Math.floor(at/7), col=at%7, who=board[at];
  if (who<0) return false;
  return [[1,0],[0,1],[1,1],[1,-1]].some(([dr,dc]) => {
    let count=1;
    for (const sign of [-1,1]) for(let step=1;step<4;step++) {
      const r=row+dr*step*sign,c=col+dc*step*sign;
      if(r<0||r>=6||c<0||c>=7||board[r*7+c]!==who)break;
      count++;
    }
    return count>=4;
  });
}

export function sowCongkak(pits, side, pit) {
  const own=i=>side===0?i>=0&&i<7:i>=8&&i<15;
  if(!Number.isInteger(pit)||!own(pit)||!pits[pit])return null;
  const home=side===0?7:15, skip=side===0?15:7;
  let cursor=pit, seeds=pits[pit];pits[pit]=0;
  const seen=new Set();
  while(seeds) {
    cursor=(cursor+1)%16;if(cursor===skip)continue;
    pits[cursor]++;seeds--;
    if(seeds)continue;
    if(cursor===home)return true;
    if(pits[cursor]>1) {
      const signature=cursor+':'+pits.join(',');
      // Repeated relay positions cannot make progress. End this turn, preserving all seeds.
      if(seen.has(signature))return false;seen.add(signature);
      seeds=pits[cursor];pits[cursor]=0;
    } else if(own(cursor)&&pits[14-cursor]>0) {
      pits[home]+=pits[14-cursor]+1;pits[cursor]=pits[14-cursor]=0;
    }
  }
  return false;
}

export function ludoMoves(tokens, dice) {
  return tokens.flatMap((step,i)=>step<0?dice===6?[i]:[]:step<57&&step+dice<=57?[i]:[]);
}

// The five games share only their table lifecycle. Private cards and quiz answers never
// enter a room snapshot; publish builds a separate view for each consenting participant.
export function createCasualGames(send, now=Date.now, pick=randomInt) {
  const rooms=new WeakMap();
  const map=ps=>{if(!rooms.has(ps))rooms.set(ps,new Map());return rooms.get(ps);};
  const slot=(kind,table)=>`${kind}:${table}`;
  const find=(ps,p,kind)=>rooms.get(ps)?.get(slot(kind,tableOf(p)));
  const alive=g=>g.players.filter(p=>!p.left);
  const index=(g,id)=>g.players.findIndex(p=>p.id===id);
  function finish(g,winners,text) {g.phase='finished';g.winners=winners;g.notice=text;g.ends=0;}
  function next(g,from=g.turn) {
    for(let n=1;n<=g.players.length;n++){const i=(from+n)%g.players.length;if(!g.players[i].left)return i;}
    return from;
  }
  function deadline(g) {g.ends=(g.pausedAt??now())+(g.kind==='quiz'?15000:35000);}
  function quizQuestion(g) {
    g.phase='playing';g.answers={};g.reveal=null;
    const [text,options,answer]=questions[g.order[g.round]];
    const positions=shuffle([0,1,2,3],pick);
    g.question={text,options:positions.map(i=>options[i])};g.correct=positions.indexOf(answer);deadline(g);
  }
  function quizReveal(g) {
    g.phase='reveal';g.reveal=g.correct;g.ends=now()+3500;
    for(const p of alive(g))if(g.answers[p.id]===g.correct)p.score+=10;
    g.notice=`Jawapan: ${g.question.options[g.correct]}`;
  }
  function view(g,id) {
    const me=g.players.find(p=>p.id===id);
    const value={id:g.id,kind:g.kind,tableId:g.tableId,revision:g.revision,phase:g.phase,self:id,turn:g.players[g.turn]?.id,
      ends:g.ends,serverTime:now(),notice:g.notice,winners:g.winners,paused:g.players.some(p=>p.missingAt!=null&&!p.left),
      players:g.players.map(p=>({id:p.id,name:p.name,left:p.left,online:p.missingAt==null,score:p.score,count:p.hand?.length}))};
    if(g.kind==='four')value.board=g.board;
    if(g.kind==='congkak')value.pits=g.pits;
    if(g.kind==='ludo')Object.assign(value,{tokens:g.tokens,dice:g.dice,legal:me&&!me.left&&g.players[g.turn]===me&&g.dice?ludoMoves(g.tokens[g.turn],g.dice):[]});
    if(g.kind==='bluff')Object.assign(value,{hand:me&&!me.left?me.hand:[],rank:ranks[g.rank],pileCount:g.pile.length,last:g.last?{by:g.players[g.last.by].id,count:g.last.cards.length,rank:ranks[g.last.rank]}:null});
    if(g.kind==='quiz')Object.assign(value,{question:g.question,round:g.round+1,total:10,answered:Object.keys(g.answers),answer:g.answers[id]??null,correct:g.phase==='playing'?null:g.reveal});
    return value;
  }
  function publish(ps,g) {
    for(const p of ps.values())if(tableOf(p)===g.tableId&&g.players.some(m=>m.id===identity(p)))send(p.ws,{type:'casual-state',game:view(g,identity(p))});
  }
  function changed(ps,g){g.revision++;publish(ps,g);}
  function settleBluff(g,challenger=null) {
    const last=g.last;if(!last)return;
    const liar=last.cards.some(c=>c%13!==last.rank);
    if(challenger!=null) {
      const loser=liar?last.by:challenger;g.players[loser].hand.push(...g.pile);g.pile=[];
      g.notice=`${g.players[challenger].name} panggil Tipu! ${liar?'Memang tipu':'Kad jujur'} — ${g.players[loser].name} ambil longgokan.`;
    } else g.notice='Tiada cabaran. Giliran seterusnya.';
    g.last=null;
    const winner=alive(g).find(p=>p.hand.length===0);
    if(winner){finish(g,[winner.id],`${winner.name} habis kad!`);return;}
    g.phase='playing';g.turn=next(g,last.by);g.rank=(g.rank+1)%13;deadline(g);
  }
  function depart(g,id) {
    const i=index(g,id);if(i<0||g.players[i].left||g.phase==='finished')return;
    // Settle a pending last-card claim before removing a player from its challenge window.
    if(g.kind==='bluff'&&g.last){g.players[g.last.by].hand.push(...g.pile);g.pile=[];g.last=null;g.phase='playing';}
    g.players[i].left=true;g.players[i].missingAt=null;
    if(g.kind==='bluff'){g.pile.push(...g.players[i].hand);g.players[i].hand=[];}
    if(alive(g).length<2){finish(g,alive(g).map(p=>p.id),'Perlawanan tamat — pemain lain keluar.');return;}
    if(g.turn===i){g.turn=next(g);if(g.kind==='ludo')g.dice=null;deadline(g);}
    g.notice=`${g.players[i].name} keluar dari perlawanan.`;
  }
  const games={};
  for(const kind of Object.keys(catalog)) games[kind]={
    start(ps,p,roster) {
      const tableId=tableOf(p),rule=catalog[kind],old=find(ps,p,kind);
      if(!tableId||old&&old.phase!=='finished'||roster.length<rule.min||roster.length>rule.max||new Set(roster.map(identity)).size!==roster.length||roster.some(m=>tableOf(m)!==tableId))return;
      const g={id:randomUUID(),kind,tableId,revision:0,phase:'playing',turn:0,ends:0,started:now(),moves:0,notice:'Jom main!',winners:[],
        players:roster.map(m=>({id:identity(m),name:m.name,left:false,missingAt:null,score:0}))};
      if(kind==='four')g.board=Array(42).fill(-1);
      if(kind==='congkak')g.pits=Array.from({length:16},(_,i)=>i===7||i===15?0:7);
      if(kind==='ludo'){g.tokens=g.players.map(()=>Array(4).fill(-1));g.dice=null;}
      if(kind==='bluff'){g.rank=0;g.pile=[];g.last=null;g.players.forEach(m=>m.hand=[]);shuffle(Array.from({length:52},(_,i)=>i),pick).forEach((c,i)=>g.players[i%g.players.length].hand.push(c));}
      if(kind==='quiz'){g.order=shuffle(questions.map((_,i)=>i),pick).slice(0,10);g.round=0;quizQuestion(g);}else deadline(g);
      map(ps).set(slot(kind,tableId),g);publish(ps,g);
    },
    canJoin(ps,p){const g=find(ps,p,kind);return !g||g.phase==='finished'||g.players.some(m=>m.id===identity(p)&&!m.left);},
    isPlaying(ps,p){const g=find(ps,p,kind);return !!g&&g.phase!=='finished'&&g.players.some(m=>m.id===identity(p)&&!m.left);},
    open(ps,p){const g=find(ps,p,kind);if(g&&g.players.some(m=>m.id===identity(p)))send(p.ws,{type:'casual-state',game:view(g,identity(p))});},
    canRematch(ps,p){const g=find(ps,p,kind);return g?.phase==='finished'&&g.players.some(m=>m.id===identity(p));},
    leave(ps,p){const g=find(ps,p,kind);if(g){depart(g,identity(p));changed(ps,g);}},
  };
  function tick(ps) {
    const list=rooms.get(ps);if(!list)return;
    for(const [key,g] of list) {
      if([...ps.values()].some(p=>tableOf(p)===g.tableId))g.emptySince=null;
      else {g.emptySince??=now();if(now()-g.emptySince>60000){list.delete(key);continue;}}
      if(g.phase==='finished')continue;
      let dirty=false;
      for(const m of alive(g)) {
        const present=[...ps.values()].some(p=>identity(p)===m.id&&tableOf(p)===g.tableId);
        if(present&&m.missingAt!=null){m.missingAt=null;dirty=true;}
        else if(!present){if(m.missingAt==null){m.missingAt=now();dirty=true;}if(now()-m.missingAt>=30000){depart(g,m.id);dirty=true;}}
      }
      const paused=g.players.some(p=>p.missingAt!=null&&!p.left);
      if(paused)g.pausedAt??=now();
      else if(g.pausedAt!=null){if(g.ends)g.ends+=now()-g.pausedAt;g.pausedAt=null;}
      if(g.phase!=='finished'&&!paused) {
        if(now()-g.started>=30*60000){finish(g,[],'Had 30 minit dicapai — seri.');dirty=true;}
        else if(now()>=g.ends) {
          if(g.kind==='quiz') {
            if(g.phase==='playing')quizReveal(g);
            else if(++g.round>=10){const best=Math.max(...alive(g).map(p=>p.score));finish(g,alive(g).filter(p=>p.score===best).map(p=>p.id),'Kuiz tamat!');}
            else quizQuestion(g);
          }else if(g.kind==='bluff'&&g.phase==='challenge')settleBluff(g);
          else depart(g,g.players[g.turn].id);
          dirty=true;
        }
      }
      if(dirty)changed(ps,g);
    }
  }
  function handle(ps,p,m) {
    if(m.type!=='casual-action')return false;
    if(typeof m.game!=='string'||!Object.hasOwn(games,m.game))return true;
    tick(ps);const g=find(ps,p,m.game),id=identity(p);
    if(!g||g.id!==m.gameId||g.phase==='finished'||g.players.some(p=>p.missingAt!=null&&!p.left))return true;
    const i=index(g,id);if(i<0||g.players[i].left)return true;
    // Quiz answers race legitimately: lock each answer by question, not another player's revision.
    if(g.kind==='quiz') {
      if(g.phase!=='playing'||m.round!==g.round+1||Object.hasOwn(g.answers,id)||!Number.isInteger(m.choice)||m.choice<0||m.choice>3)return true;
      g.answers[id]=m.choice;if(alive(g).every(p=>Object.hasOwn(g.answers,p.id)))quizReveal(g);changed(ps,g);return true;
    }
    if(m.revision!==g.revision){send(p.ws,{type:'casual-state',game:view(g,id)});return true;}
    if(g.kind==='bluff'&&g.phase==='challenge') {
      if(m.action==='challenge'&&g.last.by!==i){settleBluff(g,i);changed(ps,g);}return true;
    }
    if(g.turn!==i||g.phase!=='playing')return true;
    if(g.kind==='four') {
      if(!Number.isInteger(m.column)||m.column<0||m.column>6)return true;
      let at=35+m.column;while(at>=0&&g.board[at]>=0)at-=7;if(at<0)return true;
      g.board[at]=i;
      if(fourWinner(g.board,at))finish(g,[id],`${p.name} dapat empat sebaris!`);
      else if(g.board.every(c=>c>=0))finish(g,[],'Papan penuh — seri.');
      else {g.turn=next(g);deadline(g);}
    } else if(g.kind==='congkak') {
      const again=sowCongkak(g.pits,i,m.pit);if(again===null)return true;
      if(g.pits.slice(0,7).every(n=>n===0)||g.pits.slice(8,15).every(n=>n===0)) {
        for(let j=0;j<7;j++){g.pits[7]+=g.pits[j];g.pits[j]=0;g.pits[15]+=g.pits[j+8];g.pits[j+8]=0;}
        finish(g,g.pits[7]===g.pits[15]?[]:[g.players[g.pits[7]>g.pits[15]?0:1].id],`Guli: ${g.pits[7]} – ${g.pits[15]}`);
      }else {if(!again)g.turn=next(g);deadline(g);}
    } else if(g.kind==='ludo') {
      if(m.action==='roll'&&g.dice==null) {
        g.dice=pick(6)+1;g.notice=`${p.name} baling ${g.dice}.`;
        if(!ludoMoves(g.tokens[i],g.dice).length){g.notice+=' Tiada langkah.';if(g.dice!==6)g.turn=next(g);g.dice=null;}
        deadline(g);
      }else if(m.action==='move'&&g.dice&&ludoMoves(g.tokens[i],g.dice).includes(m.piece)) {
        const step=g.tokens[i][m.piece]<0?0:g.tokens[i][m.piece]+g.dice;g.tokens[i][m.piece]=step;
        const square=(i*13+step)%52;
        if(step<52&&!safeSquares.has(square))for(let j=0;j<g.tokens.length;j++)if(j!==i&&!g.players[j].left)g.tokens[j]=g.tokens[j].map(t=>t>=0&&t<52&&(j*13+t)%52===square?-1:t);
        if(g.tokens[i].every(t=>t===57))finish(g,[id],`${p.name} bawa semua buah pulang!`);
        else {if(g.dice!==6)g.turn=next(g);deadline(g);}g.dice=null;
      }else return true;
    } else if(g.kind==='bluff') {
      if(m.action!=='play'||!Array.isArray(m.cards)||m.cards.length<1||m.cards.length>4||new Set(m.cards).size!==m.cards.length||m.cards.some(c=>!Number.isInteger(c)||!g.players[i].hand.includes(c)))return true;
      g.players[i].hand=g.players[i].hand.filter(c=>!m.cards.includes(c));g.pile.push(...m.cards);g.last={by:i,cards:[...m.cards],rank:g.rank};g.phase='challenge';g.ends=now()+6000;
      g.notice=`${p.name} dakwa ${m.cards.length} kad ${ranks[g.rank]}. Tipu atau jujur?`;
    }
    g.moves++;changed(ps,g);return true;
  }
  return {games,tick,handle};
}
