import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

export const PETRONAS={x:-31,z:112,url:'/assets/models/environment/LM_ENV_Petronas.glb?v=petronas-v2'};
export interface PetronasSite {
  group:THREE.Group; fallback:THREE.Group; ready:Promise<void>;
  status:{state:'loading'|'ready'|'fallback';batches:number;triangles:number;textures:number;logoLoaded:boolean};
}

/** The existing geometry/collisions stay usable until the complete replacement is ready. */
export function loadPetronas(scene:THREE.Scene,fallback:THREE.Group):PetronasSite {
  fallback.name='PETRONAS procedural fallback';fallback.updateMatrixWorld(true);
  const inverse=fallback.matrixWorld.clone().invert(),batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  fallback.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;
    const copy=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    const geometry=copy.index?copy.toNonIndexed():copy;if(copy!==geometry)copy.dispose();
    const list=batches.get(o.material)||[];list.push(geometry);batches.set(o.material,list);
  });
  fallback.clear();
  for(const [material,geometries] of batches){const geometry=mergeGeometries(geometries);if(geometry){const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;fallback.add(mesh);}geometries.forEach(g=>g.dispose());}
  const group=new THREE.Group();group.name='PETRONAS detailed Blender station';group.position.set(PETRONAS.x,0,PETRONAS.z);scene.add(group);
  const status:PetronasSite['status']={state:'loading',batches:0,triangles:0,textures:0,logoLoaded:false};
  const ready=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(PETRONAS.url).then(gltf=>{
    const textures=new Set<string>();let logo=false,concrete=false,batches=0,triangles=0;
    gltf.scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      o.castShadow=o.receiveShadow=true;
      for(const material of Array.isArray(o.material)?o.material:[o.material]){
        const m=material as THREE.MeshStandardMaterial;
        if(m.map?.image)textures.add(m.map.uuid);
        if(m.roughnessMap?.image)textures.add(m.roughnessMap.uuid);
        if(m.normalMap?.image)textures.add(m.normalMap.uuid);
        if(m.name.includes('Official PETRONAS')){logo=!!m.map?.image;m.depthWrite=false;m.side=THREE.DoubleSide;o.castShadow=false;}
        if(m.name.includes('forecourt concrete'))concrete=!!m.map?.image&&!!m.roughnessMap?.image&&!!m.normalMap?.image;
        if(m.name.includes('storefront glass')){m.depthWrite=false;m.side=THREE.DoubleSide;o.castShadow=false;}
      }
      batches+=Array.isArray(o.material)?o.material.length:1;
      triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    });
    // GLTFLoader can resolve successfully after silently dropping a blocked image.
    if(!logo||!concrete||!batches)throw new Error('PETRONAS embedded logo or PBR textures incomplete');
    gltf.scene.userData.source='Blender PETRONAS';group.add(gltf.scene);fallback.visible=false;
    Object.assign(status,{state:'ready',batches,triangles,textures:textures.size,logoLoaded:logo});
  }).catch(error=>{status.state='fallback';console.warn('[PETRONAS] Keeping complete station fallback',error);});
  return {group,fallback,ready,status};
}

/** Local material reflection probe; it does not alter the other city assets. */
export async function preparePetronasEnvironment(renderer:THREE.WebGLRenderer,site:PetronasSite){
  await site.ready;if(site.status.state!=='ready')return;
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
  const target=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
  site.group.userData.environmentTarget=target;
  site.group.traverse(o=>{if(o instanceof THREE.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
    const m=material as THREE.MeshStandardMaterial;m.envMap=target.texture;m.envMapIntensity=.55;m.needsUpdate=true;
  }});
}
