export const railHeight:number;
export const trackLength:number;
export const cycleSeconds:number;
export function arrivalIn(station:number,now?:number):number;
export const stations:{id:string;name:string;distance:number;x:number;z:number}[];
export function trackPoint(distance:number):{x:number;z:number;yaw:number};
export function trainState(id:number,now?:number):{id:number;distance:number;station:number;next:number;doors:boolean;remaining:number;speed:number};
export function passengerPoint(train:number,seat:number,now?:number):{x:number;z:number;y:number;yaw:number};
