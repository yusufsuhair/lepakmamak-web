export const worldAreas:{minX:number;maxX:number;minZ:number;maxZ:number}[];
export function insideWorld(x:number,z:number,radius?:number):boolean;
export function clampWorldPoint(x:number,z:number,radius?:number):{x:number;z:number};
