import * as THREE from 'three';
import {box,createPerson,material,type World} from './world';

// All authored coordinates are relative to this origin: relocate the whole neighbourhood here.
export const villageOrigin={x:122,z:-132};
export const villageResidents=[
 {name:'Upin',x:-3,z:7,color:'#f3ce32',child:true,line:'Betul, betul, betul! Jom jumpa kawan-kawan di halaman!',hair:false},
 {name:'Ipin',x:0,z:8,color:'#56a9dd',child:true,line:'Jom lepak! Abang Upin tunggu di halaman.',hair:false},
 {name:'Opah',x:-17,z:-5,color:'#b797cc',child:false,line:'Selamat datang, cucu. Jaga diri dan berbaik dengan semua orang.',hair:true},
 {name:'Kak Ros',x:-13,z:-4,color:'#dc6885',child:false,line:'Lepas main, ingat kemas halaman ya!',hair:true},
 {name:'Tok Dalang',x:16,z:-5,color:'#d5c8a0',child:false,line:'Mari tengok kebun Tok. Jangan pijak anak pokok!',hair:true},
 {name:'Ehsan',x:6,z:7,color:'#e55858',child:true,line:'Kita berkumpul di clubhouse hari ini!',hair:true},
 {name:'Fizi',x:9,z:10,color:'#dcb153',child:true,line:'Ramainya orang hari ini. Jom cari Mail!',hair:true},
 {name:'Mail',x:18,z:12,color:'#76a870',child:true,line:'Singgah warung dulu! Lepas itu kita main bersama.',hair:true},
 {name:'Mei Mei',x:-8,z:11,color:'#e89ca8',child:true,line:'Mari belajar dan bermain sama-sama!',hair:true},
 {name:'Jarjit',x:3,z:13,color:'#5986c5',child:true,line:'Dua tiga bunga di taman, selamat datang wahai kawan!',hair:true},
 {name:'Susanti',x:-11,z:13,color:'#c787bc',child:true,line:'Cantik kampung ini. Mari jalan-jalan!',hair:true},
 {name:'Cikgu Melati',x:-18,z:10,color:'#b683b1',child:false,line:'Selamat datang ke tadika. Semua orang boleh belajar sesuatu yang baru.',hair:true},
 {name:'Uncle Muthu',x:20,z:6,color:'#d2a078',child:false,line:'Selamat datang! Duduklah, berehat sekejap di warung.',hair:true},
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
}

// Resident meshes load separately; no moving people are merged into the static scenery.
export function createVillageResidents(scene:THREE.Scene){
 const group=new THREE.Group();group.position.set(villageOrigin.x,0,villageOrigin.z);scene.add(group);
 const people=villageResidents.map((resident,i)=>{
  const rig=createPerson(resident.color);rig.group.position.set(resident.x,.1,resident.z);rig.group.scale.setScalar(resident.child?.73:1);
  if(!resident.hair){const hair=rig.group.children[4];if(hair)hair.visible=false;}
  if(resident.name==='Upin')box(rig.group,0,2.22,0,.025,.18,.025,'#302f28');
  if(resident.name==='Ehsan'||resident.name==='Mei Mei')for(const side of [-1,1])box(rig.group,side*.115,1.91,.255,.19,.1,.025,'#433a32');
  if(resident.name==='Opah'||resident.name==='Cikgu Melati'){box(rig.group,0,1.79,-.11,.55,.48,.28,resident.color);}
  if(resident.name==='Tok Dalang')box(rig.group,0,2.1,-.02,.48,.18,.42,'#e8e3ce');
  if(resident.name==='Jarjit'){const turban=new THREE.Mesh(new THREE.SphereGeometry(.29,8,6),material('#775084'));turban.position.set(0,2.06,0);rig.group.add(turban);}
  sign(rig.group,resident.name,0,2.6,0,1.7,.36);group.add(rig.group);return{rig,resident,phase:i*1.3};
 });
 return{group,update(time:number){for(const {rig,resident,phase} of people){const sway=Math.sin(time*1.5+phase);rig.rightArm.rotation.x=sway*.18;rig.group.position.y=.1+Math.sin(time*2+phase)*.025;rig.group.rotation.y=Math.sin(time*.2+phase)*.3;if(resident.child){rig.leftArm.rotation.x=-sway*.18;}}}};
}
