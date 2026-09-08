import fields from '../shared/profile-fields.json' with {type:'json'};
import {filterChat} from './chat-filter.mjs';
export function cleanProfile(value) {
 return Object.fromEntries(fields.map(({key,max})=>[key,filterChat(typeof value?.[key]==='string'?value[key].normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'')]));
}
export function publicProfile(player) {
 return {id:player.id,name:player.name,registered:!!player.userId,gameMaster:!!player.gameMaster,details:player.userId?cleanProfile(player.profile):null};
}
