import * as THREE from 'three';
import {loadInstancedWebAsset, type WebAssetPlacement} from './web-assets';
import {batchShopFallback} from './world';

export type FoliageFamily='rain-tree'|'coconut-palm';
export type FoliageState='loading'|'ready'|'partial'|'fallback';

interface PendingBatch {
  placements:WebAssetPlacement[];
  fallbacks:THREE.Group[];
}

const definitions:Record<FoliageFamily,{asset:string;url:string}>={
  'rain-tree':{asset:'LM_TREE_RainTree',url:'/assets/models/foliage/LM_TREE_RainTree.glb?v=trees-v2'},
  'coconut-palm':{asset:'LM_TREE_CoconutPalm',url:'/assets/models/foliage/LM_TREE_CoconutPalm.glb?v=trees-v2'},
};

/** Leaf cards carry normals bent toward the outside of the crown (scripts/blender/build_trees.py).
 * three flips a double-sided face's normal whenever its back is in view, which would scatter dark
 * cards through a sunlit canopy, so alpha-tested foliage keeps the authored normal on both sides.
 * A card seen edge-on squeezes its leaves into streaks, so it thins out as it turns away. */
const leafNormals=THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;','');
const leafEdges=`float lmFacing=abs(dot(normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition))),normalize(vViewPosition)));
diffuseColor.a*=smoothstep(.06,.3,lmFacing);
#include <alphatest_fragment>`;
function prepareLeaves(asset:THREE.Object3D){
  asset.traverse(object=>{
    const material=(object as THREE.Mesh).material as THREE.MeshStandardMaterial;
    if(!(object as THREE.Mesh).isMesh||!material.alphaTest)return;
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader
      .replace('#include <normal_fragment_begin>',leafNormals).replace('#include <alphatest_fragment>',leafEdges);};
    material.customProgramCacheKey=()=>'lm-leaf-cards';
  });
}
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
  // The batch's stand-ins become a few merged meshes of their own: cheap to draw while the GLB
  // loads, and one group the swap can take away. (Left in place, the city batcher used to merge
  // them into the static city, where the swap could never reach and old blobs grew through the
  // Blender trees.) The merged geometry is this group's own; the materials stay shared.
  const standIn=new THREE.Group();standIn.name=`${family}-fallback`;parent.add(standIn);
  for(const fallback of batch.fallbacks)standIn.attach(fallback);
  batchShopFallback(standIn);
  pendingBatches++;
  void loadInstancedWebAsset(definition.url,batch.placements,definition.asset).then(asset=>{
    prepareLeaves(asset);
    parent.add(asset);
    standIn.removeFromParent();
    standIn.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});
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
  // Keep the stand-in out of the static city batch, which runs before this batch flushes.
  fallback.traverse(object=>{object.userData.keepUnbatched=true;});
  batch.placements.push(placement);
  batch.fallbacks.push(fallback);
}

/** Stable rotation breaks repetition without making screenshots or exports random. */
export function foliageYaw(x:number,z:number){
  const seed=Math.sin(x*12.9898+z*78.233)*43758.5453;
  return (seed-Math.floor(seed))*Math.PI*2;
}
