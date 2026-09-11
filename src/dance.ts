import * as THREE from 'three';
import type {Person} from './world';
// Hand-authored from the supplied five-second reference: face flicks/steps,
// then hands framing the chest with shoulder and chest rolls. Repeat for 10s.
const poses=[
// time, left shoulder x/z, right shoulder x/z, left/right elbow, chest x/y/z, left/right step
 [0,-.55,-.5,-1.3,.2,-1.1,-1.55,0,-.12,.04,.3,-.25],
 [.35,-.55,-.45,-1.5,.35,-1.0,-1.75,-.05,.12,-.04,-.35,.25],
 [.7,-.4,-.3,-1.35,.55,-.9,-1.5,.04,-.14,.035,.28,-.32],
 [1.05,-.6,-.5,-1.5,.22,-1.15,-1.7,-.04,.12,-.04,-.32,.24],
 [1.4,-.45,-.35,-1.4,.45,-.9,-1.6,.04,-.1,.04,.25,-.3],
 [1.8,-.7,-.6,-.9,.6,-1.45,-1.45,0,0,0,0,0],
 [2.2,-.7,-.65,-.7,.65,-1.6,-1.6,-.12,-.14,.06,0,0],
 [2.65,-.7,-.65,-.7,.65,-1.6,-1.6,.12,.14,-.06,.04,-.04],
 [3.1,-.7,-.65,-.7,.65,-1.6,-1.6,-.13,-.13,.06,0,0],
 [3.55,-.7,-.65,-.7,.65,-1.6,-1.6,.12,.13,-.06,.04,-.04],
 [4,-.7,-.65,-.7,.65,-1.6,-1.6,-.13,-.14,.06,0,0],
 [4.5,-.7,-.65,-.7,.65,-1.6,-1.6,.12,.14,-.06,.04,-.04],
 [5,-.55,-.5,-1.3,.2,-1.1,-1.55,0,-.12,.04,.3,-.25],
];
type Rig={upper:THREE.Group;parts:{object:THREE.Object3D;y:number}[];elbows:THREE.Group[];forearms:{object:THREE.Object3D;y:number;arm:THREE.Group}[];active:boolean};
const rigs=new WeakMap<Person,Rig>();
export function dancePose(person:Person,remaining:number,time:number,reduced=false){
 let rig=rigs.get(person);
 if(remaining<=0){
  if(rig?.active){for(const p of rig.parts){person.group.add(p.object);p.object.position.y=p.y;}for(const p of rig.forearms){p.arm.add(p.object);p.object.position.y=p.y;}rig.upper.removeFromParent();for(const e of rig.elbows)e.removeFromParent();rig.active=false;person.group.rotation.z=0;person.leftArm.rotation.z=person.rightArm.rotation.z=0;}
  return;
 }
 if(!rig){const parts=person.group.children.filter(o=>o!==person.leftLeg&&o!==person.rightLeg).map(object=>({object,y:object.position.y}));const elbows=[new THREE.Group(),new THREE.Group()];const forearms=[person.leftArm,person.rightArm].map(arm=>({object:arm.children[1],y:arm.children[1].position.y,arm}));rig={upper:new THREE.Group(),parts,elbows,forearms,active:false};rig.upper.position.y=1;rigs.set(person,rig);}
 if(!rig.active){person.group.add(rig.upper);for(const p of rig.parts){rig.upper.add(p.object);p.object.position.y=p.y-1;}rig.forearms.forEach((p,i)=>{const e=rig!.elbows[i];e.position.y=-.34;p.arm.add(e);e.add(p.object);p.object.position.y=p.y+.34;});rig.active=true;}
 const t=((time%5)+5)%5;let index=0;while(index<poses.length-2&&poses[index+1][0]<t)index++;const a=poses[index],b=poses[index+1];let f=(t-a[0])/(b[0]-a[0]);f=f*f*(3-2*f);const v=(i:number)=>a[i]+(b[i]-a[i])*f;const soft=reduced?.35:1;
 person.leftArm.rotation.set(v(1),0,v(2));person.rightArm.rotation.set(v(3),0,v(4));rig.elbows[0].rotation.x=v(5);rig.elbows[1].rotation.x=v(6);const chest=Math.min(1,Math.max(0,(t-1.6)/.4))*Math.min(1,(5-t)/.4);rig.elbows[0].rotation.z=chest*.85;rig.elbows[1].rotation.z=-chest*.85;
 rig.upper.rotation.set(v(7)*soft,v(8)*soft,v(9)*soft);rig.upper.position.z=-Math.sin(t*Math.PI*4)*.025*soft;
 person.leftLeg.rotation.x=v(10)*soft;person.rightLeg.rotation.x=v(11)*soft;person.group.rotation.z=Math.sin(t*Math.PI*2)*.025*soft;
}
export function danceVolume(distance:number){const t=Math.max(0,Math.min(1,(18-distance)/15));return .42*t*t;}
export function createDanceAudio(){
 const clips=new Map<string,{audio:HTMLAudioElement;gain:GainNode;source:MediaElementAudioSourceNode;until:number}>();
 const seen=new Map<string,number>();
 function remove(id:string){const clip=clips.get(id);if(!clip)return;clip.audio.pause();clip.audio.removeAttribute('src');clip.audio.load();clip.source.disconnect();clip.gain.disconnect();clips.delete(id);}
 return {
 update(people:{id:string;x:number;z:number;danceUntil?:number}[],pos:{x:number;z:number},ctx:AudioContext|null,out:AudioNode|null,enabled:boolean,range=1){
  const now=Date.now();for(const [id,until] of seen)if(until<=now)seen.delete(id);
  for(const [id,c] of clips){const p=people.find(p=>p.id===id);if(!enabled||!p||!p.danceUntil||p.danceUntil<=now){remove(id);continue;}c.gain.gain.setTargetAtTime(danceVolume(Math.hypot(p.x-pos.x,p.z-pos.z)/range),ctx!.currentTime,.15);}
  if(!enabled||!ctx||!out||ctx.state!=='running')return;
  for(const p of people){if(!p.danceUntil||p.danceUntil<=now||seen.get(p.id)===p.danceUntil||Math.hypot(p.x-pos.x,p.z-pos.z)>=18*range)continue;
   const audio=new Audio('/dance-bad.mp3');const gain=ctx.createGain();gain.gain.value=0;const source=ctx.createMediaElementSource(audio);source.connect(gain);gain.connect(out);clips.set(p.id,{audio,gain,source,until:p.danceUntil});seen.set(p.id,p.danceUntil);audio.currentTime=Math.max(0,10-(p.danceUntil-now)/1000);void audio.play().catch(()=>{remove(p.id);});
  }
 },stop(){for(const id of clips.keys())remove(id);seen.clear();}
 };
}
