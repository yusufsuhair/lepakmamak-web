import {test,expect} from '@playwright/test';
import stalls from '../shared/stalls.json' with {type:'json'};

// Street stalls are scenery. They name themselves when you walk up and do nothing else.
test('a stall names itself when you are near and goes quiet when you walk away',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/stall-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"><div class="brand-status"></div></div>'}));
 await page.goto('/stall-harness');
 await page.evaluate(async()=>{
  const {setupStalls}=await import('/src/stalls.ts');
  const THREE=await import('/node_modules/three/build/three.module.js');
  const camera=new THREE.PerspectiveCamera(60,390/844,.1,500);
  const ui=setupStalls(document.getElementById('hud')!);
  (window as any).show=(x:number,z:number,enabled=true)=>{camera.position.set(x,6,z+12);camera.lookAt(x,2,z);camera.updateMatrixWorld();ui.update({x,z},camera,enabled);};
 });

 const balang=stalls.find(s=>s.id==='air-balang')!;
 await page.evaluate(([x,z])=>(window as any).show(x,z),[balang.x,balang.z]);
 await expect(page.getByText('Air Balang Pak Din',{exact:true})).toBeVisible();

 // Walking off hides it again.
 await page.evaluate(([x,z])=>(window as any).show(x+40,z+40),[balang.x,balang.z]);
 await expect(page.getByText('Air Balang Pak Din',{exact:true})).toBeHidden();

 // Riding, sitting or an open panel suppresses the label the same way it always did.
 await page.evaluate(([x,z])=>(window as any).show(x,z,false),[balang.x,balang.z]);
 await expect(page.getByText('Air Balang Pak Din',{exact:true})).toBeHidden();
});

test('no ordering interface survives anywhere in the stall UI',async({page})=>{
 await page.route('**/stall-gone-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"><div class="brand-status"></div></div>'}));
 await page.goto('/stall-gone-harness');
 await page.evaluate(async()=>{const {setupStalls}=await import('/src/stalls.ts');setupStalls(document.getElementById('hud')!);});
 await expect(page.locator('#street-stall')).toHaveCount(0);
 await expect(page.locator('#street-snack')).toHaveCount(0);
 await expect(page.locator('#stall-menu')).toHaveCount(0);
 // The label is a plain name, never a "Pesan · …" button.
 await expect(page.getByRole('button',{name:/Pesan/})).toHaveCount(0);
});

test('the stalls themselves are still standing in the world',()=>{
 expect(stalls.map(s=>s.name)).toEqual(['Air Balang Pak Din','Pisang Goreng Mak Cik']);
});
