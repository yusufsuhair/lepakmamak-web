import {lands,attractions} from './legoland-data';
import {toParkLocal} from '../shared/legoland.mjs';

/** The west edge of the city is the physical entrance into the park. */
export const LEGOLAND_WORLD_MIN_X = -175;
export const LEGOLAND_MAP_BOUNDS = {minX: -195, maxX: 295, minZ: -185, maxZ: 185} as const;
/** The park zooms further than the city: on a phone its 47 names only separate close up. */
export const LEGOLAND_MAX_ZOOM = 4;

export type LegolandMapPlayer = {x:number;z:number;yaw?:number};
export type LegolandMapPeer = {x:number;z:number;name?:string;party?:boolean};
export type LegolandMapView = {panX?:number;panZ?:number};

export function isInLegoland(x:number){return Number.isFinite(x)&&x<LEGOLAND_WORLD_MIN_X;}

const LAND_WIDTH = 77;
const LAND_DEPTH = 74;
const KIND_COLOURS:Record<string,string>={
 coaster:'#f15b4f', boat:'#28b4c8', tower:'#8e63cf', spin:'#e5a92b', drive:'#3f80d3',
 shoot:'#db5a3d', build:'#6ca95b', slide:'#d96a9b', explore:'#f0c34f',
};

function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
 const radius=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);
 ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();
}

function label(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,colour='#173c32',maxWidth?:number,halo?:string){
 ctx.font=`700 ${size}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
 if(halo){ctx.lineJoin='round';ctx.lineWidth=size/3;ctx.strokeStyle=halo;ctx.strokeText(text,x,y,maxWidth);}
 ctx.fillStyle=colour;ctx.fillText(text,x,y,maxWidth);
}

function playerPoint(x:number,z:number){return toParkLocal(x,z);}

/**
 * Draw the actual park layout from the same authored attraction data as the 3D scene.
 * The renderer is intentionally 2D: a compact top-down map is much easier to read on a
 * phone, while the attraction names and land colours make it useful at desktop size too.
 */
export function drawLegolandMap(canvas:HTMLCanvasElement,player:LegolandMapPlayer,peers:LegolandMapPeer[]=[],expanded=false,zoom=1,view:LegolandMapView={},played:ReadonlySet<number>=new Set()){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const width=canvas.width,height=canvas.height;
 const parkWidth=LEGOLAND_MAP_BOUNDS.maxX-LEGOLAND_MAP_BOUNDS.minX;
 const parkDepth=LEGOLAND_MAP_BOUNDS.maxZ-LEGOLAND_MAP_BOUNDS.minZ;
 const padding=expanded?28:8;
 const scale=Math.min((width-padding*2)/parkWidth,(height-padding*2)/parkDepth)*Math.max(.5,Math.min(LEGOLAND_MAX_ZOOM,zoom));
 // Text and markers are sized in CSS pixels: the 1024px canvas is shown ~340px wide on a phone,
 // where fixed 6px names came out at 2px however far you zoomed.
 const u=Math.max(1,canvas.clientWidth?width/canvas.clientWidth:1);
 // A name that would land on another is skipped rather than stacked; zooming in gives it room.
 const taken:number[][]=[];
 const fits=(x:number,y:number,w:number,h:number)=>{if(taken.some(([l,t,r,b])=>x<r&&l<x+w&&y<b&&t<y+h))return false;taken.push([x,y,x+w,y+h]);return true;};
 const centerX=(LEGOLAND_MAP_BOUNDS.minX+LEGOLAND_MAP_BOUNDS.maxX)/2;
 const centerZ=(LEGOLAND_MAP_BOUNDS.minZ+LEGOLAND_MAP_BOUNDS.maxZ)/2;
 const mapX=(x:number)=>(x-centerX)*scale;
 const mapY=(z:number)=>(z-centerZ)*scale;
 canvas.dataset.scope='legoland';canvas.dataset.mapScope='legoland';canvas.dataset.worldScale=String(scale);canvas.dataset.centerX=String(centerX);canvas.dataset.centerZ=String(centerZ);canvas.dataset.panX=String(view.panX||0);canvas.dataset.panZ=String(view.panZ||0);
 canvas.dataset.played=[...played].sort((a,b)=>a-b).join(' ');
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#173c32';ctx.fillRect(0,0,width,height);
 ctx.save();ctx.translate(width/2+Number(view.panX||0)*scale,height/2+Number(view.panZ||0)*scale);
 // Water outside the park and the cream perimeter make the map read as a park plan rather
 // than another green city road grid.
 ctx.fillStyle='#4daeb8';ctx.fillRect(mapX(LEGOLAND_MAP_BOUNDS.minX-20),mapY(LEGOLAND_MAP_BOUNDS.minZ-20),parkWidth*scale+40*scale,parkDepth*scale+40*scale);
 ctx.fillStyle='#d9c99d';roundRect(ctx,mapX(-195),mapY(-185),parkWidth*scale,parkDepth*scale,12);ctx.fill();
 ctx.strokeStyle='#fff3cf';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#82b876';roundRect(ctx,mapX(-188),mapY(-178),474*scale,346*scale,9);ctx.fill();

 // Main promenades connect the entrance, MINILAND and the lands. Their broad light bands
 // remain visible at minimap size and the little cross paths give orientation at full size.
 ctx.strokeStyle='#ead6ad';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(3,expanded?8:5);
 const paths:[number,number][][]=[[[0,154],[0,0],[0,-165]],[[0,0],[-145,0],[270,0]],[[0,0],[-110,125]],[[0,0],[110,125]],[[0,0],[110,-110]]];
 for(const path of paths){ctx.beginPath();path.forEach(([x,z],i)=>i?ctx.lineTo(mapX(x),mapY(z)):ctx.moveTo(mapX(x),mapY(z)));ctx.stroke();}
 ctx.lineWidth=Math.max(1,expanded?3:2);ctx.strokeStyle='#f5e6c4';
 for(const [x,z] of [[-110,90],[-110,5],[-85,-85],[15,-110],[110,-65],[110,35],[115,125],[220,0]]){ctx.beginPath();ctx.moveTo(mapX(x),mapY(z));ctx.lineTo(mapX(0),mapY(0));ctx.stroke();}

 for(const land of lands){
  const w=land.name==='Water Park'?112:LAND_WIDTH,d=land.name==='Water Park'?112:LAND_DEPTH;
  const x=mapX(land.x)-w*scale/2,y=mapY(land.z)-d*scale/2;
  ctx.fillStyle=land.color+'dd';roundRect(ctx,x,y,w*scale,d*scale,expanded?7:4);ctx.fill();
  ctx.strokeStyle='#fff4d080';ctx.lineWidth=expanded?1.5:1;ctx.stroke();
 }
 // Land names first, as tabs on each land's top edge: they are what you steer by.
 if(expanded)for(const land of lands){
  const size=12*u,top=mapY(land.z)-(land.name==='Water Park'?112:LAND_DEPTH)*scale/2;ctx.font=`700 ${size}px sans-serif`;
  const w=ctx.measureText(land.name).width+size,h=size*1.6,x=mapX(land.x)-w/2;
  if(!fits(x,top-h/2,w,h))continue;
  ctx.fillStyle=land.color;roundRect(ctx,x,top-h/2,w,h,h/2);ctx.fill();ctx.strokeStyle='#fff8df';ctx.lineWidth=u;ctx.stroke();label(ctx,land.name,mapX(land.x),top,size,'#fff8df');
 }

 // Entrance arch and the park title are useful landmarks even when the user opens the map
 // immediately after arriving at the west edge.
 ctx.fillStyle='#e33e37';roundRect(ctx,mapX(-18),mapY(151),36*scale,12*scale,3);ctx.fill();
 if(expanded){const size=11*u;ctx.font=`700 ${size}px sans-serif`;const w=ctx.measureText('LEGOLAND MALAYSIA').width;if(fits(mapX(0)-w/2,mapY(156)-size/2,w,size))label(ctx,'LEGOLAND MALAYSIA',mapX(0),mapY(156),size,'#fff8df',undefined,'#173c32');label(ctx,'N ↑',mapX(270),mapY(-168),11*u,'#fff8df');}

 // Played attractions turn green with a tick, so the last few left on the passport stand out.
 // Pins also shrink with the map so neighbours never merge on a phone; numbers wait until they fit.
 const ring=expanded?Math.min(9*u,scale*7):4,pin=expanded?ring*.78:2.6,numbered=pin>=5*u;
 for(const attraction of attractions){
  const x=mapX(attraction.x),y=mapY(attraction.z),done=played.has(attraction.id),colour=done?'#2e9e5b':KIND_COLOURS[attraction.kind]||'#fff3bc';
  ctx.fillStyle='#173c32aa';ctx.beginPath();ctx.arc(x,y,ring,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=colour;ctx.beginPath();ctx.arc(x,y,pin,0,Math.PI*2);ctx.fill();
  if(expanded){taken.push([x-ring,y-ring,x+ring,y+ring]);if(numbered)label(ctx,done?'✓':String(attraction.id+1),x,y,(done?1.4:1.15)*pin,done?'#fff':'#173c32');}
 }
 if(expanded)for(const attraction of attractions){
  const size=10*u,x=mapX(attraction.x),y=mapY(attraction.z)+ring+size*.8;ctx.font=`700 ${size}px sans-serif`;const w=ctx.measureText(attraction.name).width;
  if(fits(x-w/2-2*u,y-size/2-u,w+4*u,size+2*u))label(ctx,attraction.name,x,y,size,'#fff8df',undefined,'#173c32');
 }

 const visiblePeers=peers.filter(peer=>isInLegoland(peer.x));
 canvas.dataset.attractionCount=String(attractions.length);canvas.dataset.peerCount=String(visiblePeers.length);
 for(const peer of visiblePeers){
  const point=playerPoint(peer.x,peer.z),x=mapX(point.x),y=mapY(point.z),colour=peer.party?'#ff5a4f':'#49cfff';
  ctx.save();ctx.globalAlpha=.25;ctx.fillStyle=colour;ctx.beginPath();ctx.arc(x,y,expanded?12*u:7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=colour;ctx.strokeStyle='#fff';ctx.lineWidth=expanded?2*u:1.5;ctx.beginPath();ctx.arc(x,y,expanded?5*u:3.5,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(expanded&&peer.name){const name=peer.name.trim().slice(0,16);ctx.font=`700 ${9*u}px sans-serif`;const w=ctx.measureText(name).width+10*u;ctx.fillStyle='#173c32e8';roundRect(ctx,x-w/2,y-22*u,w,15*u,5*u);ctx.fill();label(ctx,name,x,y-14.5*u,9*u,'#fff8e7',w-6*u);}
  ctx.restore();
 }

 const you=playerPoint(player.x,player.z),youX=mapX(you.x),youY=mapY(you.z);
 ctx.fillStyle='#173c32';ctx.globalAlpha=.32;ctx.beginPath();ctx.arc(youX,youY,expanded?12*u:7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#dfff87';ctx.strokeStyle='#fff';ctx.lineWidth=expanded?2*u:1.5;ctx.beginPath();ctx.arc(youX,youY,expanded?6*u:4,0,Math.PI*2);ctx.fill();ctx.stroke();
 if(expanded){
  ctx.save();ctx.translate(youX,youY);ctx.rotate(-(player.yaw||0));ctx.scale(u,u);ctx.fillStyle='#fff8df';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(-5,2);ctx.lineTo(0,-1);ctx.lineTo(5,2);ctx.closePath();ctx.fill();ctx.restore();label(ctx,'YOU',youX,youY+17*u,9*u,'#fff8df',undefined,'#173c32');
 }
 ctx.restore();
 if(expanded){
  const legend='● You   ● Friends   ● Geng   ✓ Played';ctx.font=`600 ${10*u}px sans-serif`;
  ctx.fillStyle='#173c32d9';roundRect(ctx,6*u,6*u,ctx.measureText(legend).width+12*u,40*u,8*u);ctx.fill();
  ctx.fillStyle='#fff8df';ctx.font=`700 ${12*u}px sans-serif`;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText('LEGOLAND MAP',12*u,12*u);
  ctx.font=`600 ${10*u}px sans-serif`;ctx.fillStyle='#d4eee0';ctx.fillText(legend,12*u,29*u);
 } else {label(ctx,'LEGOLAND',width/2,12,10,'#fff8df');}
}
