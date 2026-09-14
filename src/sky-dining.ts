import * as THREE from 'three';
import {batchShopFallback,box,createPerson,material, nearLoader, cullBeyond} from './world';
import type {Solid} from './physics';
import {SKY,inSkyPool} from '../shared/sky-dining.mjs';
import tables from '../shared/tables.json';
import chairs from '../shared/chairs.json';
import {cdnUrl} from './cdn';

export function swimPose(person:ReturnType<typeof createPerson>,time:number){
 person.leftArm.rotation.x=-1.2+Math.sin(time*2.5)*.45;
 person.rightArm.rotation.x=-1.2-Math.sin(time*2.5)*.45;
 person.leftLeg.rotation.x=Math.sin(time*3)*.22;person.rightLeg.rotation.x=-person.leftLeg.rotation.x;
}
/** Night for the Blender venue (scripts/blender/build_skydining.py): materials named '… glow' light
 * only after dark, the blue and magenta strands and the backlit onyx glow a little by day and fully at
 * night, and the pool picks up underwater light. The water and its caustics share one time uniform. */
const pool={uTime:{value:0},uSky:{value:new THREE.Color('#b9dcec')},uNight:{value:0},uWaterY:{value:SKY.y-.12},uCaustic:{value:null as THREE.Texture|null}};
const glows:{material:THREE.MeshStandardMaterial;day:number;night:number}[]=[];
let skyNight=false;
function applySkyNight(){pool.uNight.value=skyNight?1:0;for(const g of glows)g.material.emissiveIntensity=skyNight?g.night:g.day;}
export function setSkyDiningNight(night:boolean){skyNight=night;applySkyNight();}
function dressVenue(model:THREE.Object3D){
 model.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return;const m=o.material as THREE.MeshStandardMaterial;
  for(const t of [m.map,m.normalMap])if(t)t.anisotropy=8;
  if(glows.some(g=>g.material===m))return;
  const on=m.emissiveIntensity;
  if(/glow$/i.test(m.name)){glows.push({material:m,day:0,night:on});o.castShadow=false;}
  else if(m.name.startsWith('Strand')||m.name==='Backlit onyx'){if(m.name==='Backlit onyx')m.emissive.set('#ffb070');glows.push({material:m,day:on*.4,night:on});}
  else if(m.name==='Pool mosaic'){
   // Underwater the tiles take moving caustics (two scrolls of the sea's ripple normal beating
   // against each other) and, at night, the pool lights' blue.
   m.emissiveMap=m.map;m.emissive.set('#6fdcff');glows.push({material:m,day:0,night:.3});
   m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,pool);
    shader.vertexShader='varying vec3 vPoolWorld;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n vPoolWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='uniform float uTime;\nuniform float uNight;\nuniform float uWaterY;\nuniform sampler2D uCaustic;\nvarying vec3 vPoolWorld;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
     vec2 poolC=vPoolWorld.xz*.55;
     float poolA=texture2D(uCaustic,poolC+vec2(uTime*.021,uTime*.013)).x;
     float poolB=texture2D(uCaustic,poolC*1.37-vec2(uTime*.017,-uTime*.024)).y;
     float poolCaustic=pow(clamp(1.-abs(poolA-poolB)*4.,0.,1.),4.)*(1.-smoothstep(uWaterY-.3,uWaterY-.03,vPoolWorld.y));
     totalEmissiveRadiance+=poolCaustic*mix(.5,.8,uNight)*vec3(.9,1.,1.)*diffuseColor.rgb*2.;`);
   };
   m.needsUpdate=true;
  }
 });
 applySkyNight();
}
export function createSkyDining(scene:THREE.Scene){
 const root=new THREE.Group();root.name='Wet Deck · Sky Dining';root.position.set(SKY.x,SKY.y,SKY.z);scene.add(root);
 // The venue skin is swapped for LM_ENV_SkyDining.glb; the pool, the animated parts and the
 // canvas labels stay on root so the basin, the water and the wording survive the swap.
 const venue=new THREE.Group();venue.name='sky-dining';root.add(venue);
 const solids:Solid[]=[];
 box(venue,0,-4.1,0,34,3.8,30,'#233447');
 const lit=(color:string,intensity:number)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.3});
 const blue=lit('#51aaff',1.5),pink=lit('#e73dff',1.3),gold=lit('#ffe0a0',1.1);
 const glass=new THREE.MeshStandardMaterial({color:'#9dd5ed',transparent:true,opacity:.18,roughness:.15,depthWrite:false,side:THREE.DoubleSide});
 function label(text:string,x:number,y:number,z:number,w:number){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d')!;
  c.fillStyle='#11182e';c.fillRect(0,0,1024,128);c.fillStyle='#f9e5bd';c.font='600 62px sans-serif';c.textAlign='center';c.fillText(text,512,86,990);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w/8),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);root.add(mesh);return mesh;
 }
 function obstacle(x:number,z:number,w:number,d:number){solids.push({x:SKY.x+x,z:SKY.z+z,hx:w/2,hz:d/2});}
 // Four slabs leave a real recessed basin: swimmers do not disappear through an opaque deck.
 box(venue,0,-.3,5,36,.6,22,'#b6a79d');box(venue,-14,-.3,-10,8,.6,8,'#b6a79d');box(venue,14,-.3,-10,8,.6,8,'#b6a79d');box(venue,0,-.3,-15,36,.6,2,'#b6a79d');
 // Basin floor and water stay off the swapped group so the swimmable void can never be filled.
 const basinFloor=box(root,0,-1.8,-10,18,.25,8,'#246b84');
 root.add(poolWater());
 for(const x of [-9.2,9.2])box(venue,x,-.5,-10,.35,1.5,8.5,'#477d98');
 for(const z of [-14.2,-5.8]){box(venue,0,-.5,z,18.5,1.5,.35,'#477d98');box(venue,0,.03,z,18.5,.07,.14,pink);}
 // Broad shallow steps on the lounge side give an obvious way in and out.
 for(let i=0;i<4;i++)box(venue,0,-.15-i*.34,-6.05-i*.65,3.8,.3,.75,'#88a9c3');
 // Clear north-facing edge frames the actual KLCC skyline.
 for(const x of [-17.7,17.7]){box(venue,x,.8,0,.12,1.6,32,glass);box(venue,x,1.6,0,.1,.07,32,gold);obstacle(x,0,.3,32);}
 for(const z of [-15.7,15.7]){box(venue,0,.8,z,36,1.6,.12,glass);box(venue,0,1.6,z,36,.07,.1,gold);obstacle(0,z,36,.3);}
 // Indoor half: curved ceiling ribbons, blue hanging strands and a warm-backed bar.
 const roof=box(root,0,5.4,9,36,.25,14,new THREE.MeshStandardMaterial({color:'#23263e',transparent:true,opacity:1}));
 // Overhead cover hides while you are up there, so the follow camera can look into the lounge.
 const overhead:THREE.Object3D[]=[roof];box(venue,0,2.6,15.5,36,5.2,.15,'#182338');
 for(const x of [-17.5,17.5])box(venue,x,2.6,9,.15,5.2,13,glass);
 for(let i=0;i<4;i++){
  const points=Array.from({length:24},(_,j)=>new THREE.Vector3(-17+j*34/23,5.1,3+i*3+Math.sin(j*.3+i)*.8));
  const ribbon=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.055,5,false),blue);venue.add(ribbon);
 }
 for(let i=0;i<52;i++){const x=-17+i*34/51;box(venue,x,3.8,15.25,.035,2.7,.035,i%3?blue:pink);}
 for(const x of [-16,-8,8,16])box(venue,x,2.6,3,.18,5.2,.18,'#b7a8b6');
 box(venue,0,.6,3,12,1.2,2.4,'#262538');box(venue,0,1.27,3,12.5,.18,2.8,'#dfd3bf');obstacle(0,3,12.5,2.8);
 box(venue,0,.15,1.57,11.8,.15,.08,gold);label('WET DECK · SKY DINING',0,3.7,14.95,14).rotation.y=Math.PI;
 for(let i=0;i<9;i++){box(venue,-5+i*1.25,1.5,3,.18,.4,.18,['#65bfac','#d898bb','#dfb767'][i%3]);box(venue,-5+i*1.25,.6,5.3,.7,.18,.7,'#6e7cb8');box(venue,-5+i*1.25,.3,5.3,.1,.6,.1,'#ad986e');}
 // Banquettes retain the reference's navy upholstery and magenta cushions.
 for(const x of [-11,0,11]){box(venue,x,.45,13.4,7,.65,1.7,'#172342');box(venue,x,1.05,14.15,7,1,.25,'#202342');for(const dx of [-2,0,2])box(venue,x+dx,.9,13.7,1,.75,.25,dx?'#a63b7f':'#7453ad');}
 for(const x of [-16,16])for(const z of [-14,-5]){
  box(venue,x,.45,z,1.25,.9,1.25,'#263c45');obstacle(x,z,1.25,1.25);
  for(let j=0;j<5;j++){const leaf=box(venue,x+Math.sin(j*1.3)*.3,1.2,z+Math.cos(j*1.3)*.3,.16,1.3,.5,'#456e68');leaf.rotation.z=Math.sin(j)*.35;}
 }
 const rooftopTables=tables.filter(t=>t.id.startsWith('sky-'));
 for(const table of rooftopTables){const x=table.x-SKY.x,z=table.z-SKY.z;
  const large=table.id==='sky-7';
  if(large){const top=new THREE.Mesh(new THREE.CylinderGeometry(1.9,1.9,.15,32),material('#34314b'));top.position.set(x,.9,z);venue.add(top);for(const side of [1,-1])label('WEREWOLF · 9 SEATS',x,2.6,z+side*.01,4).rotation.y=side>0?0:Math.PI;}
  else box(venue,x,.9,z,2.2,.15,2.2,'#34314b');
  box(venue,x,.43,z,.22,.85,.22,'#bcaa7d');obstacle(x,z,large?3.2:2.2,large?3.2:2.2);
  box(venue,x,1.06,z,.18,.24,.18,pink);
  for(const chair of chairs.filter(c=>c.tableId===table.id)){const seat=new THREE.Group();seat.position.set(chair.x-SKY.x,0,chair.z-SKY.z);seat.rotation.y=chair.yaw;venue.add(seat);box(seat,0,.5,0,.85,.18,.85,'#493657');box(seat,0,.96,-.38,.9,.85,.15,'#574268');for(const dx of [-.32,.32])for(const dz of [-.32,.32])box(seat,dx,.25,dz,.06,.5,.06,'#b8a180');}
 }
 const dj=createPerson('#24304c');dj.group.position.set(-14,0,6.5);root.add(dj.group);cullBeyond(dj.group,120);box(venue,-14,1,5.5,3.3,.28,1.2,'#171827');obstacle(-14,5.5,3.3,1.2);
 for(const x of [-14.8,-13.2]){const disc=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.04,24),material('#58a9c8'));disc.position.set(x,1.17,5.5);venue.add(disc);}
 for(const x of [-16.3,-11.7])box(venue,x,.8,5.5,.7,1.6,.65,'#171b28');
 const swimmers=Array.from({length:4},(_,i)=>{const p=createPerson(['#496d91','#784c97','#397b80','#864f73'][i]);root.add(p.group);cullBeyond(p.group,120);return p;});
 for(const [x,z,color] of [[-6,5,'#86633c'],[5,6,'#527c85'],[-6,12,'#714971'],[5,12,'#386879']] as const){const p=createPerson(color);p.group.position.set(x,0,z);root.add(p.group);cullBeyond(p.group,120);}
 // A lift vestibule sits on the existing hotel, with a visible street-level entrance.
 box(venue,14,1.6,12,3.8,3.2,3,'#242d47');obstacle(14,13,3.8,1);
 label('LIFT ↓',14,2.6,10.45,3).rotation.y=Math.PI;for(const side of [1,-1])label('POOL · STEPS ↓',0,.65,-5.3+side*.01,4).rotation.y=side>0?0:Math.PI;
 box(venue,SKY.entry.x-SKY.x,1.6-SKY.y,SKY.entry.z-SKY.z,3.4,3.2,1.5,'#28314a');
 const streetLabel=label('WET DECK ↑',SKY.entry.x-SKY.x,3.7-SKY.y,SKY.entry.z-SKY.z+.8,5);streetLabel.name='Street lift sign';
 root.traverse(o=>{o.userData.keepUnbatched=true;});
 batchShopFallback(venue);
 void nearLoader(venue,170,320).loadAsync(cdnUrl('assets/models/environment/LM_ENV_SkyDining.glb')).then(gltf=>{
  gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;o.castShadow=false;}});
  for(const child of [...venue.children])if(!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial))child.removeFromParent();
  dressVenue(gltf.scene);venue.add(gltf.scene);
  // The Blender basin and lounge roof replace the procedural floor and roof slab.
  basinFloor.visible=false;const ceiling=gltf.scene.getObjectByName('ceiling');if(ceiling){roof.removeFromParent();overhead[0]=ceiling;}
 }).catch(error=>console.warn('[SKY DINING] keeping procedural venue',error));
 return {root,solids,update(time:number,reduced:boolean,visiting=false){
  for(const o of overhead)o.visible=!visiting;
  pool.uTime.value=reduced?0:time;if(scene.background instanceof THREE.Color)pool.uSky.value.copy(scene.background);
  swimmers.forEach((p,i)=>{const t=reduced?i:time*.13+i*Math.PI/2;p.group.position.set(Math.sin(t)*(5-i*.4),-1.15,-10+Math.cos(t)*2);p.group.rotation.y=t+Math.PI/2;swimPose(p,reduced?0:time+i);});
  dj.leftArm.rotation.x=-1.2;dj.rightArm.rotation.x=-1.2+(reduced?0:Math.sin(time*2)*.15);
 },swimming:inSkyPool};
}

/** The pool surface: a sheet over x -9..9, z -14..-6 at the still-water line, continuing over the
 * north knife edge as the spill sheet into the catch gutter. A scrolling two-layer ripple normal,
 * a fresnel sheen of the sky colour and a clear tint over the mosaic, as the sea does in beach.ts. */
function poolWater(){
 const texture=new THREE.TextureLoader().load('/assets/textures/beach/water-normal.webp?v=beach-v2');
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.NoColorSpace;pool.uCaustic.value=texture;
 const rows:[number,number][]=[[-6,-.12],[-10,-.12],[-14,-.12],[-14.05,-.135],[-14.09,-.22],[-14.11,-.5]];
 const position:number[]=[],uv:number[]=[],index:number[]=[];let v=0;
 rows.forEach(([z,y],r)=>{if(r)v+=Math.hypot(z-rows[r-1][0],y-rows[r-1][1]);for(const x of [-9,0,9]){position.push(x,y,z);uv.push(x/3,v/3);}});
 for(let r=0;r<rows.length-1;r++)for(let c=0;c<2;c++){const a=r*3+c,b=a+1,d=a+3,e=a+4;index.push(a,b,d,b,e,d);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:'#0a6178',transparent:true,opacity:.42,roughness:.03,metalness:0,normalMap:texture,normalScale:new THREE.Vector2(.3,.3),depthWrite:false});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,pool);
  shader.fragmentShader='uniform float uTime;\nuniform vec3 uSky;\nuniform float uNight;\n'+shader.fragmentShader
   .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
    `vec3 mapN = texture2D( normalMap, vNormalMapUv + vec2( uTime * .013, uTime * .021 ) ).xyz * 2.0 - 1.0;
     vec3 mapN2 = texture2D( normalMap, vNormalMapUv * 2.3 + vec2( -uTime * .024, uTime * .009 ) ).xyz * 2.0 - 1.0;
     mapN = normalize( vec3( mapN.xy + mapN2.xy * .6, mapN.z * mapN2.z ) );`)
   .replace('#include <opaque_fragment>',
    `#include <opaque_fragment>
     float poolFresnel = pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 3.0 );
     gl_FragColor.rgb = mix( gl_FragColor.rgb, uSky, poolFresnel * .55 ) + uNight * vec3( .03, .2, .26 ) * ( 1.0 - poolFresnel );
     gl_FragColor.a = mix( gl_FragColor.a, .94, poolFresnel );`);
 };
 const mesh=new THREE.Mesh(geometry,material);mesh.name='Swimming pool';mesh.renderOrder=1;return mesh;
}
