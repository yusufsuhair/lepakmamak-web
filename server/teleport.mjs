import destinations from '../shared/teleports.json' with {type:'json'};
export function teleportPlayer(player,message,now=Date.now()){
 const destination=destinations.find(p=>p.id===message.id);
 if(!destination||player.riding||player.passengerOf||now-(player.lastTeleport||0)<3000)return null;
 player.lastTeleport=now;player.chairId=null;player.seated=false;delete player.chairStand;
 player.x=destination.x;player.z=destination.z;player.speed=0;player.jumpHeight=0;player.danceUntil=0;player.supermanUntil=0;
 return destination;
}
