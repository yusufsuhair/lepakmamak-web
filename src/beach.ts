import * as THREE from 'three';
import {batchShopFallback,box,createIceCreamBike,createPerson,material,palm,type Person,type World, nearLoader, cullBeyond} from './world';
import tables from '../shared/tables.json';
import chairs from '../shared/chairs.json';
import {cdnUrl} from './cdn';
import {NIGHT_SUN,onSkyChange} from './weather';

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

/** Mirrors scripts/blender/build_beach.py: the dry sand top, the foreshore slope between fore0 and
 * fore1, the nearshore floor, and the still-water line, which crosses the slope near z 152. The
 * dry beach runs west..east; past the hedges (hedgeZ) the seabed spans the whole sea. */
export const SHORE={sandY:.02,fore0:150.3,fore1:153.3,nearY:-.035,seaY:-.012,waterline:152.2,west:87.5,east:156.25,hedgeZ:157.6};
const smooth=(t:number)=>{t=Math.min(Math.max(t,0),1);return t*t*(3-2*t);};
export const shoreY=(z:number)=>SHORE.sandY+(SHORE.nearY-SHORE.sandY)*smooth((z-SHORE.fore0)/(SHORE.fore1-SHORE.fore0));
/** Sea surface height. The swell is damped to a lap over the shallow floor (which sits 2 cm under
 * still water), only builds past z 159 where the Blender seabed drops away, and flattens again
 * toward the horizon, where the mesh is too coarse to carry it. */
export function seaY(x:number,z:number,time:number){
 return SHORE.seaY+(Math.sin(z*.55+time*1.6)*.13+Math.sin(x*.3+z*.25+time)*.05)*(.06+.94*smooth((z-159)/24))*(1-smooth((z-260)/240));
}
// Shallow -> deep: [metres offshore of the still waterline, colour, alpha]. Clear over the sand
// (a tint no brighter than the wet seabed it lets through), opaque past the break.
const DEPTH:[number,string,number][]=[[0,'#5fb8a8',0],[.7,'#4cb2a6',.16],[3,'#35a8a6',.42],[8,'#1b95a3',.74],[20,'#127e96',.93],[60,'#0c5b78',1],[400,'#0a4766',1]];
function depthColour(d:number,out:THREE.Color){
 let i=0;while(i<DEPTH.length-2&&d>DEPTH[i+1][0])i++;
 const [d0,c0,a0]=DEPTH[i],[d1,c1,a1]=DEPTH[i+1],t=smooth((d-d0)/(d1-d0));
 out.set(c0).lerp(new THREE.Color(c1),t);return a0+(a1-a0)*t;
}

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
 // Sand, tide strip and boardwalk are fallback too: the Blender terrain replaces them.
 box(props,124,-.015,142,58,.06,22,'#edd3a0');
 box(props,124,.015,151,58,.02,2,'#d6bf94');
 box(props,88,.025,132,16,.05,3,'#b3936c');
 for(let x=81;x<99;x+=.65)box(props,x,.06,132,.5,.04,3,'#c3a67c');
 sign('PANTAI SENJA',98,3.6,132,9);pole(94,1.65,132,.1,3.3,'#796245');pole(102,1.65,132,.1,3.3,'#796245');
 world.mapBuildings.push({x:124,z:142,w:58,d:22,color:'#edd3a0'});
 const beachMatkool=createIceCreamBike();beachMatkool.position.set(89,.09,142);beachMatkool.rotation.y=Math.PI/2;g.add(beachMatkool);
 world.solids.push({x:89,z:142,hx:1.35,hz:1.8});
 const {seaGeometry,seaUniforms,foam,swash}=createSea(g);
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
 const vendor=createPerson('#ead09b',true);vendor.group.position.set(98,0,135.3);g.add(vendor.group);cullBeyond(vendor.group,110);
 const walkers=[createPerson('#df9168'),createPerson('#74a6b2'),createPerson('#d6b56a')];for(const p of walkers){g.add(p.group);cullBeyond(p.group,110);}
 for(const x of [119,130,142]){box(props,x,.35,148,1,.15,2.4,'#c7aa7a');const back=box(props,x,.8,148.9,1,1.1,.1,'#e9ddc0');back.rotation.x=-.35;}
 pole(125,.2,148,.8,.4,'#776650');const fire=createFlame();fire.position.set(125,.14,148);g.add(fire);world.solids.push({x:125,z:148,hx:.8,hz:.8});
 const glow=new THREE.PointLight('#ffb566',10,13,2);glow.position.set(125,1.5,148);g.add(glow);
 for(const x of [104,146]){pole(x,1.8,144,.08,3.6,'#795b40');sphere(x,3.6,144,.23,'#ffdf99');const l=new THREE.PointLight('#ffe0ae',7,12,2);l.position.set(x,3.5,144);g.add(l);}
 // The props above are the fallback until the Blender set arrives. Only the canvas signs
 // are kept, so PANTAI SENJA, KELAPA SEGAR · RM5 and WEREWOLF · 9 TEMPAT stay the game's
 // wording rather than being baked into the mesh.
 props.traverse(o=>{o.userData.keepUnbatched=true;});
 batchShopFallback(props);
 // City palms stand in until the Blender set brings its own (PALMS in build_beach.py). Planted
 // after batching, so the foliage loader can still swap its fallbacks for instances.
 for(const [x,z,s] of [[98,145,.85],[149,133,.85],[102,137,.85],[154.2,140.5,.95],[90.5,147.5,.9]]) palm(props,x,z,s);
 void nearLoader(props,170,300).loadAsync(cdnUrl('assets/models/environment/LM_ENV_Beach.glb')).then(gltf=>{
  gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;o.castShadow=false;}
   // The sand only receives: it is flat, and casting would double every prop's shadow cost.
   if(o.name.includes('terrain')){o.castShadow=false;for(const t of [m.map,m.normalMap])if(t)t.anisotropy=8;}});
  const fallback=(child:THREE.Object3D)=>child!==gltf.scene&&!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial);
  for(const child of [...props.children])if(fallback(child))child.removeFromParent();
  props.add(gltf.scene);
  // The city palm batch can finish loading after this swap and would land in props beside the
  // Blender palms; turn it away.
  props.addEventListener('childadded',({child})=>{if(fallback(child))queueMicrotask(()=>child.removeFromParent());});
 }).catch(error=>console.warn('[BEACH] keeping procedural props',error));
 const position=seaGeometry.attributes.position;
 const nearbyRest=(position:{x:number;z:number})=>BEACH_REST_SPOTS.filter(spot=>Math.hypot(position.x-spot.x,position.z-spot.z)<=2.6).sort((a,b)=>Math.hypot(position.x-a.x,position.z-a.z)-Math.hypot(position.x-b.x,position.z-b.z))[0]||null;
 return {iceCream:beachMatkool,nearbyRest,exitSpot:(spot:BeachRestSpot)=>({x:spot.exitX,z:spot.exitZ}),pose:beachRestPose,update(time:number,player?:{x:number;z:number}){
  // The swell is CPU work on 7.9k vertices plus a normal pass (~2.5 ms a frame); past 130 m of the
  // shore it cannot be seen, and the shader ripples keep moving anyway.
  if(!player||Math.hypot(player.x-120,Math.max(0,SHORE.waterline-player.z))<130){
   for(let i=0;i<position.count;i++)position.setY(i,seaY(position.getX(i),position.getZ(i),time));
   position.needsUpdate=true;seaGeometry.computeVertexNormals();
  }
  seaUniforms.uTime.value=time;seaUniforms.uSky.value.copy(scene.background instanceof THREE.Color?scene.background:seaUniforms.uSky.value);
  foam.forEach(crest=>crest.update(time));swash.forEach(wash=>wash.update(time));
  walkers.forEach((p,i)=>{const t=time*.22+i*2.1;p.group.position.set(117+i*10+Math.sin(t)*3,0,145+Math.cos(t)*.6);p.group.rotation.y=Math.cos(t)>0?Math.PI/2:-Math.PI/2;p.leftLeg.rotation.x=Math.sin(time*3+i)*.25;p.rightLeg.rotation.x=-p.leftLeg.rotation.x;});
  vendor.rightArm.rotation.x=-.35+Math.sin(time*1.5)*.12;fire.scale.y=1+Math.sin(time*5)*.12;
 }};
}

/** Campfire flame: three crossed additive cards of a soft teardrop gradient, so it glows and
 * flickers instead of reading as a solid cone. update() stretches it through fire.scale.y. */
function createFlame(){
 const c=document.createElement('canvas');c.width=64;c.height=128;const ctx=c.getContext('2d')!;
 const body=ctx.createRadialGradient(32,92,2,32,84,40);body.addColorStop(0,'rgba(255,246,200,1)');body.addColorStop(.35,'rgba(255,176,64,.9)');body.addColorStop(.75,'rgba(230,80,20,.35)');body.addColorStop(1,'rgba(160,30,0,0)');
 ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(32,4);ctx.bezierCurveTo(58,52,62,96,32,126);ctx.bezierCurveTo(2,96,6,52,32,4);ctx.fill();
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const flame=new THREE.Group();flame.name='beach-fire-flame';
 const flameMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:true});
 for(let k=0;k<3;k++){const card=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.3),flameMaterial);card.position.y=.62;card.rotation.y=k*Math.PI/3;flame.add(card);}
 return flame;
}

/** The sea: a swell mesh whose rows crowd toward the shore, tinted and faded by depth, with a
 * scrolling two-layer ripple normal, a sky-coloured fresnel sheen that follows the weather's
 * background colour (so it darkens at night), breaking crests offshore and swash lace that
 * runs up the wet sand and drains back. Textures come from scripts/blender/build_beach.py. */
function createSea(g:THREE.Group){
 const loader=new THREE.TextureLoader();
 const texture=(name:string)=>{const t=loader.load(`/assets/textures/beach/${name}.webp?v=beach-v2`);t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;};
 const waterNormal=texture('water-normal'),foamTexture=texture('foam');foamTexture.wrapT=THREE.ClampToEdgeWrapping;
 const cols=64,rows=120;
 const seaGeometry=new THREE.PlaneGeometry(1,1,cols,rows);seaGeometry.rotateX(-Math.PI/2);
 const position=seaGeometry.attributes.position,uv=seaGeometry.attributes.uv;
 const colours=new Float32Array(position.count*4),colour=new THREE.Color();
 for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
  const i=r*(cols+1)+c;let x=c===0?-500:c===cols?750:74+100*c/cols;
  // Snap the columns nearest the hedge ends onto them, so the shore-hugging rows start exactly
  // where the dry beach does; beyond the hedges the water starts behind them. The outer columns
  // and the last rows run the sea out to the fogged horizon.
  if(Math.abs(x-SHORE.west)<.8)x=SHORE.west;if(Math.abs(x-SHORE.east)<.8)x=SHORE.east;
  const near=x<SHORE.west||x>SHORE.east?SHORE.hedgeZ:150.8,z=near+900*(r/rows)**2.4;
  position.setXYZ(i,x,SHORE.seaY,z);uv.setXY(i,x/7,z/7);
  const a=depthColour(z-SHORE.waterline,colour);colours.set([colour.r,colour.g,colour.b,a],i*4);
 }
 seaGeometry.setAttribute('color',new THREE.BufferAttribute(colours,4));seaGeometry.computeVertexNormals();seaGeometry.computeBoundingSphere();
 const seaUniforms={uTime:{value:0},uSky:{value:new THREE.Color('#b9dcec')},uLight:{value:new THREE.Color(1,1,1)}};
 const seaMaterial=new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,roughness:.07,metalness:0,normalMap:waterNormal,normalScale:new THREE.Vector2(.32,.32)});
 seaMaterial.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,seaUniforms);
  shader.fragmentShader='uniform float uTime;\nuniform vec3 uSky;\nuniform vec3 uLight;\n'+shader.fragmentShader
   // The depth colours are daylight turquoise and the city's night ambient is strong: the sky's light
   // scales the ambient on the water body only, so sun, moon, lamp and fire light and glints still read.
   .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\n     reflectedLight.indirectDiffuse *= uLight;')
   .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
    `vec3 mapN = texture2D( normalMap, vNormalMapUv + vec2( uTime * .011, uTime * .019 ) ).xyz * 2.0 - 1.0;
     vec3 mapN2 = texture2D( normalMap, vNormalMapUv * 2.3 + vec2( -uTime * .021, uTime * .007 ) ).xyz * 2.0 - 1.0;
     mapN = normalize( vec3( mapN.xy + mapN2.xy * .6, mapN.z * mapN2.z ) );`)
   .replace('#include <opaque_fragment>',
    `#include <opaque_fragment>
     float seaFresnel = pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 4.0 );
     gl_FragColor.rgb = mix( gl_FragColor.rgb, uSky, seaFresnel * .6 );
     gl_FragColor.a = mix( gl_FragColor.a, 1.0, seaFresnel * .75 * smoothstep( .0, .3, vColor.a ) );`);
 };
 const sea=new THREE.Mesh(seaGeometry,seaMaterial);sea.name='beach-sea';g.add(sea);

 // A foam strip: a grid whose vertex alpha fades toward its ends and its seaward edge, re-laid each
 // frame along a leading edge and onto the higher of sand and water.
 const surface=(x:number,z:number,time:number)=>Math.max(shoreY(z),seaY(x,z,time));
 function strip(name:string,depth:number,segX:number,segZ:number){
  const geometry=new THREE.PlaneGeometry(1,1,segX,segZ);
  const alpha=new Float32Array(geometry.attributes.position.count*4);
  for(let r=0;r<=segZ;r++)for(let c=0;c<=segX;c++){const u=c/segX;alpha.set([1,1,1,smooth(u*7)*smooth((1-u)*7)],(r*(segX+1)+c)*4);}
  geometry.setAttribute('color',new THREE.BufferAttribute(alpha,4));
  const foamMaterial=new THREE.MeshLambertMaterial({color:'#f3faf7',alphaMap:foamTexture,vertexColors:true,transparent:true,depthWrite:false,opacity:0,side:THREE.DoubleSide});
  // Vertices move every frame, so bound the whole surf zone once instead of recomputing.
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(122,0,162),48);
  const mesh=new THREE.Mesh(geometry,foamMaterial);mesh.name=name;mesh.renderOrder=2;g.add(mesh);
  const pos=geometry.attributes.position,uvs=geometry.attributes.uv;
  return {material:foamMaterial,place(x0:number,x1:number,lead:(x:number)=>number,time:number,drift:number){
   for(let r=0;r<=segZ;r++)for(let c=0;c<=segX;c++){
    const i=r*(segX+1)+c,x=x0+(x1-x0)*c/segX,z=lead(x)+depth*r/segZ;
    pos.setXYZ(i,x,surface(x,z,time)+.012,z);uvs.setXY(i,x/6+drift,r/segZ);   // v runs lip -> trailing lace
   }
   pos.needsUpdate=true;uvs.needsUpdate=true;
  }};
 }
 // Breaking crests: short, broken lines of white water that roll in, brighten over the bar and
 // dissolve before the shore. Each pass picks a new span, so the sets never repeat in place.
 const foam=Array.from({length:8},(_,i)=>{
  const s=strip('beach-foam',2.4,28,4);
  return {material:s.material,update(time:number){
   const t=time*.045+i/8,phase=t%1,n=Math.floor(t);
   const seed=Math.sin((i+1)*12.9898+n*78.233)*43758.5453,f=seed-Math.floor(seed);
   const len=18+f*24,x0=SHORE.west+2+f*(SHORE.east-SHORE.west-len-4),x1=x0+len,bend=(f-.5)*2,z=180-phase*27;
   s.material.opacity=smooth((180-z)/8)*(1-smooth((157.5-z)/4))*(.5+.45*smooth((170-z)/8));
   s.place(x0,x1,x=>z+Math.sin(x*.21+i)*.6+bend*Math.sin((x-x0)/len*Math.PI),time,time*.02*(i%2?1:-1));
  }};
 });
 // Swash: two sheets of lace that rush up the wet sand, stall, and drain back fading.
 const swash=[0,.5].map(offset=>{
  const s=strip('beach-swash',1.8,56,4);
  return {material:s.material,update(time:number){
   const phase=(time/7.5+offset)%1,rushing=phase<.32;
   const reach=152.9-1.7*(rushing?smooth(phase/.32):1-smooth((phase-.32)/.68));
   s.material.opacity=.85*(rushing?1:1-smooth((phase-.32)/.6));
   s.place(SHORE.west+.5,SHORE.east-.5,x=>reach+Math.sin(x*.37+offset*9)*.28+Math.sin(x*1.13+offset*3)*.1,time,offset*3+time*.01);
  }};
 });
 // Dusk warms and dims the water, night takes it to blue-black; the foam dims with it but keeps
 // enough to trace the surf. Driven by the one sky (weather.ts), only when it changes.
 const white=new THREE.Color(1,1,1),hue=new THREE.Color(),nightSea=new THREE.Color('#7d97c8'),foamColour=new THREE.Color('#f3faf7');
 sea.userData.light=seaUniforms.uLight.value;
 onSkyChange(sky=>{
  const day=smooth((sky.lightIntensity-NIGHT_SUN)/(1.5-NIGHT_SUN));
  // Sunlight's hue at unit brightness, part way to white, so dusk warms the water without darkening it twice.
  hue.copy(sky.light).multiplyScalar(1/Math.max(.05,sky.light.r*.2126+sky.light.g*.7152+sky.light.b*.0722)).lerp(white,.45).multiplyScalar(.25+.75*day);
  seaUniforms.uLight.value.copy(nightSea).multiplyScalar(.16).lerp(hue,day);
  for(const crest of [...foam,...swash])crest.material.color.copy(foamColour).multiplyScalar(.28+.72*day);
 });
 return {seaGeometry,seaUniforms,foam,swash};
}
