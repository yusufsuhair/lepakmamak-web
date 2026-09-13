import {test,expect} from '@playwright/test';

test('Blender tree families replace fallbacks in instanced batches',async({page})=>{
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakFoliage?.state),{timeout:45000}).toBe('ready');
  const status=await page.evaluate(()=>(window as any).__lepakFoliage);
  expect(status.failed).toBe(0);
  expect(status.instances).toBeGreaterThanOrEqual(40);
  expect(status.draws).toBeLessThanOrEqual(20);
});

test('tree stand-ins leave the scene once the Blender trees arrive',async({page})=>{
  await page.route('**/foliage-harness',route=>route.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
  await page.goto('/foliage-harness');
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/.vite/deps/three.js');
    const {createWorld}=await import('/src/world.ts');
    const scene=new THREE.Scene(),world=createWorld(scene);
    await Promise.resolve();   // batches flush in the microtask after the city is built
    // Canopy and frond colours only the procedural tree() and palm() stand-ins use. The Mamak
    // street's own palms wait for that street's separate swap, which this harness never starts.
    const standInColours=new Set(['658853','53764d','577a3c','6f9046']);
    const mamak=(o:any)=>{while(o&&o!==world.mamakStreetFallback)o=o.parent;return !!o;};
    const standIns=()=>{let count=0;scene.traverse((o:any)=>{if(o.isMesh&&standInColours.has(o.material.color?.getHexString())&&!mamak(o))count++;});return count;};
    const before=standIns();
    const start=performance.now();
    while(world.foliage.state==='loading'&&performance.now()-start<45000)await new Promise(r=>setTimeout(r,100));
    return {before,after:standIns(),state:world.foliage.state};
  });
  // Stand-ins used to be merged into the static city batch, where the swap could never remove them.
  expect(result.before).toBeGreaterThan(0);
  expect(result).toMatchObject({state:'ready',after:0});
});

test('tree GLBs preserve scale, family metadata and mobile budgets',async({page})=>{
  await page.goto('/');
  const stats=await page.evaluate(async()=>{
    const {gltfLoader}=await import('/src/web-assets.ts');
    const result:Record<string,unknown>={};
    for(const name of ['LM_TREE_RainTree','LM_TREE_CoconutPalm']){
      const gltf=await gltfLoader.loadAsync(`/assets/models/foliage/${name}.glb?v=trees-v2`);
      const variants:any[]=[];
      for(const root of gltf.scene.children){
        let triangles=0,draws=0,minY=Infinity,maxY=-Infinity;
        const materials=new Set<string>();
        root.traverse((node:any)=>{
          if(!node.isMesh)return;
          triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;
          draws++;materials.add(node.material.name);
          node.geometry.computeBoundingBox();
          minY=Math.min(minY,node.geometry.boundingBox.min.y);maxY=Math.max(maxY,node.geometry.boundingBox.max.y);
        });
        const leaves=[...root.children,root].map((n:any)=>n.material).find((m:any)=>m?.alphaTest>0);
        variants.push({variant:root.userData.lm_variant,version:root.userData.lm_foliage_version,family:root.userData.lm_family,
          triangles,draws,materials:materials.size,minY,height:maxY-minY,leafAlphaTest:leaves?.alphaTest,leafDoubleSided:leaves?.side===2});
      }
      result[name]=variants;
    }
    return result as any;
  });
  const budgets={LM_TREE_RainTree:{family:'urban-rain-tree',triangles:6000},LM_TREE_CoconutPalm:{family:'tropical-coconut-palm',triangles:3500}};
  for(const [name,budget] of Object.entries(budgets)){
    const variants=stats[name];
    expect(variants.map((v:any)=>v.variant)).toEqual(['A','B']);
    for(const tree of variants){
      expect(tree).toMatchObject({version:5,family:budget.family,draws:2,materials:2,leafAlphaTest:.5,leafDoubleSided:true});
      expect(tree.triangles).toBeLessThanOrEqual(budget.triangles);
      expect(tree.minY).toBeGreaterThanOrEqual(-1e-4);
      expect(tree.height).toBeGreaterThan(6);
    }
  }
});

test('tree loading failure keeps the playable procedural foliage',async({page})=>{
  await page.route('**/assets/models/foliage/*.glb*',route=>route.abort());
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepakFoliage?.state),{timeout:45000}).toBe('fallback');
  expect(await page.evaluate(()=>(window as any).__lepakFoliage)).toMatchObject({completed:0,instances:0,draws:0});
});
