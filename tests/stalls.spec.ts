import {test,expect} from '@playwright/test';
import {createStalls} from '../server/stalls.mjs';
test('street stalls enforce distance, catalogue and one snack with nearby reactions',()=>{
 const messages:any[]=[];const handle=createStalls((ws:any,m:any)=>messages.push({ws,...m}));
 const a:any={id:'a',name:'A',ws:'a',x:0,z:0};const b:any={id:'b',name:'B',ws:'b',x:-16,z:62};const far:any={id:'f',ws:'f',x:100,z:100};const players=new Map([['a',a],['b',b],['f',far]]);
 handle(players,a,{type:'stall-order',stallId:'air-balang',itemId:'air-jagung'});expect(a.snack).toBeUndefined();
 handle(players,b,{type:'stall-order',stallId:'air-balang',itemId:'air-jagung'});expect(b.snack).toBe('air-jagung');expect(messages.filter(m=>m.type==='stall-action').some(m=>m.ws==='f')).toBe(false);
 const consume=createStalls((ws:any,m:any)=>messages.push({ws,...m}));consume(players,b,{type:'stall-consume',playerId:'a'});expect(b.snack).toBeNull();
 const invalid=createStalls(()=>{});invalid(players,b,{type:'stall-order',stallId:'air-balang',itemId:'cucur'});expect(b.snack).toBeNull();
});
test('mobile stall menu supports ordering and consuming',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.route('**/stall-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"><div class="brand-status"></div></div>'}));await page.goto('/stall-harness');
 await page.evaluate(async()=>{const {setupStalls}=await import('/src/stalls.ts');const THREE=await import('/node_modules/three/build/three.module.js');const ui=setupStalls(document.getElementById('hud')!,m=>{ui.state((m as any).type==='stall-order'?(m as any).itemId:null,true);return true;},()=>{});ui.state(null,true);const camera=new THREE.PerspectiveCamera(53,390/844,.1,100);camera.position.set(-16,5,70);camera.lookAt(-16,2,60);camera.updateMatrixWorld();ui.update({x:-16,z:62},camera,true);});
 await page.getByRole('button',{name:'Pesan · Air Balang Pak Din',exact:true}).click();await page.getByRole('button',{name:'Sirap bandung',exact:true}).click();await expect(page.locator('#stall-status')).toContainText('Pesanan dah siap');await page.getByRole('button',{name:'Tutup',exact:true}).click();await expect(page.locator('#street-snack')).toHaveText('Minum · Sirap bandung');await page.locator('#street-snack').click();await expect(page.locator('#street-snack')).toBeHidden();
});
