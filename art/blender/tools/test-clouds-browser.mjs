import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const output=path.resolve(process.argv[2]??'art/blender/generated/clouds-v1');
const base=process.env.LM_BASE_URL??'http://127.0.0.1:5192';
await fs.mkdir(path.join(output,'previews'),{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),results=[];
try {
 for(const [device,viewport] of [['desktop',{width:1280,height:800}],['mobile',{width:390,height:844}]]) {
  const page=await browser.newPage({viewport}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/cloud-review',r=>r.fulfill({contentType:'text/html',body:'<style>body{margin:0}</style>'}));
  await page.goto(base+'/cloud-review');
  const texture=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createClouds}=await import('/src/clouds.ts');
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,600);
    camera.lookAt(0,110,430);camera.updateMatrixWorld();
    const cloud=createClouds(scene);await cloud.ready;
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    let map;scene.traverse(o=>{if(o.isInstancedMesh)map=o.material.map;});
    const c=document.createElement('canvas');c.width=map.image.width;c.height=map.image.height;
    const ctx=c.getContext('2d');ctx.drawImage(map.image,0,0);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    let partial=0,opaque=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]>0&&pixels[i]<255)partial++;if(pixels[i]>200)opaque++;}
    const blocker=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshBasicMaterial({color:0xff0000,side:T.DoubleSide}));
    blocker.position.set(0,128,500);blocker.visible=false;scene.add(blocker);
    window.renderClouds=(night,occlusion=false,hidden=false)=>{
      scene.background=new T.Color(night?'#172535':'#b9dcec');
      cloud.setWeather({condition:'sunny',night});cloud.update(0,camera,true,innerWidth<500);
      scene.getObjectByName('LM_SKY_CloudLayer').visible=!hidden;
      blocker.visible=occlusion;renderer.render(scene,camera);
      const gl=renderer.getContext(),rgba=new Uint8Array(4);gl.readPixels(Math.floor(innerWidth/2),Math.floor(innerHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
      return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,error:gl.getError(),pixel:[...rgba],...cloud.status};
    };
    return {width:c.width,height:c.height,partialAlphaPixels:partial,opaquePixels:opaque,colorSpace:map.colorSpace};
  });
  assert.equal(texture.width,512);assert.equal(texture.height,256);assert.ok(texture.partialAlphaPixels>500);
  assert.equal(texture.colorSpace,'srgb');
  const views={};
  for(const night of [false,true]) {
    const key=night?'night':'day';views[key]=await page.evaluate(n=>window.renderClouds(n),night);
    assert.equal(views[key].error,0);assert.equal(views[key].draws,1);
    assert.equal(views[key].triangles,device==='mobile'?12:18);
    await page.screenshot({path:path.join(output,'previews',`sky-${device}-${key}.png`)});
  }
  const covered=await page.evaluate(()=>window.renderClouds(false,true));
  const baseline=await page.evaluate(()=>window.renderClouds(false,true,true));
  assert.deepEqual(covered.pixel,baseline.pixel,'a farther landmark must fully cover sky clouds');
  assert.deepEqual(errors,[]);results.push({device,texture,views,farLandmarkOcclusion:'passed',errors});
  await page.close();
 }
 for(const [device,viewport] of [['desktop',{width:1280,height:800}],['mobile',{width:390,height:844}]]) for(const night of [false,true]) {
  const page=await browser.newPage({viewport,isMobile:device==='mobile',hasTouch:device==='mobile'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const now=Date.parse(night?'2026-09-11T15:00:00Z':'2026-09-11T06:00:00Z');
  await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'sunny',observedAt:now,serverTime:now,source:'Cloud capture'}}));
  await page.goto(base);await page.waitForFunction(()=>window.__lepakClouds?.state==='ready');
  await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Cloud Guest');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await page.waitForFunction(()=>window.__lepak?.started);
  await page.mouse.move(viewport.width*.6,viewport.height*.5);await page.mouse.down();
  await page.mouse.move(viewport.width*.6+80,viewport.height*.5-110,{steps:12});await page.mouse.up();
  await page.waitForTimeout(600);
  await page.screenshot({path:path.join(output,'previews',`game-clouds-${device}-${night?'night':'day'}.png`)});
  assert.deepEqual(errors,[]);results.push({device,game:true,night,status:await page.evaluate(()=>window.__lepakClouds),errors});
  await page.close();
 }
} finally {await browser.close();}
await fs.writeFile(path.join(output,'reports/browser-render.json'),JSON.stringify({passed:true,base,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
