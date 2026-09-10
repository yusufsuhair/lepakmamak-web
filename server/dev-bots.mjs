import crypto from 'node:crypto';

const environmentAllowsTools = () => process.env.RAILWAY_ENVIRONMENT_NAME === 'development' || process.env.ALLOW_DEV_TOOLS === 'true';
const palette = ['#dafa8e','#f4a06c','#72c8ba','#e4bd66','#d58ca0','#9cace0'];
const skins = ['#efc6a0','#cf986c','#b98157','#8b583d','#593b30'];
const hairs = ['#202c2b','#654331','#d8b66c','#a64f34','#79549b'];
const shirts = ['#ef734c','#62876b','#628fbb','#c9779c','#eee2c6','#29363b'];
const silentSocket = {readyState:1,bufferedAmount:0,send(){},close(){}};

export function createDevBots(maxPlayers=100,enabled=environmentAllowsTools()){
 function remove(players,ownerId){let removed=0;for(const [id,bot] of players)if(bot.devBotOwner===ownerId){players.delete(id);removed++;}return removed;}
 return {enabled,remove,handle(players,owner,message){
  if(!message?.type?.startsWith('dev-'))return false;
  if(!enabled)return true;
  if(message.type==='dev-remove-bots')return {changed:remove(players,owner.id),message:'Semua test users anda telah dibuang.'};
  if(message.type!=='dev-spawn-bots')return true;
  const requested=Math.max(1,Math.min(30,Math.floor(Number(message.count)||1)));
  const count=Math.min(requested,Math.max(0,maxPlayers-players.size));
  for(let index=0;index<count;index++){
   const id=`dev-${crypto.randomUUID()}`,angle=(index/count)*Math.PI*2,radius=2.4+(index%3)*1.15;
   players.set(id,{id,ws:silentSocket,name:`Test User ${index+1}`,guest:true,gameMaster:false,userId:null,accessories:[],muted:false,
    appearance:{gender:index%2?'female':'male',hairstyle:index%3===2?'ponytail':index%3===1?'bob':'short',hair:hairs[index%hairs.length],skin:skins[index%skins.length],shirt:shirts[index%shirts.length],trousers:'#253a40'},
    color:palette[index%palette.length],x:owner.x+Math.sin(angle)*radius,z:owner.z+Math.cos(angle)*radius,yaw:angle+Math.PI,riding:false,vehicle:'bike',passengerOf:null,seatIndex:null,speed:0,y:0,liftId:null,jumpHeight:0,seated:false,chairId:null,resting:null,restSpotId:null,
    mic:message.mic===true,speaker:message.speaker===true,deflate:false,opus:false,supermanUntil:0,updatedAt:Date.now(),devBot:true,devBotOwner:owner.id});
  }
  return {changed:count,message:count?`${count} test users spawned nearby.`:'City sudah penuh.'};
 }};
}
