import {stations,trainState,passengerPoint} from '../shared/lrt.mjs';
export function createLrt(send){
 function sync(players,now=Date.now()){for(const p of players.values())if(p.lrtId!=null){const point=passengerPoint(p.lrtId,p.lrtSeat,now);p.x=point.x;p.z=point.z;p.yaw=point.yaw;p.speed=trainState(p.lrtId,now).speed;}}
 function handle(players,p,m,now=Date.now()){
  if(m.type==='lrt-board'){
   const station=stations.findIndex(s=>s.id===m.station),id=m.train;
   if(station<0||![0,1].includes(id)||p.riding||p.passengerOf||p.chairId||p.jumpHeight>0||(p.danceUntil||0)>now||Math.hypot(p.x-stations[station].x,p.z-stations[station].z)>5)return true;
   const state=trainState(id,now),occupied=new Set([...players.values()].filter(q=>q.lrtId===id).map(q=>q.lrtSeat));let seat=0;while(occupied.has(seat))seat++;
   if(!state.doors||state.station!==station||seat>=24){send(p.ws,{type:'notice',message:'Tunggu tren berhenti dan pintu dibuka.'});return true;}
   p.lrtId=id;p.lrtSeat=seat;p.riding=true;p.vehicle='car';p.speed=0;p.jumpHeight=0;sync(players,now);send(p.ws,{type:'lrt-boarded',train:id,seat,serverTime:now});return true;
  }
  if(m.type==='lrt-exit'){
   if(p.lrtId==null)return true;const state=trainState(p.lrtId,now);
   if(!state.doors||state.station<0){send(p.ws,{type:'notice',message:'Turun apabila pintu dibuka di stesen.'});return true;}
   const station=stations[state.station];p.lrtId=null;p.lrtSeat=null;p.riding=false;p.speed=0;p.x=station.x;p.z=station.z;
   send(p.ws,{type:'lrt-exited',x:p.x,z:p.z});return true;
  }
  if(p.lrtId!=null&&['state','car-claim','passenger-join','passenger-leave','chair-sit','chair-stand','recall','punch','horn','dance','superman'].includes(m.type))return true;
  return false;
 }
 return{sync,handle};
}
