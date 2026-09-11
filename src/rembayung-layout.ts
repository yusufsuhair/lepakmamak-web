import profile from '../shared/rembayung.json';
import type {Point, Solid} from './physics';

export const REMBAYUNG = profile;
/** Blender +Y is depth; glTF +Z faces out of the front entrance. */
export function rembayungPoint(x:number,d:number):Point {
  return {x:profile.origin.x+x,z:profile.origin.z-d};
}

export function rembayungSolids():Solid[] {
  const solids:Solid[]=[];
  const rect=(id:string,x:number,d:number,hx:number,hd:number,yaw=0,top=7.5)=>{
    solids.push({id:`rembayung-${id}`,...rembayungPoint(x,d),hx,hz:hd,yaw,cameraTop:profile.origin.y+top});
  };
  rect('wall-left',-9,17,.14,17);rect('wall-right',9,17,.14,17);
  rect('wall-rear',0,34,9,.14,0,14.1);
  rect('facade-left',-5.25,0,3.75,.10,0,14.1);rect('facade-right',5.25,0,3.75,.10,0,14.1);
  for(const side of [-1,1])rect(`door-${side}`,side*1.2,.65,.03,.72,side*Math.atan2(.6,1.3),2.7);
  for(const furniture of profile.furniture)rect(furniture.id,furniture.x,furniture.d,furniture.hx,furniture.hd,0,furniture.top);
  rect('tree',0,15.9,.92,.92,0,6.5);
  rect('kuih-cabinet',-2.75,2.1,1.865,.46,0,1.85);
  rect('rear-pavilion',0,26.45,2.3,.16,0,3.3);
  for(const side of [-1,1]){
    for(const d of [4,10,16,22])rect(`planter-${side}-${d}`,side*8.2,d,.35,1.9,0,2.2);
    rect(`front-planter-${side}`,side*5.3,1.3,2.6,.35,0,2.2);
    for(const d of [9.85,20])rect(`slats-${side}-${d}`,side*6.5,d,1.75,.06,0,3.3);
  }
  // The thin pavilion screen behind the central tree is visible and solid.
  rect('central-screen',0,15.9,2.16,.035,0,3.3);
  // Same guard footprints at both heights: ground access under the gallery is closed.
  rect('gallery-front-left',-6,29.3,2.8,.045,0,5.16);
  rect('gallery-front-right',3.4,29.3,5.4,.045,0,5.16);
  // Slightly inset rail endpoints accommodate the avatar's conservative circle radius.
  rect('stair-front-guard',2.6,27.67,4.55,.045,0,5.16);
  rect('stair-rear-guard',2.6,29.03,4.55,.045,0,5.16);
  rect('landing-front',-2.72,27.67,.5,.045,0,5.16);
  rect('landing-left',-3.22,28.5,.045,.85,0,5.16);
  return solids;
}

/** Existing multiplayer state already carries ground height (0–6 m). */
export function rembayungGroundHeight(point:Point):number|null {
  const x=point.x-profile.origin.x,d=profile.origin.z-point.z;
  if(Math.abs(x)>9.15 || d<-.1 || d>34.1)return null;
  if(d>=29.29)return profile.mezzanineHeight;
  if(x>=-3.25 && x<=-2.20 && d>=27.6)return profile.mezzanineHeight;
  if(x>=-2.25 && x<=7.32 && d>=27.6 && d<=29.1){
    return Math.max(0,Math.min(profile.mezzanineHeight,(7.32-x)/9.57*profile.mezzanineHeight));
  }
  return 0;
}
