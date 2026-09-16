// Real game geometry, deliberately framed for the Explore cards. Run against npm run dev.
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
await mkdir('public/explore',{recursive:true});
try {
 await page.route('**/explore-photo',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto(`${process.env.CAPTURE_URL||'http://127.0.0.1:5207'}/explore-photo`);
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const W=await import('/src/world.ts'),S=await import('/src/sky-dining.ts'),B=await import('/src/beach.ts'),P=await import('/src/pickleball.ts'),C=await import('/src/clouds.ts'),weather=await import('/src/weather.ts');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#a3bfd7');scene.fog=new THREE.Fog('#a3bfd7',150,560);
  const world=W.createWorld(scene),sky=S.createSkyDining(scene),beach=B.createBeach(scene,world);P.createPickleball(scene,world);W.streamAllNow();
  const clouds=C.createClouds(scene),ambient=new THREE.HemisphereLight('#f6edcf','#758b75',1.8),sun=new THREE.DirectionalLight('#ffdfa3',2.7);scene.add(ambient,sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-100,right:100,top:100,bottom:-100,near:1,far:320});sun.shadow.normalBias=.12;sun.shadow.bias=-.00015;
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,960);renderer.setPixelRatio(1.5);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  const camera=new THREE.PerspectiveCamera(48,1.5,.1,650);document.body.replaceChildren(renderer.domElement);renderer.domElement.style.width='1440px';renderer.domElement.style.height='960px';
  window.photo={scene,sky,beach,clouds,ambient,sun,renderer,camera,THREE,weather,S};
  await new Promise(resolve=>{let idle;const done=()=>{clearTimeout(idle);idle=setTimeout(resolve,2500);};THREE.DefaultLoadingManager.onLoad=done;done();});
 });
 const shots=[
  {id:'wet-deck',eye:[-122,49,40],at:[-97,46,16],fov:62,sun:[-.5,.3,-.7]},
  {id:'klcc',eye:[50,36,-6],at:[0,46,-122],fov:54,sun:[-.7,.65,.4]},
  {id:'beach',eye:[103,6,137],at:[129,2,158],fov:62,sun:[-.6,.22,.7]},
  {id:'pickleball',eye:[113,12,132],at:[96,0,115],fov:50,sun:[-.7,.6,.4]},
  {id:'mosque',eye:[81,11,99],at:[54,10,131],fov:60,sun:[-.6,.4,-.5]},
 ];
 for(const shot of shots){
  await page.evaluate(s=>{const p=window.photo,{THREE}=p;const palette=p.weather.skyPalette(new THREE.Vector3(...s.sun).normalize(),'sunny');p.scene.background.copy(palette.horizon);p.scene.fog.color.copy(palette.horizon);p.ambient.color.copy(palette.ambientSky);p.ambient.intensity=palette.ambientIntensity;p.sun.color.copy(palette.light);p.sun.intensity=palette.lightIntensity;p.sun.target.position.set(...s.at);p.sun.position.copy(p.sun.target.position).add(new THREE.Vector3(...s.sun).normalize().multiplyScalar(140));p.clouds.setWeather({condition:'sunny',night:false,sky:palette});p.camera.position.set(...s.eye);p.camera.lookAt(...s.at);p.camera.fov=s.fov;p.camera.updateProjectionMatrix();p.clouds.update(42,p.camera,true,false);p.sky.update(42,false,true);p.beach.update(42);p.scene.updateMatrixWorld(true);p.renderer.render(p.scene,p.camera);},shot);
  await page.locator('canvas').first().screenshot({path:`public/explore/${shot.id}.jpg`,type:'jpeg',quality:90});console.log(`Captured ${shot.id}`);
 }
}finally{await browser.close();}
