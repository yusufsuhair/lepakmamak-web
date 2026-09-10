import * as THREE from 'three';
import {box,material,type Person} from './world';

const runners=['Upin','Ipin','Ehsan','Fizi','Dzul'];
const walkers=['Mei Mei','Susanti','Devi'];
const cyclists=['Mail','Rajoo'];
export function villageActivity(name:string){
 if(runners.includes(name))return 'run';
 if(walkers.includes(name))return 'walk';
 if(cyclists.includes(name))return 'cycle';
 if(name==='Jarjit'||name==='Ijat')return 'badminton';
 if(name==='Tok Dalang')return 'feed';
 if(name==='Opah')return 'laundry';
 if(name==='Kak Ros')return 'sweep';
 return 'idle';
}

// All children in each group share a clock and trail one another along the same
// clear route. Integrating speed keeps the walk/run change continuous each lap.
export function groupRoute(name:string,time:number){
 const activity=villageActivity(name);
 const running=activity==='run'&&time%16>=6;
 const travel=Math.floor(time/16)*8.8+Math.min(time%16,6)*.3+Math.max(0,time%16-6)*.7;
 const index=activity==='run'?runners.indexOf(name):activity==='walk'?walkers.indexOf(name):cyclists.indexOf(name);
 const angle=activity==='run'?travel-index*.45:activity==='walk'?time*.3-index*.5:time*.62-index*1.1;
 const cx=activity==='run'?-9:activity==='walk'?9:18;
 const cz=activity==='run'?9:activity==='walk'?10:16.8;
 const rx=activity==='run'?3:activity==='walk'?2:4.7;
 const rz=activity==='run'?3:activity==='walk'?3:1.65;
 return{x:cx+Math.sin(angle)*rx,z:cz+Math.cos(angle)*rz,heading:Math.atan2(Math.cos(angle)*rx,-Math.sin(angle)*rz),running,stride:activity==='run'?travel*10:time*4-index*.5};
}

function rod(parent:THREE.Object3D,a:number[],b:number[],radius:number,color:string){
 const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),6),material(color));
 mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(mesh);return mesh;
}
function ball(parent:THREE.Object3D,x:number,y:number,z:number,r:number,color:string){
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,10,7),material(color));mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}

export function createVillageCycle(rig:Person,color:string){
 // Lift the rider onto the saddle; the bike and rider then share the same root.
 for(const child of rig.group.children)child.position.y+=.35;
 const bike=new THREE.Group();bike.name='village-bicycle';rig.group.add(bike);
 const wheels=[-.85,.85].map(z=>{
  const wheel=new THREE.Group();wheel.position.set(0,.45,z);bike.add(wheel);
  const tire=new THREE.Mesh(new THREE.TorusGeometry(.42,.055,7,20),material('#303b38'));tire.rotation.y=Math.PI/2;wheel.add(tire);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;rod(wheel,[0,0,0],[0,Math.sin(a)*.39,Math.cos(a)*.39],.009,'#d8dfdb');}
  return wheel;
 });
 const rear=[0,.45,-.85],crankPoint=[0,.48,0],saddle=[0,1.2,-.24],front=[0,.45,.85],stem=[0,1.2,.6];
 for(const [a,b] of [[rear,crankPoint],[rear,saddle],[saddle,crankPoint],[saddle,stem],[crankPoint,stem],[stem,front]])rod(bike,a,b,.035,color);
 box(bike,0,1.23,-.24,.36,.09,.4,'#354640');
 rod(bike,stem,[0,1.55,.62],.03,'#d9ded6');rod(bike,[-.4,1.55,.62],[.4,1.55,.62],.03,'#d9ded6');
 const crank=new THREE.Group();crank.position.set(0,.48,0);bike.add(crank);
 for(const side of [-1,1]){rod(crank,[side*.15,0,0],[side*.15,side*.22,0],.025,'#c3d2c9');box(crank,side*.23,side*.22,0,.22,.05,.12,'#333f3c');}
 const pedalLegs=[rig.leftLeg,rig.rightLeg].map((leg,i)=>{
  for(const mesh of leg.children)mesh.visible=false;
  const thigh=rod(leg,[0,0,0],[0,-1,0],.095,'#c7be9c');
  const shin=rod(leg,[0,0,0],[0,-1,0],.075,'#b98157');
  const shoe=box(leg,0,0,0,.22,.12,.3,'#f6efd7');
  return{leg,thigh,shin,shoe,side:i===0?-1:1};
 });
 const up=new THREE.Vector3(0,1,0),hip=new THREE.Vector3(),foot=new THREE.Vector3(),knee=new THREE.Vector3(),delta=new THREE.Vector3();
 function poseBone(bone:THREE.Mesh,start:THREE.Vector3,end:THREE.Vector3){
  delta.copy(end).sub(start);bone.scale.y=delta.length();bone.position.copy(start).add(end).multiplyScalar(.5);bone.quaternion.setFromUnitVectors(up,delta.normalize());
 }
 rig.leftArm.rotation.x=-1.7;rig.rightArm.rotation.x=-1.7;
 return{bike,wheels,crank,update(time:number){
  for(const wheel of wheels)wheel.rotation.x=time*5;
  crank.rotation.x=time*5;
  for(const {leg,thigh,shin,shoe,side} of pedalLegs){
   foot.set(0,.48+side*Math.cos(time*5)*.22-leg.position.y,side*Math.sin(time*5)*.22);
   const distance=foot.length(),bend=Math.sqrt(Math.max(0,.55*.55-distance*distance/4));
   knee.set(0,foot.y/2-foot.z/distance*bend,foot.z/2+foot.y/distance*-bend);
   poseBone(thigh,hip,knee);poseBone(shin,knee,foot);shoe.position.copy(foot);
  }
 }};
}

type Villager={rig:Person;resident:{name:string}};
export function createVillageChores(group:THREE.Group,people:Villager[]){
 const tok=people.find(p=>p.resident.name==='Tok Dalang')!.rig;
 const opah=people.find(p=>p.resident.name==='Opah')!.rig;
 const ros=people.find(p=>p.resident.name==='Kak Ros')!.rig;
 // Feeding bowl, tossed grain and a flock that circles then pecks at the food.
 const bowl=ball(tok.leftArm,0,-.5,.14,.22,'#b78851');bowl.scale.y=.5;
 const chickens=Array.from({length:6},(_,i)=>{
  const chicken=new THREE.Group();chicken.name=i===0?'Rembo':'ayam';group.add(chicken);
  const body=ball(chicken,0,.36,0,.26,i===0?'#aa6033':'#ead6a0');body.scale.z=1.4;
  const neck=new THREE.Group();neck.position.set(0,.44,.2);chicken.add(neck);
  ball(neck,0,.17,.07,.14,'#e7bf79');box(neck,0,.3,.08,.06,.1,.13,'#c54434');
  const beak=new THREE.Mesh(new THREE.ConeGeometry(.065,.16,5),material('#edac38'));beak.rotation.x=Math.PI/2;beak.position.set(0,.16,.24);neck.add(beak);
  for(const side of [-1,1]){ball(neck,side*.115,.2,.1,.022,'#242f2a');rod(chicken,[side*.1,.1,0],[side*.1,.23,0],.02,'#c99331');}
  const tail=box(chicken,0,.48,-.28,.15,.3,.14,i===0?'#47674a':'#a17b51');tail.rotation.x=-.6;
  return{group:chicken,neck};
 });
 const grains=Array.from({length:18},()=>ball(group,0,0,0,.035,'#e6c45c'));
 // A towel attached to Opah's hand moves up to the line; the hung towel takes
 // over at the top of the gesture. Other washing sways gently from its pegs.
 const held=box(opah.rightArm,0,-.75,0,.65,.5,.045,'#e5bd72');
 const laundry=Array.from({length:5},(_,i)=>{
  const cloth=new THREE.Group();cloth.position.set(-12+i,2.32,-2.5);group.add(cloth);
  box(cloth,0,-.4,0,.7,.78,.035,['#8fbfd2','#db8c98','#e5bd72','#b3c57e','#e6decc'][i]);
  for(const side of [-1,1])box(cloth,side*.24,0,0,.055,.12,.06,'#b77a49');
  return cloth;
 });
 const broom=new THREE.Group();broom.name='penyapu';ros.rightArm.add(broom);
 rod(broom,[0,-.35,.05],[0,-1.3,.3],.025,'#956437');
 for(let i=0;i<9;i++)rod(broom,[(i-4)*.018,-1.25,.29],[(i-4)*.065,-1.47,.35],.022,'#c6a35b');
 const leaves=Array.from({length:14},(_,i)=>{
  const leaf=box(group,0,.19,0,.12,.018,.22,i%2?'#ad7c40':'#c69b4b');leaf.rotation.y=i*2.4;return leaf;
 });
 return{chickens,grains,laundry,held,broom,leaves,update(time:number){
  const feeding=time%4/4;
  tok.group.rotation.y=0;tok.leftArm.rotation.x=-.9;
  tok.rightArm.rotation.x=-.25-Math.sin(feeding*Math.PI)*1.1;
  for(const [i,grain] of grains.entries()){
   const flight=(feeding-.25-i*.006)/.45;grain.visible=flight>=0&&flight<=1;
   grain.position.set(9.38+(i%5-2)*.12*flight,1.05*(1-flight)+Math.sin(flight*Math.PI)*.6,-3.8+flight*(1.8+(i%3)*.25));
  }
  for(const [i,chicken] of chickens.entries()){
   const a=i*Math.PI/3+time*.18;
   chicken.group.position.set(9+Math.sin(a)*(1+i%2*.3),.16,-1.9+Math.cos(a)*.8);
   chicken.group.rotation.y=Math.atan2(-Math.sin(a),-Math.cos(a));
   chicken.neck.rotation.x=.25+Math.max(0,Math.sin(time*5+i))*1.3;
  }
  const drying=time%8/8;
  const reach=drying<.65?Math.sin(drying/.65*Math.PI/2):Math.cos((drying-.65)/.35*Math.PI/2);
  opah.group.rotation.y=0;opah.group.rotation.x=drying<.2?Math.sin(drying/.2*Math.PI)*.2:0;
  opah.rightArm.rotation.x=-.4-reach*2.4;opah.leftArm.rotation.x=-.3-reach*2.2;
  held.visible=drying<.65;laundry[2].visible=drying>=.65;
  for(const [i,cloth] of laundry.entries())cloth.rotation.x=Math.sin(time*1.8+i)*.1;
  const sweep=Math.sin(time*2.5);
  ros.group.position.set(-10+Math.sin(time*.3)*.6,.18,1);
  ros.group.rotation.y=.3;ros.group.rotation.x=.12;
  ros.rightArm.rotation.x=-.12;ros.rightArm.rotation.z=sweep*.3;
  ros.leftArm.rotation.x=-.6;
  for(const [i,leaf] of leaves.entries()){
   const gather=(Math.sin(time*.5)+1)/2;
   leaf.position.set(-9.15+(Math.sin(i*2.4)*.9)*(1-gather*.8),.19,1.5+Math.cos(i*2.4)*.65*(1-gather*.8));
  }
 }};
}
