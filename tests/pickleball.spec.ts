import {test,expect} from '@playwright/test';
// @ts-ignore server module
import {createPickleball,inCourt} from '../server/pickleball.mjs';
test('court eligibility and server-owned serve, rally miss and distance checks',()=>{
 const sent:any[]=[];const game=createPickleball((ws:any,m:any)=>sent.push({ws,...m}));const a={id:'a',ws:'a',x:35,z:125,yaw:0},b={id:'b',ws:'b',x:35,z:135,yaw:Math.PI},outside={id:'c',ws:'c',x:0,z:0};const ps=new Map([['a',a],['b',b],['c',outside]]);
 expect(inCourt(a)).toBe(true);expect(inCourt({...a,riding:true})).toBe(false);expect(inCourt(outside)).toBe(false);
 game.handle(ps,outside,{type:'pickleball-hit'});expect(sent).toHaveLength(0);
 game.handle(ps,a,{type:'pickleball-hit'});expect(sent.find(m=>m.type==='pickleball-state').game.ball).toBeTruthy();expect(sent.some(m=>m.ws==='c')).toBe(false);
 const count=sent.length;game.handle(ps,b,{type:'pickleball-hit'});expect(sent.length).toBe(count);
 for(let i=0;i<100;i++)game.tick(ps);const final=sent.filter(m=>m.type==='pickleball-state').at(-1).game;expect(final.ball).toBeNull();expect(final.score).toEqual([1,0]);
 a.z=90;b.z=90;game.tick(ps);game.tick(ps);expect(sent.filter(m=>m.type==='pickleball-state').at(-1).game.score).toEqual([0,0]);
});
test('court is clear, rackets equip and stow, mobile HUD fits',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {createWorld,createPerson}=await import('/src/world.ts');const {createPickleball}=await import('/src/pickleball.ts');document.body.innerHTML='';
  const scene=new THREE.Scene();scene.background=new THREE.Color('#bfd6ce');const world=createWorld(scene);const overlaps=world.solids.filter(s=>Math.abs(s.x-35)<s.hx+6&&Math.abs(s.z-130)<s.hz+10);(window as any).overlaps=overlaps;
  const court=createPickleball(scene,world),person=createPerson();person.group.position.set(34,.15,126);scene.add(person.group);court.equip(person,true);(window as any).racketVisible=person.rightArm.children.at(-1)?.visible;court.equip(person,false);(window as any).racketHidden=!person.rightArm.children.at(-1)?.visible;court.equip(person,true);
  const other=createPerson('#75a2d7');other.group.position.set(35,.15,134);other.group.rotation.y=Math.PI;scene.add(other.group);court.equip(other,true);
  scene.add(new THREE.HemisphereLight(0xffffff,0x668877,3));const camera=new THREE.PerspectiveCamera(48,900/700,.1,500);camera.position.set(50,22,150);camera.lookAt(35,0,130);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(900,700);document.body.append(renderer.domElement);renderer.render(scene,camera);court.update({x:35,z:126},true,.1,true);
 });expect(await page.evaluate(()=>(window as any).overlaps)).toEqual([]);expect(await page.evaluate(()=>(window as any).racketVisible&&(window as any).racketHidden)).toBe(true);
 await page.screenshot({path:'/tmp/pickleball-court.png'});
 await page.setViewportSize({width:375,height:812});await page.locator('canvas').evaluate(el=>el.style.display='none');await expect(page.getByRole('button',{name:'Serve / Pukul'})).toBeVisible();const box=await page.locator('#pickleball-hud').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(375);
});
