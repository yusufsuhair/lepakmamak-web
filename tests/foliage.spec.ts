import {test,expect} from '@playwright/test';

test('Blender tree families replace fallbacks in instanced batches',async({page})=>{
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakFoliage?.state),{timeout:45000}).toBe('ready');
  const status=await page.evaluate(()=>(window as any).__lepakFoliage);
  expect(status.failed).toBe(0);
  expect(status.instances).toBeGreaterThanOrEqual(40);
  expect(status.draws).toBeLessThanOrEqual(20);
});

test('tree GLBs preserve scale, family metadata and mobile budgets',async({page})=>{
  await page.goto('/');
  const stats=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const result:Record<string,unknown>={};
    for(const name of ['LM_TREE_RainTree','LM_TREE_CoconutPalm']){
      const gltf=await new GLTFLoader().loadAsync(`/assets/models/foliage/${name}.glb?v=trees-v1`);
      let triangles=0,draws=0,version:number|undefined,family:string|undefined;
      gltf.scene.traverse((node:any)=>{
        if(node.userData?.lm_foliage_version!==undefined){version=node.userData.lm_foliage_version;family=node.userData.lm_family;}
        if(!node.isMesh)return;
        triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;
        draws+=Array.isArray(node.material)?node.material.length:1;
      });
      const bounds=new THREE.Box3().setFromObject(gltf.scene);
      result[name]={triangles,draws,version,family,minY:bounds.min.y,height:bounds.max.y-bounds.min.y};
    }
    return result as any;
  });
  expect(stats.LM_TREE_RainTree).toMatchObject({version:4,family:'urban-rain-tree',draws:2});
  expect(stats.LM_TREE_RainTree.triangles).toBeLessThan(500);
  expect(stats.LM_TREE_CoconutPalm).toMatchObject({version:4,family:'tropical-coconut-palm',draws:3});
  expect(stats.LM_TREE_CoconutPalm.triangles).toBeLessThan(1800);
  for(const tree of Object.values(stats) as any[]){
    expect(tree.minY).toBeGreaterThanOrEqual(-1e-4);
    expect(tree.height).toBeGreaterThan(6);
  }
});

test('tree loading failure keeps the playable procedural foliage',async({page})=>{
  await page.route('**/assets/models/foliage/*.glb*',route=>route.abort());
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakFoliage?.state),{timeout:45000}).toBe('fallback');
  expect(await page.evaluate(()=>(window as any).__lepakFoliage)).toMatchObject({completed:0,instances:0,draws:0});
});
