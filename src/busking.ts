import * as THREE from 'three';
import {createPerson,box,material} from './world';
import type {Solid} from './physics';
export const buskingSpot={x:-40,z:64};
// Full volume within 3m; smooth falloff and silence at 22m.
export function buskingVolume(distance:number){const t=Math.max(0,Math.min(1,(22-distance)/19));return .55*t*t*(3-2*t);}
export function createBuskers(scene:THREE.Scene,solids:Solid[]){
 const group=new THREE.Group();group.position.set(buskingSpot.x,0,buskingSpot.z);scene.add(group);
 box(group,0,.04,0,5,.08,3.6,'#92704e');
 const guitarist=createPerson('#376c65');guitarist.group.position.set(-.7,.12,0);group.add(guitarist.group);
 const guitar=new THREE.Group();guitar.position.set(-.03,1.15,.35);guitar.rotation.z=-.55;guitarist.group.add(guitar);
 for(const [y,r] of [[-.15,.28],[.12,.21]]){const body=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),material('#bd7c38'));body.scale.set(1,1,.3);body.position.y=y;guitar.add(body);}
 box(guitar,0,.53,0,.09,.8,.06,'#69462b');box(guitar,0,.96,0,.16,.22,.08,'#855332');
 const hole=new THREE.Mesh(new THREE.CircleGeometry(.085,12),material('#302b22'));hole.position.set(0,.09,.082);guitar.add(hole);
 for(let i=0;i<4;i++)box(guitar,-.025+i*.017,.35,.09,.004,1,.005,'#e4d6a9');
 box(group,-.7,.7,1,.035,1.4,.035,'#333e39');box(group,-.7,1.45,.87,.06,.06,.34,'#303a35');box(group,-.7,.09,1,.6,.04,.5,'#333e39');
 const drummer=createPerson('#c39354',true);drummer.group.position.set(1.05,.02,-.15);group.add(drummer.group);box(group,1.05,.42,-.05,.6,.8,.6,'#b58855');
 for(const x of [-2,2]){box(group,x,.45,.1,.65,.9,.55,'#263932');const speaker=new THREE.Mesh(new THREE.CircleGeometry(.22,12),material('#111f1d'));speaker.position.set(x,.46,.381);group.add(speaker);}
 box(group,-.25,.13,1.2,1.3,.18,.48,'#43392e');box(group,-.25,.235,1.2,1.1,.03,.34,'#d7ba70');
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#244d40';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff0c4';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.fillText('BUSKING SANTAI',256,58);ctx.font='24px sans-serif';ctx.fillText('Jom singgah, layan lagu',256,101);const sign=new THREE.Mesh(new THREE.PlaneGeometry(2,.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));sign.position.set(0,.6,1.65);group.add(sign);
 solids.push({x:buskingSpot.x-.7,z:buskingSpot.z,hx:.5,hz:.5},{x:buskingSpot.x+1.05,z:buskingSpot.z,hx:.5,hz:.5});for(const x of [-2,2])solids.push({x:buskingSpot.x+x,z:buskingSpot.z+.1,hx:.35,hz:.3});
 return {update(time:number,reduced:boolean){guitarist.rightArm.rotation.x=-.65+(reduced?0:Math.sin(time*12)*.18);guitarist.leftArm.rotation.x=-1.1;guitarist.leftArm.rotation.z=-.4;guitarist.group.rotation.z=reduced?0:Math.sin(time*2)*.025;drummer.leftArm.rotation.x=-.7+(reduced?0:Math.sin(time*8)*.15);drummer.rightArm.rotation.x=-.7+(reduced?0:Math.cos(time*8)*.15);}};
}
