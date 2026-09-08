export type SavedLocation = {x:number;z:number;yaw:number};
export function locationKey(room:string,account:string){return `lepakmamak-location:${encodeURIComponent(room)}:${encodeURIComponent(account)}`;}
export function readLocation(key:string):SavedLocation|null{
 try{const p=JSON.parse(localStorage.getItem(key)||'null');return p&&[p.x,p.z,p.yaw].every(Number.isFinite)&&Math.abs(p.x)<=151&&Math.abs(p.z)<=151?{x:p.x,z:p.z,yaw:p.yaw}:null;}catch{return null;}
}
export function writeLocation(key:string,p:SavedLocation){try{localStorage.setItem(key,JSON.stringify({x:Math.max(-151,Math.min(151,p.x)),z:Math.max(-151,Math.min(151,p.z)),yaw:p.yaw}));}catch{/* Storage may be unavailable. */}}
