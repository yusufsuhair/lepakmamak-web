import * as THREE from 'three';
import places from '../shared/places.json';
import {drawCarPin,type CarPin} from './car-finder';

export type MapPeer = {x: number; z: number; name: string; party?: boolean};

/** A lazy, low-resolution second view of the actual city; no duplicate world. */
export function createMapOverview(scene:THREE.Scene, canvas:HTMLCanvasElement, select:(id:string)=>void){
 let renderer:THREE.WebGLRenderer|undefined;
 const camera=new THREE.OrthographicCamera(-440,440,440,-440,1,1500);
 const basePosition=new THREE.Vector3(50,600,250),baseLookAt=new THREE.Vector3(-180,0,-50);
 let panX=0,panZ=0;
 function updateCamera(){camera.position.set(basePosition.x+panX,basePosition.y,basePosition.z+panZ);camera.lookAt(baseLookAt.x+panX,baseLookAt.y,baseLookAt.z+panZ);camera.updateMatrixWorld();}
 updateCamera();
 const point=new THREE.Vector3();
 let lastRender=0,lastSelection='',lastZoom=0;
 let hits:{id:string;x:number;y:number}[]=[];
 function project(x:number,y:number,z:number){point.set(x,y,z).project(camera);return{x:(point.x+1)*canvas.width/2,y:(1-point.y)*canvas.height/2};}
 function groundAtScreen(x:number,y:number){
  const near=new THREE.Vector3(x/canvas.width*2-1,1-y/canvas.height*2,-1).unproject(camera);
  const far=new THREE.Vector3(x/canvas.width*2-1,1-y/canvas.height*2,1).unproject(camera);
  const direction=far.sub(near);
  const distance=direction.y? -near.y/direction.y:0;
  return near.add(direction.multiplyScalar(distance));
 }
 function clampPan(value:number){return THREE.MathUtils.clamp(value,-230,230);}
 function draw(x:number,z:number,selected:string,zoom=1,car?:CarPin,peers:MapPeer[]=[]){
  const peerKey=peers.map(peer=>`${peer.name}:${Math.round(peer.x)}:${Math.round(peer.z)}:${peer.party?'p':'c'}`).join('|');
  const selectionKey=`${selected}:${car?.label||''}:${car?.x||''}:${car?.z||''}:${Math.round(panX)}:${Math.round(panZ)}:${peerKey}`;
  const now=performance.now();if(now-lastRender<250&&selectionKey===lastSelection&&zoom===lastZoom)return;lastRender=now;lastSelection=selectionKey;lastZoom=zoom;
  if(!renderer){renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});renderer.setPixelRatio(1);renderer.setSize(640,640);renderer.outputColorSpace=THREE.SRGBColorSpace;}
  camera.zoom=zoom;camera.updateProjectionMatrix();updateCamera();
  const fog=scene.fog;scene.fog=null;
  try{renderer.render(scene,camera);}finally{scene.fog=fog;}
  const ctx=canvas.getContext('2d')!;ctx.drawImage(renderer.domElement,0,0,canvas.width,canvas.height);
  hits=[];ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 18px sans-serif';
  for(const place of places){const p=project(place.x,8,place.z);hits.push({id:place.id,...p});const chosen=place.id===selected;
   ctx.fillStyle=chosen?'#ffe09a':'#173c32';ctx.strokeStyle='#fff5dc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,17,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=chosen?'#173c32':'#fff5dc';ctx.fillText(place.id,p.x,p.y);
   if(chosen){const width=ctx.measureText(place.name).width+24;const labelX=Math.max(width/2,Math.min(canvas.width-width/2,p.x));ctx.fillStyle='#ffe09a';ctx.fillRect(labelX-width/2,p.y-52,width,28);ctx.fillStyle='#173c32';ctx.fillText(place.name,labelX,p.y-38);}
  }
  for(const peer of peers){
   const p=project(peer.x,5,peer.z),color=peer.party?'#ff5a4f':'#49cfff';
   ctx.save();ctx.globalAlpha=.28;ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,19,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=color;ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.fill();ctx.stroke();
   const name=peer.name.trim().slice(0,16);if(name){const width=Math.min(190,ctx.measureText(name).width+22),labelX=Math.max(width/2,Math.min(canvas.width-width/2,p.x));const labelY=Math.max(17,p.y-28);ctx.fillStyle='#102e26e8';ctx.roundRect(labelX-width/2,labelY-12,width,23,8);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#fff8e7';ctx.font='700 13px sans-serif';ctx.fillText(name,labelX,labelY);}
   ctx.restore();
  }
  const you=project(x,5,z);ctx.fillStyle='#49cfff';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(you.x,you.y,10,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';ctx.fillText('YOU',you.x,you.y+25);
  if(car){const p=project(car.x,5,car.z);drawCarPin(ctx,{x:p.x,z:p.y,label:car.label},{x:you.x,z:you.y},20);}
 }
 function pan(dx:number,dy:number){
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);right.y=0;if(right.lengthSq())right.normalize();
  const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);up.y=0;if(up.lengthSq())up.normalize();
  const worldPerPixel=(880/camera.zoom)/Math.max(1,canvas.width);
  const delta=right.multiplyScalar(-dx*worldPerPixel).add(up.multiplyScalar(dy*worldPerPixel));
  panX=clampPan(panX+delta.x);panZ=clampPan(panZ+delta.z);updateCamera();canvas.dataset.panX=panX.toFixed(2);canvas.dataset.panZ=panZ.toFixed(2);
 }
 function zoomAt(x:number,y:number,nextZoom:number){
  const target=groundAtScreen(x,y);
  camera.zoom=nextZoom;camera.updateProjectionMatrix();updateCamera();
  const after=groundAtScreen(x,y);
  panX=clampPan(panX+target.x-after.x);panZ=clampPan(panZ+target.z-after.z);updateCamera();
  canvas.dataset.panX=panX.toFixed(2);canvas.dataset.panZ=panZ.toFixed(2);canvas.dataset.zoom=String(nextZoom);
  lastRender=0;
 }
 function reset(){panX=0;panZ=0;updateCamera();lastRender=0;}
 return{draw,pan,zoomAt,reset,click(event:MouseEvent){if(canvas.dataset.gesture)return;const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)/r.width*canvas.width,y=(event.clientY-r.top)/r.height*canvas.height;const hit=hits.filter(p=>Math.hypot(x-p.x,y-p.y)<25).sort((a,b)=>Math.hypot(x-a.x,y-a.y)-Math.hypot(x-b.x,y-b.y))[0];if(hit)select(hit.id);}};
}
