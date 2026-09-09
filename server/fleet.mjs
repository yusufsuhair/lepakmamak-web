import seeds from '../shared/fleet.json' with {type:'json'};

// One authoritative fleet per room. Claims are synchronous and cannot race.
export function createFleet(send,broadcast){
  const rooms=new WeakMap();
  function cars(players){if(!rooms.has(players))rooms.set(players,seeds.map(s=>({...s,owner:null,yaw:s.axis==='z'?(s.direction<0?Math.PI:0):s.direction*Math.PI/2})));return rooms.get(players);}
  function sync(players,ws){const message={type:'fleet',cars:cars(players).map(({id,x,z,yaw,owner,npc})=>({id,x,z,yaw,owner,npc}))};if(ws)send(ws,message);else broadcast(players,message);}
  function release(players,player){const car=cars(players).find(c=>c.owner===player.id);if(car){car.owner=null;car.speed=0;car.npc=false;}player.fleetId=null;}
  function handle(players,player,message,now=Date.now()){
    if(message.type!=='car-claim')return false;
    const car=cars(players).find(c=>c.id===message.id);
    // The visible car trails its server position. Leave room for interpolation,
    // a moving target and the click's network round trip (UI range is 4.8m).
    if(!car||car.owner||player.riding||player.passengerOf||player.chairId||player.jumpHeight>0||(player.danceUntil||0)>now||Math.hypot(player.x-car.x,player.z-car.z)>7){send(player.ws,{type:'notice',code:'CAR_CLAIM_DENIED',message:car?.owner?'Kereta ini sudah dipandu pemain lain.':'Dekat lagi dengan kereta, kemudian cuba Cilok semula.'});return true;}
    const angry=car.npc;
    car.owner=player.id;car.npc=false;car.speed=0;
    player.fleetId=car.id;player.carStyle=car.style;player.riding=true;player.vehicle='car';player.speed=0;player.x=car.x;player.z=car.z;player.yaw=car.yaw;
    send(player.ws,{type:'car-claimed',car});sync(players);
    if(angry)broadcast(players,{type:'car-angry',x:car.x,z:car.z,yaw:car.yaw});
    return true;
  }
  function updatePlayer(players,player){const car=cars(players).find(c=>c.owner===player.id);if(!car)return;
    if(!player.riding||player.vehicle!=='car'){release(players,player);return;}
    car.x=player.x;car.z=player.z;car.yaw=player.yaw;
  }
  function tick(players,dt){for(const car of cars(players)){
    if(car.owner){if(!players.has(car.owner)){car.owner=null;car.npc=false;car.speed=0;}continue;}
    if(!car.npc)continue;
    const ax=car.x+(car.axis==='x'?car.direction*6:0),az=car.z+(car.axis==='z'?car.direction*6:0);
    if([...players.values()].some(p=>p.lrtId==null&&Math.hypot(p.x-ax,p.z-az)<5)||cars(players).some(c=>c!==car&&Math.hypot(c.x-ax,c.z-az)<3.8))continue;
    car[car.axis]+=car.speed*car.direction*dt;
    if(car[car.axis]>150)car[car.axis]=-150;if(car[car.axis]<-150)car[car.axis]=150;
  }sync(players);}
  return {sync,handle,release,updatePlayer,tick};
}
