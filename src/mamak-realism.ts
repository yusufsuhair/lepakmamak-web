import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {disposeWebAsset,loadWebAsset} from './web-assets';

export const MAMAK_REALISM_URL='/assets/models/environment/LM_ENV_MamakMaju_Realism.glb?v=dining-v7-4-seat-metadata';
export const mamakRealismStatus={state:'loading' as 'loading'|'ready'|'baseline'|'fallback',triangles:0,draws:0,textures:0};

/** Validate all decoded images before the existing Mamak fallback can be hidden. */
export async function loadMamakRealism(scene:THREE.Scene,renderer:THREE.WebGLRenderer){
  let asset:THREE.Group|undefined;
  try{
    const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MAMAK_REALISM_URL);asset=gltf.scene;
    let triangles=0,draws=0;const textures=new Set<THREE.Texture>();
    const required=new Set(['MR | ivory speckled laminate','MR | roti toasted layers','MR | brushed stainless','MR | deep red moulded polypropylene']);
    asset.traverse(o=>{if(o instanceof THREE.Mesh){
      triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;draws+=Array.isArray(o.material)?o.material.length:1;
      o.castShadow=o.receiveShadow=true;
      for(const source of Array.isArray(o.material)?o.material:[o.material]){
        const m=source as THREE.MeshStandardMaterial;
        for(const t of [m.map,m.normalMap,m.aoMap])if(t){if(!t.image)throw new Error(`Missing decoded image: ${m.name}`);textures.add(t);}
        if(required.has(m.name)){
          if(!(m.name.includes('laminate')||m.name.includes('roti')?m.map?.image:m.normalMap?.image))throw new Error(`Missing PBR map: ${m.name}`);
          required.delete(m.name);
        }
        if(m.name==='MR | mug glass'){m.depthWrite=false;o.castShadow=false;}
      }
    }});
    if(required.size||triangles>250000||draws>24)throw new Error('Incomplete or over-budget Mamak realism model');
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),probe=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
    asset.userData.reflectionTarget=probe;
    asset.traverse(o=>{if(o instanceof THREE.Mesh)for(const source of Array.isArray(o.material)?o.material:[o.material]){
      const m=source as THREE.MeshStandardMaterial;if(m.name.startsWith('MR |')){m.envMap=probe.texture;m.envMapIntensity=.65;}
    }});
    asset.name='LM_ENV_MamakMaju';asset.position.set(-29,0,30);scene.add(asset);
    Object.assign(mamakRealismStatus,{state:'ready',triangles,draws,textures:textures.size});return asset;
  }catch(error){
    if(asset)disposeWebAsset(asset);
    console.warn('[mamak-realism] Keeping original Mamak appearance',error);
    try{const baseline=await loadWebAsset('/assets/models/environment/LM_ENV_MamakMaju.glb?v=mamak-v7',scene,new THREE.Vector3(-29,0,30),'LM_ENV_MamakMaju');mamakRealismStatus.state='baseline';return baseline;}
    catch(error){mamakRealismStatus.state='fallback';throw error;}
  }
}
