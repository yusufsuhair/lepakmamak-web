import * as THREE from 'three';
import {box, material} from './world';
import type {Solid} from './physics';
const roundGeometry=new THREE.SphereGeometry(1,10,8);
function round(parent:THREE.Object3D,x:number,y:number,z:number,scale:number[],color:string){const mesh=new THREE.Mesh(roundGeometry,material(color));mesh.position.set(x,y,z);mesh.scale.set(...scale as [number,number,number]);mesh.castShadow=true;parent.add(mesh);return mesh;}
export function createAnimal(cat:boolean,color:string){
 const group=new THREE.Group(), body=new THREE.Group();group.add(body);
 round(body,0,.43,0,cat?[.23,.23,.42]:[.29,.29,.48],color);
 const head=new THREE.Group();head.position.set(0,.66,.4);body.add(head);
 round(head,0,0,0,cat?[.27,.25,.23]:[.29,.27,.26],color);
 round(head,0,-.08,.2,[.16,.1,.11],'#fff0d5');
 for(const side of [-1,1]){
  round(head,side*.115,.025,.215,[.045,.065,.03],'#23332d');round(head,side*.105,.046,.242,[.014,.019,.01],'#ffffff');
  if(cat){const ear=new THREE.Mesh(new THREE.ConeGeometry(.115,.25,3),material(color));ear.position.set(side*.17,.24,-.01);head.add(ear);const inner=box(head,side*.17,.24,.035,.065,.1,.025,'#edb0ab');inner.rotation.z=side*-.2;}
  else {const ear=round(head,side*.265,-.045,-.02,[.10,.24,.13],'#68462f');ear.rotation.z=side*.16;}
 }
 round(head,0,-.055,.305,[.045,.03,.025],cat?'#e69c9a':'#23332d');
 if(!cat)round(head,0,-.15,.27,[.055,.075,.025],'#f1a2a0');
 const legs:THREE.Mesh[]=[];
 for(const x of [-.16,.16])for(const z of [-.27,.27]){const leg=round(body,x,.2,z,[.075,.19,.085],color);legs.push(leg);round(leg,0,-.7,.2,[1.12,.4,1.25],'#fff0d5');}
 const tail=new THREE.Group();tail.position.set(0,.48,-.37);body.add(tail);
 const tip=round(tail,0,cat?.25:.13,-.12,cat?[.055,.32,.055]:[.07,.22,.075],color);tip.rotation.x=-.55;
 if(cat)for(const x of [-.12,.12])box(head,x,-.075,.285,.16,.012,.012,'#fff0d5');
 else box(body,0,.65,.23,.52,.055,.085,'#62b8ac');
 return {group,body,head,legs,tail,cat};
}
export function createStreetAnimals(scene:THREE.Scene,solids:Solid[]){
 const seeds=[[-12,49],[-12,58],[12,34],[65,45],[-68,55],[52,-87]];
 const animals=seeds.map(([sx,sz],i)=>{
  let x=sx,z=sz,found=false;
  for(let r=0;r<=18&&!found;r+=3)for(let a=0;a<8&&!found;a++){
   const cx=sx+Math.cos(a*Math.PI/4)*r,cz=sz+Math.sin(a*Math.PI/4)*r;
   if(solids.every(s=>Math.abs(cx-s.x)>s.hx+2.5||Math.abs(cz-s.z)>s.hz+2.5)){x=cx;z=cz;found=true;}
  }
  const pet=createAnimal(i%2===0,['#e6a34e','#c89c70','#f0e8d8','#f3e4cc','#888f96','#79543e'][i]);
  pet.group.name=i%2===0?'Street cat':'Street dog';scene.add(pet.group);
  return {...pet,x,z,phase:i*5.3,nextSound:0};
 });
 let lastSound=-10;
 return {animals,update(time:number,listener:{x:number;z:number},sound:(cat:boolean,volume:number,pan:number)=>void){
  for(const [i,pet] of animals.entries()){
   const cycle=(time+pet.phase)%32,walking=cycle<18,playing=cycle>=18&&cycle<26;
   const angle=walking?cycle/18*Math.PI*2:0;
   pet.group.position.set(pet.x+Math.sin(angle)*1.7,.12,pet.z+Math.cos(angle)*1.7);
   pet.group.rotation.y=walking?Math.PI/2+angle:Math.sin(time*.8+i)*.3;
   pet.body.rotation.z=playing?(pet.cat?Math.sin(time*3)*.8:Math.sin(time*6)*.12):0;
   pet.body.position.y=playing?Math.abs(Math.sin(time*3))*.12:walking?Math.abs(Math.sin(time*7))*.025:0;
   pet.head.rotation.x=playing?Math.sin(time*4)*.25:Math.sin(time*1.8+i)*.08;
   pet.tail.rotation.z=Math.sin(time*(pet.cat?3:9))*(pet.cat?.25:.65);
   pet.legs.forEach((leg,j)=>leg.rotation.x=walking?Math.sin(time*7+(j===0||j===3?0:Math.PI))*.45:playing?Math.sin(time*5+j)*.3:0);
   const distance=Math.hypot(listener.x-pet.group.position.x,listener.z-pet.group.position.z);
   if(distance<14&&time>pet.nextSound&&time-lastSound>2.5){
    pet.nextSound=time+9+i;lastSound=time;sound(pet.cat,Math.pow(1-distance/14,2),Math.max(-1,Math.min(1,(pet.group.position.x-listener.x)/14)));
   }
  }
 }};
}
export function animalSound(context:AudioContext,cat:boolean,volume:number,pan:number,destination:AudioNode=context.destination){
 const now=context.currentTime,output=context.createGain(),stereo=context.createStereoPanner();stereo.pan.value=pan;output.gain.value=volume*.09;output.connect(stereo);stereo.connect(destination);
 const duration=cat?.7:.42;
 const oscillator=context.createOscillator(),filter=context.createBiquadFilter(),envelope=context.createGain();
 oscillator.type=cat?'sawtooth':'triangle';filter.type='lowpass';filter.frequency.value=cat?1600:700;
 oscillator.frequency.setValueAtTime(cat?620:210,now);oscillator.frequency.exponentialRampToValueAtTime(cat?940:100,now+duration*.25);oscillator.frequency.exponentialRampToValueAtTime(cat?420:70,now+duration);
 envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(1,now+.04);envelope.gain.exponentialRampToValueAtTime(.001,now+duration);
 let noise:AudioBufferSourceNode|undefined;
 if(!cat){
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.65;
  noise=context.createBufferSource();noise.buffer=buffer;noise.connect(filter);noise.start();
  envelope.gain.cancelScheduledValues(now);envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(1,now+.02);envelope.gain.linearRampToValueAtTime(.02,now+.15);envelope.gain.linearRampToValueAtTime(.8,now+.23);envelope.gain.exponentialRampToValueAtTime(.001,now+duration);
 }
 oscillator.connect(filter);filter.connect(envelope);envelope.connect(output);oscillator.start();oscillator.stop(now+duration);
 oscillator.onended=()=>{oscillator.disconnect();noise?.disconnect();filter.disconnect();envelope.disconnect();output.disconnect();stereo.disconnect();};
 return output;
}
