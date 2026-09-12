import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {lands,attractions,instructions,type Attraction} from './legoland-data';
import {automated,toParkWorld,toParkLocal,parkPose,parkExit,rideDuration,type ParkRide} from '../shared/legoland.mjs';
import type {World} from './world';
import {isInLegoland} from './legoland-map';
import teleports from '../shared/teleports.json';
import './legoland.css';

export function createLegoland(worldScene:THREE.Scene,world:World,options:{send:(message:object)=>void;online:()=>boolean;canEnter:()=>boolean;clearInput:()=>void;notice:(title:string,body:string)=>void}){
 const scene=new THREE.Group();scene.name='LEGOLAND — city west';
 const scenery=new THREE.Group();scene.add(scenery);
 const mats=new Map<string,THREE.MeshStandardMaterial>();const cube=new THREE.BoxGeometry(1,1,1),stud=new THREE.CylinderGeometry(.3,.3,.18,8);
 const mat=(color:string)=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.65}));return mats.get(color)!;};
 function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string){const m=new THREE.Mesh(cube,mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;}
 function brick(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string){box(parent,x,y,z,w,h,d,color);for(let i=-w/2+.6;i<w/2;i+=1.2)for(let j=-d/2+.6;j<d/2;j+=1.2){const m=new THREE.Mesh(stud,mat(color));m.position.set(x+i,y+h/2+.09,z+j);parent.add(m);}}
 // Place signs (lands, landmarks) are framed cream boards; a solid colour board is an attraction you can play.
 function label(text:string,x:number,y:number,z:number,color:string,width=16,sign=false){const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d')!;const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const paint=(caption:string,done=false)=>{ctx.fillStyle=sign?'#fff8e9':done?'#2e8b57':color;ctx.fillRect(0,0,768,128);if(sign){ctx.strokeStyle=done?'#2e8b57':color;ctx.lineWidth=16;ctx.strokeRect(8,8,752,112);}ctx.fillStyle=sign?'#173c32':'white';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(caption,384,64,735);tex.needsUpdate=true;};paint(text);const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/6),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));m.position.set(x,y,z);scenery.add(m);return paint;}
 box(scenery,50,-.7,0,490,1,370,'#7aaf75');
 box(scenery,35,.01,0,360,.12,12,'#ead6ad');box(scenery,0,.02,10,12,.12,275,'#ead6ad');
 for(const land of lands){box(scenery,land.x,.05,land.z,land.name==='Water Park'?112:77,.18,land.name==='Water Park'?112:74,'#b8cf91');box(scenery,land.x,.16,land.z,8,.14,75,'#f2dfb6');box(scenery,land.x,.17,land.z,76,.14,8,'#f2dfb6');label(land.name,land.x,6,land.z,land.color,18,true);}
 for(const x of [-13,13])brick(scenery,x,6,154,5,12,5,'#e33935');brick(scenery,0,13,154,32,3,6,'#f1c72a');label('LEGOLAND MALAYSIA',0,13.1,157.1,'#e33935',29);
 // The tree ring leaves the gate and its path open so the entrance reads as one; none of the trees collide.
 for(let i=0;i<95;i++){const angle=i*2.399, radius=145+(i%4)*7,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;if(z>0&&Math.abs(x)<24)continue;box(scenery,x,2,z,1,4,1,'#8d6541');brick(scenery,x,5,z,4,3,4,i%2?'#398455':'#4b9557');}
 const curves=new Map<number,THREE.CatmullRomCurve3>(),cars=new Map<number,THREE.Group>();
 const signs=new Map<number,(caption:string,done?:boolean)=>void>();
 const palettes=['#e74438','#f0c533','#357ec5','#4c9b68'];
 function rideCurve(a:Attraction){return new THREE.CatmullRomCurve3(Array.from({length:97},(_,i)=>{const p=parkPose(a,i/96),local=toParkLocal(p.x,p.z);return new THREE.Vector3(local.x,p.y-1,local.z);}),a.kind!=='slide','catmullrom',.2);}
 for(const a of attractions){const color=lands[a.land].color;box(scenery,a.x,.24,a.z,20,.3,19,'#fff0c8');const entrance=parkExit(a),entry=toParkLocal(entrance.x,entrance.z);signs.set(a.id,label(a.name,entry.x,3.2,entry.z-3,color,12));
  if(['coaster','boat','slide','drive'].includes(a.kind)){
   const curve=rideCurve(a);curves.set(a.id,curve);scenery.add(new THREE.Mesh(new THREE.TubeGeometry(curve,a.id===0?192:64,a.kind==='boat'?1.1:.35,5,false),mat(a.id===0?'#777d80':a.kind==='boat'?'#46c8d7':color)));
   if(a.kind==='coaster'||a.kind==='slide')for(let i=0;i<12;i++){const p=curve.getPoint(i/12);box(scenery,p.x,p.y/2,p.z,.35,p.y,.35,'#d7d6c4');}
   const car=new THREE.Group();box(car,0,.6,0,2.2,.8,3,color);box(car,0,1.2,-.6,2,1,.35,'#333d4a');if(a.id===0){box(car,0,2,-1,2.5,.4,2,'#f3c72c');box(car,0,1.8,1,.6,2,.6,'#333d4a');for(const side of [-1,1])for(const z of [-1,1])box(car,side*1.2,.3,z,.3,.8,.8,'#333d4a');}scene.add(car);cars.set(a.id,car);
  }else if(a.kind==='tower'){brick(scenery,a.x,12,a.z,2,24,2,color);const car=new THREE.Group();box(car,0,.2,0,6,.6,6,'#f3c938');scene.add(car);cars.set(a.id,car);
  }else if(a.kind==='spin'){brick(scenery,a.x,2,a.z,2,4,2,color);const car=new THREE.Group();box(car,0,0,0,15,.4,.6,color);box(car,0,0,0,.6,.4,15,color);for(let i=0;i<4;i++)box(car,Math.sin(i*Math.PI/2)*7,.6,Math.cos(i*Math.PI/2)*7,3,1.3,3,palettes[i]);scene.add(car);cars.set(a.id,car);
  }else if(a.kind==='shoot'){brick(scenery,a.x,4,a.z-5,15,8,3,color);for(let i=0;i<3;i++)brick(scenery,a.x-6+i*6,9,a.z-5,3,2,4,'#e7c462');
  }else if(a.kind==='build'){box(scenery,a.x,1,a.z,12,2,10,'#f5d441');for(let i=0;i<4;i++)brick(scenery,a.x-4+i*2.5,2.6,a.z,2,1,2,palettes[i]);
  }else if(a.land===9){box(scenery,a.x,3,a.z,16,6,10,'#286c97');for(let i=0;i<4;i++){box(scenery,a.x-6+i*4,3,a.z+5.1,3.5,4,.1,'#58d2dd');brick(scenery,a.x-6+i*4,3+(i%2),a.z+5.3,1,.5,.4,'#f4cb47');}
  }else{for(let i=0;i<6;i++){const h=3+(i%3)*3;brick(scenery,a.x-6+(i%3)*6,h/2,a.z-3+Math.floor(i/3)*6,3,h,3,palettes[i%4]);}if(a.name==='Amazing Malaysia')box(scenery,a.x,5,a.z-3,12,.7,1,'#d4dce0');}
 }
 // Distinct landmarks and landscaping make the ten lands readable from a distance.
 const obstacles:{x:number;z:number;w:number;d:number}[]=[];
 function building(x:number,z:number,w:number,h:number,d:number,color:string){brick(scenery,x,h/2,z,w,h,d,color);obstacles.push({x,z,w,d});}
 building(-110,-3,15,10,5,'#bdb4a0');for(const x of [-122,-98]){building(x,-3,6,15,6,'#c8c0b0');const roof=new THREE.Mesh(new THREE.ConeGeometry(4.5,7,4),mat('#ba3848'));roof.position.set(x,18,-3);scenery.add(roof);for(let i=0;i<3;i++)brick(scenery,x-2+i*2,15.5,0,1,1,1,'#d9ceb4');}label('LEGO KINGDOMS',-110,11,1,'#913d47',16,true);
 for(let i=0;i<6;i++)brick(scenery,15,1+i*2,-110,22-i*3,2,22-i*3,'#d2ad62');obstacles.push({x:15,z:-110,w:22,d:22});
 building(108,32,17,7,9,'#be4440');for(let i=0;i<3;i++){const roof=box(scenery,108,8+i*2.4,32,23-i*4,.7,15-i*3,'#303e44');roof.rotation.z=.02;}label('NINJAGO',108,5,37,'#ab292c',12,true);
 box(scenery,220,.3,0,32,.3,27,'#42b7d0');for(let i=0;i<8;i++)box(scenery,206+i*4,.49,0,.3,.08,25,'#a5e5e8');label('WATER PARK',220,6,-9,'#087eaa',20,true);
 box(scenery,110,.3,-65,24,.25,14,'#697775');for(let i=0;i<6;i++)box(scenery,100+i*4,.47,-65,2,.04,.3,'#f8e7b0');
 for(const x of [-5,5]){building(x,-8,3,13,3,'#a9bfc5');brick(scenery,x,14,-8,1,3,1,'#cbd8d6');}box(scenery,0,8,-8,10,.7,1.2,'#8bafb4');label('MINILAND · MALAYSIA',0,3,9,'#358863',17,true);
 for(const l of lands)for(const side of [-1,1]){const x=l.x+side*34,z=l.z+32;box(scenery,x,1,z,3,.3,1,'#a96a44');box(scenery,x,.5,z,.3,1,.3,'#7c604d');brick(scenery,x+5,2,z,1,4,1,'#79985a');brick(scenery,x+5,4,z,4,2,4,'#408556');}
 // Batch the hundreds of static blocks by material; animated rides remain separate.
 scenery.updateMatrixWorld(true);const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>(),originals:THREE.Mesh[]=[];
 scenery.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const list=buckets.get(o.material)||[];list.push(g);buckets.set(o.material,list);originals.push(o);}});
 for(const [material,geometries] of buckets){const merged=mergeGeometries(geometries);if(merged)scene.add(new THREE.Mesh(merged,material));for(const g of geometries)g.dispose();}for(const o of originals)o.removeFromParent();

 scene.rotation.y=Math.PI/2;scene.position.x=-350;worldScene.add(scene);
 for(const o of obstacles){const p=toParkWorld(o.x,o.z);world.solids.push({...p,hx:o.d/2,hz:o.w/2});}
 for(const land of lands){const p=toParkWorld(land.x,land.z);world.mapBuildings.push({...p,w:74,d:land.name==='Water Park'?112:77,color:land.color});}
 box(worldScene,-173,-.15,0,55,.3,19,'#d8cca8');
 for(const z of [-9,9])box(worldScene,-173,.6,z,55,1.2,.3,'#7c8e76');
 const panel=document.createElement('section');panel.id='legoland-panel';panel.hidden=true;panel.setAttribute('aria-label','LEGOLAND tarikan');
 panel.innerHTML='<small>LEGOLAND · Dalam bandar</small><h2></h2><span class="park-played" hidden>✓ Played</span><p class="park-description"></p><p class="park-status" role="status"></p><button class="park-enter">Main tarikan</button><div class="park-tools" hidden><button class="park-build">Letak blok</button><button class="park-undo">Undo</button><button class="park-collect">Kutip</button></div><button class="park-leave" hidden>Keluar tarikan</button><button class="park-return" hidden>Return to the City</button><small class="park-pass"></small>';
 document.getElementById('hud')!.append(panel);
 const title=panel.querySelector('h2')!,description=panel.querySelector('.park-description')!,status=panel.querySelector('.park-status')!;
 const enter=panel.querySelector<HTMLButtonElement>('.park-enter')!,leaveButton=panel.querySelector<HTMLButtonElement>('.park-leave')!,tools=panel.querySelector<HTMLElement>('.park-tools')!,returnButton=panel.querySelector<HTMLButtonElement>('.park-return')!,playedBadge=panel.querySelector<HTMLElement>('.park-played')!;
 const mini=new THREE.Group();scene.add(mini);const tokens:THREE.Mesh[]=[],blocks:THREE.Mesh[]=[];
 const targetMaterial=new THREE.MeshStandardMaterial({color:'#ffde46',emissive:'#aa5500',emissiveIntensity:.5});
 let ride:ParkRide|null=null,nearby:Attraction|undefined,stop:Attraction|undefined,dropAt:Attraction|undefined,won=false,score=0,lastKey='',position={x:0,z:0},camera:THREE.Camera,clock=Date.now(),peers:{id:string;x:number;z:number;parkRide?:ParkRide|null}[]=[];
 const completed=new Set<number>();try{const saved=JSON.parse(localStorage.getItem('lepak-legoland-pass-v1')||'[]');if(Array.isArray(saved))for(const id of saved)if(attractions[id])completed.add(id);}catch{}
 function passport(){panel.querySelector('.park-pass')!.textContent=`Pasport ${completed.size} / ${attractions.length} · sesi bandar yang sama`;}passport();
 // In the park you read the board, not the map, so the sign carries the tick too.
 const markSign=(id:number)=>signs.get(id)?.(`✓ ${attractions[id].name}`,true);for(const id of completed)markSign(id);
 function clear(){for(const child of [...mini.children]){mini.remove(child);if(child instanceof THREE.Mesh&&child.geometry!==cube)child.geometry.dispose();}tokens.length=0;blocks.length=0;}
 function sync(next:ParkRide|null){const key=next?`${next.id}:${next.startedAt}`:'';if(lastKey===key)return;lastKey=key;if(ride&&!next){pendingExit=parkExit(dropAt||attractions[ride.id]);dropAt=undefined;}ride=next;won=false;score=0;clear();options.clearInput();if(!next){status.textContent='Dekati pintu dan pilih Main tarikan.';return;}const a=attractions[next.id];if(!a){ride=null;return;}status.textContent='Jom!';const count=a.kind==='shoot'?8:5;if(['shoot','explore','drive'].includes(a.kind))for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;const m=new THREE.Mesh(a.kind==='drive'?new THREE.TorusGeometry(1.7,.18,6,16):new THREE.IcosahedronGeometry(.8,0),targetMaterial);m.position.set(a.x+Math.sin(angle)*13,a.kind==='shoot'?3+(i%3):1.5,a.z+Math.cos(angle)*12);mini.add(m);tokens.push(m);}}
 function award(){if(!ride||won)return;won=true;completed.add(ride.id);passport();markSign(ride.id);try{localStorage.setItem('lepak-legoland-pass-v1',JSON.stringify([...completed]));}catch{}status.textContent='Selesai · cop dikumpul!';options.notice('LEGOLAND',`${attractions[ride.id].name} selesai!`);}
 // Off the Express you step down at the attraction beside the train; the server checks it is beside it.
 function finish(){if(!ride)return;dropAt=ride.id===0&&stop&&stop.id!==0?stop:undefined;if(options.online()){options.send({type:'park-leave',stop:dropAt?.id});return;}sync(null);}
 let pendingExit:{x:number;y:number;z:number}|null=null;
 enter.onclick=()=>{if(!nearby||!options.canEnter())return;options.clearInput();if(options.online())options.send({type:'park-enter',id:nearby.id});else sync({id:nearby.id,startedAt:clock});};
 leaveButton.onclick=finish;
 // Mamak Maju is where a session starts, so it is the city to go back to without walking out the gate.
 const city=teleports.find(t=>t.id==='1')!;
 returnButton.onclick=()=>{if(ride||!options.canEnter())return;options.clearInput();if(options.online())options.send({type:'teleport',id:city.id});else pendingExit={x:city.x,y:0,z:city.z};};
 function build(){if(!ride||attractions[ride.id].kind!=='build'||won)return;const a=attractions[ride.id],i=blocks.length;blocks.push(box(mini,a.x-3+i%4*2,3+Math.floor(i/4)*1.2,a.z+2,1.8,1,1.8,palettes[i%4]));status.textContent=`Binaan ${blocks.length} / 8`;if(blocks.length===8)award();}
 panel.querySelector<HTMLButtonElement>('.park-build')!.onclick=build;
 panel.querySelector<HTMLButtonElement>('.park-undo')!.onclick=()=>{if(won)return;const b=blocks.pop();if(b)mini.remove(b);status.textContent=`Binaan ${blocks.length} / 8`;};
 panel.querySelector<HTMLButtonElement>('.park-collect')!.onclick=()=>{if(!ride||won)return;const local=toParkLocal(position.x,position.z),t=tokens.find(t=>t.visible&&Math.hypot(t.position.x-local.x,t.position.z-local.z)<3);if(t){t.visible=false;score++;status.textContent=`Penemuan ${score} / 5`;if(score===5)award();}else options.notice('Dekati objek','Berjalan dekat objek berkilau, kemudian tekan Kutip.');};
 const ray=new THREE.Raycaster();const canvas=document.getElementById('world')!;
 canvas.addEventListener('pointerdown',e=>{if(!ride||panel.hidden||attractions[ride.id].kind!=='shoot'||won)return;e.stopImmediatePropagation();if(clock-ride.startedAt>30000)return;const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);scene.updateMatrixWorld(true);const hit=ray.intersectObjects(tokens.filter(t=>t.visible))[0];if(hit){hit.object.visible=false;score++;if(score===8)award();}},true);
 return{
  get active(){return !!ride;},get driving(){return ride!=null&&attractions[ride.id].kind==='drive';},
  get state(){return ride;},
  get played():ReadonlySet<number>{return completed;},
  get summary(){const left=attractions.filter(a=>!completed.has(a.id));return `✓ Played ${completed.size} / ${attractions.length}`+(left.length&&left.length<=5?` · Belum main: ${left.map(a=>a.name).join(', ')}`:'');},
  complete(id:number){if(ride?.id===id)award();},
  sync(next:ParkRide|null){sync(next);},
  peers(value:typeof peers){peers=value;},
  disconnect(){if(ride)pendingExit=parkExit(attractions[ride.id]);sync(null);},
  pose(now:number){if(pendingExit){const p=pendingExit;pendingExit=null;return{...p,yaw:Math.PI/2};}if(!ride)return null;const a=attractions[ride.id];return automated(a)?parkPose(a,Math.min(1,(now-ride.startedAt)/1000/rideDuration(a))):null;},
  update(pos:{x:number;z:number},view:THREE.Camera,now:number,visible:boolean){
   position=pos;camera=view;clock=now;scene.visible=true;const local=toParkLocal(pos.x,pos.z);
   const distance=(a:Attraction)=>{const entry=parkExit(a);return Math.hypot(pos.x-entry.x,pos.z-entry.z);};nearby=attractions.reduce<Attraction|undefined>((best,a)=>distance(a)<(best?distance(best):17)?a:best,undefined);
   const a=ride?attractions[ride.id]:nearby;panel.hidden=!visible||(!a&&!isInLegoland(pos.x))||(!ride&&!options.canEnter());panel.classList.toggle('park-compact',!a);if(a){title.textContent=a.name;description.textContent=instructions[a.kind];}playedBadge.hidden=!a||!completed.has(a.id);
   stop=ride?.id===0?attractions.reduce((best,x)=>distance(x)<distance(best)?x:best):undefined;const leaveText=stop&&stop.id!==0?`Turun di ${stop.name}`:'Keluar tarikan';if(leaveButton.textContent!==leaveText)leaveButton.textContent=leaveText;
   enter.hidden=!!ride||!a;leaveButton.hidden=!ride;returnButton.hidden=!!ride;tools.hidden=!ride||!['build','explore'].includes(a?.kind||'');
   panel.querySelector<HTMLElement>('.park-build')!.hidden=a?.kind!=='build';panel.querySelector<HTMLElement>('.park-undo')!.hidden=a?.kind!=='build';panel.querySelector<HTMLElement>('.park-collect')!.hidden=a?.kind!=='explore';
   if(ride&&a){const elapsed=(now-ride.startedAt)/1000;if(automated(a)){if(elapsed>=rideDuration(a)){award();if(!options.online())finish();}else status.textContent=`Perjalanan · ${Math.floor(elapsed)}s`;}if(a.kind==='shoot'&&!won)status.textContent=elapsed>=30?'Masa tamat · keluar dan cuba lagi':`Sasaran ${score} / 8 · ${Math.ceil(30-elapsed)}s`;if(a.kind==='drive'&&!won){const t=tokens[score];tokens.forEach((t,i)=>{t.visible=i>=score;});if(t&&Math.hypot(t.position.x-local.x,t.position.z-local.z)<2.5){score++;if(score===5)award();}if(!won)status.textContent=`Checkpoint ${score} / 5`;}}
   for(const a of attractions){const car=cars.get(a.id);if(!car)continue;const guest=peers.find(p=>p.parkRide?.id===a.id),active=ride?.id===a.id?ride:guest?.parkRide;const progress=active?Math.min(1,(now-active.startedAt)/1000/rideDuration(a)):(now/45000+a.id*.13)%1;const p=parkPose(a,progress),q=toParkLocal(p.x,p.z);if(a.kind==='drive'&&active){const at=ride?.id===a.id?local:toParkLocal(guest!.x,guest!.z);car.position.set(at.x,.3,at.z);}else if(a.kind==='spin'){car.position.set(a.x,3,a.z);car.rotation.y=progress*Math.PI*2;}else{car.position.set(q.x,p.y-1,q.z);car.rotation.y=p.yaw-Math.PI/2;}}
  }
 };
}
