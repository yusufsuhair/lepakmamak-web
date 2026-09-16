import * as THREE from 'three';
import {box, cullCrowd, material, setObjectShadows} from './world';
import {loadGltf} from './web-assets';
import petBreeds from '../shared/pet-breeds.json';
import type {Solid} from './physics';

const roundGeometry=new THREE.SphereGeometry(1,10,8);
const CAT_MODEL_URL='/assets/models/pets/LM_PET_Cats.glb?v=cats-v1';
let catModel:Promise<THREE.Group|null>|null=null;
function loadCatModel(){return catModel||(catModel=loadGltf(CAT_MODEL_URL).then(result=>result.scene).catch(()=>null));}

export type PetBreedId=typeof petBreeds[number]['id'];
export type PetBreed=typeof petBreeds[number];
export const petBreedList=petBreeds as readonly PetBreed[];
export type AnimalAction='idle'|'walk'|'lie'|'play'|'jump';
type CatParts={visual:THREE.Group;body:THREE.Object3D;head:THREE.Object3D;legs:THREE.Object3D[];tail:THREE.Object3D;ears:THREE.Object3D[];eyes:THREE.Object3D[]};
type Animal={group:THREE.Group;body:THREE.Group;head:THREE.Group;legs:THREE.Mesh[];tail:THREE.Group;cat:boolean;anchor:THREE.Object3D;parts:CatParts|null;breed:PetBreedId|null};

function round(parent:THREE.Object3D,x:number,y:number,z:number,scale:number[],color:string){const mesh=new THREE.Mesh(roundGeometry,material(color));mesh.position.set(x,y,z);mesh.scale.set(...scale as [number,number,number]);mesh.castShadow=true;parent.add(mesh);return mesh;}

function breedFor(color:string,breed?:string){
  const selected=petBreedList.find(item=>item.id===breed);
  if(selected)return selected;
  return petBreedList.find(item=>item.base==='pet-ginger'&&item.fur.toLowerCase()===color.toLowerCase())||petBreedList[0];
}

function materialShade(mesh:THREE.Mesh,breed:PetBreed,source:THREE.Material){
  const next=source.clone() as THREE.Material & {color?:THREE.Color};
  const name=mesh.name.toLowerCase();
  let shade='';
  if(name.includes('eye-glint'))shade='#fffdf0';
  else if(name.includes('eye'))shade=breed.eye;
  else if(name.includes('nose'))shade='#c66f75';
  else if(name.includes('ear-inner'))shade='#dd9698';
  else if(name.includes('belly')||name.includes('cheek')||name.includes('paw-shell'))shade=breed.belly;
  else if(breed.id==='tuxedo'&&(name.includes('chest')||name.includes('neck')||name.includes('paw')))shade=breed.belly;
  else if(breed.id==='siamese'&&(name.includes('ear-shell')||name.includes('tail-segment')||name.includes('leg-shin')))shade=breed.stripe;
  else if(breed.id==='calico'&&(name.includes('tail-segment-tip')||name.includes('ear-shell-l')))shade=breed.stripe;
  else shade=breed.fur;
  if(next.color&&shade)next.color.set(shade);
  return next;
}

function attachCatModel(animal:Animal,template:THREE.Group,breed:PetBreed){
  if(animal.group.userData.disposed||animal.parts)return;
  const visual=template.clone(true);visual.name='LM_PET_Cat_Visual';visual.rotation.x=Math.PI/2;visual.position.y=-.24;visual.scale.setScalar(breed.scale);
  const materials=new Set<THREE.Material>();
  visual.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const source=Array.isArray(object.material)?object.material:[object.material];
    const copies=source.map(item=>{const copy=materialShade(object,breed,item);materials.add(copy);return copy;});
    object.material=Array.isArray(object.material)?copies:copies[0];object.castShadow=true;object.receiveShadow=true;
  });
  const body=visual.getObjectByName('pet-body'),head=visual.getObjectByName('pet-head'),tail=visual.getObjectByName('pet-tail-base');
  if(!body||!head||!tail){visual.traverse(object=>{if(object instanceof THREE.Mesh)for(const item of Array.isArray(object.material)?object.material:[object.material])item.dispose();});return;}
  const legs=['pet-leg-fl','pet-leg-fr','pet-leg-bl','pet-leg-br'].map(name=>visual.getObjectByName(name)).filter((part):part is THREE.Object3D=>!!part);
  const ears=['pet-ear-l','pet-ear-r'].map(name=>visual.getObjectByName(name)).filter((part):part is THREE.Object3D=>!!part);
  const eyes=['pet-eye-l','pet-eye-r'].map(name=>visual.getObjectByName(name)).filter((part):part is THREE.Object3D=>!!part);
  animal.body.visible=false;animal.group.add(visual);animal.anchor=body;animal.parts={visual,body,head,legs,tail,ears,eyes};animal.breed=breed.id;animal.group.userData.catModel='blender';animal.group.userData.catMaterials=materials;
}

/** Reset and pose either the Blender rig or the synchronous fallback. */
export function animateAnimal(animal:Animal,action:AnimalAction,time:number,phase=0){
  const parts=animal.parts;
  const body=parts?.body||animal.body,head=parts?.head||animal.head,legs=parts?.legs||animal.legs,tail=parts?.tail||animal.tail;
  body.rotation.set(0,0,0);head.rotation.set(0,0,0);tail.rotation.set(0,0,0);body.position.y=0;
  for(const leg of legs)leg.rotation.set(0,0,0);
  animal.group.userData.poseYOffset=0;
  if(parts){parts.head.position.set(0,.31,action==='lie'?- .75:-.92);parts.body.position.set(0,0,action==='lie'?- .36:-.47);}
  const stride=time*10+phase;
  if(action==='walk'){
    for(const [index,leg] of legs.entries())leg.rotation.x=Math.sin(stride+(index===0||index===3?0:Math.PI))*.48;
    body.position.y=Math.abs(Math.sin(stride))*.025;tail.rotation.z=Math.sin(time*3+phase)*.28;head.rotation.z=Math.sin(time*1.7+phase)*.04;
  }else if(action==='lie'){
    body.rotation.y=.92;head.rotation.z=-.25;tail.rotation.z=.4;animal.group.userData.poseYOffset=-.16;
  }else if(action==='play'){
    body.rotation.x=-.20;head.rotation.x=.22;head.rotation.z=Math.sin(time*4+phase)*.14;tail.rotation.z=Math.sin(time*5+phase)*.7;
    for(const [index,leg] of legs.entries())leg.rotation.x=index<2?-.34+Math.sin(time*5+index)*.14:.18;
  }else if(action==='jump'){
    animal.group.userData.poseYOffset=Math.max(0,Math.sin((time+phase)*5))* .42;body.rotation.x=.12;head.rotation.x=-.12;tail.rotation.z=Math.sin(time*6+phase)*.5;
    for(const leg of legs)leg.rotation.x=-.65;
  }else{
    body.position.y=Math.abs(Math.sin(time*1.8+phase))*.018;head.rotation.z=Math.sin(time*.9+phase)*.06;tail.rotation.z=Math.sin(time*1.8+phase)*.22;
    if(parts&&Math.sin(time*.8+phase)>0.93)for(const ear of parts.ears)ear.rotation.z=Math.sin(time*14+phase)*.16;
  }
  if(parts){const blink=Math.sin(time*.95+phase)>0.985? .12:1;for(const eye of parts.eyes)eye.scale.y=blink;}
}

export function createAnimal(cat:boolean,color:string,breed?:string):Animal{
 const group=new THREE.Group(),body=new THREE.Group();group.add(body);
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
 setObjectShadows(group,false);group.traverse(o=>{if(o instanceof THREE.Mesh)o.receiveShadow=false;});
 const animal:Animal={group,body,head,legs,tail,cat,anchor:body,parts:null,breed:cat?breedFor(color,breed).id:null};
 if(cat){const selected=breedFor(color,breed);group.userData.petBreed=selected.id;void loadCatModel().then(template=>{if(template)attachCatModel(animal,template,selected);});}
 return animal;
}

export function createStreetAnimals(scene:THREE.Scene,solids:Solid[]){
 const seeds=[[-12,49],[-12,58],[12,34],[65,45],[-68,55],[52,-87],[-57,27],[-62,-22],[-21,-35],[23,-44],[54,-21],[103,88],[132,94],[-112,55],[105,-14],[34,94],[-42,132],[-119,-72],[48,-112],[-45,-111]];
 const colors=['#e6a34e','#c89c70','#f0e8d8','#f3e4cc','#888f96','#79543e','#d8b27c','#4c4640','#e8d4b8','#b56f4a'];
 const animals=seeds.map(([sx,sz],i)=>{
  let x=sx,z=sz,found=false;
  for(let r=0;r<=18&&!found;r+=3)for(let a=0;a<8&&!found;a++){const cx=sx+Math.cos(a*Math.PI/4)*r,cz=sz+Math.sin(a*Math.PI/4)*r;if(solids.every(s=>Math.abs(cx-s.x)>s.hx+2.5||Math.abs(cz-s.z)>s.hz+2.5)){x=cx;z=cz;found=true;}}
  const cat=i%2===0,breed=cat?petBreedList[i%petBreedList.length].id:undefined,pet=createAnimal(cat,colors[i%colors.length],breed);pet.group.scale.setScalar((pet.cat?.82:.94)+(i%4)*.045);pet.group.name=cat?'Street cat':'Street dog';scene.add(pet.group);cullCrowd(pet.group,100);
  return {...pet,x,z,phase:i*5.3,nextSound:0,routeRadius:1.25+(i%4)*.32};
 });
 let lastSound=-10;
 return {animals,update(time:number,listener:{x:number;z:number},sound:(cat:boolean,volume:number,pan:number)=>void,range=1){
  for(const [i,pet] of animals.entries()){
   const cycle=(time+pet.phase)%32,action=pet.cat?(cycle<16?'walk':cycle<20?'idle':cycle<25?'lie':cycle<29?'play':'jump'):(cycle<18?'walk':cycle<26?'play':'idle');
   const walking=action==='walk',angle=walking?cycle/18*Math.PI*2:0;
   pet.group.position.set(pet.x+Math.sin(angle)*pet.routeRadius,.12+(pet.group.userData.poseYOffset||0),pet.z+Math.cos(angle)*pet.routeRadius);
   pet.group.rotation.y=walking?Math.PI/2+angle:Math.sin(time*.8+i)*.3;
   if(pet.cat)animateAnimal(pet,action,time,pet.phase);else{pet.body.rotation.z=action==='play'?Math.sin(time*3)*.8:0;pet.body.position.y=action==='play'?Math.abs(Math.sin(time*3))*.12:walking?Math.abs(Math.sin(time*7))*.025:0;pet.head.rotation.x=action==='play'?Math.sin(time*4)*.25:Math.sin(time*1.8+i)*.08;pet.tail.rotation.z=Math.sin(time*9)*.65;pet.legs.forEach((leg,j)=>leg.rotation.x=walking?Math.sin(time*7+(j===0||j===3?0:Math.PI))*.45:action==='play'?Math.sin(time*5+j)*.3:0);}
   const distance=Math.hypot(listener.x-pet.group.position.x,listener.z-pet.group.position.z);pet.group.visible=distance<68;
   if(distance<14*range&&time>pet.nextSound&&time-lastSound>2.5){pet.nextSound=time+9+i;lastSound=time;const audibleDistance=distance/range;sound(pet.cat,Math.pow(1-audibleDistance/14,2),Math.max(-1,Math.min(1,(pet.group.position.x-listener.x)/(14*range))));}
  }
 }};
}

export function animalSound(context:AudioContext,cat:boolean,volume:number,pan:number,destination:AudioNode=context.destination){
 const now=context.currentTime,output=context.createGain(),stereo=context.createStereoPanner();stereo.pan.value=pan;output.gain.value=volume*.09;output.connect(stereo);stereo.connect(destination);const duration=cat?.7:.42;
 const oscillator=context.createOscillator(),filter=context.createBiquadFilter(),envelope=context.createGain();oscillator.type=cat?'sawtooth':'triangle';filter.type='lowpass';filter.frequency.value=cat?1600:700;oscillator.frequency.setValueAtTime(cat?620:210,now);oscillator.frequency.exponentialRampToValueAtTime(cat?940:100,now+duration*.25);oscillator.frequency.exponentialRampToValueAtTime(cat?420:70,now+duration);envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(1,now+.04);envelope.gain.exponentialRampToValueAtTime(.001,now+duration);
 let noise:AudioBufferSourceNode|undefined;if(!cat){const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.65;noise=context.createBufferSource();noise.buffer=buffer;noise.connect(filter);noise.start();envelope.gain.cancelScheduledValues(now);envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(1,now+.02);envelope.gain.linearRampToValueAtTime(.02,now+.15);envelope.gain.linearRampToValueAtTime(.8,now+.23);envelope.gain.exponentialRampToValueAtTime(.001,now+duration);}
 oscillator.connect(filter);filter.connect(envelope);envelope.connect(output);oscillator.start();oscillator.stop(now+duration);oscillator.onended=()=>{oscillator.disconnect();noise?.disconnect();filter.disconnect();envelope.disconnect();output.disconnect();stereo.disconnect();};return output;
}
