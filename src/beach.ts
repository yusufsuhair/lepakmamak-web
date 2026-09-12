import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchShopFallback,box,createIceCreamBike,createPerson,material,palm,type Person,type World} from './world';
import tables from '../shared/tables.json';
import chairs from '../shared/chairs.json';

export const BEACH={minX:95,maxX:153,minZ:131,shoreZ:152};
export type BeachRestKind = 'sunbed' | 'hammock';
export type BeachRestSpot = {id:string;kind:BeachRestKind;x:number;z:number;yaw:number;height:number;exitX:number;exitZ:number};
export const BEACH_REST_SPOTS: readonly BeachRestSpot[] = [
 {id:'sunbed-1',kind:'sunbed',x:119,z:148,yaw:0,height:.62,exitX:119,exitZ:150.7},
 {id:'sunbed-2',kind:'sunbed',x:130,z:148,yaw:0,height:.62,exitX:130,exitZ:150.7},
 {id:'sunbed-3',kind:'sunbed',x:142,z:148,yaw:0,height:.62,exitX:142,exitZ:150.7},
 {id:'hammock-1',kind:'hammock',x:101,z:148,yaw:Math.PI/2,height:1.1,exitX:101,exitZ:150.7},
 {id:'hammock-2',kind:'hammock',x:148,z:147,yaw:Math.PI/2,height:1.1,exitX:148,exitZ:149.7},
];

export function beachRestPose(person:Person,kind:BeachRestKind|null,yaw=0){
 if(!kind){
  person.group.position.set(0,0,0);person.group.rotation.set(0,0,0);
  person.leftLeg.rotation.set(0,0,0);person.rightLeg.rotation.set(0,0,0);
  person.leftArm.rotation.set(0,0,0);person.rightArm.rotation.set(0,0,0);return;
 }
 person.group.position.y=kind==='hammock'?1.1:.62;
 person.group.rotation.set(kind==='sunbed'?-Math.PI/2:0,yaw,kind==='hammock'?Math.PI/2:0);
 person.leftLeg.rotation.set(0,0,0);person.rightLeg.rotation.set(0,0,0);
 person.leftArm.rotation.set(0,0,0);person.rightArm.rotation.set(0,0,0);
}

export function createBeach(scene:THREE.Scene,world:World){
 const g=new THREE.Group();g.name='Pantai Senja';scene.add(g);
 // Static props live in one group so the Blender set (scripts/blender/build_beach.py) can
 // replace them atomically. The animated sea, its breaking crests, the fire flame and the
 // walkers stay outside it, so the swap can never remove them.
 const props=new THREE.Group();props.name='beach-props';g.add(props);
 const mesh=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Object3D=props)=>{const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 const pole=(x:number,y:number,z:number,r:number,h:number,color:string,parent:THREE.Object3D=props)=>mesh(new THREE.CylinderGeometry(r,r,h,10),color,x,y,z,parent);
 const sphere=(x:number,y:number,z:number,r:number,color:string)=>mesh(new THREE.IcosahedronGeometry(r,1),color,x,y,z);
 function sign(text:string,x:number,y:number,z:number,w:number){const c=document.createElement('canvas');c.width=768;c.height=160;const ctx=c.getContext('2d')!;ctx.fillStyle='#245e58';ctx.fillRect(0,0,768,160);ctx.fillStyle='#fff1bf';ctx.font='bold 58px sans-serif';ctx.textAlign='center';ctx.fillText(text,384,100);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*160/768),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide}));m.position.set(x,y,z);props.add(m);}
 box(g,124,-.015,142,58,.06,22,'#edd3a0');
 box(g,124,.015,151,58,.02,2,'#d6bf94');
 box(g,88,.025,132,16,.05,3,'#b3936c');
 for(let x=81;x<99;x+=.65)box(g,x,.06,132,.5,.04,3,'#c3a67c');
 sign('PANTAI SENJA',98,3.6,132,9);pole(94,1.65,132,.1,3.3,'#796245');pole(102,1.65,132,.1,3.3,'#796245');
 world.mapBuildings.push({x:124,z:142,w:58,d:22,color:'#edd3a0'});
 const beachMatkool=createIceCreamBike();beachMatkool.position.set(89,.09,142);beachMatkool.rotation.y=Math.PI/2;g.add(beachMatkool);
 world.solids.push({x:89,z:142,hx:1.35,hz:1.8});
 // Broad sea with actual travelling wave geometry and translucent breaking crests.
 const seaGeometry=new THREE.PlaneGeometry(100,180,64,96);seaGeometry.rotateX(-Math.PI/2);
 const sea=new THREE.Mesh(seaGeometry,new THREE.MeshStandardMaterial({color:'#329ca4',roughness:.32,metalness:.2,side:THREE.DoubleSide}));sea.position.set(124,.18,242);g.add(sea);
 const foam=Array.from({length:8},()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(57,.5,28,1),new THREE.MeshBasicMaterial({color:'#e5fff6',transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;g.add(m);return m;});
 for(const [x,z] of [[98,145],[149,133],[102,137]]) palm(g,x,z,.85);
 // Two rope hammocks hang between sturdy coconut posts, with a visible dip in the cloth.
 for(const spot of BEACH_REST_SPOTS.filter(spot=>spot.kind==='hammock')){
  const left=spot.x-3.2,right=spot.x+3.2;
  for(const x of [left,right])pole(x,1.65,spot.z,.13,3.3,'#795a3b');
  const positions:number[]=[];
  for(let i=0;i<=16;i++){
   const t=i/16,x=left+(right-left)*t,y=1.45-.42*Math.sin(Math.PI*t);
   positions.push(x,y,spot.z-.43,x,y,spot.z+.43);
  }
  const indices:number[]=[];for(let i=0;i<16;i++){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,b,c,b,d,c);}
  const hammockGeometry=new THREE.BufferGeometry();hammockGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));hammockGeometry.setIndex(indices);hammockGeometry.computeVertexNormals();
  const hammockMaterial=material('#d77991');hammockMaterial.side=THREE.DoubleSide;const hammock=new THREE.Mesh(hammockGeometry,hammockMaterial);hammock.castShadow=true;props.add(hammock);
  const ropeGeometry=new THREE.BufferGeometry();ropeGeometry.setAttribute('position',new THREE.Float32BufferAttribute([left,2.4,spot.z,left,1.45,spot.z,right,2.4,spot.z,right,1.45,spot.z],3));props.add(new THREE.LineSegments(ropeGeometry,new THREE.LineBasicMaterial({color:'#d5bd8e'})));
 }
 for(const t of tables.filter(t=>t.id.startsWith('pantai-'))){
  const seats=chairs.filter(c=>c.tableId===t.id),big=seats.length===9;
  pole(t.x,1.02,t.z,big?1.95:1.14,.16,'#d6ab75');pole(t.x,.5,t.z,.17,1,'#765839');world.solids.push({x:t.x,z:t.z,hx:big?1.2:.9,hz:big?1.2:.9});
  for(const seat of seats){const c=new THREE.Group();c.position.set(seat.x,0,seat.z);c.rotation.y=seat.yaw;props.add(c);box(c,0,.6,0,.75,.1,.75,'#387f82');box(c,0,1,-.34,.75,.75,.1,'#387f82');for(const dx of [-.28,.28])for(const dz of [-.28,.28])box(c,dx,.3,dz,.07,.6,.07,'#765839');}
  if(big)sign('WEREWOLF · 9 TEMPAT',t.x,2.8,t.z-3.3,5);
  else{pole(t.x,2,t.z,.06,4,'#765839');mesh(new THREE.ConeGeometry(2.6,.85,12),'#f1b663',t.x,4,t.z);}
 }
 // Coconut stall faces the promenade; vendor is behind the counter.
 box(props,98,.55,137,3.8,1.1,1.4,'#648a47');box(props,98,1.14,137,4,.12,1.7,'#c99c64');world.solids.push({x:98,z:137,hx:2,hz:.85});
 for(const x of [96.3,99.7])pole(x,1.5,136.5,.09,3,'#987049');
 box(props,98,3,136.8,4.8,.2,2.7,'#b39b62');sign('KELAPA SEGAR · RM5',98,2.45,137.75,4.2);
 for(let i=0;i<6;i++)sphere(96.7+i*.5,1.4,137,.25,'#97ac49');
 const vendor=createPerson('#ead09b',true);vendor.group.position.set(98,0,135.3);g.add(vendor.group);
 const walkers=[createPerson('#df9168'),createPerson('#74a6b2'),createPerson('#d6b56a')];for(const p of walkers)g.add(p.group);
 for(const x of [119,130,142]){box(props,x,.35,148,1,.15,2.4,'#c7aa7a');const back=box(props,x,.8,148.9,1,1.1,.1,'#e9ddc0');back.rotation.x=-.35;}
 pole(125,.2,148,.8,.4,'#776650');const fire=mesh(new THREE.ConeGeometry(.45,.9,7),'#ffb253',125,.8,148,g);world.solids.push({x:125,z:148,hx:.8,hz:.8});
 const glow=new THREE.PointLight('#ffb566',10,13,2);glow.position.set(125,1.5,148);g.add(glow);
 for(const x of [104,146]){pole(x,1.8,144,.08,3.6,'#795b40');sphere(x,3.6,144,.23,'#ffdf99');const l=new THREE.PointLight('#ffe0ae',7,12,2);l.position.set(x,3.5,144);g.add(l);}
 // The props above are the fallback until the Blender set arrives. Only the canvas signs
 // are kept, so PANTAI SENJA, KELAPA SEGAR · RM5 and WEREWOLF · 9 TEMPAT stay the game's
 // wording rather than being baked into the mesh.
 props.traverse(o=>{o.userData.keepUnbatched=true;});
 batchShopFallback(props);
 void new GLTFLoader().loadAsync('/assets/models/environment/LM_ENV_Beach.glb?v=beach-v1').then(gltf=>{
  gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;o.castShadow=false;}});
  for(const child of [...props.children])if(!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial))child.removeFromParent();
  props.add(gltf.scene);
 }).catch(error=>console.warn('[BEACH] keeping procedural props',error));
 const position=seaGeometry.attributes.position;
 const nearbyRest=(position:{x:number;z:number})=>BEACH_REST_SPOTS.filter(spot=>Math.hypot(position.x-spot.x,position.z-spot.z)<=2.6).sort((a,b)=>Math.hypot(position.x-a.x,position.z-a.z)-Math.hypot(position.x-b.x,position.z-b.z))[0]||null;
 return {iceCream:beachMatkool,nearbyRest,exitSpot:(spot:BeachRestSpot)=>({x:spot.exitX,z:spot.exitZ}),pose:beachRestPose,update(time:number){
  for(let i=0;i<position.count;i++){const x=position.getX(i),z=position.getZ(i);position.setY(i,Math.sin(z*.55+time*1.6)*.13+Math.sin(x*.3+z*.25+time)*.05);}position.needsUpdate=true;seaGeometry.computeVertexNormals();
  foam.forEach((m,i)=>{const phase=(time*.13+i/8)%1;m.position.set(124,.38,152+(1-phase)*36);(m.material as THREE.MeshBasicMaterial).opacity=Math.sin(phase*Math.PI)*.65;m.scale.y=.6+phase*1.7;});
  walkers.forEach((p,i)=>{const t=time*.22+i*2.1;p.group.position.set(117+i*10+Math.sin(t)*3,0,145+Math.cos(t)*.6);p.group.rotation.y=Math.cos(t)>0?Math.PI/2:-Math.PI/2;p.leftLeg.rotation.x=Math.sin(time*3+i)*.25;p.rightLeg.rotation.x=-p.leftLeg.rotation.x;});
  vendor.rightArm.rotation.x=-.35+Math.sin(time*1.5)*.12;fire.scale.y=1+Math.sin(time*5)*.12;
 }};
}
