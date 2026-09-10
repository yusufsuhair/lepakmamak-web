// Shared geometry keeps server seating, swimming and the rooftop renderer in agreement.
export const SKY={x:-106,z:37,y:44,hx:18,hz:16,entry:{x:-94,z:57},landing:{x:-92,z:49},pool:{x:-106,z:27,hx:9,hz:4}};
export const onSky=(p)=>Math.abs(p.x-SKY.x)<SKY.hx&&Math.abs(p.z-SKY.z)<SKY.hz;
export const inSkyPool=(p)=>Math.abs(p.x-SKY.pool.x)<SKY.pool.hx&&Math.abs(p.z-SKY.pool.z)<SKY.pool.hz;
export const skyHeight=(p)=>SKY.y-(inSkyPool(p)?1.15:0);
export function skyTravel(player){
 if(player.passengerOf||player.riding||player.seated||player.chairId||player.resting||player.parkRide||player.lrtId!=null||player.jumpHeight>0)return false;
 const upstairs=player.skyDining===true,door=upstairs?SKY.landing:SKY.entry;
 if(Math.hypot(player.x-door.x,player.z-door.z)>(upstairs?1:3))return false;
 const destination=upstairs?SKY.entry:SKY.landing;
 Object.assign(player,destination,{skyDining:!upstairs,y:upstairs?0:SKY.y,liftId:null,speed:0,jumpHeight:0});return true;
}
