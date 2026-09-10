import * as THREE from 'three';
import {box,createPerson,material,palm,type World} from './world';
import tables from '../shared/tables.json';
import chairs from '../shared/chairs.json';

export const BEACH={minX:95,maxX:153,minZ:131,shoreZ:152};
export function createBeach(scene:THREE.Scene,world:World){
 const g=new THREE.Group();g.name='Pantai Senja';scene.add(g);
 const mesh=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>{const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
 const pole=(x:number,y:number,z:number,r:number,h:number,color:string)=>mesh(new THREE.CylinderGeometry(r,r,h,10),color,x,y,z);
 const sphere=(x:number,y:number,z:number,r:number,color:string)=>mesh(new THREE.IcosahedronGeometry(r,1),color,x,y,z);
 function sign(text:string,x:number,y:number,z:number,w:number){const c=document.createElement('canvas');c.width=768;c.height=160;const ctx=c.getContext('2d')!;ctx.fillStyle='#245e58';ctx.fillRect(0,0,768,160);ctx.fillStyle='#fff1bf';ctx.font='bold 58px sans-serif';ctx.textAlign='center';ctx.fillText(text,384,100);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*160/768),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide}));m.position.set(x,y,z);g.add(m);}
 box(g,124,-.015,142,58,.06,22,'#edd3a0');
 box(g,124,.015,151,58,.02,2,'#d6bf94');
 box(g,88,.025,132,16,.05,3,'#b3936c');
 for(let x=81;x<99;x+=.65)box(g,x,.06,132,.5,.04,3,'#c3a67c');
 sign('PANTAI SENJA',98,3.6,132,9);pole(94,1.65,132,.1,3.3,'#796245');pole(102,1.65,132,.1,3.3,'#796245');
 world.mapBuildings.push({x:124,z:142,w:58,d:22,color:'#edd3a0'});
 // Broad sea with actual travelling wave geometry and translucent breaking crests.
 const seaGeometry=new THREE.PlaneGeometry(100,180,64,96);seaGeometry.rotateX(-Math.PI/2);
 const sea=new THREE.Mesh(seaGeometry,new THREE.MeshStandardMaterial({color:'#329ca4',roughness:.32,metalness:.2,side:THREE.DoubleSide}));sea.position.set(124,.18,242);g.add(sea);
 const foam=Array.from({length:8},()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(57,.5,28,1),new THREE.MeshBasicMaterial({color:'#e5fff6',transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;g.add(m);return m;});
 for(const [x,z] of [[98,145],[149,133],[148,148],[102,137]]){
  palm(g,x,z,.85);
 }
 for(const t of tables.filter(t=>t.id.startsWith('pantai-'))){
  const seats=chairs.filter(c=>c.tableId===t.id),big=seats.length===9;
  pole(t.x,1.02,t.z,big?1.95:1.14,.16,'#d6ab75');pole(t.x,.5,t.z,.17,1,'#765839');world.solids.push({x:t.x,z:t.z,hx:big?1.2:.9,hz:big?1.2:.9});
  for(const seat of seats){const c=new THREE.Group();c.position.set(seat.x,0,seat.z);c.rotation.y=seat.yaw;g.add(c);box(c,0,.6,0,.75,.1,.75,'#387f82');box(c,0,1,-.34,.75,.75,.1,'#387f82');for(const dx of [-.28,.28])for(const dz of [-.28,.28])box(c,dx,.3,dz,.07,.6,.07,'#765839');}
  if(big)sign('WEREWOLF · 9 TEMPAT',t.x,2.8,t.z-3.3,5);
  else{pole(t.x,2,t.z,.06,4,'#765839');mesh(new THREE.ConeGeometry(2.6,.85,12),'#f1b663',t.x,4,t.z);}
 }
 // Coconut stall faces the promenade; vendor is behind the counter.
 box(g,98,.55,137,3.8,1.1,1.4,'#648a47');box(g,98,1.14,137,4,.12,1.7,'#c99c64');world.solids.push({x:98,z:137,hx:2,hz:.85});
 for(const x of [96.3,99.7])pole(x,1.5,136.5,.09,3,'#987049');
 box(g,98,3,136.8,4.8,.2,2.7,'#b39b62');sign('KELAPA SEGAR · RM5',98,2.45,137.75,4.2);
 for(let i=0;i<6;i++)sphere(96.7+i*.5,1.4,137,.25,'#97ac49');
 const vendor=createPerson('#ead09b',true);vendor.group.position.set(98,0,135.3);g.add(vendor.group);
 const walkers=[createPerson('#df9168'),createPerson('#74a6b2'),createPerson('#d6b56a')];for(const p of walkers)g.add(p.group);
 for(const x of [119,130,142]){box(g,x,.35,148,1,.15,2.4,'#c7aa7a');const back=box(g,x,.8,148.9,1,1.1,.1,'#e9ddc0');back.rotation.x=-.35;}
 pole(125,.2,148,.8,.4,'#776650');const fire=mesh(new THREE.ConeGeometry(.45,.9,7),'#ffb253',125,.8,148);world.solids.push({x:125,z:148,hx:.8,hz:.8});
 const glow=new THREE.PointLight('#ffb566',10,13,2);glow.position.set(125,1.5,148);g.add(glow);
 for(const x of [104,146]){pole(x,1.8,144,.08,3.6,'#795b40');sphere(x,3.6,144,.23,'#ffdf99');const l=new THREE.PointLight('#ffe0ae',7,12,2);l.position.set(x,3.5,144);g.add(l);}
 const position=seaGeometry.attributes.position;
 return {update(time:number){
  for(let i=0;i<position.count;i++){const x=position.getX(i),z=position.getZ(i);position.setY(i,Math.sin(z*.55+time*1.6)*.13+Math.sin(x*.3+z*.25+time)*.05);}position.needsUpdate=true;seaGeometry.computeVertexNormals();
  foam.forEach((m,i)=>{const phase=(time*.13+i/8)%1;m.position.set(124,.38,152+(1-phase)*36);(m.material as THREE.MeshBasicMaterial).opacity=Math.sin(phase*Math.PI)*.65;m.scale.y=.6+phase*1.7;});
  walkers.forEach((p,i)=>{const t=time*.22+i*2.1;p.group.position.set(117+i*10+Math.sin(t)*3,0,145+Math.cos(t)*.6);p.group.rotation.y=Math.cos(t)>0?Math.PI/2:-Math.PI/2;p.leftLeg.rotation.x=Math.sin(time*3+i)*.25;p.rightLeg.rotation.x=-p.leftLeg.rotation.x;});
  vendor.rightArm.rotation.x=-.35+Math.sin(time*1.5)*.12;fire.scale.y=1+Math.sin(time*5)*.12;
 }};
}
