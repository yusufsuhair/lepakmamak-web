import chairs from '../shared/chairs.json' with {type:'json'};
import config from '../shared/lukis.json' with {type:'json'};
import {randomInt,randomUUID} from 'node:crypto';
import {filterChat} from './chat-filter.mjs';
const tableOf=p=>chairs.find(c=>c.id===p.chairId)?.tableId;
const key=p=>p.userId||p.id;
const normal=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const colors=[...config.colors.map(c=>c.value),'#ffffff'];
export function scoreGuess(seconds,place){return 100+Math.max(0,Math.min(300,Math.ceil(seconds)*5))+Math.max(0,100-(place-1)*35);}
export function wordHint(word,stage){return [...word].map((c,i)=>c===' '||c==='-'?' / ':stage>0&&(i===0||word[i-1]===' ')||stage>1&&i%3===0?c.toUpperCase():'_').join(' ');}
function isClose(a,b){a=normal(a);b=normal(b);if(!a||Math.abs(a.length-b.length)>1)return false;let i=0,j=0,n=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++n>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}return n+Math.abs(a.length-i-(b.length-j))<=1;}
export function createLukis(send,now=Date.now,pick=randomInt){
 const games=new WeakMap();
 const members=(ps,id)=>[...ps.values()].filter(p=>tableOf(p)===id);
 function rebuild(g){let lines=[];for(const a of g.history.slice(0,g.cursor)){if(a.clear)lines=[];else lines.push(...a.lines);}g.lines=lines;}
 function view(g,p,includeBoard=true){const id=key(p),remaining=Math.ceil((g.ends-now())/1000),stage=remaining<=20?2:remaining<=40?1:0;return {id:g.id,tableId:g.tableId,self:id,phase:g.phase,drawer:g.drawer,round:g.round,total:g.order.length,ends:g.ends,serverTime:now(),word:g.phase==='choosing'?'':g.phase==='drawing'&&id!==g.drawer?wordHint(g.word.text,stage):g.word.text,waitingForPlayers:!!g.waitingForPlayers,category:g.phase==='choosing'?'':g.word.category,choices:g.phase==='choosing'&&id===g.drawer?g.choices.map(w=>({text:w.text,category:w.category})):[],scores:g.order.map(id=>({id,name:g.names[id],score:g.scores[id],roundPoints:g.roundPoints[id]||0})).sort((a,b)=>b.score-a.score),lines:includeBoard?g.lines:undefined,solved:g.solved,roundWinners:g.roundWinners,guesses:g.guesses,boardVersion:g.boardVersion,lastBatch:g.lastBatch,nextStroke:g.maxStroke+1,canUndo:g.cursor>0,canRedo:g.cursor<g.history.length};}
 function state(ps,g,only,includeBoard=true){for(const p of only?[only]:members(ps,g.tableId))send(p.ws,{type:'lukis-state',game:view(g,p,includeBoard)});}
 function reveal(g){g.phase='reveal';g.ends=now()+6000;}
 function choose(g,index){g.word=g.choices[index];g.used.add(g.word.text);g.phase='drawing';g.ends=now()+60000;}
 function next(g){
  if(g.round>=g.order.length){g.phase='finished';g.ends=0;return;}
  g.round++;g.drawer=g.order[g.round-1];g.history=[];g.cursor=0;g.lines=[];g.solved=[];g.guesses=[];g.roundWinners=[];g.roundPoints={};g.boardVersion=0;g.lastBatch=0;g.maxStroke=0;g.totalPoints=0;g.lastHint=0;g.guessAt={};
  const pool=config.words.filter(w=>!g.used.has(w.text));g.choices=[];for(let i=0;i<3;i++)g.choices.push(pool.splice(pick(pool.length),1)[0]);
  if(g.protocol===2){g.phase='choosing';g.ends=now()+12000;g.word={text:'',category:''};}else choose(g,0);
 }
 function tick(ps){const map=games.get(ps);if(!map)return;for(const [id,g] of map){const people=members(ps,id).filter(p=>g.order.includes(key(p)));let presenceChanged=false;for(const participant of g.order){if(people.some(p=>key(p)===participant)){if(g.missingAt[participant]){delete g.missingAt[participant];presenceChanged=true;}}else if(!g.missingAt[participant]){g.missingAt[participant]=now();presenceChanged=true;}}g.waitingForPlayers=people.length<2;if(g.protocol===2&&g.waitingForPlayers&&Object.values(g.missingAt).every(at=>now()-at<30000)){if(presenceChanged)state(ps,g,undefined,false);continue;}if(people.length<2){map.delete(id);for(const p of members(ps,id))send(p.ws,{type:'lukis-state',game:null});continue;}if(presenceChanged)state(ps,g,undefined,false);if(g.phase==='finished')continue;
  if(['drawing','choosing'].includes(g.phase)&&!people.some(p=>key(p)===g.drawer)&&(g.protocol!==2||now()-(g.missingAt[g.drawer]||0)>=30000)){reveal(g);state(ps,g);continue;}
  if(g.phase==='drawing'){const stage=g.ends-now()<=20000?2:g.ends-now()<=40000?1:0;const targets=people.filter(p=>key(p)!==g.drawer);if(now()>=g.ends||targets.every(p=>g.solved.includes(key(p)))){reveal(g);state(ps,g);}else if(stage!==g.lastHint){g.lastHint=stage;state(ps,g,undefined,false);}}
  else if(now()>=g.ends){if(g.phase==='choosing')choose(g,0);else next(g);state(ps,g);}
 }}
 function validLine(a){return Array.isArray(a)&&a.length===7&&a.slice(0,4).every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&colors.includes(a[4])&&config.sizes.includes(a[5])&&Number.isSafeInteger(a[6])&&a[6]>=0&&a[6]<1e9;}
 function append(g,lines){const id=lines[0][6];let last=g.history[g.cursor-1];if(g.cursor!==g.history.length||last?.id!==id){g.history=g.history.slice(0,g.cursor);last={id,lines:[]};g.history.push(last);g.cursor++;}last.lines.push(...lines);g.lines.push(...lines);g.maxStroke=Math.max(g.maxStroke,id);g.totalPoints+=lines.length;}
 return {tick,handle(ps,p,m){if(!['lukis-open','lukis-start','lukis-choose','lukis-line','lukis-ink','lukis-undo','lukis-redo','lukis-clear','lukis-guess'].includes(m.type))return false;tick(ps);const tableId=tableOf(p);if(!tableId){send(p.ws,{type:'notice',message:'Duduk semeja dahulu untuk Lukis Lah!'});return true;}if(!games.has(ps))games.set(ps,new Map());const map=games.get(ps),people=members(ps,tableId);let g=map.get(tableId);const id=key(p);
  if(m.type==='lukis-start'){if(g&&g.phase!=='finished')return true;if(people.length<2){send(p.ws,{type:'notice',message:'Ajak seorang lagi duduk semeja.'});return true;}g={id:randomUUID(),tableId,protocol:m.version===2?2:1,order:people.map(key),names:Object.fromEntries(people.map(p=>[key(p),p.name])),scores:Object.fromEntries(people.map(p=>[key(p),0])),round:0,used:new Set(),missingAt:{},waitingForPlayers:false};map.set(tableId,g);next(g);state(ps,g);return true;}
  if(m.type==='lukis-open'){if(g)state(ps,g,p);else send(p.ws,{type:'lukis-state',game:null});return true;}if(!g)return true;
  const epoch=m.gameId===g.id&&m.round===g.round;
  if(g.protocol===2&&!epoch)return true;
  if(m.type==='lukis-choose'&&g.phase==='choosing'&&id===g.drawer&&Number.isInteger(m.choice)&&m.choice>=0&&m.choice<3){choose(g,m.choice);state(ps,g);return true;}
  if(g.phase!=='drawing')return true;
  if(m.type==='lukis-ink'&&id===g.drawer){if(!epoch||m.boardVersion!==g.boardVersion){state(ps,g,p);return true;}if(!Number.isSafeInteger(m.seq)||m.seq>=1e9||m.seq<=g.lastBatch)return true;g.lastBatch=m.seq;const lines=m.lines;
   if(!Array.isArray(lines)||!lines.length||lines.length>24||!lines.every(validLine)||!lines.every(a=>a[6]===lines[0][6])||lines[0][6]<g.maxStroke||g.totalPoints+lines.length>18000||g.cursor>=600){send(p.ws,{type:'lukis-feedback',kind:'limit',message:'Strok tidak diterima atau papan penuh. Buka semula papan; jika penuh, tunggu giliran seterusnya.'});state(ps,g,p);return true;}
   append(g,lines);for(const q of people)send(q.ws,{type:'lukis-ink',gameId:g.id,round:g.round,boardVersion:g.boardVersion,seq:m.seq,lines});return true;
  }
  if(m.type==='lukis-line'&&id===g.drawer&&g.protocol===1){const a=Array.isArray(m.line)&&m.line.length===6?[...m.line,0]:m.line;if(validLine(a)&&g.totalPoints<18000){append(g,[a]);for(const q of people)send(q.ws,{type:'lukis-line',line:a});}return true;}
  if(['lukis-undo','lukis-redo','lukis-clear'].includes(m.type)&&id===g.drawer){if(g.protocol===2&&m.boardVersion!==g.boardVersion){state(ps,g,p);return true;}if(m.type==='lukis-undo'&&g.cursor>0)g.cursor--;else if(m.type==='lukis-redo'&&g.cursor<g.history.length)g.cursor++;else if(m.type==='lukis-clear'&&g.lines.length){g.history=g.history.slice(0,g.cursor);g.history.push({clear:true});g.cursor++;}else return true;g.boardVersion++;rebuild(g);state(ps,g);return true;}
  if(m.type==='lukis-guess'&&id!==g.drawer&&g.order.includes(id)&&!g.solved.includes(id)&&typeof m.text==='string'&&m.text.length<=60&&normal(m.text)){if(now()-(g.guessAt[id]||0)<600){send(p.ws,{type:'lukis-feedback',kind:'wait',message:'Sekejap… cuba lagi.'});return true;}g.guessAt[id]=now();const answers=[g.word.text,...(g.word.aliases||[])];
   if(answers.some(w=>normal(m.text)===normal(w))){const place=g.solved.length+1,timeBonus=Math.min(300,Math.max(0,Math.ceil((g.ends-now())/1000)*5)),placeBonus=Math.max(0,100-(place-1)*35),points=100+timeBonus+placeBonus,eligible=g.order.length-1,artistPoints=Math.round((150+timeBonus/2)/eligible);g.solved.push(id);g.scores[id]+=points;g.scores[g.drawer]+=artistPoints;g.roundPoints[id]=points;g.roundPoints[g.drawer]=(g.roundPoints[g.drawer]||0)+artistPoints;const result={id,name:p.name,points,place,base:100,timeBonus,placeBonus,artistPoints};g.roundWinners.push(result);for(const q of people)send(q.ws,{type:'lukis-correct',...result,gameId:g.id,round:g.round});if(people.filter(q=>g.order.includes(key(q))&&key(q)!==g.drawer).every(q=>g.solved.includes(key(q))))reveal(g);state(ps,g,undefined,false);
   }else{g.guesses.push({name:p.name,text:filterChat(m.text.replace(/[\u0000-\u001f\u007f]/g,' ').trim())});g.guesses=g.guesses.slice(-10);state(ps,g,undefined,false);const near=answers.some(w=>isClose(m.text,w));send(p.ws,{type:'lukis-feedback',kind:near?'close':'wrong',message:near?'Hampir tepat! Cuba ejaan sekali lagi.':'Belum tepat. Cuba lagi!'});}return true;}
  return true;}};
}
