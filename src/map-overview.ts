import * as THREE from 'three';
import places from '../shared/places.json';

/** A lazy, low-resolution second view of the actual city; no duplicate world. */
export function createMapOverview(scene:THREE.Scene, canvas:HTMLCanvasElement, select:(id:string)=>void){
 let renderer:THREE.WebGLRenderer|undefined;
 const camera=new THREE.OrthographicCamera(-245,245,245,-245,1,1500);
 camera.position.set(230,340,300);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const point=new THREE.Vector3();
 let lastRender=0,lastSelection='';
 let hits:{id:string;x:number;y:number}[]=[];
 function project(x:number,y:number,z:number){point.set(x,y,z).project(camera);return{x:(point.x+1)*canvas.width/2,y:(1-point.y)*canvas.height/2};}
 function draw(x:number,z:number,selected:string){
  const now=performance.now();if(now-lastRender<250&&selected===lastSelection)return;lastRender=now;lastSelection=selected;
  if(!renderer){renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});renderer.setPixelRatio(1);renderer.setSize(640,640);renderer.outputColorSpace=THREE.SRGBColorSpace;}
  const fog=scene.fog;scene.fog=null;
  try{renderer.render(scene,camera);}finally{scene.fog=fog;}
  const ctx=canvas.getContext('2d')!;ctx.drawImage(renderer.domElement,0,0,canvas.width,canvas.height);
  hits=[];ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 18px sans-serif';
  for(const place of places){const p=project(place.x,8,place.z);hits.push({id:place.id,...p});const chosen=place.id===selected;
   ctx.fillStyle=chosen?'#ffe09a':'#173c32';ctx.strokeStyle='#fff5dc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,17,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=chosen?'#173c32':'#fff5dc';ctx.fillText(place.id,p.x,p.y);
   if(chosen){const width=ctx.measureText(place.name).width+24;const labelX=Math.max(width/2,Math.min(canvas.width-width/2,p.x));ctx.fillStyle='#ffe09a';ctx.fillRect(labelX-width/2,p.y-52,width,28);ctx.fillStyle='#173c32';ctx.fillText(place.name,labelX,p.y-38);}
  }
  const you=project(x,5,z);ctx.fillStyle='#49cfff';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(you.x,you.y,9,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.fillText('YOU',you.x,you.y+25);
 }
 return{draw,click(event:MouseEvent){const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)/r.width*canvas.width,y=(event.clientY-r.top)/r.height*canvas.height;const hit=hits.filter(p=>Math.hypot(x-p.x,y-p.y)<25).sort((a,b)=>Math.hypot(x-a.x,y-a.y)-Math.hypot(x-b.x,y-b.y))[0];if(hit)select(hit.id);}};
}
