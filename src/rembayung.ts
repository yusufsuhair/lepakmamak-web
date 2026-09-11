import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Solid} from './physics';
import {REMBAYUNG, rembayungSolids} from './rembayung-layout';

export interface RembayungSite {
  group:THREE.Group;
  fallback:THREE.Group;
  ready:Promise<void>;
  status:{state:'loading'|'ready'|'fallback';batches:number;triangles:number};
}

function proceduralFallback():THREE.Group {
  const group=new THREE.Group();group.name='Rembayung load fallback';
  const mats={steel:new THREE.MeshStandardMaterial({color:'#283432'}),wood:new THREE.MeshStandardMaterial({color:'#b47a3c'}),
    wall:new THREE.MeshStandardMaterial({color:'#d6cdb8'}),floor:new THREE.MeshStandardMaterial({color:'#b66d48'}),
    leaf:new THREE.MeshStandardMaterial({color:'#507139'}),glass:new THREE.MeshStandardMaterial({color:'#baccc1',transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide})};
  const box=(x:number,y:number,d:number,w:number,h:number,l:number,material:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),material);mesh.position.set(x,y,-d);group.add(mesh);return mesh;
  };
  box(0,-.07,17,18,.14,34,mats.floor);
  for(const side of [-1,1]){
    box(side*9,3.75,17,.15,7.5,34,mats.wall);
    const roof=box(side*4.5,10.8,17,11.18,.14,35,mats.wood);roof.rotation.z=-side*Math.atan2(6.6,9);
    box(side*5.25,1.4,0,7.5,2.8,.04,mats.glass);
  }
  box(0,4.02,31.65,17.6,.14,4.7,mats.wood);
  box(0,3.75,34,18,7.5,.15,mats.wall);
  for(let i=0;i<24;i++)box(6.9-i*.39,(i+1)*4.02/24-.045,28.35,.40,.09,1.35,mats.steel);
  box(-2.6,4,28.7,1.1,.14,2,mats.wood);
  for(const s of rembayungSolids()){
    const x=s.x-REMBAYUNG.origin.x,d=REMBAYUNG.origin.z-s.z;
    if(s.id?.includes('planter'))box(x,.45,d,s.hx*2,.9,s.hz*2,mats.wood);
    if(s.id?.includes('slats')||s.id?.endsWith('central-screen')||s.id?.endsWith('rear-pavilion'))box(x,1.5,d,s.hx*2,3,s.hz*2,mats.wood);
    if(s.id?.includes('gallery-front')||s.id?.includes('landing-'))box(x,4.60,d,s.hx*2,1.04,s.hz*2,mats.steel);
  }
  for(const d of [27.67,29.03]){
    const a=new THREE.Vector3(7.12,1.1,-d),b=new THREE.Vector3(-2.25,5.12,-d),delta=b.clone().sub(a);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.06,.07,delta.length()),mats.steel);rail.position.copy(a).add(b).multiplyScalar(.5);
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize());group.add(rail);
    for(let i=0;i<24;i++)box(6.9-i*.39,(i+1)*4.02/24+.5,d,.035,1,.035,mats.steel);
  }
  for(const f of REMBAYUNG.furniture)box(f.x,f.floor+(f.id.startsWith('Dining table')?.76:.46),f.d,f.hx*2,.09,f.hd*2,mats.wood);
  box(-2.75,.7,2.1,3.73,1.4,.86,mats.wood);
  box(0,2.3,15.9,.20,4.6,.20,mats.wood);
  for(const [x,y,d,sx,sy,sz] of [[0,5.1,15.9,2.1,1.15,1.8],[-1.45,4.7,15.55,1.4,.85,1.25],[1.35,4.9,16.2,1.5,.9,1.25],[-.4,5.45,14.8,1.35,.75,1.15],[.55,5.5,17,1.35,.75,1.15]] as const){
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),mats.leaf);crown.position.set(x,y,-d);crown.scale.set(sx,sy,sz);group.add(crown);
  }
  for(const x of [-9,-6,-3,0,3,6,9]){
    const height=14.1-Math.abs(x)/9*6.6;
    box(x,(height+2.8)/2,0,.065,height-2.8,.09,mats.steel);
  }
  box(0,3.18,0,18,.65,.15,mats.steel);
  for(const y of [5.4,7.4,9.4,11.4])box(0,y,0,Math.min(18,(14.1-y)/6.6*18),.065,.1,mats.steel);
  // Batch even the offline fallback, which must remain cheap and navigable.
  group.updateMatrixWorld(true);
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  for(const child of [...group.children]){
    if(!(child instanceof THREE.Mesh))continue;
    const transformed=child.geometry.clone().applyMatrix4(child.matrixWorld);
    const geo=transformed.index?transformed.toNonIndexed():transformed;
    if(geo!==transformed)transformed.dispose();
    const list=batches.get(child.material)||[];list.push(geo);batches.set(child.material,list);
    child.geometry.dispose();group.remove(child);
  }
  for(const [mat,geos] of batches){const merged=mergeGeometries(geos);if(merged)group.add(new THREE.Mesh(merged,mat));geos.forEach(g=>g.dispose());}
  const wordmark=new THREE.TextureLoader().load('/rembayung-wordmark.png');wordmark.colorSpace=THREE.SRGBColorSpace;
  const logo=new THREE.Mesh(new THREE.PlaneGeometry(11,11/3),new THREE.MeshBasicMaterial({map:wordmark,transparent:true,alphaTest:.05,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  logo.position.set(0,8.733,.25);group.add(logo);
  return group;
}

function dispose(group:THREE.Group){
  const materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const mat of Array.isArray(o.material)?o.material:[o.material])materials.add(mat);}});
  for(const mat of materials){if('map' in mat && mat.map instanceof THREE.Texture)textures.add(mat.map);mat.dispose();}
  textures.forEach(t=>t.dispose());
}

export function createRembayung(scene:THREE.Scene,solids:Solid[]):RembayungSite {
  const group=new THREE.Group();group.name='Rembayung Restaurant';
  group.position.set(REMBAYUNG.origin.x,REMBAYUNG.origin.y,REMBAYUNG.origin.z);
  scene.add(group);
  const fallback=proceduralFallback();group.add(fallback);
  solids.push(...rembayungSolids());
  const status:RembayungSite['status']={state:'loading',batches:0,triangles:0};
  const ready=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(REMBAYUNG.asset).then(gltf=>{
    const asset=gltf.scene;asset.name='LM_ENV_Rembayung';
    asset.updateMatrixWorld(true);
    const instances=new Map<string,THREE.Mesh[]>();
    asset.traverse(o=>{if(o instanceof THREE.Mesh && !Array.isArray(o.material)){
      const key=o.geometry.uuid+':'+o.material.uuid;const list=instances.get(key)||[];list.push(o);instances.set(key,list);
    }});
    const inverse=asset.matrixWorld.clone().invert();
    for(const list of instances.values()){
      if(list.length<2)continue;
      const mesh=new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length);mesh.name='Rembayung instanced chairs';
      list.forEach((source,i)=>{mesh.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(inverse,source.matrixWorld));source.removeFromParent();});
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();asset.add(mesh);
    }
    asset.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      o.castShadow=true;o.receiveShadow=true;o.frustumCulled=true;
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(m.name.includes('architectural glass')){
          m.transparent=true;m.depthWrite=false;m.side=THREE.DoubleSide;o.castShadow=false;
        }
        if(m.name.includes('wordmark')){m.depthWrite=false;o.castShadow=false;}
      }
      status.batches++;status.triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o instanceof THREE.InstancedMesh?o.count:1);
    });
    if(!status.batches)throw new Error('Empty Rembayung GLB');
    asset.userData.source='blender-glb';group.add(asset);fallback.visible=false;fallback.removeFromParent();dispose(fallback);status.state='ready';
  }).catch(error=>{status.state='fallback';console.warn('[Rembayung] Keeping playable fallback; asset unavailable',error);});
  return {group,fallback,ready,status};
}
