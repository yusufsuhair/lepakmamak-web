import {parkAttractions,automated,parkPose,parkExit,rideDuration} from '../shared/legoland.mjs';
export function createPark(send,now=Date.now){
 function leave(player,complete=false){const a=parkAttractions[player.parkRide?.id];if(!a)return;Object.assign(player,parkExit(a),{parkRide:null,speed:0,jumpHeight:0});if(complete)send(player.ws,{type:'park-complete',id:String(a.id)});}
 return{
  locked(player){const a=parkAttractions[player.parkRide?.id];return a&&automated(a);},
  tick(players){let changed=false;for(const player of players.values()){const ride=player.parkRide;if(!ride)continue;const a=parkAttractions[ride.id];if(!a){player.parkRide=null;continue;}if(automated(a)){const progress=(now()-ride.startedAt)/1000/rideDuration(a);if(progress>=1)leave(player,true);else Object.assign(player,parkPose(a,progress),{speed:0,jumpHeight:0});player.updatedAt=now();changed=true;}else{const exit=parkExit(a);if(Math.hypot(player.x-exit.x,player.z-exit.z)>48){leave(player);changed=true;}}}return changed;},
  handle(players,player,message){
   if(!['park-enter','park-leave'].includes(message.type))return false;
   if(message.type==='park-leave'){leave(player);return true;}
   const a=Number.isInteger(message.id)?parkAttractions[message.id]:null;
   const entrance=a&&parkExit(a);
   if(!a||!entrance||player.parkRide||player.riding||player.passengerOf||player.chairId||player.resting||player.lrtId!=null||(player.danceUntil||0)>now()||Math.hypot(player.x-entrance.x,player.z-entrance.z)>18){send(player.ws,{type:'notice',message:'Datang ke pintu tarikan dengan berjalan dahulu.'});return true;}
   if([...players.values()].some(p=>p.parkRide?.id===a.id)){send(player.ws,{type:'notice',message:'Tarikan sedang digunakan. Tunggu giliran sebentar.'});return true;}
   player.parkRide={id:a.id,startedAt:now()};player.y=0;player.jumpHeight=0;player.speed=0;
   if(automated(a))Object.assign(player,parkPose(a,0));
   return true;
  }
 };
}
