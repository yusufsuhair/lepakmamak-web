import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const output=path.resolve(process.argv[2]??'art/blender/generated/sky-v2');
const base=process.env.LM_BASE_URL??'http://127.0.0.1:5192';
await fs.mkdir(path.join(output,'previews'),{recursive:true});await fs.mkdir(path.join(output,'reports'),{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),results=[];
try {
 for(const [device,viewport] of [['desktop',{width:1280,height:800}],['mobile',{width:390,height:844}]]) {
  const page=await browser.newPage({viewport}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/sky-review',r=>r.fulfill({contentType:'text/html',body:'<style>body{margin:0}</style>'}));
  await page.goto(base+'/sky-review');
  await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createClouds}=await import('/src/clouds.ts');
    const scene=new T.Scene();scene.background=new T.Color();
    const camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.1,600);camera.lookAt(-.85,.3,.52);camera.updateMatrixWorld();
    const sky=createClouds(scene);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;document.body.append(renderer.domElement);
    const blocker=new T.Mesh(new T.SphereGeometry(550,12,8),new T.MeshBasicMaterial({color:'#ff0000',side:T.BackSide}));
    blocker.visible=false;scene.add(blocker);
    window.renderSky=(time,covered=false,hidden=false,seconds=0)=>{
      sky.setWeather({condition:'sunny',night:time==='night',twilight:time==='dusk'?1:0});
      sky.update(seconds,camera,false,innerWidth<500);blocker.visible=covered;scene.getObjectByName('LM_SKY_Atmosphere').visible=!hidden;
      renderer.render(scene,camera);
      const gl=renderer.getContext(),pixels=new Uint8Array(innerWidth*innerHeight*4);
      gl.readPixels(0,0,innerWidth,innerHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];
      const middle=4*(Math.floor(innerHeight/2)*innerWidth+Math.floor(innerWidth/2));
      return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,error:gl.getError(),
        mean:sum/(innerWidth*innerHeight*3),pixel:[...pixels.slice(middle,middle+4)],...sky.status};
    };
    window.benchmarkSky=()=>{
      blocker.visible=false;sky.setWeather({condition:'sunny',night:false});
      const samples=[];
      for(let i=0;i<20;i++) {
        sky.update(i,camera,false,innerWidth<500);
        const start=performance.now();renderer.render(scene,camera);renderer.getContext().finish();
        if(i>=5)samples.push(performance.now()-start);
      }
      samples.sort((a,b)=>a-b);
      const median=samples[Math.floor(samples.length/2)];
      return {medianSynchronizedRenderMs:median>0?median:null,samples:samples.length,
        note:median>0?'Isolated sky on this computer, not whole-game FPS or a physical phone':'Timer precision insufficient (zero median); no usable performance measurement'};
    };
  });
  const views={};
  for(const time of ['day','dusk','night']) {
    views[time]=await page.evaluate(t=>window.renderSky(t),time);
    assert.equal(views[time].error,0);assert.equal(views[time].draws,1);
    const first=await page.screenshot({path:path.join(output,'previews',`sky-${device}-${time}.png`)});
    await page.evaluate(t=>window.renderSky(t),time);assert.deepEqual(first,await page.screenshot(),'fixed-time rendering must be deterministic');
  }
  assert.ok(views.night.mean<views.day.mean);assert.notDeepEqual(views.dusk.pixel,views.day.pixel);
  const covered=await page.evaluate(()=>window.renderSky('day',true));
  const control=await page.evaluate(()=>window.renderSky('day',true,true));
  assert.deepEqual(covered.pixel,control.pixel,'sky must never cover foreground');
  await page.evaluate(()=>window.renderSky('day'));
  const timing=await page.evaluate(()=>window.benchmarkSky());
  assert.deepEqual(errors,[]);results.push({device,views,occlusion:'passed',timing,errors});await page.close();
 }
 for(const [device,viewport] of [['desktop',{width:1280,height:800}],['mobile',{width:390,height:844}]]) for(const time of ['day','dusk','night']) {
  const page=await browser.newPage({viewport,isMobile:device==='mobile',hasTouch:device==='mobile'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const now=Date.parse(`2026-09-11T${time==='day'?'06':time==='dusk'?'11':'15'}:00:00Z`);
  await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'sunny',observedAt:now,serverTime:now,source:'Sky capture'}}));
  await page.goto(base);await page.waitForFunction(()=>window.__lepakClouds?.state==='ready');
  await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Sky Guest');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await page.waitForFunction(()=>window.__lepak?.started);
  await page.mouse.move(viewport.width*.6,viewport.height*.5);await page.mouse.down();
  await page.mouse.move(viewport.width*.6+80,viewport.height*.5-110,{steps:12});await page.mouse.up();await page.waitForTimeout(600);
  await page.screenshot({path:path.join(output,'previews',`game-sky-${device}-${time}.png`)});
  assert.deepEqual(errors,[]);results.push({device,time,game:true,status:await page.evaluate(()=>window.__lepakClouds),errors});await page.close();
 }
} finally {await browser.close();}
await fs.writeFile(path.join(output,'reports/browser-render.json'),JSON.stringify({passed:true,base,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
