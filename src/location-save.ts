import {insideWorld,clampWorldPoint} from '../shared/world-bounds.mjs';
export type SavedLocation = {x:number;z:number;yaw:number};
export function locationKey(room:string,account:string){return `lepakmamak-location:${encodeURIComponent(room)}:${encodeURIComponent(account)}`;}
export function readLocation(key:string):SavedLocation|null{
 try{const p=JSON.parse(localStorage.getItem(key)||'null');return p&&[p.x,p.z,p.yaw].every(Number.isFinite)&&insideWorld(p.x,p.z,1)?{x:p.x,z:p.z,yaw:p.yaw}:null;}catch{return null;}
}
export function writeLocation(key:string,p:SavedLocation){try{localStorage.setItem(key,JSON.stringify({...clampWorldPoint(p.x,p.z,1),yaw:p.yaw}));}catch{/* Storage may be unavailable. */}}
