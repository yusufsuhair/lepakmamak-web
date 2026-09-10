import locations from '../shared/tables.json' with {type:'json'};
import chairs from '../shared/chairs.json' with {type:'json'};
const tableForChair=new Map(chairs.map(c=>[c.id,c.tableId]));
export function createTableSocial(send, gameSummary=()=>({})){
 const previous=new WeakMap();
 return {sync(players,force=false){
  const games=gameSummary(players)||{};
  const tables=locations.map(t=>{const activeGames=games[t.id]||[];return {id:t.id,name:t.name,capacity:chairs.filter(c=>c.tableId===t.id).length,occupants:[...players.values()].filter(p=>tableForChair.get(p.chairId)===t.id).map(p=>({id:p.id,name:p.name,chairId:p.chairId,appearance:p.appearance})),activeGames,activeGame:activeGames.find(game=>game.phase==='playing')||activeGames[0]||null};});
  const key=JSON.stringify(tables);if(!force&&previous.get(players)===key)return;previous.set(players,key);for(const p of players.values())send(p.ws,{type:'tables',tables});
 },handle(_players,_player,message){return ['table-name','table-round','receipt','table-order','table-consume'].includes(message.type);}};
}
