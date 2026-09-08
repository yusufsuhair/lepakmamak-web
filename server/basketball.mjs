import court from '../shared/basketball.json' with {type:'json'};
export const inBasketball=p=>!p.riding&&!p.seated&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x-court.x)<=court.halfWidth+1&&Math.abs(p.z-court.z)<=court.halfLength+1;
export function createBasketball(send,now=Date.now,onScore=()=>{}){
 const rooms=new WeakMap();
 const fresh=()=>({holder:null,charge:0,shot:null,ball:{x:court.x,y:.25,z:court.z},scores:{},notice:'Dekati bola dan ambil. Tahan Shoot, lepas di zon hijau.',seq:0});
 function get(ps){if(!rooms.has(ps))rooms.set(ps,fresh());return rooms.get(ps);}
 function publish(ps,g){const scores=Object.values(g.scores).sort((a,b)=>b.points-a.points).slice(0,5);for(const p of ps.values())if(Math.hypot(p.x-court.x,p.z-court.z)<65)send(p.ws,{type:'basketball-state',game:{holder:g.holder,ball:g.ball,shooting:!!g.shot,scores,notice:g.notice}});}
 function release(g){g.holder=null;g.charge=0;g.ball.y=.25;}
 function tick(ps){let g=get(ps);const people=[...ps.values()].filter(inBasketball);
  if(!people.length&&(g.holder||g.shot||Object.keys(g.scores).length)){g=fresh();rooms.set(ps,g);}
  if(g.holder){const p=ps.get(g.holder);if(!p||!inBasketball(p))release(g);else{g.ball={x:p.x+Math.sin(p.yaw||0)*.45,z:p.z+Math.cos(p.yaw||0)*.45,y:.3+Math.abs(Math.sin(now()/100))*1.05};if(g.charge&&now()-g.charge>4000)g.charge=0;}}
  if(g.shot){const s=g.shot,t=Math.min(1.6,(now()-s.at)/1000),u=Math.min(1,t/1.15);g.ball={x:s.x+(s.tx-s.x)*u,z:s.z+(s.tz-s.z)*u,y:t<=1.15?1.65+(3.05-1.65)*u+3.6*Math.sin(Math.PI*u):Math.max(.25,3.05-(t-1.15)*7)};
   if(t>=1.15&&!s.scored){s.scored=true;if(s.good){const entry=g.scores[s.id]||(g.scores[s.id]={id:s.id,name:s.name,points:0});entry.points+=s.points;g.notice=`${s.name} masuk! +${s.points} mata`;const player=ps.get(s.id);if(player)onScore(player,s.points); }else g.notice='Tak masuk! Dekati bola untuk rebound.';}
   if(t>=1.6){g.ball.y=.25;g.shot=null;}
  }
  if(++g.seq%(g.holder||g.shot?2:10)===0)publish(ps,g);
 }
 return {tick,handle(ps,p,m){if(!['basketball-grab','basketball-charge','basketball-shoot','basketball-cancel'].includes(m.type))return false;tick(ps);if(!inBasketball(p))return true;const g=get(ps);
  if(m.type==='basketball-grab'){if(!g.holder&&!g.shot&&Math.hypot(p.x-g.ball.x,p.z-g.ball.z)<=court.radius){g.holder=p.id;g.notice=`${p.name} pegang bola · tahan Shoot dan lepas di zon hijau`;publish(ps,g);}return true;}
  if(g.holder!==p.id)return true;
  if(m.type==='basketball-charge'){if(!g.charge)g.charge=now();return true;}
  if(m.type==='basketball-cancel'){g.charge=0;return true;}
  const hoopZ=court.z+(p.z<court.z?-court.hoopOffset:court.hoopOffset),distance=Math.hypot(p.x-court.x,p.z-hoopZ),held=g.charge?now()-g.charge:0;
  const good=distance<=3||held>=600&&held<=1000;g.shot={id:p.id,name:p.name,x:p.x,z:p.z,tx:court.x+(good?0:1.7),tz:hoopZ,at:now(),good,points:distance>=6.75?3:2,scored:false};g.holder=null;g.charge=0;g.notice='Bola di udara…';publish(ps,g);return true;
 }};
}
