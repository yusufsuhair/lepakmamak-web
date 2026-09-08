import type {Person} from './world';
export function dancePose(person:Person,remaining:number,time:number,reduced=false){
 person.group.rotation.x=person.group.rotation.z=0;person.leftArm.rotation.z=person.rightArm.rotation.z=0;
 const torso=person.group.children[0];torso.rotation.x=0;
 if(remaining<=0)return;
 const beat=time*Math.PI*4,soft=reduced?.35:1;
 person.group.rotation.z=Math.sin(beat*.5)*.07*soft;torso.rotation.x=Math.sin(beat)*.13*soft;
 person.leftArm.rotation.x=-1.1+Math.sin(beat)*.55*soft;person.rightArm.rotation.x=-1.1+Math.sin(beat+Math.PI)*.55*soft;
 person.leftArm.rotation.z=-.6-Math.sin(beat*.5)*.45*soft;person.rightArm.rotation.z=.6-Math.sin(beat*.5)*.45*soft;
 person.leftLeg.rotation.x=Math.sin(beat*.5)*.12*soft;person.rightLeg.rotation.x=-person.leftLeg.rotation.x;
}
export function danceVolume(distance:number){const t=Math.max(0,Math.min(1,(18-distance)/15));return .65*t*t;}
export function createDanceAudio(){
 const clips=new Map<string,{audio:HTMLAudioElement;gain:GainNode;source:MediaElementAudioSourceNode;until:number}>();
 const seen=new Map<string,number>();
 function remove(id:string){const clip=clips.get(id);if(!clip)return;clip.audio.pause();clip.audio.removeAttribute('src');clip.audio.load();clip.source.disconnect();clip.gain.disconnect();clips.delete(id);}
 return {
 update(people:{id:string;x:number;z:number;danceUntil?:number}[],pos:{x:number;z:number},ctx:AudioContext|null,out:AudioNode|null,enabled:boolean){
  const now=Date.now();for(const [id,until] of seen)if(until<=now)seen.delete(id);
  for(const [id,c] of clips){const p=people.find(p=>p.id===id);if(!enabled||!p||!p.danceUntil||p.danceUntil<=now){remove(id);continue;}c.gain.gain.setTargetAtTime(danceVolume(Math.hypot(p.x-pos.x,p.z-pos.z)),ctx!.currentTime,.15);}
  if(!enabled||!ctx||!out||ctx.state!=='running')return;
  for(const p of people){if(!p.danceUntil||p.danceUntil<=now||seen.get(p.id)===p.danceUntil||Math.hypot(p.x-pos.x,p.z-pos.z)>=18)continue;
   const audio=new Audio('/dance-bad.mp3');const gain=ctx.createGain();gain.gain.value=0;const source=ctx.createMediaElementSource(audio);source.connect(gain);gain.connect(out);clips.set(p.id,{audio,gain,source,until:p.danceUntil});seen.set(p.id,p.danceUntil);audio.currentTime=Math.max(0,10-(p.danceUntil-now)/1000);void audio.play().catch(()=>{remove(p.id);});
  }
 },stop(){for(const id of clips.keys())remove(id);seen.clear();}
 };
}
