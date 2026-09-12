import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import stalls from '../shared/stalls.json';
import {batchShopFallback, createPerson} from './world';
import type {Solid} from './physics';

export const stallVoiceSpots = stalls.map(({id,name,x,z}) => ({id,name,x,z}));
export const STALL_VOICE_REACH = 5;
export const STALL_VOICE_FULL = 1.5;
export const STALL_VOICE_PEAK = .44;

export function nearestStallDistance(position:{x:number;z:number}) {
 return Math.min(...stallVoiceSpots.map(stall => Math.hypot(position.x-stall.x,position.z-stall.z)));
}

// Keep the hawker call at the counter so it does not wash over the surrounding street.
export function stallVoiceVolume(distance:number) {
 const t=Math.max(0,Math.min(1,(STALL_VOICE_REACH-distance)/(STALL_VOICE_REACH-STALL_VOICE_FULL)));
 return STALL_VOICE_PEAK*t*t*(3-2*t);
}

export function createStallWorld(scene:THREE.Scene,solids:Solid[]){
 // The procedural carts below are the fallback. The Blender gerai
 // (scripts/blender/build_stalls.py) replaces them wholesale once it loads, so they live in
 // one group; the canvas name and price boards are drawn on top of either and stay.
 const group=new THREE.Group();group.name='stalls';scene.add(group);
 for(const stall of stalls){
  const g=new THREE.Group();g.position.set(stall.x,0,stall.z);group.add(g);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));m.position.set(x,y,z);g.add(m);return m;};
  box(0,.65,0,3.8,1.3,1.35,stall.color);box(0,1.34,0,4,.12,1.55,'#e6e0cf');
  for(const x of [-1.9,1.9])for(const z of [-.7,.7])box(x,1.6,z,.07,3.2,.07,'#ddd4bc');
  for(let i=0;i<8;i++)box(-1.75+i*.5,3.1,0,.5,.14,2.8,i%2?'#fff0ca':stall.color);
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d')!;ctx.fillStyle=stall.color;ctx.fillRect(0,0,768,160);ctx.fillStyle='#fff8db';ctx.textAlign='center';ctx.font='bold 45px sans-serif';ctx.fillText(stall.name,384,72);ctx.font='26px sans-serif';ctx.fillText(stall.id==='air-balang'?'SEJUK • SEGAR • PADU':'PANAS-PANAS BARU ANGKAT',384,122);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.9,.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));sign.position.set(0,2.6,.8);g.add(sign);
  for(let i=0;i<3;i++){
   if(stall.id==='air-balang'){
    const jar=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.72,12),new THREE.MeshStandardMaterial({color:stall.items[i].color,roughness:.2}));jar.position.set(-1.2+i*1.2,1.75,0);g.add(jar);
    box(-1.2+i*1.2,2.13,0,.77,.08,.77,'#ece8d6');box(-1.2+i*1.2,1.49,.4,.08,.1,.18,'#eeeeee');
   }else{
    box(-1.2+i*1.2,1.45,0,1,.08,1,'#a9aaa0');
    for(let j=0;j<6;j++){const fritter=box(-1.5+i*1.2+(j%3)*.25,1.53+Math.floor(j/3)*.07,-.25+Math.floor(j/3)*.4,.15,.12,.36,stall.items[i].color);fritter.rotation.y=.3*(j%2?1:-1);}
   }
  }
  // The hawker rig stays outside the replaced group: its character parts stream in later.
  const seller=createPerson(stall.id==='air-balang'?'#f3e7c3':'#7e608d');seller.group.position.set(stall.x,.12,stall.z-1.4);scene.add(seller.group);
  box(2.2,.4,-.3,.7,.8,.7,'#394e41');solids.push({x:stall.x,z:stall.z,hx:2,hz:.8},{x:stall.x,z:stall.z-1.4,hx:.4,hz:.4});
 }
 group.traverse(o=>{o.userData.keepUnbatched=true;});
 batchShopFallback(group);
 void new GLTFLoader().loadAsync('/assets/models/environment/LM_ENV_Stalls.glb?v=stalls-v1').then(gltf=>{
  gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;o.castShadow=false;}});
  for(const child of [...group.children])if(!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial))child.removeFromParent();
  group.add(gltf.scene);
 }).catch(error=>console.warn('[STALLS] keeping procedural stalls',error));
}
// Stalls name themselves when you walk up and carry the nearby hawker call.
export function setupStalls(hud:HTMLElement){
 const labels=stalls.map(stall=>{const label=document.createElement('div');label.className='table-label stall-name';label.hidden=true;label.textContent=stall.name;hud.append(label);return {stall,label};});
 return {update(pos:{x:number;z:number},camera:THREE.Camera,enabled:boolean){
  for(const {stall,label} of labels){
   if(!enabled||Math.hypot(pos.x-stall.x,pos.z-stall.z)>5){label.hidden=true;continue;}
   const p=new THREE.Vector3(stall.x,3.8,stall.z).project(camera);
   label.hidden=p.z<-1||p.z>1||Math.abs(p.x)>.85||Math.abs(p.y)>.9;
   if(!label.hidden){label.style.left=`${(p.x+1)*innerWidth/2}px`;label.style.top=`${(1-p.y)*innerHeight/2}px`;}
  }
 }};
}
