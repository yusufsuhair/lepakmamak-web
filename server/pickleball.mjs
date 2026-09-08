import court from '../shared/pickleball.json' with {type:'json'};
export const inCourt=p=>!p.riding&&!p.seated&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x-court.x)<=court.apronWidth&&Math.abs(p.z-court.z)<=court.apronLength;
export function createPickleball(send){
 const rooms=new WeakMap(),cooldown=new WeakMap();
 function game(ps){if(!rooms.has(ps))rooms.set(ps,{ball:null,score:[0,0],lastSide:0,bounces:0,serve:0,until:0,notice:'Masuk court · klik / tap untuk serve',seq:0});return rooms.get(ps);}
 function publish(ps,g){for(const p of ps.values())if(Math.hypot(p.x-court.x,p.z-court.z)<70)send(p.ws,{type:'pickleball-state',game:{ball:g.ball?{x:g.ball.x,y:g.ball.y,z:g.ball.z}:null,score:g.score,serve:g.serve,notice:g.notice}});}
 function point(g,side){g.score[side]++;g.ball=null;g.serve=side;g.until=Date.now()+1600;g.notice=`Mata ${side===0?'Biru':'Jingga'}! Klik untuk serve.`;if(g.score[side]>=11&&g.score[side]-g.score[1-side]>=2){g.notice=`${side===0?'Biru':'Jingga'} menang! Game baharu sebentar lagi.`;g.until=Date.now()+6000;g.reset=true;}}
 return {tick(ps){const g=game(ps);if(![...ps.values()].some(inCourt)){g.ball=null;g.score=[0,0];g.reset=false;g.until=0;g.notice='Masuk court · klik / tap untuk serve';}
  if(g.reset&&Date.now()>=g.until){g.score=[0,0];g.reset=false;g.notice='Game baharu · klik / tap untuk serve';}
  if(g.ball){const b=g.ball,previousZ=b.z;b.x+=b.vx*.05;b.z+=b.vz*.05;b.vy-=5*.05;b.y+=b.vy*.05;
   if((previousZ-court.z)*(b.z-court.z)<=0&&b.y<1.1&&Math.abs(b.x-court.x)<3.5)point(g,1-g.lastSide);
   else if(Math.abs(b.x-court.x)>court.apronWidth+2||Math.abs(b.z-court.z)>court.apronLength+2)point(g,g.bounces>0?g.lastSide:1-g.lastSide);
   else if(b.y<=.22){const side=b.z<court.z?0:1;if(g.bounces===0&&(Math.abs(b.x-court.x)>court.halfWidth||Math.abs(b.z-court.z)>court.halfLength||side===g.lastSide))point(g,1-g.lastSide);else if(++g.bounces>=2)point(g,g.lastSide);else{b.y=.22;b.vy=3;}}
  }if(++g.seq%2===0)publish(ps,g);
 },handle(ps,p,m){if(m.type!=='pickleball-hit')return false;if(!inCourt(p)||Date.now()-(cooldown.get(p)||0)<350)return true;cooldown.set(p,Date.now());const g=game(ps),side=p.z<court.z?0:1;if(Date.now()<g.until)return true;
  if(g.ball&&(g.lastSide===side||Math.hypot(p.x-g.ball.x,p.z-g.ball.z)>2.7||g.ball.y>2.8))return true;
  if(!g.ball&&g.score.some(Boolean)&&side!==g.serve){send(p.ws,{type:'notice',message:`Serve dari bahagian ${g.serve===0?'Biru':'Jingga'}.`});return true;}
  const x=g.ball?.x??Math.max(court.x-court.halfWidth+.3,Math.min(court.x+court.halfWidth-.3,p.x)),z=g.ball?.z??(court.z+(side===0?-5:5));
  const y=g.ball?.y??1,travel=1.4,targetX=court.x+Math.max(-2.4,Math.min(2.4,Math.sin(p.yaw||0)*2.4)),targetZ=court.z+(side===0?4.8:-4.8);
  g.ball={x,y,z,vx:(targetX-x)/travel,vz:(targetZ-z)/travel,vy:(.35-y+2.5*travel*travel)/travel};g.lastSide=side;g.bounces=0;g.notice='Rally! Dekati bola dan pukul sebelum lantunan kedua.';
  for(const q of ps.values())if(Math.hypot(q.x-court.x,q.z-court.z)<70)send(q.ws,{type:'pickleball-swing',id:p.id});publish(ps,g);return true;
 }};
}
