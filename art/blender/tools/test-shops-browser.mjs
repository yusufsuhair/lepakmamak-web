import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.LM_BASE_URL ?? 'http://127.0.0.1:5192/';
const output=path.resolve(process.argv[2] ?? 'art/blender/generated/mamak-shops');
await fs.mkdir(path.join(output,'previews'),{recursive:true});
await fs.mkdir(path.join(output,'reports'),{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),results=[];
try {
  for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport,isMobile:name==='mobile',hasTouch:name==='mobile'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(()=>Object.values(window.__lepakShops ?? {}).filter(s=>s.state==='ready').length===6);
    await page.getByRole('button',{name:"Jom, let's go"}).click();
    await page.locator('#auth-guest').click();
    await page.locator('#guest-name').fill('Shop Walk');
    await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
    await page.waitForFunction(()=>window.__lepak.started);
    // Reach ZUS using normal game movement, without requiring an online teleport service.
    for(const [key,axis,target] of [['s','z',68],['d','x',27]]) {
      await page.keyboard.down(key);
      try {await page.waitForFunction(([axis,target])=>window.__lepak.position[axis]>=target,[axis,target],{timeout:30000});}
      finally {await page.keyboard.up(key);}
    }
    await page.locator('#world').hover({position:{x:viewport.width/2,y:viewport.height/2}});
    await page.mouse.wheel(0,1000);
    await page.waitForFunction(()=>window.__lepak.cameraZoom>=16.9);
    await page.screenshot({path:path.join(output,'previews',`game-${name}-zus.png`)});
    const state=await page.evaluate(()=>({shops:window.__lepakShops,position:window.__lepak.position,drawCalls:window.__lepak.drawCalls}));
    await page.locator('#interaction').click();
    await page.waitForFunction(()=>window.__lepak.seated);
    await page.screenshot({path:path.join(output,'previews',`game-${name}-zus-seated.png`)});
    await page.locator('#interaction').click();
    await page.waitForFunction(()=>!window.__lepak.seated);
    assert.deepEqual(errors,[]);
    results.push({viewport:name,realGame:state,pageErrors:[...errors],sitStand:'passed'});
    // Supplement the playable-game view with controlled cameras over the real world geometry.
    await page.route('**/shop-review-harness',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="hud"></div>'}));
    await page.goto(new URL('/shop-review-harness',base).href);
    const shops=await page.evaluate(async()=>{
      const THREE=await import('/node_modules/three/build/three.module.js');
      const {createWorld}=await import('/src/world.ts');
      const {loadMamakShops}=await import('/src/mamak-shops.ts');
      const shops=(await import('/shared/mamak-shops.json')).default;
      const scene=new THREE.Scene();scene.background=new THREE.Color('#d6decd');
      const world=createWorld(scene);await loadMamakShops(scene,world.shopFallbacks).settled;
      scene.add(new THREE.HemisphereLight('#f6edcf','#758b75',1.8));
      const sun=new THREE.DirectionalLight('#ffdfa3',2.7);sun.position.set(-70,110,60);scene.add(sun);
      const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;document.body.append(renderer.domElement);
      window.reviewShop=(shop)=>{
        const aspect=innerWidth/innerHeight,halfHeight=Math.max(8.5,(shop.width+5)/aspect/2);
        const camera=new THREE.OrthographicCamera(-halfHeight*aspect,halfHeight*aspect,halfHeight,-halfHeight,.1,500);
        camera.position.set(shop.x,7.5,shop.z+22);camera.lookAt(shop.x,5.5,shop.z);
        renderer.render(scene,camera);
      };
      return shops;
    });
    for(const shop of shops) {
      await page.evaluate(shop=>window.reviewShop(shop),shop);
      await page.screenshot({path:path.join(output,'previews',`world-${name}-${shop.asset}.png`)});
    }
    assert.deepEqual(errors,[]);
    await context.close();
  }
} finally {await browser.close();}
await fs.writeFile(path.join(output,'reports/browser-tests.json'),JSON.stringify({passed:true,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
