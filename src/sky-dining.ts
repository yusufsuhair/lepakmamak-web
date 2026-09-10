import * as THREE from 'three';
import {box,createPerson,material} from './world';
import type {Solid} from './physics';
import {SKY,inSkyPool} from '../shared/sky-dining.mjs';
import tables from '../shared/tables.json';
import chairs from '../shared/chairs.json';

export function swimPose(person:ReturnType<typeof createPerson>,time:number){
 person.leftArm.rotation.x=-1.2+Math.sin(time*2.5)*.45;
 person.rightArm.rotation.x=-1.2-Math.sin(time*2.5)*.45;
 person.leftLeg.rotation.x=Math.sin(time*3)*.22;person.rightLeg.rotation.x=-person.leftLeg.rotation.x;
}
export function createSkyDining(scene:THREE.Scene){
 const root=new THREE.Group();root.name='Wet Deck · Sky Dining';root.position.set(SKY.x,SKY.y,SKY.z);scene.add(root);
 const solids:Solid[]=[];
 box(root,0,-4.1,0,34,3.8,30,'#233447');
 const glow=(color:string)=>new THREE.MeshBasicMaterial({color});
 const blue=glow('#51aaff'),pink=glow('#e73dff'),gold=glow('#ffe0a0');
 const glass=new THREE.MeshStandardMaterial({color:'#9dd5ed',transparent:true,opacity:.18,roughness:.15,depthWrite:false,side:THREE.DoubleSide});
 function label(text:string,x:number,y:number,z:number,w:number){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d')!;
  c.fillStyle='#11182e';c.fillRect(0,0,1024,128);c.fillStyle='#f9e5bd';c.font='600 62px sans-serif';c.textAlign='center';c.fillText(text,512,86,990);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w/8),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);root.add(mesh);return mesh;
 }
 function obstacle(x:number,z:number,w:number,d:number){solids.push({x:SKY.x+x,z:SKY.z+z,hx:w/2,hz:d/2});}
 // Four slabs leave a real recessed basin: swimmers do not disappear through an opaque deck.
 box(root,0,-.3,5,36,.6,22,'#b6a79d');box(root,-14,-.3,-10,8,.6,8,'#b6a79d');box(root,14,-.3,-10,8,.6,8,'#b6a79d');box(root,0,-.3,-15,36,.6,2,'#b6a79d');
 box(root,0,-1.8,-10,18,.25,8,'#246b84');
 const water=new THREE.MeshStandardMaterial({color:'#784fce',emissive:'#362368',emissiveIntensity:.65,transparent:true,opacity:.73,roughness:.18,metalness:.35,depthWrite:false});
 const surface=box(root,0,-.18,-10,18,.06,8,water);surface.name='Swimming pool';
 for(const x of [-9.2,9.2])box(root,x,-.5,-10,.35,1.5,8.5,'#477d98');
 for(const z of [-14.2,-5.8]){box(root,0,-.5,z,18.5,1.5,.35,'#477d98');box(root,0,.03,z,18.5,.07,.14,pink);}
 // Broad shallow steps on the lounge side give an obvious way in and out.
 for(let i=0;i<4;i++)box(root,0,-.15-i*.34,-6.05-i*.65,3.8,.3,.75,'#88a9c3');
 const ripples:THREE.Mesh[]=[];
 for(let i=0;i<7;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(.7,.74,36),new THREE.MeshBasicMaterial({color:'#d4b9ff',transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(-7+i*2.2,-.12,-10+(i%3-1)*2);root.add(ring);ripples.push(ring);}
 // Clear north-facing edge frames the actual KLCC skyline.
 for(const x of [-17.7,17.7]){box(root,x,.8,0,.12,1.6,32,glass);box(root,x,1.6,0,.1,.07,32,gold);obstacle(x,0,.3,32);}
 for(const z of [-15.7,15.7]){box(root,0,.8,z,36,1.6,.12,glass);box(root,0,1.6,z,36,.07,.1,gold);obstacle(0,z,36,.3);}
 // Indoor half: curved ceiling ribbons, blue hanging strands and a warm-backed bar.
 const roof=box(root,0,5.4,9,36,.25,14,new THREE.MeshStandardMaterial({color:'#23263e',transparent:true,opacity:1}));box(root,0,2.6,15.5,36,5.2,.15,'#182338');
 for(const x of [-17.5,17.5])box(root,x,2.6,9,.15,5.2,13,glass);
 for(let i=0;i<4;i++){
  const points=Array.from({length:24},(_,j)=>new THREE.Vector3(-17+j*34/23,5.1,3+i*3+Math.sin(j*.3+i)*.8));
  const ribbon=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.055,5,false),blue);root.add(ribbon);
 }
 for(let i=0;i<52;i++){const x=-17+i*34/51;box(root,x,3.8,15.25,.035,2.7,.035,i%3?blue:pink);}
 for(const x of [-16,-8,8,16])box(root,x,2.6,3,.18,5.2,.18,'#b7a8b6');
 box(root,0,.6,3,12,1.2,2.4,'#262538');box(root,0,1.27,3,12.5,.18,2.8,'#dfd3bf');obstacle(0,3,12.5,2.8);
 box(root,0,.15,1.57,11.8,.15,.08,gold);label('WET DECK · SKY DINING',0,3.7,14.95,14);
 for(let i=0;i<9;i++){box(root,-5+i*1.25,1.5,3,.18,.4,.18,['#65bfac','#d898bb','#dfb767'][i%3]);box(root,-5+i*1.25,.6,5.3,.7,.18,.7,'#6e7cb8');box(root,-5+i*1.25,.3,5.3,.1,.6,.1,'#ad986e');}
 // Banquettes retain the reference's navy upholstery and magenta cushions.
 for(const x of [-11,0,11]){box(root,x,.45,13.4,7,.65,1.7,'#172342');box(root,x,1.05,14.15,7,1,.25,'#202342');for(const dx of [-2,0,2])box(root,x+dx,.9,13.7,1,.75,.25,dx?'#a63b7f':'#7453ad');}
 for(const x of [-16,16])for(const z of [-14,-5]){
  box(root,x,.45,z,1.25,.9,1.25,'#263c45');obstacle(x,z,1.25,1.25);
  for(let j=0;j<5;j++){const leaf=box(root,x+Math.sin(j*1.3)*.3,1.2,z+Math.cos(j*1.3)*.3,.16,1.3,.5,'#456e68');leaf.rotation.z=Math.sin(j)*.35;}
 }
 const rooftopTables=tables.filter(t=>t.id.startsWith('sky-'));
 for(const table of rooftopTables){const x=table.x-SKY.x,z=table.z-SKY.z;
  const large=table.id==='sky-7';
  if(large){const top=new THREE.Mesh(new THREE.CylinderGeometry(1.9,1.9,.15,32),material('#34314b'));top.position.set(x,.9,z);root.add(top);label('WEREWOLF · 9 SEATS',x,2.6,z,4);}
  else box(root,x,.9,z,2.2,.15,2.2,'#34314b');
  box(root,x,.43,z,.22,.85,.22,'#bcaa7d');obstacle(x,z,large?3.2:2.2,large?3.2:2.2);
  box(root,x,1.06,z,.18,.24,.18,pink);
  for(const chair of chairs.filter(c=>c.tableId===table.id)){const seat=new THREE.Group();seat.position.set(chair.x-SKY.x,0,chair.z-SKY.z);seat.rotation.y=chair.yaw;root.add(seat);box(seat,0,.5,0,.85,.18,.85,'#493657');box(seat,0,.96,-.38,.9,.85,.15,'#574268');for(const dx of [-.32,.32])for(const dz of [-.32,.32])box(seat,dx,.25,dz,.06,.5,.06,'#b8a180');}
 }
 const dj=createPerson('#24304c');dj.group.position.set(-14,0,6.5);root.add(dj.group);box(root,-14,1,5.5,3.3,.28,1.2,'#171827');obstacle(-14,5.5,3.3,1.2);
 for(const x of [-14.8,-13.2]){const disc=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.04,24),material('#58a9c8'));disc.position.set(x,1.17,5.5);root.add(disc);}
 for(const x of [-16.3,-11.7])box(root,x,.8,5.5,.7,1.6,.65,'#171b28');
 const swimmers=Array.from({length:4},(_,i)=>{const p=createPerson(['#496d91','#784c97','#397b80','#864f73'][i]);root.add(p.group);return p;});
 for(const [x,z,color] of [[-6,5,'#86633c'],[5,6,'#527c85'],[-6,12,'#714971'],[5,12,'#386879']] as const){const p=createPerson(color);p.group.position.set(x,0,z);root.add(p.group);}
 // A lift vestibule sits on the existing hotel, with a visible street-level entrance.
 box(root,14,1.6,12,3.8,3.2,3,'#242d47');obstacle(14,13,3.8,1);
 label('LIFT ↓',14,2.6,10.45,3);label('POOL · STEPS ↓',0,.65,-5.3,4);
 const entry=new THREE.Group();entry.position.set(SKY.entry.x,0,SKY.entry.z);scene.add(entry);box(entry,0,1.6,0,3.4,3.2,1.5,'#28314a');
 const streetLabel=label('WET DECK ↑',SKY.entry.x-SKY.x,3.7-SKY.y,SKY.entry.z-SKY.z+.8,5);streetLabel.name='Street lift sign';
 return {root,solids,update(time:number,reduced:boolean,visiting=false){
  roof.visible=!visiting;roof.castShadow=!visiting;
  ripples.forEach((r,i)=>{r.scale.setScalar(reduced?1:1+(time*.3+i*.2)%1.6);(r.material as THREE.MeshBasicMaterial).opacity=reduced?.15:.3*(1-((time*.3+i*.2)%1.6)/1.6);});
  swimmers.forEach((p,i)=>{const t=reduced?i:time*.13+i*Math.PI/2;p.group.position.set(Math.sin(t)*(5-i*.4),-1.15,-10+Math.cos(t)*2);p.group.rotation.y=t+Math.PI/2;swimPose(p,reduced?0:time+i);});
  dj.leftArm.rotation.x=-1.2;dj.rightArm.rotation.x=-1.2+(reduced?0:Math.sin(time*2)*.15);
 },swimming:inSkyPool};
}
