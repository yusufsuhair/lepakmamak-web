type Point={x:number;z:number};
export const SKY:Point&{y:number;hx:number;hz:number;entry:Point;landing:Point;pool:Point&{hx:number;hz:number}};
export function onSky(point:Point):boolean;
export function inSkyPool(point:Point):boolean;
export function skyHeight(point:Point):number;
export function skyTravel(player:Record<string,unknown>):boolean;
