export const worldAreas=[{minX:-153,maxX:153,minZ:-153,maxZ:153},{minX:-525,maxX:-175,minZ:-290,maxZ:180},{minX:-200,maxX:-145,minZ:-9,maxZ:9}];
export function insideWorld(x,z,radius=0){return Number.isFinite(x)&&Number.isFinite(z)&&worldAreas.some(b=>x>=b.minX+radius&&x<=b.maxX-radius&&z>=b.minZ+radius&&z<=b.maxZ-radius);}
export function clampWorldPoint(x,z,radius=0){const choices=worldAreas.map(b=>({x:Math.max(b.minX+radius,Math.min(b.maxX-radius,x)),z:Math.max(b.minZ+radius,Math.min(b.maxZ-radius,z))}));return choices.sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];}
