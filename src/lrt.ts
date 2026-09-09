import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {box,material} from './world';
import {stations,trackPoint,trackLength,trainState,railHeight} from '../shared/lrt.mjs';
import type {Solid} from './physics';
import './lrt.css';

function batchStatic(group:THREE.Group,dynamic:THREE.Object3D[]=[]){
 group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),sources:THREE.Mesh[]=[];
 group.traverse(obj=>{if(!(obj instanceof THREE.Mesh)||Array.isArray(obj.material)||obj.material instanceof THREE.MeshBasicMaterial)return;
  for(let parent:THREE.Object3D|null=obj;parent&&parent!==group;parent=parent.parent)if(dynamic.includes(parent))return;
  const geometry=obj.geometry.clone().applyMatrix4(inverse.clone().multiply(obj.matrixWorld));
  if(!batches.has(obj.material))batches.set(obj.material,[]);batches.get(obj.material)!.push(geometry);sources.push(obj);
 });
 for(const mesh of sources)mesh.removeFromParent();
 for(const [mat,geometries] of batches){const merged=mergeGeometries(geometries);if(merged){const mesh=new THREE.Mesh(merged,mat);mesh.receiveShadow=true;group.add(mesh);}geometries.forEach(g=>g.dispose());}
}

function label(parent:THREE.Group,text:string,x:number,y:number,z:number,w:number,h:number){
 const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#082f50';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 44px sans-serif';ctx.fillText(text,384,64,740);
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
export function createLrt(scene:THREE.Scene,solids:Solid[]){
 const infrastructure=new THREE.Group();infrastructure.name='Lepak LRT elevated line';scene.add(infrastructure);
 const beamMatrices:THREE.Matrix4[]=[],railMatrices:THREE.Matrix4[]=[],pillarMatrices:THREE.Matrix4[]=[];
 const dummy=new THREE.Object3D();
 for(let d=0;d<trackLength;d+=3){const a=trackPoint(d),b=trackPoint(Math.min(d+3,trackLength));const length=Math.hypot(b.x-a.x,b.z-a.z),yaw=Math.atan2(b.x-a.x,b.z-a.z);
  dummy.position.set((a.x+b.x)/2,railHeight-.5,(a.z+b.z)/2);dummy.rotation.set(0,yaw,0);dummy.scale.set(4.6,.8,length+.08);dummy.updateMatrix();beamMatrices.push(dummy.matrix.clone());
  for(const side of [-1,1]){dummy.position.set((a.x+b.x)/2+Math.cos(yaw)*side*.95,railHeight,(a.z+b.z)/2-Math.sin(yaw)*side*.95);dummy.scale.set(.13,.18,length+.1);dummy.updateMatrix();railMatrices.push(dummy.matrix.clone());}
 }
 for(let d=0;d<trackLength;d+=24){const p=trackPoint(d);dummy.position.set(p.x,5,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(1.1,10,1.1);dummy.updateMatrix();pillarMatrices.push(dummy.matrix.clone());solids.push({x:p.x,z:p.z,hx:.55,hz:.55});}
 for(const [matrices,color] of [[beamMatrices,'#9caaa9'],[railMatrices,'#414b52'],[pillarMatrices,'#a8b0a9']] as const){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),material(color),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;infrastructure.add(mesh);}
 const stationGroups=stations.map((station,index)=>{
  const p=trackPoint(station.distance),g=new THREE.Group();g.name=station.name+' LRT';g.position.set(p.x,0,p.z);g.rotation.y=p.yaw;scene.add(g);
  box(g,4.9,railHeight+.05,0,5.5,.8,59,'#b6c1bc');box(g,2.35,railHeight+.5,0,.25,.04,58,'#ffcf4e');
  box(g,5,railHeight+4.2,0,6,.25,60,'#143e5c');box(g,5,railHeight+4.45,0,6.2,.18,60,'#a8ced2');
  for(const z of [-27,-15,0,15,27]){box(g,6.9,railHeight+2.2,z,.2,4.1,.2,'#5c727c');box(g,6.7,railHeight+1,z,1,.3,3.5,'#236c9c');}
  for(const z of [-29,29])box(g,5,railHeight+1.2,z,5,.15,.1,'#516979');
  box(g,7.5,railHeight+1.1,0,.1,.1,58,'#526975');
  box(g,11.8,railHeight/2,0,2.3,railHeight+1,3.5,'#59717d');box(g,10.62,1.2,0,.05,2.4,1.8,'#c7d1d0');
  solids.push({x:p.x+Math.cos(p.yaw)*11.8,z:p.z-Math.sin(p.yaw)*11.8,hx:Math.abs(Math.cos(p.yaw))*1.15+Math.abs(Math.sin(p.yaw))*1.75,hz:Math.abs(Math.sin(p.yaw))*1.15+Math.abs(Math.cos(p.yaw))*1.75});
  const ground=label(g,`LRT ${String(index+1).padStart(2,'0')} · ${station.name}`,9,3.8,0,7,1.1);ground.rotation.y=Math.PI/2;
  label(g,`Rapid KL  ·  ${station.name}`,4.9,railHeight+3.1,0,5.3,.8).rotation.y=Math.PI/2;
  batchStatic(g);return g;
 });
 const trains=[0,1].map(id=>Array.from({length:4},(_,i)=>{
  const g=new THREE.Group();g.name=`LRT ${id+1} coach ${i+1}`;scene.add(g);
  box(g,0,.55,0,3.8,.65,11.5,'#dae1e1');box(g,0,.02,0,2.5,.35,10,'#38424a');
  const roof=box(g,0,3.8,0,3.9,.32,11.5,'#c6d0d2');
  const doors:THREE.Mesh[]=[];
  for(const side of [-1,1]){
   box(g,side*1.82,1,0,.16,.55,11.4,'#d2233c');
   for(const z of [-4.6,-1.5,1.5,4.6]){box(g,side*1.82,2.6,z,.1,1.55,1.95,'#274653');box(g,side*1.8,3.5,z,.18,.2,2.1,'#e9eded');}
   for(const z of [-3,3])for(const part of [-1,1]){const door=box(g,side*1.88,2.25,z+part*.42,.12,2.55,.8,'#b6c5c9');door.userData.z=door.position.z;door.userData.part=part;door.userData.side=side;doors.push(door);box(door,0,.35,0,1.1,.38,.72,'#233f4d');}
   for(const z of [-4,0,4]){box(g,side*1.25,1.12,z,.7,.25,1.65,'#2587ae');box(g,side*1.58,1.52,z,.15,.65,1.65,'#2587ae');}
  }
  for(const z of [-4.1,4.1]){box(g,0,2.1,z,.07,2.8,.07,'#f4d052');for(const side of [-1,1])box(g,side*1.3,.1,z,.55,.65,1.3,'#20282e');}
  for(const z of [-5.75,5.75])box(g,0,2.1,z,3.75,2.75,.15,'#e0e5e4');
  if(i===0||i===3){const front=i===0?1:-1;const glass=box(g,0,2.6,front*5.88,3.15,1.65,.12,'#183c4c');glass.rotation.x=front*.12;
   label(g,'Rapid KL',0,1.4,front*5.99,2.6,.48);label(g,'LRT · LEPAK LOOP',0,3.48,front*6,2.9,.3);
   for(const side of [-1,1])box(g,side*1.25,1,front*5.99,.4,.17,.1,i===0?'#fff3bc':'#eb4c4c');
  }else box(g,0,1.6,6,1.8,2.1,.7,'#414b50');
  batchStatic(g,[roof,...doors]);return{g,roof,doors};
 }));
 return {update(now:number,viewer:{x:number;z:number},aboard:number|null){
  stationGroups.forEach(g=>g.visible=Math.hypot(g.position.x-viewer.x,g.position.z-viewer.z)<145);
  trains.forEach((coaches,id)=>{const state=trainState(id,now);coaches.forEach((coach,i)=>{const p=trackPoint(state.distance+18-i*12);coach.g.position.set(p.x,railHeight,p.z);coach.g.rotation.y=p.yaw;coach.g.visible=aboard===id||Math.hypot(p.x-viewer.x,p.z-viewer.z)<160;coach.roof.visible=aboard!==id;for(const door of coach.doors)door.position.z=THREE.MathUtils.lerp(door.position.z,door.userData.z+(state.doors&&door.userData.side===1?door.userData.part*.65:0),.2);});});
 },drawMap(ctx:CanvasRenderingContext2D){ctx.save();ctx.strokeStyle='#f3667d';ctx.lineWidth=1.8;ctx.beginPath();for(let d=0;d<=trackLength;d+=3){const p=trackPoint(d);if(d===0)ctx.moveTo(p.x,p.z);else ctx.lineTo(p.x,p.z);}ctx.closePath();ctx.stroke();for(const s of stations){const p=trackPoint(s.distance);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.z,2.4,0,Math.PI*2);ctx.fill();}ctx.restore();}};
}
