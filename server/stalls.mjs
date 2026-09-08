import stalls from '../shared/stalls.json' with {type:'json'};
export function createStalls(send){
 const cooldown=new WeakMap();
 return function handle(players,player,message){
  if(!['stall-order','stall-consume'].includes(message.type))return false;
  const now=Date.now();if(now-(cooldown.get(player)||0)<1000)return true;
  cooldown.set(player,now);
  let text='';
  if(message.type==='stall-consume'){
   if(!player.snack)return true;
   const item=stalls.flatMap(s=>s.items).find(i=>i.id===player.snack);player.snack=null;
   text=item?.kind==='drink'?'Fuh, sejuk! Lega tekak.':'Panas-panas memang sedap!';
  }else{
   const stall=stalls.find(s=>s.id===message.stallId),item=stall?.items.find(i=>i.id===message.itemId);
   if(!stall||!item)return true;
   if(player.riding||player.seated||Math.hypot(player.x-stall.x,player.z-stall.z)>5){send(player.ws,{type:'notice',message:'Datang dekat gerai dengan berjalan kaki untuk pesan.'});return true;}
   if(player.snack){send(player.ws,{type:'notice',message:'Habiskan pesanan yang ada dulu, ya!'});return true;}
   player.snack=item.id;text=`Saya ambil ${item.name.toLowerCase()}!`;
  }
  for(const p of players.values())if(Math.hypot(p.x-player.x,p.z-player.z)<=15)send(p.ws,{type:'stall-action',id:player.id,name:player.name,text});
  return true;
 };
}
