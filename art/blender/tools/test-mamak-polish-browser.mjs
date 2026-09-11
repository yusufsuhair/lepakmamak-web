import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const base=process.env.LM_BASE_URL ?? 'http://127.0.0.1:5192';
const output=path.resolve(process.argv[2] ?? 'art/blender/generated/mamak-maju-v3');
await fs.mkdir(path.join(output,'previews'),{recursive:true});
await fs.mkdir(path.join(output,'reports'),{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const results=[];
try {
  for(const [device,viewport] of [['desktop',{width:1280,height:800}],['mobile',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport,isMobile:device==='mobile',hasTouch:device==='mobile'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/mamak-v3-review',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style>'}));
    await page.goto(`${base}/mamak-v3-review`);
    const textures=await page.evaluate(async()=>{
      const THREE=await import('/node_modules/three/build/three.module.js');
      const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const {NIGHT_AMBIENT,NIGHT_SUN}=await import('/src/weather.ts');
      const gltf=await new GLTFLoader().loadAsync('/assets/models/environment/LM_ENV_MamakMaju.glb?v=mamak-v3');
      const scene=new THREE.Scene();scene.add(gltf.scene);
      const ambient=new THREE.HemisphereLight('#f6edcf','#758b75',1.8);
      const sun=new THREE.DirectionalLight('#ffdfa3',2.7);sun.position.set(-70,110,60);
      scene.add(ambient,sun);
      const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
      renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
      document.body.append(renderer.domElement);
      const camera=new THREE.PerspectiveCamera(innerWidth<500?78:58,innerWidth/innerHeight,.05,200);
      camera.position.set(-5.5,3.6,10.8);camera.lookAt(-10,2.15,7);
      let steel,geometry;
      gltf.scene.traverse(o=>{if(o.isMesh && o.material.name==='LM_Counter_Steel'){steel=o.material;geometry=o.geometry;}});
      const ao=steel.aoMap,normal=steel.normalMap;
      window.renderCounter=(night,baked)=>{
        scene.background=new THREE.Color(night?'#172535':'#b9dcec');
        ambient.intensity=night?NIGHT_AMBIENT:1.8;sun.intensity=night?NIGHT_SUN:2.7;
        sun.color.set(night?'#9cb8ed':'#ffdfa3');
        steel.aoMap=baked?ao:null;steel.normalMap=baked?normal:null;steel.needsUpdate=true;
        renderer.render(scene,camera);
        const gl=renderer.getContext(),pixels=new Uint8Array(innerWidth*innerHeight*4);
        gl.readPixels(0,0,innerWidth,innerHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let total=0;for(let i=0;i<pixels.length;i+=4)total+=pixels[i]+pixels[i+1]+pixels[i+2];
        return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,
          meanBrightness:total/(pixels.length/4*3),webglError:gl.getError()};
      };
      return {ao:{width:ao.image.width,height:ao.image.height,colorSpace:ao.colorSpace},
        normal:{width:normal.image.width,height:normal.image.height,colorSpace:normal.colorSpace},
        tangent:!!geometry.attributes.tangent,uv:!!geometry.attributes.uv,
        emissive:steel.emissive.getHex(),baseColorTexture:!!steel.map,
        roughness:steel.roughness,metalness:steel.metalness};
    });
    assert.equal(textures.ao.width,512);assert.equal(textures.normal.height,512);
    assert.equal(textures.ao.colorSpace,'');assert.equal(textures.normal.colorSpace,'');
    assert.ok(textures.tangent && textures.uv);assert.equal(textures.emissive,0);
    assert.equal(textures.baseColorTexture,false);
    const views={};
    for(const night of [false,true]) for(const baked of [false,true]) {
      const key=`${night?'night':'day'}-${baked?'baked':'plain'}`;
      views[key]=await page.evaluate(([night,baked])=>window.renderCounter(night,baked),[night,baked]);
      assert.equal(views[key].webglError,0);assert.equal(views[key].draws,7);
      await page.screenshot({path:path.join(output,'previews',`counter-${device}-${key}.png`)});
    }
    assert.ok(views['night-baked'].meanBrightness<views['day-baked'].meanBrightness);
    for(const time of ['day','night']) {
      const plain=await fs.readFile(path.join(output,'previews',`counter-${device}-${time}-plain.png`));
      const baked=await fs.readFile(path.join(output,'previews',`counter-${device}-${time}-baked.png`));
      assert.notDeepEqual(plain,baked,'baked material must affect real rendered output');
    }
    assert.deepEqual(errors,[]);
    results.push({device,textures,views,pageErrors:errors});
    await context.close();
  }
} finally {await browser.close();}
await fs.writeFile(path.join(output,'reports/texture-browser-tests.json'),JSON.stringify({passed:true,base,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
