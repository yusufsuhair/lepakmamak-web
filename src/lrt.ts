import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {box,material} from './world';
import {stations,trackPoint,trackLength,trainState,railHeight} from '../shared/lrt.mjs';
import type {Solid} from './physics';
import './lrt.css';

function batchStatic(group:THREE.Group,dynamic:THREE.Object3D[]=[]){
 group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),sources:THREE.Mesh[]=[];
 group.traverse(obj=>{if(!(obj instanceof THREE.Mesh)||Array.isArray(obj.material)||obj.material instanceof THREE.MeshBasicMaterial)return;
  for(let parent:THREE.Object3D|null=obj;parent&&parent!==group;parent=parent.parent)if(dynamic.includes(parent))return;
  const geometry=obj.geometry.clone().applyMatrix4(inverse.clone().multiply(obj.matrixWorld));
  if(!batches.has(obj.material))batches.set(obj.material,[]);batches.get(obj.material)!.push(geometry);sources.push(obj);
 });
 for(const mesh of sources)mesh.removeFromParent();
 for(const [mat,geometries] of batches){const merged=mergeGeometries(geometries);if(merged){const mesh=new THREE.Mesh(merged,mat);mesh.receiveShadow=true;group.add(mesh);}geometries.forEach(g=>g.dispose());}
}

// Blender-built Rapid KL assets (scripts/blender/build_lrt.py). The box placeholders
// below stay on screen until each GLB lands, and stay for good if it never does.
const LRT_VERSION='lrt-v2';
type AssetState='loading'|'ready'|'fallback';
export const lrtStatus:{viaduct:AssetState;station:AssetState;train:AssetState;night:boolean}={viaduct:'loading',station:'loading',train:'loading',night:false};
// Night: emissive maps hold head/tail lamps and displays (lit all day: saturated red/amber or pure
// white texels) and saloon light, stairwell glow and roof LEDs (night only); the platform wash is
// additive light shown only at night. Glossy paint and glass reflect a small painted sky of their
// own, never scene.environment.
const nightUniform={value:0};const glows:THREE.MeshStandardMaterial[]=[];const washes:THREE.Material[]=[];
const envs:Record<'day'|'night',THREE.Texture|null>={day:null,night:null};
function sky(stops:[number,string][]){const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d')!;const g=ctx.createLinearGradient(0,0,0,64);
 for(const [at,colour] of stops)g.addColorStop(at,colour);ctx.fillStyle=g;ctx.fillRect(0,0,128,64);const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;return t;}
function applyNight(){nightUniform.value=lrtStatus.night?1:0;for(const m of glows)m.envMap=lrtStatus.night?envs.night:envs.day;for(const w of washes)w.visible=lrtStatus.night;}
export function setLrtNight(night:boolean){lrtStatus.night=night;applyNight();}
function dress(mesh:THREE.Mesh){
 const m=mesh.material as THREE.MeshStandardMaterial;
 if(m.name==='LRT night wash'){m.emissiveMap=m.map;m.map=null;m.color.setRGB(0,0,0);m.emissive.set('#ffd9a0');m.emissiveIntensity=.55;
  Object.assign(m,{blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});m.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=false;mesh.renderOrder=2;if(!washes.includes(m))washes.push(m);return;}
 if(glows.includes(m))return;
 envs.day??=sky([[0,'#5d8fc4'],[.42,'#b8d3e6'],[.5,'#e8ece8'],[.56,'#9aa29a'],[1,'#5f655f']]);
 envs.night??=sky([[0,'#060b14'],[.45,'#1a2536'],[.5,'#4a4136'],[.56,'#1d1b19'],[1,'#08090b']]);
 m.envMap=envs.day;m.envMapIntensity=m.name==='LRT girder concrete'||m.name==='LRT pier concrete'?.25:.9;glows.push(m);
 for(const t of [m.map,m.normalMap])if(t)t.anisotropy=8;
 const girder=m.name==='LRT girder concrete';
 if(!m.emissiveMap&&!girder)return;
 m.onBeforeCompile=shader=>{
  shader.uniforms.lrtNight=nightUniform;
  // One girder sheet holds three 3 m segment variants side by side; each instance picks one.
  if(girder)shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
   #ifdef USE_INSTANCING
    float lrtSeg=floor(fract(sin(dot(floor(instanceMatrix[3].xz*.5),vec2(12.9898,78.233)))*43758.5453)*3.)/3.;
    #ifdef USE_MAP
     vMapUv.x+=lrtSeg;
    #endif
    #ifdef USE_NORMALMAP
     vNormalMapUv.x+=lrtSeg;
    #endif
   #endif`);
  if(m.emissiveMap)shader.fragmentShader='uniform float lrtNight;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`
   vec4 lrtGlow=texture2D(emissiveMap,vEmissiveMapUv);
   float lrtDay=clamp(step(.5,lrtGlow.r-lrtGlow.b)+step(.92,min(lrtGlow.r,min(lrtGlow.g,lrtGlow.b))),0.,1.);
   totalEmissiveRadiance*=lrtGlow.rgb*mix(lrtDay,1.6,lrtNight);`);
 };
}
function lrtAsset(name:string){return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/assets/models/lrt/${name}.glb?v=${LRT_VERSION}`).then(gltf=>{
 gltf.scene.traverse(obj=>{if(!(obj instanceof THREE.Mesh))return;obj.castShadow=obj.receiveShadow=true;const m=obj.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;obj.castShadow=false;}dress(obj);});
 applyNight();return gltf.scene;}).catch(error=>{console.warn(`LRT asset ${name} unavailable, keeping placeholder`,error);return null;});}
// Drop every placeholder mesh but keep the canvas labels (station names, destinations).
function swapIn(group:THREE.Object3D,model:THREE.Object3D){for(const child of [...group.children])if(!child.userData.label)child.removeFromParent();group.add(model);}
function instanced(node:THREE.Object3D,matrices:THREE.Matrix4[]){const out:THREE.InstancedMesh[]=[];node.updateMatrixWorld(true);
 node.traverse(obj=>{if(!(obj instanceof THREE.Mesh))return;const mesh=new THREE.InstancedMesh(obj.geometry,obj.material,matrices.length);const local=obj.matrixWorld.clone();
  matrices.forEach((m,i)=>mesh.setMatrixAt(i,m.clone().multiply(local)));mesh.receiveShadow=true;mesh.castShadow=obj.castShadow;out.push(mesh);});return out;}
function label(parent:THREE.Group,text:string,x:number,y:number,z:number,w:number,h:number){
 const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#082f50';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 44px sans-serif';ctx.fillText(text,384,64,740);
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.userData.label=true;parent.add(mesh);return mesh;
}
export function createLrt(scene:THREE.Scene,solids:Solid[]){
 const infrastructure=new THREE.Group();infrastructure.name='Lepak LRT elevated line';scene.add(infrastructure);
 const beamMatrices:THREE.Matrix4[]=[],railMatrices:THREE.Matrix4[]=[],pillarMatrices:THREE.Matrix4[]=[],girderMatrices:THREE.Matrix4[]=[],pierMatrices:THREE.Matrix4[]=[];
 const dummy=new THREE.Object3D();
 for(let d=0;d<trackLength;d+=3){const a=trackPoint(d),b=trackPoint(Math.min(d+3,trackLength));const length=Math.hypot(b.x-a.x,b.z-a.z),yaw=Math.atan2(b.x-a.x,b.z-a.z);
  dummy.position.set((a.x+b.x)/2,0,(a.z+b.z)/2);dummy.rotation.set(0,yaw,0);dummy.scale.set(1,1,(length+.08)/3);dummy.updateMatrix();girderMatrices.push(dummy.matrix.clone());
  dummy.position.set((a.x+b.x)/2,railHeight-.5,(a.z+b.z)/2);dummy.rotation.set(0,yaw,0);dummy.scale.set(4.6,.8,length+.08);dummy.updateMatrix();beamMatrices.push(dummy.matrix.clone());
  for(const side of [-1,1]){dummy.position.set((a.x+b.x)/2+Math.cos(yaw)*side*.95,railHeight,(a.z+b.z)/2-Math.sin(yaw)*side*.95);dummy.scale.set(.13,.18,length+.1);dummy.updateMatrix();railMatrices.push(dummy.matrix.clone());}
 }
 for(let d=0;d<trackLength;d+=24){const p=trackPoint(d);dummy.position.set(p.x,5,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(1.1,10,1.1);dummy.updateMatrix();pillarMatrices.push(dummy.matrix.clone());
  dummy.position.y=0;dummy.scale.set(1,1,1);dummy.updateMatrix();pierMatrices.push(dummy.matrix.clone());solids.push({x:p.x,z:p.z,hx:.8,hz:.8});}
 for(const [matrices,color] of [[beamMatrices,'#9caaa9'],[railMatrices,'#414b52'],[pillarMatrices,'#a8b0a9']] as const){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),material(color),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;infrastructure.add(mesh);}
 void lrtAsset('LM_LRT_Viaduct').then(model=>{if(!model)return;const girder=model.getObjectByName('girder'),pier=model.getObjectByName('pier');if(!girder||!pier)return;
  infrastructure.clear();for(const mesh of [...instanced(girder,girderMatrices),...instanced(pier,pierMatrices)])infrastructure.add(mesh);lrtStatus.viaduct='ready';}).finally(()=>{if(lrtStatus.viaduct==='loading')lrtStatus.viaduct='fallback';});
 const stationGroups=stations.map((station,index)=>{
  const p=trackPoint(station.distance),g=new THREE.Group();g.name=station.name+' LRT';g.position.set(p.x,0,p.z);g.rotation.y=p.yaw;scene.add(g);
  box(g,4.9,railHeight+.05,0,5.5,.8,59,'#b6c1bc');box(g,2.35,railHeight+.5,0,.25,.04,58,'#ffcf4e');
  box(g,5,railHeight+4.2,0,6,.25,60,'#143e5c');box(g,5,railHeight+4.45,0,6.2,.18,60,'#a8ced2');
  for(const z of [-27,-15,0,15,27]){box(g,6.9,railHeight+2.2,z,.2,4.1,.2,'#5c727c');box(g,6.7,railHeight+1,z,1,.3,3.5,'#236c9c');}
  for(const z of [-29,29])box(g,5,railHeight+1.2,z,5,.15,.1,'#516979');
  box(g,7.5,railHeight+1.1,0,.1,.1,58,'#526975');
  box(g,11.8,railHeight/2,0,2.3,railHeight+1,3.5,'#59717d');box(g,10.62,1.2,0,.05,2.4,1.8,'#c7d1d0');
  solids.push({x:p.x+Math.cos(p.yaw)*11.8,z:p.z-Math.sin(p.yaw)*11.8,hx:Math.abs(Math.cos(p.yaw))*1.15+Math.abs(Math.sin(p.yaw))*1.75,hz:Math.abs(Math.sin(p.yaw))*1.15+Math.abs(Math.cos(p.yaw))*1.75});
  // Back to back so the totem reads from the street and from under the line, neither side mirrored.
  for(const side of [1,-1])label(g,`LRT ${String(index+1).padStart(2,'0')} · ${station.name}`,9+side*.03,3.8,0,7,1.1).rotation.y=side*Math.PI/2;
  label(g,`Rapid KL  ·  ${station.name}`,4.9,railHeight+3.1,0,5.3,.8).rotation.y=Math.PI/2;
  for(const along of [-18,18])solids.push({x:p.x+Math.cos(p.yaw)*4.9+Math.sin(p.yaw)*along,z:p.z-Math.sin(p.yaw)*4.9+Math.cos(p.yaw)*along,hx:.7*(Math.abs(Math.cos(p.yaw))+Math.abs(Math.sin(p.yaw))),hz:.7*(Math.abs(Math.cos(p.yaw))+Math.abs(Math.sin(p.yaw)))});
  batchStatic(g);return g;
 });
 void lrtAsset('LM_LRT_Station').then(model=>{const station=model?.getObjectByName('station');if(station){for(const g of stationGroups)swapIn(g,station.clone());lrtStatus.station='ready';}else lrtStatus.station='fallback';});
 const trains=[0,1].map(id=>Array.from({length:4},(_,i)=>{
  const g=new THREE.Group();g.name=`LRT ${id+1} coach ${i+1}`;scene.add(g);
  box(g,0,.55,0,3.8,.65,11.5,'#dae1e1');box(g,0,.02,0,2.5,.35,10,'#38424a');
  const roof=box(g,0,3.8,0,3.9,.32,11.5,'#c6d0d2');
  const doors:THREE.Mesh[]=[];
  for(const side of [-1,1]){
   box(g,side*1.82,1,0,.16,.55,11.4,'#d2233c');
   for(const z of [-4.6,-1.5,1.5,4.6]){box(g,side*1.82,2.6,z,.1,1.55,1.95,'#274653');box(g,side*1.8,3.5,z,.18,.2,2.1,'#e9eded');}
   for(const z of [-3,3])for(const part of [-1,1]){const door=box(g,side*1.88,2.25,z+part*.42,.12,2.55,.8,'#b6c5c9');door.userData.z=door.position.z;door.userData.part=part;door.userData.side=side;doors.push(door);box(door,0,.35,0,1.1,.38,.72,'#233f4d');}
   for(const z of [-4,0,4]){box(g,side*1.25,1.12,z,.7,.25,1.65,'#2587ae');box(g,side*1.58,1.52,z,.15,.65,1.65,'#2587ae');}
  }
  for(const z of [-4.1,4.1]){box(g,0,2.1,z,.07,2.8,.07,'#f4d052');for(const side of [-1,1])box(g,side*1.3,.1,z,.55,.65,1.3,'#20282e');}
  for(const z of [-5.75,5.75])box(g,0,2.1,z,3.75,2.75,.15,'#e0e5e4');
  if(i===0||i===3){const front=i===0?1:-1;const glass=box(g,0,2.6,front*5.88,3.15,1.65,.12,'#183c4c');glass.rotation.x=front*.12;
   label(g,'Rapid KL',0,2.28,front*6.72,1.5,.3);label(g,'LRT · LEPAK LOOP',0,3.45,front*6.36,1.5,.26);
   for(const side of [-1,1])box(g,side*1.25,1,front*5.99,.4,.17,.1,i===0?'#fff3bc':'#eb4c4c');
  }else box(g,0,1.6,6,1.8,2.1,.7,'#414b50');
  batchStatic(g,[roof,...doors]);return{g,roof:roof as THREE.Object3D,doors:doors as THREE.Object3D[]};
 }));
 void lrtAsset('LM_LRT_Train').then(model=>{if(!model){lrtStatus.train='fallback';return;}
  trains.forEach(coaches=>coaches.forEach((coach,i)=>{const node=model.getObjectByName(i===0||i===3?'cab':'mid');if(!node)return;
   const flipped=i===3,body=node.clone();if(flipped)body.rotation.y=Math.PI;swapIn(coach.g,body);
   // Blender suffixes the second coach's names (roof.001, door_P_1_a.001) and the loader drops the dot.
   let roof:THREE.Object3D|undefined;body.traverse(obj=>{if(!roof&&/^roof(\d{3})?$/.test(obj.name))roof=obj;});if(roof)coach.roof=roof;coach.doors=[];
   body.traverse(obj=>{const m=/^door_([PN])_\d_([ab])(\d{3})?$/.exec(obj.name);if(!m)return;obj.userData.z=obj.position.z;obj.userData.side=(m[1]==='P'?1:-1)*(flipped?-1:1);obj.userData.part=m[2]==='a'?-1:1;coach.doors.push(obj);});
  }));lrtStatus.train='ready';});
 return {update(now:number,viewer:{x:number;z:number},aboard:number|null){
  stationGroups.forEach(g=>g.visible=Math.hypot(g.position.x-viewer.x,g.position.z-viewer.z)<145);
  trains.forEach((coaches,id)=>{const state=trainState(id,now);coaches.forEach((coach,i)=>{const p=trackPoint(state.distance+18-i*12);coach.g.position.set(p.x,railHeight,p.z);coach.g.rotation.y=p.yaw;coach.g.visible=aboard===id||Math.hypot(p.x-viewer.x,p.z-viewer.z)<160;coach.roof.visible=aboard!==id;for(const door of coach.doors)door.position.z=THREE.MathUtils.lerp(door.position.z,door.userData.z+(state.doors&&door.userData.side===1?door.userData.part*.65:0),.2);});});
 },drawMap(ctx:CanvasRenderingContext2D){ctx.save();ctx.strokeStyle='#f3667d';ctx.lineWidth=1.8;ctx.beginPath();for(let d=0;d<=trackLength;d+=3){const p=trackPoint(d);if(d===0)ctx.moveTo(p.x,p.z);else ctx.lineTo(p.x,p.z);}ctx.closePath();ctx.stroke();for(const s of stations){const p=trackPoint(s.distance);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.z,2.4,0,Math.PI*2);ctx.fill();}ctx.restore();}};
}
