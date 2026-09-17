import {test,expect} from '@playwright/test';
import destinations from '../shared/teleports.json' with {type:'json'};
import {skyTravel} from '../shared/sky-dining.mjs';

async function enter(page:any){
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Explorer');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await expect(page.locator('#open-explore')).toBeVisible();await expect(page.locator('#loading')).toBeHidden();
}
function city(page:any,online=true){
 return page.routeWebSocket('**/ws',(ws:any)=>{
  const p:any={id:'explorer',name:'Explorer',color:'#72c8ba',x:-18,z:52,yaw:Math.PI,riding:false,speed:0,seated:false};
  ws.onMessage((raw:any)=>{const m=JSON.parse(String(raw));
   if(m.type==='join'&&online)ws.send(JSON.stringify({type:'welcome',id:p.id,players:[p]}));
   if(m.type==='teleport'){Object.assign(p,destinations.find(d=>d.id===m.id),{id:'explorer',skyDining:false,y:0});ws.send(JSON.stringify({type:'teleported',id:m.id}));}
   if(m.type==='sky-lift'&&skyTravel(p))ws.send(JSON.stringify({type:'sky-arrived',upstairs:p.skyDining}));
  });
 });
}

test('Explore takes players to Wet Deck, guides the lift, and remembers the experience',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await city(page);await enter(page);
 await expect(page.locator('#explore-teaser')).toBeVisible();await page.locator('#open-explore').click();
 await expect(page.locator('.explore-card')).toHaveCount(5);
 await expect.poll(()=>page.locator('.explore-photo img').evaluateAll(images=>images.every(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth>0))).toBe(true);
 const before=await page.evaluate(()=>(window as any).__lepak.position);await page.keyboard.press('KeyW');
 expect(await page.evaluate(()=>(window as any).__lepak.position)).toEqual(before);await expect(page.locator('#explore-city')).toBeVisible();
 await page.screenshot({path:info.outputPath('explore-desktop.png')});
 await page.getByRole('tab',{name:/Tutorial/}).click();await expect(page.locator('.tutorial-card')).toHaveCount(5);await expect(page.locator('#explore-title')).toHaveText('Learn the city.');
 await expect(page.locator('[data-tutorial="afk"]')).toContainText('Set note');await expect(page.locator('[data-tutorial="clothes"]')).toContainText('saves automatically');
 await expect(page.locator('[data-tutorial="games"]')).toContainText('Mamak Maju · game tables');await expect(page.locator('[data-tutorial="games"]')).toContainText('ZUS Coffee · social seating');await expect(page.locator('[data-tutorial="games"]')).toContainText('READY');
 await expect.poll(()=>page.locator('.tutorial-shot img').evaluateAll(images=>images.every(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth===1280))).toBe(true);
 await page.screenshot({path:info.outputPath('explore-tutorial-desktop.png')});await page.locator('[data-tutorial="games"]').scrollIntoViewIfNeeded();const chrome=page.locator('#explore-city>header,.explore-tabs');await chrome.evaluateAll(elements=>elements.forEach(element=>(element as HTMLElement).style.visibility='hidden'));await page.locator('[data-tutorial="games"]').screenshot({path:info.outputPath('explore-tutorial-games.png')});await chrome.evaluateAll(elements=>elements.forEach(element=>(element as HTMLElement).style.visibility=''));await page.getByRole('tab',{name:/Places/}).click();
 await page.locator('[data-visit="wet-deck"]').click();await expect(page.locator('#explore-guide')).toContainText('Naik Wet Deck');await expect(page.locator('#interaction')).toHaveClass(/explore-target/);
 await expect(page.locator('#interaction')).toHaveText('Naik Wet Deck');await page.locator('#interaction').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.skyDining)).toBe(true);await expect(page.locator('#explore-guide')).toBeHidden();
 await page.locator('#open-explore').click();await expect(page.locator('[data-place="wet-deck"] .explore-visited')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#explore-city')).toBeHidden();await expect(page.locator('#pause')).toBeHidden();await expect(page.locator('#open-explore')).toBeFocused();
 expect(await page.evaluate(()=>localStorage.getItem('lepak-explore-count:experience:wet-deck'))).toBe('1');expect(errors).toEqual([]);
});

test('all destination cards use existing travel, guides dismiss, and the full map stays available',async({page})=>{
 await city(page);await enter(page);
 for(const id of ['15','pantai-senja','21','17']){
  await page.locator('#open-explore').click();await page.locator(`[data-visit="${id}"]`).click();
  const d=destinations.find(p=>p.id===id)!;await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.position)).toEqual({x:d.x,z:d.z});
  if(id==='17'){await expect.poll(()=>page.evaluate(()=>localStorage.getItem('lepak-experienced-v1'))).toContain('17');}else{await expect(page.locator('#explore-guide')).toBeVisible();await page.locator('#explore-guide [data-dismiss]').click();}await expect(page.locator('#explore-marker')).toBeHidden();
 }
 await page.locator('#open-explore').click();await page.locator('#explore-map').click();await expect(page.locator('#city-map')).toBeVisible();await expect(page.locator('#explore-city')).toBeHidden();
 await page.getByRole('button',{name:'wet-deck Wet Deck · Sky Dining',exact:true}).click();await page.locator('#map-teleport').click();await expect(page.locator('#explore-guide')).toContainText('Naik Wet Deck');
});

test('mobile cards fit, keyboard focus stays in the dialog, and hint dismissal persists',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5}));await city(page);await enter(page);
 const hud=await page.evaluate(()=>{const explore=document.querySelector('#open-explore')!.getBoundingClientRect(),weather=document.querySelector('#weather-label')!.getBoundingClientRect();return{exploreBottom:explore.bottom,weatherTop:weather.top};});expect(hud.weatherTop-hud.exploreBottom).toBeGreaterThanOrEqual(8);
 await page.getByRole('button',{name:'Dismiss exploration hint'}).click();await page.locator('#open-explore').click();
 await expect(page.locator('#close-explore')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.locator('#explore-map')).toBeFocused();
 const bounds=await page.locator('#explore-city').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));expect(bounds.scroll).toBe(bounds.client);
 await page.locator('#close-explore').focus();await page.locator('#explore-city').evaluate(e=>e.scrollTop=0);await page.screenshot({path:info.outputPath('explore-mobile.png')});
 await page.getByRole('tab',{name:/Tutorial/}).click();await page.locator('#explore-city').evaluate(e=>e.scrollTop=0);await page.screenshot({path:info.outputPath('explore-tutorial-mobile.png')});await page.getByRole('tab',{name:/Places/}).click();
 await page.locator('[data-visit="wet-deck"]').click();await expect(page.locator('#explore-guide')).toBeVisible();await expect(page.locator('#interaction')).toBeVisible();
 await page.screenshot({path:info.outputPath('explore-mobile-guide.png')});
 await enter(page);await expect(page.locator('#explore-teaser')).toBeHidden();
});

test('discovery completion follows activity state and muted mosque offers a sound action',async({page})=>{
 await page.route('**/explore-unit',r=>r.fulfill({contentType:'text/html',body:'<div id="minimap-wrap"></div>'}));await page.goto('/explore-unit');
 await page.evaluate(async()=>{
  const {createExplore}=await import('/src/explore.ts');const {PerspectiveCamera}=await import('/node_modules/.vite/deps/three.js');
  const camera=new PerspectiveCamera(53,1,.1,450);camera.position.set(54,5,108);camera.lookAt(54,2,129);camera.updateMatrixWorld();
  let audioEnabled=false;const state={visible:true,position:{x:54,z:108},camera,experienced:[],audioEnabled:false,online:true};
  const explore=createExplore({releaseInput(){},canOpen:()=>true,visit:()=> 'City offline. Reconnect before travelling.',map(){},enableSound(){audioEnabled=true;}});
  (window as any).testExplore={explore,state,get audioEnabled(){return audioEnabled;}};explore.arrive('17');explore.update(state);
 });
 await expect(page.locator('#explore-guide [data-sound]')).toBeVisible();await page.locator('[data-sound]').click();expect(await page.evaluate(()=>(window as any).testExplore.audioEnabled)).toBe(true);
 await page.evaluate(()=>{const {explore,state}=(window as any).testExplore;explore.update({...state,audioEnabled:true,experienced:['17']});});await expect(page.locator('#explore-guide')).toBeHidden();
 await page.locator('#open-explore').click();await page.locator('[data-visit="21"]').click();await expect(page.locator('#explore-error')).toContainText('City offline');await expect(page.locator('#explore-city')).toBeVisible();
});
