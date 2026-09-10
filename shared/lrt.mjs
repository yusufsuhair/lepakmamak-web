const arc=14*Math.PI/2;
export const trackLength=488+4*arc;
export const railHeight=11;
export const stations=[
 {id:'lrt-klcc',name:'KLCC',distance:36,x:-32,z:-73},
 {id:'lrt-ampang',name:'Ampang Park',distance:100,x:32,z:-73},
 {id:'lrt-trx',name:'TRX',distance:150+arc,x:85,z:-30},
 {id:'lrt-timur',name:'Mamak Timur',distance:210+arc,x:85,z:30},
 {id:'lrt-busking',name:'Busking Sentral',distance:274+2*arc,x:32,z:87},
 {id:'lrt-mamak',name:'Mamak Maju',distance:338+2*arc,x:-32,z:87},
 {id:'lrt-rembayung',name:'Rembayung',distance:408+3*arc,x:-91,z:30},
 {id:'lrt-zoo',name:'Zoo & Kampung',distance:468+3*arc,x:-91,z:-30},
];
export function trackPoint(distance){
 let d=((distance%trackLength)+trackLength)%trackLength;
 const line=(x,z,dx,dz)=>({x:x+dx*d,z:z+dz*d,yaw:Math.atan2(dx,dz)});
 const curve=(x,z,start)=>{const a=start+d/14;return{x:x+14*Math.cos(a),z:z+14*Math.sin(a),yaw:Math.atan2(-Math.sin(a),Math.cos(a))};};
 if(d<130)return line(-68,-64,1,0);d-=130;
 if(d<arc)return curve(62,-50,-Math.PI/2);d-=arc;
 if(d<114)return line(76,-50,0,1);d-=114;
 if(d<arc)return curve(62,64,0);d-=arc;
 if(d<130)return line(62,78,-1,0);d-=130;
 if(d<arc)return curve(-68,64,Math.PI/2);d-=arc;
 if(d<114)return line(-82,64,0,-1);d-=114;
 return curve(-68,-50,Math.PI);
}
const legs=stations.map((s,i)=>{const distance=(stations[(i+1)%stations.length].distance-s.distance+trackLength)%trackLength;return{distance,travel:distance/9+3};});
export const cycleSeconds=legs.reduce((n,l)=>n+12+l.travel,0);
export function arrivalIn(station,now=Date.now()){
 const start=legs.slice(0,station).reduce((n,l)=>n+12+l.travel,0)+1;
 return Math.ceil(Math.min(...[0,1].map(id=>{const state=trainState(id,now);if(state.station===station&&state.doors)return 0;const phase=((now/1000+id*cycleSeconds/2)%cycleSeconds+cycleSeconds)%cycleSeconds;return(start-phase+cycleSeconds)%cycleSeconds;})));
}
export function trainState(id,now=Date.now()){
 let t=((now/1000+id*cycleSeconds/2)%cycleSeconds+cycleSeconds)%cycleSeconds;
 for(let i=0;i<stations.length;i++){
  const leg=legs[i],station=stations[i];
  if(t<12)return{id,distance:station.distance,station:i,next:(i+1)%stations.length,doors:t>1&&t<10,remaining:12-t,speed:0};
  t-=12;
  if(t<leg.travel){const u=t/leg.travel,smooth=u*u*(3-2*u);return{id,distance:station.distance+leg.distance*smooth,station:-1,next:(i+1)%stations.length,doors:false,remaining:leg.travel-t,speed:leg.distance*6*u*(1-u)/leg.travel};}
  t-=leg.travel;
 }
 return{id,distance:stations[0].distance,station:0,next:1,doors:false,remaining:0,speed:0};
}
// How far you can move inside a coach before you are standing in a wall. Coaches sit 12
// apart, so 4.4 along keeps you inside your own one.
export const COACH={along:4.4,across:1.05};
export const clampCoach=(along,across)=>({
 along:Math.max(-COACH.along,Math.min(COACH.along,Number(along)||0)),
 across:Math.max(-COACH.across,Math.min(COACH.across,Number(across)||0)),
});

// Where a rider is, in the world, given where they are standing inside their coach. The
// train's own position comes from the shared clock, so everybody draws the same carriage
// in the same place and only the small offset has to travel.
export function coachPoint(train,coach,along,across,now=Date.now()){
 const state=trainState(train,now),p=trackPoint(state.distance+18-coach*12);
 return{x:p.x+Math.cos(p.yaw)*across+Math.sin(p.yaw)*along,z:p.z-Math.sin(p.yaw)*across+Math.cos(p.yaw)*along,y:railHeight+.85,yaw:p.yaw};
}
// Where a seat is: the spot you are put in when you board, before you get up and walk.
export function seatOffset(seat){
 const slot=seat%6;
 return{along:(Math.floor(slot/2)-1)*2,across:slot%2?.9:-.9};
}
export function passengerPoint(train,seat,now=Date.now()){
 const {along,across}=seatOffset(seat);
 return coachPoint(train,Math.floor(seat/6),along,across,now);
}
// Where a rider actually is: their own offset once they have moved, the seat until then.
export function riderPoint(player,now=Date.now()){
 const seat=player.lrtSeat||0;
 const walked=player.lrtAlong!=null||player.lrtAcross!=null;
 const {along,across}=walked?clampCoach(player.lrtAlong,player.lrtAcross):seatOffset(seat);
 return coachPoint(player.lrtId,Math.floor(seat/6),along,across,now);
}
