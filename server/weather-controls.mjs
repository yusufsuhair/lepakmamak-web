export function createWeatherControls(send,broadcast){
 const states=new WeakMap();
 const live=()=>({condition:'live',daylight:'live'});
 return {
  sync(players,ws){send(ws,{type:'weather-override',override:states.get(players)||live()});},
  handle(players,player,message){
   if(message.type!=='weather-set')return false;
   if(player.gameMaster!==true){send(player.ws,{type:'notice',message:'Only the Game Master can change room weather.'});return true;}
   const {condition,daylight}=message;
   if(!['live','sunny','cloudy','rain','haze','fog'].includes(condition)||!['live','day','night'].includes(daylight))return true;
   const override={condition,daylight};states.set(players,override);
   broadcast(players,{type:'weather-override',override});return true;
  }
 };
}
