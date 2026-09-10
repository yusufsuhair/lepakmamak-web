import seeds from '../shared/fleet.json' with {type:'json'};

// One authoritative fleet per room. Claims are synchronous and cannot race.
export function createFleet(send,broadcast){
  const rooms=new WeakMap();
  const seedYaw=s=>s.axis==='z'?(s.direction<0?Math.PI:0):s.direction*Math.PI/2;
  function cars(players){if(!rooms.has(players))rooms.set(players,seeds.map(s=>({...s,owner:null,yaw:seedYaw(s)})));return rooms.get(players);}
  // A dismounted car stays exactly where it was left so a friend can take it over, but a
  // traffic car cannot stay there for good. Clearing the owner alone left npc false and
  // speed 0 for the life of the room: the car became a permanent obstacle and every car
  // behind it stalled on the 3.8m gap check, so traffic thinned out with every Cilok. The
  // room only resets when it empties, which a busy city never does.
  const RETURN_AFTER=90000;
  function retire(car,now=Date.now()){
    const seed=seeds.find(s=>s.id===car.id);
    car.owner=null;car.speed=0;car.npc=false;
    car.returnAt=seed.npc?now+RETURN_AFTER:null;
  }
  // Back to its own lane and facing rather than driving off from wherever it was parked,
  // which would send it through whatever the last driver left it next to.
  function returnToTraffic(car){
    const seed=seeds.find(s=>s.id===car.id);
    car.npc=true;car.speed=seed.speed;car.yaw=seedYaw(seed);car.returnAt=null;
    if(seed.axis==='z')car.x=seed.x;else car.z=seed.z;
  }
  // Rounded on the way out only: car.x keeps full precision, so the 100ms integration in tick()
  // never accumulates the error. A centimetre is far below what the client can show — it eases
  // toward this position on a 71ms curve — and trimming the float noise off 24 cars, ten times a
  // second, is 12% of the whole idle egress of an empty city.
  const place=v=>Math.round(v*100)/100, turn=v=>Math.round(v*1000)/1000;
  function sync(players,ws){const message={type:'fleet',cars:cars(players).map(({id,x,z,yaw,owner,npc})=>({id,x:place(x),z:place(z),yaw:turn(yaw),owner,npc}))};if(ws)send(ws,message);else broadcast(players,message);}
  function release(players,player){const car=cars(players).find(c=>c.owner===player.id);if(car)retire(car);player.fleetId=null;}
  function handle(players,player,message,now=Date.now()){
    if(message.type!=='car-claim')return false;
    const car=cars(players).find(c=>c.id===message.id);
    // The client greys the button out; this is what makes it true. Style, not id, so a
    // Lamborghini added to the fleet later is covered without anyone remembering to.
    if(car&&car.style==='lamborghini'){send(player.ws,{type:'notice',code:'CAR_CLAIM_DENIED',message:'Tak bole. Kereta ni bukan untuk cilok.'});return true;}
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
  function tick(players,dt,now=Date.now()){for(const car of cars(players)){
    if(car.owner){if(!players.has(car.owner))retire(car,now);continue;}
    if(!car.npc){if(car.returnAt&&now>=car.returnAt)returnToTraffic(car);else continue;}
    const ax=car.x+(car.axis==='x'?car.direction*6:0),az=car.z+(car.axis==='z'?car.direction*6:0);
    if([...players.values()].some(p=>p.lrtId==null&&Math.hypot(p.x-ax,p.z-az)<5)||cars(players).some(c=>c!==car&&Math.hypot(c.x-ax,c.z-az)<3.8))continue;
    car[car.axis]+=car.speed*car.direction*dt;
    if(car[car.axis]>150)car[car.axis]=-150;if(car[car.axis]<-150)car[car.axis]=150;
  }sync(players);}
  return {sync,handle,release,updatePlayer,tick};
}
