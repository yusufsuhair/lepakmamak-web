import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchShopFallback,box,createPerson,material,type World} from './world';
import {createVillageChores,createVillageCycle,groupRoute,villageActivity} from './village-activities';

// All authored coordinates are relative to this origin: relocate the whole neighbourhood here.
export const villageOrigin={x:122,z:-132};
export const villageResidents=[
 {name:'Upin',x:-9,z:7,color:'#f3ce32',child:true,line:'Jom main kejar-kejar! Ipin, tunggu kami!',hair:false},
 {name:'Ipin',x:-9,z:9,color:'#56a9dd',child:true,line:'Betul, betul, betul! Jom lari sama-sama!',hair:false},
 {name:'Opah',x:-10,z:-3.4,color:'#b797cc',child:false,line:'Opah tengah sidai baju, cucu. Harap-harap petang ini tak hujan.',hair:true},
 {name:'Kak Ros',x:-10,z:1,color:'#dc6885',child:false,line:'Kak Ros sapu daun dulu. Main boleh, jangan sepahkan halaman ya!',hair:true},
 {name:'Tok Dalang',x:9,z:-4,color:'#d5c8a0',child:false,line:'Meh, meh ayam! Tok tabur makanan. Jangan kejar ayam Tok ya!',hair:true},
 {name:'Ehsan',x:6,z:7,color:'#e55858',child:true,line:'Kita berkumpul di clubhouse hari ini!',hair:true},
 {name:'Fizi',x:9,z:10,color:'#dcb153',child:true,line:'Ramainya orang hari ini. Jom cari Mail!',hair:true},
 {name:'Mail',x:18,z:17,color:'#76a870',child:true,line:'Rajoo, jom kayuh pusing kampung! Perlahan dekat orang berjalan.',hair:true},
 {name:'Mei Mei',x:-8,z:11,color:'#e89ca8',child:true,line:'Mari belajar dan bermain sama-sama!',hair:true},
 {name:'Jarjit',x:0,z:4,color:'#5986c5',child:true,line:'Dua tiga bulu tangkis, Ijat sambut jangan terlepas!',hair:true},
 {name:'Susanti',x:-11,z:13,color:'#c787bc',child:true,line:'Cantik kampung ini. Mari jalan-jalan!',hair:true},
 {name:'Cikgu Melati',x:-18,z:10,color:'#b683b1',child:false,line:'Selamat datang ke tadika. Semua orang boleh belajar sesuatu yang baru.',hair:true},
 {name:'Uncle Muthu',x:20,z:6,color:'#d2a078',child:false,line:'Selamat datang! Duduklah, berehat sekejap di warung.',hair:true},
 {name:'Abang Salleh',x:12,z:3,color:'#d778a8',child:false,line:'Meriahnya kampung! Abang nak jalan tengok kawan-kawan.',hair:true},
 {name:'Abang Iz',x:-5,z:-3,color:'#6398a8',child:false,line:'Jom bersukan petang ini. Panaskan badan dulu!',hair:true},
 {name:'Dzul',x:-7,z:7,color:'#e79943',child:true,line:'Fizi, cepat! Kita kejar Upin dan Ipin!',hair:true},
 {name:'Ijat',x:0,z:14,color:'#7b9cc9',child:true,line:'Haa! Jarjit, sambut!',hair:true},
 {name:'Devi',x:-14,z:10,color:'#b865aa',child:true,line:'Mei Mei, mari tengok perlawanan!',hair:true},
 {name:'Rajoo',x:21,z:17,color:'#cc7850',child:true,line:'Mail, tunggu! Kita kayuh basikal sama-sama!',hair:true},
 {name:'Ah Tong',x:24,z:-4,color:'#ded3ac',child:false,line:'Selamat petang! Seronok tengok kampung ramai orang.',hair:true},
 {name:'Cikgu Jasmin',x:-23,z:6,color:'#78b8af',child:false,line:'Main dengan baik dan beri semangat pada kawan ya.',hair:true},
] as const;

function sign(parent:THREE.Object3D,text:string,x:number,y:number,z:number,w:number,h:number){
 const c=document.createElement('canvas');c.width=768;c.height=192;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#315a43';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#ffedb1';ctx.font='bold 52px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,96,730);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);parent.add(mesh);
}

export function createDurianVillage(world:Pick<World,'group'|'solids'|'mapBuildings'>){
 const g=new THREE.Group();g.position.set(villageOrigin.x,0,villageOrigin.z);world.group.add(g);
 const solid=(x:number,z:number,w:number,d:number)=>world.solids.push({x:villageOrigin.x+x,z:villageOrigin.z+z,hx:w/2,hz:d/2});
 box(g,0,.05,0,56,.1,40,'#93ad76');
 box(g,0,.13,8,51,.08,5,'#ddc69e');box(g,0,.13,0,5,.08,37,'#ddc69e');
 function house(x:number,z:number,w:number,d:number,color:string,label:string){
  box(g,x,2.2,z,w,4.2,d,color);box(g,x,.45,z+d/2+1,w+1,.7,2.4,'#a28a61');
  for(const side of [-1,1]){const roof=box(g,x+side*w/4,5.2,z,w*.61,.26,d+2,'#784e3a');roof.rotation.z=-side*.48;}
  for(const dx of [-w*.3,w*.3]){box(g,x+dx,2.7,z+d/2+.03,1.3,1.7,.08,'#3c655f');box(g,x+dx,2.7,z+d/2+.1,.08,1.7,.05,'#ede1b8');}
  box(g,x,1.7,z+d/2+.06,1.4,2.8,.1,'#745136');sign(g,label,x,4.05,z+d/2+.12,w-.5,.8);
  solid(x,z,w,d);world.mapBuildings.push({x:villageOrigin.x+x,z:villageOrigin.z+z,w,d,color});
 }
 house(-16,-11,12,9,'#bc9157','RUMAH OPAH');house(16,-11,12,9,'#8aab80','TOK DALANG');
 house(0,-12,12,10,'#edc766','UPIN & IPIN CLUBHOUSE');
 house(-19,1,10,6,'#e5a681','TADIKA MESRA');house(20,1,10,6,'#b3c092','WARUNG MUTHU');
 // An open arrival court, playground and little vegetable garden.
 for(const side of [-1,1]){box(g,side*5,2.5,18,.4,5,.4,'#795b3c');solid(side*5,18,.4,.4);}
 box(g,0,5,18,11,1.5,.35,'#366348');sign(g,'KAMPUNG DURIAN RUNTUH',0,5,18.22,10.5,1.1);
 for(const x of [13,16,19])for(const z of [-18,-16]){box(g,x,.2,z,2,.3,1.4,'#7c6246');const plant=new THREE.Mesh(new THREE.ConeGeometry(.5,1,5),material('#527942'));plant.position.set(x,.7,z);g.add(plant);}
 for(const x of [-22,-17]){box(g,x,1,15,.2,2,.2,'#b87043');solid(x,15,.25,.25);}box(g,-19.5,2,15,5.2,.2,.2,'#b87043');
 for(const x of [-20.5,-18.5]){box(g,x,1.3,15,.035,1.4,.035,'#4c5040');box(g,x,.65,15,.9,.12,.6,'#d9b45e');}
 for(const x of [14,21]){box(g,x,.9,12,2.2,.18,1.4,'#d5b376');box(g,x,.45,12,.2,.9,.2,'#7b6046');solid(x,12,2.2,1.4);}
 for(const x of [-25,25])for(const z of [-17,16]){box(g,x,1.8,z,.5,3.6,.5,'#846340');const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.3,1),material('#5c853e'));crown.position.set(x,4,z);g.add(crown);solid(x,z,.5,.5);}
 // A compact neighbourhood court, clear of house entrances and the arrival arch.
 box(g,0,.19,9,8,.08,14,'#527f71');
 for(const x of [-3.5,3.5])box(g,x,.24,9,.06,.015,13,'#f6ebc8');
 for(const z of [2.5,7,11,15.5])box(g,0,.24,z,7,.015,.06,'#f6ebc8');
 for(const z of [4.75,13.25])box(g,0,.24,z,.06,.015,4.5,'#f6ebc8');
 for(const x of [-3.8,3.8]){box(g,x,1,9,.08,1.65,.08,'#eee0b9');solid(x,9,.12,.12);}
 for(let y=.9;y<=1.7;y+=.16)box(g,0,y,9,7.6,.018,.025,'#e8e2cf');
 for(let x=-3.8;x<=3.8;x+=.25)box(g,x,1.3,9,.015,.8,.025,'#e8e2cf');
 box(g,0,1.73,9,7.6,.065,.045,'#fff5d5');
 sign(g,'BADMINTON PETANG • JARJIT vs IJAT',0,2.8,1.7,7,.65);
 // Chore props and bicycle route stay in open ground, away from doors and the court.
 for(const x of [-13,-7]){box(g,x,1.3,-2.5,.09,2.4,.09,'#82603f');solid(x,-2.5,.12,.12);}
 box(g,-10,2.35,-2.5,6,.025,.025,'#e6dfc7');
 box(g,-11,.38,-3.7,.8,.4,.6,'#b88960');solid(-11,-3.7,.8,.6);
 for(let i=0;i<48;i++){const a=i/48*Math.PI*2;box(g,18+Math.sin(a)*4.7,.16,16.8+Math.cos(a)*1.65,.18,.04,.18,'#d4bf90');}
 for(const x of [-6,6]){box(g,x,.55,17,3,.15,.7,'#b98b53');for(const dx of [-1,1])box(g,x+dx,.3,17,.15,.5,.5,'#71553a');solid(x,17,3,.7);}
 // The Blender kampung (scripts/blender/build_kampung.py) replaces the boxes above: stilt houses
 // on tiang, the timber gerbang, the swing, the vegetable beds, the court and net, the washing
 // line and four durian trees. It is authored in village-local coordinates, so its origin is
 // this group's origin and nothing shifts. Every solid() and mapBuildings footprint above is
 // untouched, so the residents' cleared routes still thread between the same colliders. The
 // canvas MeshBasicMaterial children are kept: those are the game's own text signs (village
 // name, house labels, badminton sign), and the wording has to stay the game's.
 g.name='kampung';
 g.traverse(o=>{o.userData.keepUnbatched=true;});
 batchShopFallback(g);
 void new GLTFLoader().loadAsync('/assets/models/environment/LM_ENV_Kampung.glb?v=kampung-v1').then(gltf=>{
  gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;o.castShadow=false;}});
  for(const child of [...g.children])if(!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial))child.removeFromParent();
  g.add(gltf.scene);
 }).catch(error=>console.warn('[KAMPUNG] keeping procedural village',error));
}

// Resident meshes load separately; no moving people are merged into the static scenery.
export function createVillageResidents(scene:THREE.Scene){
 const group=new THREE.Group();group.position.set(villageOrigin.x,0,villageOrigin.z);scene.add(group);
 const people=villageResidents.map((resident,i)=>{
  const rig=createPerson(resident.color);rig.group.position.set(resident.x,.1,resident.z);rig.group.scale.setScalar(resident.child?.73:1);
  if(!resident.hair){rig.group.userData.hideHair=true;const hair=rig.group.getObjectByName('avatar-hair');if(hair)hair.visible=false;}
  if(resident.name==='Upin')box(rig.group,0,2.22,0,.025,.18,.025,'#302f28');
  if(resident.name==='Ehsan'||resident.name==='Mei Mei')for(const side of [-1,1])box(rig.group,side*.115,1.91,.255,.19,.1,.025,'#433a32');
  if(resident.name==='Opah'||resident.name==='Cikgu Melati'){box(rig.group,0,1.79,-.11,.55,.48,.28,resident.color);}
  if(resident.name==='Tok Dalang')box(rig.group,0,2.1,-.02,.48,.18,.42,'#e8e3ce');
  if(resident.name==='Jarjit'){const turban=new THREE.Mesh(new THREE.SphereGeometry(.29,8,6),material('#775084'));turban.position.set(0,2.06,0);rig.group.add(turban);}
  if(['Mei Mei','Susanti','Devi','Kak Ros'].includes(resident.name))for(const side of [-1,1])box(rig.group,side*.23,1.82,-.12,.16,.4,.18,'#202c2b');
  if(resident.name==='Uncle Muthu'||resident.name==='Ah Tong')box(rig.group,0,1.76,.25,.22,.06,.03,'#38332e');
  if(resident.name==='Mail')box(rig.group,0,1.15,.19,.44,.48,.035,'#eee0b9');
  if(resident.name==='Upin'||resident.name==='Ipin')sign(rig.group,resident.name==='Upin'?'U':'I',0,1.25,.185,.32,.3);
  if(villageActivity(resident.name)==='badminton'){
   box(rig.rightArm,0,-.8,0,.05,.55,.05,'#ded9c8');
   const racket=new THREE.Mesh(new THREE.TorusGeometry(.23,.025,6,18),material('#efb14d'));
   racket.position.set(0,-1.2,0);racket.scale.y=1.3;rig.rightArm.add(racket);
   for(const offset of [-.12,0,.12]){box(rig.rightArm,offset,-1.2,0,.009,.44,.012,'#f4f1dc');box(rig.rightArm,0,-1.2+offset,0,.4,.009,.012,'#f4f1dc');}
  }
  const activity=villageActivity(resident.name);
  const cycle=activity==='cycle'?createVillageCycle(rig,resident.color):undefined;
  sign(rig.group,resident.name,0,cycle?3:2.6,0,1.7,.36);group.add(rig.group);return{rig,resident,activity,cycle,phase:i*1.3};
 });
 const chores=createVillageChores(group,people);
 const shuttle=new THREE.Group();group.add(shuttle);
 const cork=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),material('#ebcfa0'));shuttle.add(cork);
 const feathers=new THREE.Mesh(new THREE.ConeGeometry(.16,.3,8,1,true),material('#fff9e8'));feathers.rotation.x=Math.PI;feathers.position.y=.15;shuttle.add(feathers);
 return{group,people,shuttle,chores,
  nearby(x:number,z:number){return people.filter(p=>Math.hypot(x-villageOrigin.x-p.rig.group.position.x,z-villageOrigin.z-p.rig.group.position.z)<2.6).sort((a,b)=>Math.hypot(x-villageOrigin.x-a.rig.group.position.x,z-villageOrigin.z-a.rig.group.position.z)-Math.hypot(x-villageOrigin.x-b.rig.group.position.x,z-villageOrigin.z-b.rig.group.position.z))[0]?.resident;},
  update(time:number){
   const rally=time/1.65,leg=Math.floor(rally),progress=rally-leg;
   const forward=leg%2===0;
   shuttle.position.set((forward?1:-1)*(.285-.57*progress),1.8+Math.sin(progress*Math.PI)*3,forward?4+10*progress:14-10*progress);
   shuttle.rotation.x=(forward?1:-1)*Math.atan2(10,3*Math.PI*Math.cos(progress*Math.PI));
   for(const {rig,resident,phase,activity,cycle} of people){
    if(activity==='badminton'){
     const north=resident.name==='Jarjit';
     rig.group.rotation.y=north?0:Math.PI;
     rig.group.position.set(resident.x,.24,resident.z);
     const hitting=north===forward;
     const swing=hitting?Math.max(0,1-progress*5):Math.max(0,(progress-.8)*5);
     rig.rightArm.rotation.x=-.65-swing*2.1;
     rig.leftArm.rotation.x=-.4;rig.leftLeg.rotation.x=.12;rig.rightLeg.rotation.x=-.12;
     rig.group.position.y+=Math.sin(swing*Math.PI)*.12;
    }else if(activity==='run'||activity==='walk'||activity==='cycle'){
     const route=groupRoute(resident.name,time);
     rig.group.position.set(route.x,cycle?.18:.18+Math.abs(Math.sin(route.stride))*(route.running?.09:.015),route.z);
     rig.group.rotation.y=route.heading;
     if(cycle)cycle.update(time);
     else{
      const stride=Math.sin(route.stride)*(route.running?.65:.28);
      rig.leftLeg.rotation.x=stride;rig.rightLeg.rotation.x=-stride;
      rig.leftArm.rotation.x=-stride-(route.running?.3:0);rig.rightArm.rotation.x=stride-(route.running?.3:0);
     }
    }else if(activity==='idle'){
     // Small open-ground loops remain outside house, table and playground colliders.
     const walking=resident.child||['Abang Salleh','Abang Iz','Ah Tong'].includes(resident.name);
     const angle=time*.4+phase;
     if(resident.name==='Ah Tong'){
      // Ah Tong used to orbit the warung doorway, where his idle loop could look frozen
      // against the building. Give him a dedicated open path in front of the shop.
      const safeAngle=time*.25+phase;
      rig.group.position.set(28+Math.sin(safeAngle)*2.4,.18,-7+Math.cos(safeAngle)*1.3);
      rig.group.rotation.y=Math.atan2(Math.cos(safeAngle),-.5*Math.sin(safeAngle));
     }else{
      const radius=walking?.65:0;
      rig.group.position.set(resident.x+Math.sin(angle)*radius,.18,resident.z+Math.cos(angle)*radius*.5);
      rig.group.rotation.y=walking?Math.atan2(Math.cos(angle),-.5*Math.sin(angle)):Math.sin(time*.3+phase)*.4;
     }
     const stride=walking?Math.sin(time*5+phase)*.38:0;
     rig.leftLeg.rotation.x=stride;rig.rightLeg.rotation.x=-stride;
     rig.leftArm.rotation.x=-stride;rig.rightArm.rotation.x=walking?stride:Math.sin(time*1.5+phase)*.25;
    }
   }
   chores.update(time);
  }};
}
