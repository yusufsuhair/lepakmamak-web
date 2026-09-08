import chairs from '../shared/chairs.json' with {type:'json'};
import {randomInt} from 'node:crypto';
const words=['nasi lemak','teh tarik','roti canai','durian','kucing','payung','basikal','kereta','KLCC','bola','pisang','ikan','rumah','pokok','ais krim','cermin mata','selipar','kopi','bunga','telefon'];
const tableOf=p=>chairs.find(c=>c.id===p.chairId)?.tableId;
const normal=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function createLukis(send){
 const games=new WeakMap();
 const members=(ps,id)=>[...ps.values()].filter(p=>tableOf(p)===id);
 function state(ps,g){for(const p of members(ps,g.tableId))send(p.ws,{type:'lukis-state',game:{tableId:g.tableId,phase:g.phase,drawer:g.drawer,round:g.round,total:g.order.length,ends:g.ends,word:g.phase==='drawing'&&p.id!==g.drawer?'_ '.repeat(g.word.replace(/ /g,'').length).trim():g.word,scores:g.order.map(id=>({id,name:g.names[id],score:g.scores[id]})),lines:g.lines,solved:g.solved}});}
 function next(g){g.round++;g.lines=[];g.solved=[];if(g.round>g.order.length){g.phase='finished';g.ends=0;return;}g.drawer=g.order[g.round-1];g.word=words[randomInt(words.length)];g.phase='drawing';g.ends=Date.now()+60000;}
 function tick(ps){const map=games.get(ps);if(!map)return;for(const [id,g] of map){const people=members(ps,id);if(people.length<2){map.delete(id);for(const p of people)send(p.ws,{type:'lukis-state',game:null});continue;}if(g.phase==='drawing'&&(Date.now()>=g.ends||!people.some(p=>p.id===g.drawer))){g.phase='reveal';g.ends=Date.now()+5000;state(ps,g);}else if(g.phase==='reveal'&&Date.now()>=g.ends){next(g);state(ps,g);}}}
 return {tick,handle(ps,p,m){if(!['lukis-open','lukis-start','lukis-line','lukis-clear','lukis-guess'].includes(m.type))return false;tick(ps);const id=tableOf(p);if(!id){send(p.ws,{type:'notice',message:'Duduk semeja dahulu untuk Lukis Lah!'});return true;}if(!games.has(ps))games.set(ps,new Map());const map=games.get(ps);let g=map.get(id);const people=members(ps,id);
 if(m.type==='lukis-start'){if(people.length<2){send(p.ws,{type:'notice',message:'Ajak sekurang-kurangnya seorang lagi duduk semeja.'});return true;}if(g&&g.phase!=='finished')return true;g={tableId:id,order:people.map(p=>p.id),names:Object.fromEntries(people.map(p=>[p.id,p.name])),scores:Object.fromEntries(people.map(p=>[p.id,0])),round:0,lines:[],solved:[],word:'',phase:'',ends:0};map.set(id,g);next(g);state(ps,g);return true;}
 if(m.type==='lukis-open'){if(g)state(ps,g);else send(p.ws,{type:'lukis-state',game:null});return true;}if(!g||g.phase!=='drawing')return true;
 if(m.type==='lukis-line'&&g.drawer===p.id){if(g.lines.length>=2400||Date.now()-(g.lastLine||0)<12)return true;const a=m.line;if(!Array.isArray(a)||a.length!==6||!a.slice(0,4).every(n=>Number.isFinite(n)&&n>=0&&n<=1)||!['#20382e','#e34b4b','#327bd1','#2caa68','#e9b52c','#ffffff'].includes(a[4])||![3,7,14].includes(a[5]))return true;g.lastLine=Date.now();g.lines.push(a);for(const q of people)send(q.ws,{type:'lukis-line',line:a});}
 if(m.type==='lukis-clear'&&g.drawer===p.id&&Date.now()-(g.lastClear||0)>1000){g.lastClear=Date.now();g.lines=[];state(ps,g);}
 if(m.type==='lukis-guess'&&p.id!==g.drawer&&g.order.includes(p.id)&&!g.solved.includes(p.id)&&typeof m.text==='string'&&m.text.length<=60){if(Date.now()-(p.lukisGuessAt||0)<700)return true;p.lukisGuessAt=Date.now();if(normal(m.text)===normal(g.word)){g.solved.push(p.id);g.scores[p.id]+=100+Math.ceil(Math.max(0,g.ends-Date.now())/1000);g.scores[g.drawer]+=50;if(g.solved.length>=g.order.filter(id=>id!==g.drawer&&people.some(p=>p.id===id)).length){g.phase='reveal';g.ends=Date.now()+5000;}state(ps,g);}else send(p.ws,{type:'notice',message:'Belum tepat. Cuba lagi!'});}
 return true;}};
}
