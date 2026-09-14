import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {stations,railHeight,trainState} from '../shared/lrt.mjs';

// The photographic Rapid KL build (scripts/blender/build_lrt.py) replaces every placeholder, and the
// numbers gameplay stands on stay where they were: rail top, platform top and edge, the coach floor a
// rider stands on, walls inside the coach, the pier and stair tower footprints the colliders assume.
const glb=(name:string)=>{const b=fs.readFileSync(`public/assets/models/lrt/${name}.glb`);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());};

test('LRT GLBs keep the node contract the loader animates',()=>{
 const train=glb('LM_LRT_Train');
 for(const top of ['cab','mid']){
  const node=train.nodes.find((n:any)=>n.name===top&&n.children);expect(node,top).toBeTruthy();
  const kids=node.children.map((i:number)=>train.nodes[i]);
  expect(kids.filter((n:any)=>/^roof(\.\d{3})?$/.test(n.name))).toHaveLength(1);
  const doors=kids.filter((n:any)=>/^door_[PN]_[12]_[ab](\.\d{3})?$/.test(n.name));expect(doors).toHaveLength(8);
  for(const d of doors){const [x,y,z]=d.translation;expect(Math.sign(x)).toBe(d.name[5]==='P'?1:-1);expect(Math.abs(x)).toBeCloseTo(1.915,2);expect(y).toBeCloseTo(2.25,2);expect(Math.abs(Math.abs(z)-3)).toBeCloseTo(.42,2);}
 }
 expect(glb('LM_LRT_Station').nodes.some((n:any)=>n.name==='station')).toBe(true);
 const viaduct=glb('LM_LRT_Viaduct');for(const name of ['girder','pier'])expect(viaduct.nodes.some((n:any)=>n.name===name)).toBe(true);
});

test('the Blender LRT swaps in and keeps rail, platform, floor and footprint geometry',async({page})=>{
 await page.goto('/');
 const out=await page.evaluate(async({stations,railHeight,doorsAt})=>{
  const THREE:any=await import('/node_modules/.vite/deps/three.js');
  const {createWorld}:any=await import('/src/world.ts');const L:any=await import('/src/lrt.ts');const {trackPoint}:any=await import('/shared/lrt.mjs');
  const scene=new THREE.Scene();const world=createWorld(scene);const lrt=L.createLrt(scene,world.solids);
  // lrtStatus is shared with the app's own LRT on this page, so wait for this scene's swap itself.
  const swapped=()=>!scene.getObjectByName('Lepak LRT elevated line').children.some((c:any)=>c.geometry?.type==='BoxGeometry')&&!!scene.getObjectByName(stations[0].name+' LRT').getObjectByName('station')&&!!scene.getObjectByName('LRT 1 coach 2').getObjectByName('mid');
  for(let i=0;i<600&&!swapped();i++)await new Promise(r=>setTimeout(r,200));
  lrt.update(0,{x:0,z:0},null);scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  const hit=(root:any,o:number[],d:number[])=>{ray.set(new THREE.Vector3(...o),new THREE.Vector3(...d).normalize());ray.far=40;const h=ray.intersectObject(root,true).filter((x:any)=>!x.object.userData.label)[0];return h?h.point:null;};
  const infra=scene.getObjectByName('Lepak LRT elevated line');
  const placeholders=infra.children.filter((c:any)=>c.geometry?.type==='BoxGeometry').length;
  // rail top on a straight: track runs along +x at z=-64 here, rails .7175 either side
  const p=trackPoint(60);const rail=[-1,1].map(s=>hit(infra,[p.x,20,p.z+s*.7175],[0,-1,0])?.y);
  // first pier (d=0): column faces seen from four sides at head height
  const q=trackPoint(0);const pier=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>{const h=hit(infra,[q.x+dx*6,1.5,q.z+dz*6],[-dx,0,-dz]);return h?Math.hypot(h.x-q.x,h.z-q.z):null;});
  // station 0: platform top at the middle and at the edge, stair tower faces
  const g=scene.getObjectByName(stations[0].name+' LRT');const local=(x:number,y:number,z:number)=>g.localToWorld(new THREE.Vector3(x,y,z)).toArray();
  const dir=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).transformDirection(g.matrixWorld).toArray();
  const stationKids=g.children.filter((c:any)=>!c.userData.label).map((c:any)=>c.name);
  const platform=[4.9,2.2,7.5].map(x=>hit(g,local(x,12.5,5),dir(0,-1,0))?.y);
  const towerZ=hit(g,local(11.8,2,6),dir(0,0,-1));const towerX=hit(g,local(5,2,0),dir(1,0,0));
  const tower={z:towerZ?g.worldToLocal(new THREE.Vector3(towerZ.x,towerZ.y,towerZ.z)).z:null,x:towerX?g.worldToLocal(new THREE.Vector3(towerX.x,towerX.y,towerX.z)).x:null};
  // coach 0 of train 0: floor under a standing rider, walls inside |x|<1.96, every placeholder gone
  const coach=scene.getObjectByName('LRT 1 coach 1');const cl=(x:number,y:number,z:number)=>coach.localToWorld(new THREE.Vector3(x,y,z)).toArray();
  const floor=hit(coach,cl(0,2.5,-2),new THREE.Vector3(0,-1,0).transformDirection(coach.matrixWorld).toArray())?.y;
  const inv=coach.matrixWorld.clone().invert();const box=new THREE.Box3();coach.traverse((o:any)=>{if(o.isMesh&&!o.userData.label){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));}});
  const doors:any[]=[];coach.traverse((o:any)=>{if(/^door_[PN]_\d_[ab]/.test(o.name))doors.push(o);});
  const before=doors.map(d=>d.position.z);for(let i=0;i<40;i++)lrt.update(doorsAt,{x:0,z:0},null);
  const moved=doors.filter((d,i)=>Math.abs(d.position.z-before[i])>.5).map(d=>d.name[5]);
  const roofHidden=(()=>{lrt.update(doorsAt,{x:0,z:0},0);let r:any=null;scene.getObjectByName('LRT 1 coach 2').traverse((o:any)=>{if(/^roof/.test(o.name))r=o;});return r&&r.visible===false;})();
  return {status:L.lrtStatus,placeholders,rail,pier,stationKids,platform,tower,floor,box:{minX:box.min.x,maxX:box.max.x,minY:box.min.y},doors:doors.length,moved,roofHidden,railHeight};
 },{stations,railHeight,doorsAt:(trainState(0,5000).doors?5000:0)});
 console.log('LRT ASSETS',JSON.stringify(out));
 expect(out.status).toMatchObject({viaduct:'ready',station:'ready',train:'ready'});
 expect(out.placeholders).toBe(0);
 for(const y of out.rail)expect(y).toBeCloseTo(railHeight,2);
 for(const d of out.pier){expect(d).not.toBeNull();expect(d!).toBeLessThanOrEqual(.81);expect(d!).toBeGreaterThan(.5);}
 expect(out.stationKids).toEqual(['station']);
 for(const y of out.platform)expect(y).toBeCloseTo(railHeight+.8,1);
 expect(out.tower.z).toBeCloseTo(1.75,1);expect(out.tower.x).toBeCloseTo(11.8-1.15,1);
 expect(out.floor).toBeCloseTo(railHeight+.85,1);
 expect(out.box.minX).toBeGreaterThanOrEqual(-1.97);expect(out.box.maxX).toBeLessThanOrEqual(1.97);expect(out.box.minY).toBeGreaterThanOrEqual(-.01);
 expect(out.doors).toBe(8);expect(out.moved.length).toBe(4);expect(new Set(out.moved)).toEqual(new Set(['P']));
 expect(out.roofHidden).toBe(true);
});
