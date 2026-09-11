import * as THREE from 'three';
import {loadInstancedWebAsset, type WebAssetPlacement} from './web-assets';

export type FoliageFamily='rain-tree'|'coconut-palm';
export type FoliageState='loading'|'ready'|'partial'|'fallback';

interface PendingBatch {
  placements:WebAssetPlacement[];
  fallbacks:THREE.Group[];
}

const definitions:Record<FoliageFamily,{asset:string;url:string}>={
  'rain-tree':{asset:'LM_TREE_RainTree',url:'/assets/models/foliage/LM_TREE_RainTree.glb?v=trees-v1'},
  'coconut-palm':{asset:'LM_TREE_CoconutPalm',url:'/assets/models/foliage/LM_TREE_CoconutPalm.glb?v=trees-v1'},
};
const pendingByParent=new WeakMap<THREE.Object3D,Map<FoliageFamily,PendingBatch>>();
let pendingBatches=0,completedBatches=0,failedBatches=0,instances=0,draws=0;

export const foliageStatus={
  get state():FoliageState {
    if(pendingBatches)return 'loading';
    if(failedBatches&&completedBatches)return 'partial';
    if(failedBatches)return 'fallback';
    return completedBatches?'ready':'loading';
  },
  get pending(){return pendingBatches;},
  get completed(){return completedBatches;},
  get failed(){return failedBatches;},
  get instances(){return instances;},
  get draws(){return draws;},
};

function flush(parent:THREE.Object3D,family:FoliageFamily,batch:PendingBatch){
  const definition=definitions[family];
  pendingBatches++;
  void loadInstancedWebAsset(definition.url,batch.placements,definition.asset).then(asset=>{
    parent.add(asset);
    // Procedural fallbacks deliberately share the world's cached primitive geometry
    // and materials, so removing them is enough; disposing would invalidate shops,
    // avatars and other scenery that still uses those shared GPU resources.
    batch.fallbacks.forEach(fallback=>fallback.removeFromParent());
    completedBatches++;
    instances+=batch.placements.length;
    asset.traverse(object=>{if(object instanceof THREE.InstancedMesh)draws++;});
  }).catch(error=>{
    failedBatches++;
    console.warn(`[foliage] Keeping ${family} fallback; Blender asset unavailable`,error);
  }).finally(()=>{pendingBatches--;});
}

/**
 * Queue one local placement. Calls made in the same turn are collapsed into one
 * InstancedMesh batch per parent and material, while the playable fallback remains
 * visible until the complete GLB has loaded.
 */
export function queueFoliage(parent:THREE.Object3D,family:FoliageFamily,
  placement:WebAssetPlacement,fallback:THREE.Group){
  // Mamak streets have their own atomic four-asset swap and dedicated compact palm.
  if(parent.name==='mamak-street-fallback')return;
  let families=pendingByParent.get(parent);
  if(!families){families=new Map();pendingByParent.set(parent,families);}
  let batch=families.get(family);
  if(!batch){
    batch={placements:[],fallbacks:[]};families.set(family,batch);
    queueMicrotask(()=>{
      families!.delete(family);
      flush(parent,family,batch!);
    });
  }
  batch.placements.push(placement);
  batch.fallbacks.push(fallback);
}

/** Stable rotation breaks repetition without making screenshots or exports random. */
export function foliageYaw(x:number,z:number){
  const seed=Math.sin(x*12.9898+z*78.233)*43758.5453;
  return (seed-Math.floor(seed))*Math.PI*2;
}
