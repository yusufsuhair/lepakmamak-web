import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createPerson,box,material} from './world';
import type {Solid} from './physics';
// PETRONAS faces south onto the open forecourt; the stage sits in that frontage,
// with the audience between the performers and the station canopy.
export const buskingSpot={x:-31,z:86};
// Full volume within 3m; smooth falloff and silence at 22m.
export function buskingVolume(distance:number){const t=Math.max(0,Math.min(1,(22-distance)/19));return .55*t*t*(3-2*t);}
export const rembayungBuskingSpot={x:-116,z:119};
export function createBuskers(scene:THREE.Scene,solids:Solid[],spot=buskingSpot){
 const group=new THREE.Group();group.position.set(spot.x,0,spot.z);scene.add(group);
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

 // A compact crowd fills the pavement without spilling onto the road at z=78.
 // Seated spectators are merged by material because they do not animate.
 const seatedGroup=new THREE.Group();group.add(seatedGroup);
 const seatedPositions=[[-4.6,2.8],[-3.2,3.9],[-1.6,4.5],[0,4.65],[1.7,4.45],[3.3,3.8],[4.7,2.7]] as const;
 const shirts=['#d76d55','#5d8798','#d5aa52','#776b99'];
 for(let i=0;i<seatedPositions.length;i++){
  const [x,z]=seatedPositions[i],person=createPerson(shirts[i%shirts.length],true);
  person.group.position.set(x,-.28,z);person.group.rotation.y=Math.atan2(-x,-z);seatedGroup.add(person.group);
  box(seatedGroup,x,.025,z,1.15,.05,.82,i%2?'#d4a65b':'#557b6e');
  solids.push({x:spot.x+x,z:spot.z+z,hx:.42,hz:.42});
 }
 seatedGroup.updateMatrixWorld(true);
 const inverse=new THREE.Matrix4().copy(seatedGroup.matrixWorld).invert(),batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 seatedGroup.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||Array.isArray(object.material))return;
  const transform=new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld);
  const transformed=object.geometry.clone().applyMatrix4(transform);const geometry=transformed.index?transformed.toNonIndexed():transformed;
  if(transformed!==geometry)transformed.dispose();if(!batches.has(object.material))batches.set(object.material,[]);batches.get(object.material)!.push(geometry);
 });
 seatedGroup.clear();
 for(const [mat,geometries] of batches){const merged=mergeGeometries(geometries);if(merged){const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;seatedGroup.add(mesh);}for(const geometry of geometries)geometry.dispose();}

 // One fan records the performance with a small camera held at eye level.
 const cameraFan=createPerson('#bd7156');cameraFan.group.position.set(-6,0,1.8);cameraFan.group.rotation.y=Math.atan2(6,-1.8);group.add(cameraFan.group);
 cameraFan.leftArm.rotation.x=cameraFan.rightArm.rotation.x=-1.55;cameraFan.leftArm.rotation.z=-.22;cameraFan.rightArm.rotation.z=.22;
 const handCamera=new THREE.Group();handCamera.position.set(0,1.72,.43);cameraFan.group.add(handCamera);
 box(handCamera,0,0,0,.48,.3,.22,'#263331');box(handCamera,-.14,.2,-.02,.18,.1,.14,'#3b4945');
 const lens=new THREE.Mesh(new THREE.CylinderGeometry(.11,.14,.18,12),material('#111b1a'));lens.rotation.x=Math.PI/2;lens.position.z=.18;handCamera.add(lens);
 box(handCamera,.15,.02,.125,.07,.07,.03,'#d94f3e');solids.push({x:spot.x-6,z:spot.z+1.8,hx:.38,hz:.38});

 // Three standing fans wave above the seated crowd.
 const wavers=[[-5.7,4.35],[5.7,4.2],[5.8,1.6]].map(([x,z],i)=>{
  const person=createPerson(['#d4a75c','#6d8f72','#c87983'][i]);person.group.position.set(x,0,z);person.group.rotation.y=Math.atan2(-x,-z);group.add(person.group);
  person.rightArm.rotation.x=-2.55;person.rightArm.rotation.z=-.2;solids.push({x:spot.x+x,z:spot.z+z,hx:.38,hz:.38});return person;
 });
 solids.push({x:spot.x-.7,z:spot.z,hx:.5,hz:.5},{x:spot.x+1.05,z:spot.z,hx:.5,hz:.5});for(const x of [-2,2])solids.push({x:spot.x+x,z:spot.z+.1,hx:.35,hz:.3});
 return {audienceCount:seatedPositions.length+1+wavers.length,cameraFan,wavers,update(time:number,reduced:boolean){guitarist.rightArm.rotation.x=-.65+(reduced?0:Math.sin(time*12)*.18);guitarist.leftArm.rotation.x=-1.1;guitarist.leftArm.rotation.z=-.4;guitarist.group.rotation.z=reduced?0:Math.sin(time*2)*.025;drummer.leftArm.rotation.x=-.7+(reduced?0:Math.sin(time*8)*.15);drummer.rightArm.rotation.x=-.7+(reduced?0:Math.cos(time*8)*.15);handCamera.rotation.z=reduced?0:Math.sin(time*1.8)*.035;wavers.forEach((person,i)=>{person.rightArm.rotation.x=-2.55+(reduced?0:Math.sin(time*3.4+i*1.7)*.18);person.rightArm.rotation.z=-.2+(reduced?0:Math.sin(time*5+i)*.32);person.group.rotation.z=reduced?0:Math.sin(time*2+i)*.018;});}};
}
