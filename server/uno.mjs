import {randomInt,randomUUID} from 'node:crypto';
import chairs from '../shared/chairs.json' with {type:'json'};

export const UNO_COLORS=['red','yellow','green','blue'];
export function unoDeck(){
 const cards=[];let id=0;
 for(const color of UNO_COLORS){cards.push({id:String(id++),color,value:'0'});for(let copy=0;copy<2;copy++)for(const value of ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2'])cards.push({id:String(id++),color,value});}
 for(let i=0;i<4;i++)for(const value of ['wild','draw4'])cards.push({id:String(id++),color:'wild',value});return cards;
}
export const unoPoints=c=>c.color==='wild'?50:['skip','reverse','draw2'].includes(c.value)?20:Number(c.value);
export function unoPlayable(card,top,color,hand){if(!card||!top)return false;if(card.value==='draw4')return !hand.some(c=>c.color===color);return card.color==='wild'||card.color===color||card.value===top.value;}
const tableOf=p=>chairs.find(c=>c.id===p.chairId)?.tableId;
const key=p=>p.userId||p.id;
export function createUno(send,now=Date.now,pick=randomInt){
 const rooms=new WeakMap();
 const fresh=tableId=>({id:randomUUID(),tableId,revision:0,phase:'lobby',round:0,players:[],host:null,deck:[],discard:[],color:'red',direction:1,turn:null,drawn:null,ends:0,event:null,eventId:0,unoTarget:null,winner:null,roundPoints:0,dry:0,target:500,breakdown:null});
 const members=(ps,id)=>[...ps.values()].filter(p=>tableOf(p)===id);
 function map(ps){if(!rooms.has(ps))rooms.set(ps,new Map());return rooms.get(ps);}
 const find=(g,id)=>g.players.find(p=>p.id===id);
 const active=g=>g.players.filter(p=>!p.left);
 const shuffle=cards=>{for(let i=cards.length-1;i>0;i--){const j=pick(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;};
 function event(g,type,text,who=null,count=0){g.event={id:++g.eventId,type,text,who,count};g.revision++;}
 function view(g,id){const me=find(g,id),top=g.discard.at(-1);return {id:g.id,tableId:g.tableId,revision:g.revision,phase:g.phase,round:g.round,host:g.host,self:id,turn:g.turn,direction:g.direction,color:g.color,top:top||null,ends:g.ends,serverTime:now(),event:g.event,winner:g.winner,roundPoints:g.roundPoints,target:g.target,breakdown:['round-over','finished'].includes(g.phase)?g.breakdown:null,unoTarget:g.unoTarget,drawn:me?.id===g.turn?g.drawn:null,hand:me&&!me.left?me.hand:[],players:g.players.map(p=>({id:p.id,name:p.name,count:p.hand.length,score:p.score,left:p.left,online:!p.missingAt,uno:p.uno})),playable:g.phase==='playing'&&g.turn===id&&me?me.hand.filter(c=>(!g.drawn||g.drawn===c.id)&&unoPlayable(c,top,g.color,me.hand)).map(c=>c.id):[]};}
 function publish(ps,g){for(const p of members(ps,g.tableId))send(p.ws,{type:'uno-state',game:view(g,key(p))});}
 function draw(g,p,count){let received=0;for(let i=0;i<count;i++){if(!g.deck.length&&g.discard.length>1){const top=g.discard.pop();g.deck=shuffle(g.discard);g.discard=[top];}if(!g.deck.length)break;p.hand.push(g.deck.pop());received++;}p.uno=false;return received;}
 function nextId(g,id,steps=1){const list=active(g);if(!list.length)return null;const start=list.findIndex(p=>p.id===id);return list[((start<0?0:start)+g.direction*steps%list.length+list.length)%list.length].id;}
 function turn(g,id){g.turn=id;g.drawn=null;g.ends=now()+25000;}
 function win(g,id,forfeit=false){g.winner=id;g.unoTarget=null;g.ends=0;g.turn=null;const player=find(g,id);const losers=g.players.filter(p=>p.id!==id&&!p.left);g.breakdown=forfeit?[]:losers.map(p=>({id:p.id,name:p.name,points:p.hand.reduce((n,c)=>n+unoPoints(c),0),cards:p.hand}));g.roundPoints=forfeit?0:g.breakdown.reduce((sum,r)=>sum+r.points,0);if(player)player.score+=g.roundPoints;g.phase=player?.score>=g.target?'finished':'round-over';event(g,'win',player?`${player.name} menang! +${g.roundPoints} mata${forfeit?' · lawan telah keluar':''}`:'Pusingan seri. Tiada kad boleh diambil.',id);}
 // 500 is the rulebook target for a full table of four. Two players need about eighteen
 // rounds to reach it — over an hour — and an abandoned match is nobody's rematch.
 const matchTarget=count=>[200,200,200,300,500][Math.min(4,count)]||500;
 function start(g){if(g.phase==='finished'){g.round=0;for(const p of g.players)p.score=0;}g.round++;g.deck=shuffle(unoDeck());g.discard=[];g.direction=1;g.drawn=null;g.unoTarget=null;g.winner=null;g.roundPoints=0;g.dry=0;g.players=g.players.filter(p=>!p.left);g.breakdown=null;g.target=matchTarget(g.players.length);for(const p of g.players){p.hand=[];p.uno=false;}for(let i=0;i<7;i++)for(const p of g.players)draw(g,p,1);let index=g.deck.findIndex(c=>/^\d$/.test(c.value));g.discard.push(g.deck.splice(index,1)[0]);g.color=g.discard[0].color;g.turn=g.players[(g.round-1)%g.players.length].id;g.phase='dealing';g.ends=now()+3200;event(g,'deal','Mengocok dan membahagi 7 kad kepada setiap pemain.');}
 function take(g,p){g.unoTarget=null;const count=draw(g,p,1);g.dry=count?0:g.dry+1;if(g.dry>=active(g).length){win(g,null);return;}if(count&&unoPlayable(p.hand.at(-1),g.discard.at(-1),g.color,p.hand)){g.drawn=p.hand.at(-1).id;g.ends=now()+25000;}else turn(g,nextId(g,p.id));event(g,'draw',`${p.name} ambil ${count} kad.`,p.id,count);}
 function depart(g,p){const next=g.turn===p.id?nextId(g,p.id):g.turn;p.left=true;p.missingAt=0;g.deck.push(...p.hand);shuffle(g.deck);p.hand=[];if(g.unoTarget===p.id)g.unoTarget=null;if(active(g).length<2){win(g,active(g)[0]?.id||null,true);}else{if(g.turn===p.id)turn(g,next);event(g,'leave',`${p.name} keluar dari pusingan.`,p.id);}}
 function tick(ps){const games=rooms.get(ps);if(!games)return;for(const g of games.values()){const present=new Set(members(ps,g.tableId).map(key));let changed=false;for(const p of [...g.players]){if(present.has(p.id)){if(p.missingAt){p.missingAt=0;changed=true;}}else if(['lobby','round-over','finished'].includes(g.phase)){g.players=g.players.filter(q=>q!==p);changed=true;}else if(!p.left){if(!p.missingAt){p.missingAt=now();changed=true;}if(now()-p.missingAt>=60000){depart(g,p);changed=true;}}}if(!g.players.some(p=>p.id===g.host&&!p.left&&present.has(p.id))){const host=g.players.find(p=>!p.left&&present.has(p.id))?.id||null;if(host!==g.host){g.host=host;changed=true;}}if(g.phase==='dealing'&&now()>=g.ends){g.phase='playing';turn(g,g.turn);event(g,'turn','Kad sedia. Jom main!',g.turn);changed=true;}else if(g.phase==='playing'&&now()>=g.ends){const p=find(g,g.turn);if(p){if(g.drawn){g.unoTarget=null;turn(g,nextId(g,p.id));event(g,'pass',`${p.name}: masa tamat, giliran seterusnya.`,p.id);}else{take(g,p);if(g.drawn)turn(g,nextId(g,p.id));}changed=true;}}if(changed){g.revision++;publish(ps,g);}if(!g.players.length&&!members(ps,g.tableId).length)games.delete(g.tableId);}}
 return {tick,canRematch(ps,p){return rooms.get(ps)?.get(tableOf(p))?.phase==='finished';},handle(ps,p,m){if(typeof m.type!=='string'||!m.type.startsWith('uno-'))return false;const tableId=tableOf(p);if(!tableId){send(p.ws,{type:'notice',message:'Duduk di meja untuk bermain UNO.'});return true;}tick(ps);const games=map(ps);if(!games.has(tableId))games.set(tableId,fresh(tableId));let g=games.get(tableId);const id=key(p),me=find(g,id);const reply=()=>send(p.ws,{type:'uno-state',game:view(g,id)});
  if(m.type==='uno-open'){reply();return true;}
  if(m.type==='uno-join'&&['lobby','round-over','finished'].includes(g.phase)){if(!me&&g.players.length<4){g.players.push({id,name:p.name,hand:[],score:0,uno:false,left:false,missingAt:0});g.host??=id;event(g,'join',`${p.name} sudah sedia.`);publish(ps,g);}else if(me?.left&&active(g).length<4){me.left=false;me.missingAt=0;event(g,'join',`${p.name} sudah sedia.`);publish(ps,g);}else reply();return true;}
  if(m.type==='uno-leave'&&me){if(['playing','dealing'].includes(g.phase)&&!me.left)depart(g,me);else g.players=g.players.filter(q=>q!==me);if(g.host===id)g.host=active(g)[0]?.id||null;publish(ps,g);return true;}
  if(m.type==='uno-start'&&g.host===id&&['lobby','round-over','finished'].includes(g.phase)&&active(g).length>=2){start(g);publish(ps,g);return true;}
  if(m.type==='uno-rematch'&&g.phase==='finished'&&g.host===id){g=fresh(tableId);games.set(tableId,g);publish(ps,g);return true;}
  if(g.phase!=='playing'||!me||me.left||m.gameId!==g.id||m.revision!==g.revision){reply();return true;}
  if(m.type==='uno-call'&&g.unoTarget===id){me.uno=true;g.unoTarget=null;event(g,'uno',`${me.name}: UNO!`,id);publish(ps,g);return true;}
  if(m.type==='uno-catch'&&g.unoTarget&&g.unoTarget!==id){const target=find(g,g.unoTarget);draw(g,target,2);g.unoTarget=null;event(g,'catch',`${target.name} terlupa UNO! +2 kad.`,target.id,2);publish(ps,g);return true;}
  if(g.turn!==id){reply();return true;}
  if(m.type==='uno-draw'&&!g.drawn){take(g,me);publish(ps,g);return true;}
  if(m.type==='uno-pass'&&g.drawn){g.unoTarget=null;turn(g,nextId(g,id));event(g,'pass',`${me.name} simpan kad.`,id);publish(ps,g);return true;}
  if(m.type==='uno-play'){const card=me.hand.find(c=>c.id===m.cardId);if(!card||g.drawn&&card.id!==g.drawn||!unoPlayable(card,g.discard.at(-1),g.color,me.hand)||card.color==='wild'&&!UNO_COLORS.includes(m.color)){reply();return true;}g.unoTarget=null;g.dry=0;me.hand=me.hand.filter(c=>c!==card);g.discard.push(card);g.color=card.color==='wild'?m.color:card.color;me.uno=me.hand.length===1&&m.uno===true;if(me.hand.length===1&&!me.uno)g.unoTarget=id;let next=nextId(g,id);if(card.value==='reverse'){g.direction*=-1;next=active(g).length===2?id:nextId(g,id);}else if(card.value==='skip')next=nextId(g,id,2);else if(['draw2','draw4'].includes(card.value)){const target=find(g,next);draw(g,target,card.value==='draw2'?2:4);next=nextId(g,id,2);}event(g,me.uno?'uno':'play',`${me.name} main ${card.value}${me.uno?' · UNO!':''}`,id);if(!me.hand.length)win(g,id);else turn(g,next);publish(ps,g);return true;}reply();return true;}};
}
