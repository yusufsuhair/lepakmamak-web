import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchShopFallback,box,material,type Person,type World} from './world';
import court from '../shared/pickleball.json';
import './pickleball.css';
export const insidePickleball=(p:{x:number;z:number})=>Math.abs(p.x-court.x)<=court.apronWidth&&Math.abs(p.z-court.z)<=court.apronLength;
export function createPickleball(scene:THREE.Scene,world:World){
 const g=new THREE.Group();g.position.set(court.x,0,court.z);scene.add(g);
 box(g,0,.06,0,12,.12,20,'#477e6b');box(g,0,.135,-3.35,6.1,.025,6.7,'#3277a0');box(g,0,.135,3.35,6.1,.025,6.7,'#b7764c');box(g,0,.15,0,6.1,.025,4.26,'#72a492');
 for(const x of [-3.05,3.05])box(g,x,.18,0,.07,.025,13.4,'#fff2d3');
 for(const z of [-6.7,-2.13,2.13,6.7])box(g,0,.18,z,6.1,.025,.07,'#fff2d3');
 for(const z of [-4.42,4.42])box(g,0,.18,z,.07,.025,4.54,'#fff2d3');
 for(const x of [-3.4,3.4])box(g,x,.64,0,.12,1.12,.12,'#e9e3ce');
 box(g,0,1.02,0,6.8,.065,.04,'#fff5d7');
 const strands:number[]=[];for(let x=-3.3;x<=3.3;x+=.22)strands.push(x,.25,0,x,1,0);for(let y=.25;y<1;y+=.15)strands.push(-3.35,y,0,3.35,y,0);const net=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(strands,3)),new THREE.LineBasicMaterial({color:'#253e39'}));g.add(net);
 world.solids.push({x:court.x,z:court.z,hx:3.5,hz:.12});world.mapBuildings.push({x:court.x,z:court.z,w:12,d:20,color:'#3277a0'});
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#193f34';ctx.fillRect(0,0,768,192);ctx.fillStyle='#fff1ce';ctx.textAlign='center';ctx.font='bold 58px sans-serif';ctx.fillText('PICKLEBALL LEPAK',384,82);ctx.font='28px sans-serif';ctx.fillText('MASUK · AMBIL RAKET · JOM MAIN',384,139);const texture=new THREE.CanvasTexture(canvas);const sign=new THREE.Mesh(new THREE.PlaneGeometry(7,1.75),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.position.set(0,3,-10.2);g.add(sign);for(const x of [-3,3])box(g,x,1.5,-10.2,.1,3,.1,'#344c41');
 // Blender court swaps in over the procedural one; the canvas sign is MeshBasicMaterial so
 // the game keeps its own wording, and the GLB carries the sign posts that hold it up.
 g.name='pickleball';
 g.traverse(o=>{o.userData.keepUnbatched=true;});
 batchShopFallback(g);
 const status={state:'loading' as 'loading'|'ready'|'fallback',fallbackMeshes:g.children.length};
 void new GLTFLoader().loadAsync('/assets/models/environment/LM_ENV_Pickleball.glb?v=courts-v1').then(gltf=>{
  gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;o.castShadow=false;}});
  for(const child of [...g.children])if(!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial))child.removeFromParent();
  g.add(gltf.scene);
  status.state='ready';status.fallbackMeshes=g.children.length-1;
 }).catch(error=>{status.state='fallback';console.warn('[PICKLEBALL] keeping procedural court',error);});
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),material('#e1ff38'));scene.add(ball);ball.visible=false;
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.22,12),new THREE.MeshBasicMaterial({color:'#213e32',transparent:true,opacity:.35,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.visible=false;scene.add(shadow);
 const hud=document.createElement('div');hud.id='pickleball-hud';hud.hidden=true;hud.innerHTML='<strong>🏓 PICKLEBALL LEPAK</strong><b data-score>Biru 0 : 0 Jingga</b><span data-info>Masuk court · klik / tap untuk serve</span><button type="button">Serve / Pukul</button><small>Rally santai · main sampai 11 mata</small>';document.body.append(hud);
 const paddles=new WeakMap<Person,THREE.Group>();const target=new THREE.Vector3();let info='Masuk court · klik / tap untuk serve';
 function equip(person:Person,on:boolean,swing=0){let paddle=paddles.get(person);if(!paddle&&on){paddle=new THREE.Group();box(paddle,0,-.67,.015,.07,.3,.07,'#e4ba7e');box(paddle,0,-.94,.015,.37,.38,.065,'#f0ca60');box(paddle,0,-.94,.052,.28,.29,.01,'#285b66');person.rightArm.add(paddle);paddles.set(person,paddle);}if(paddle)paddle.visible=on;if(on)person.rightArm.rotation.x=-.55-Math.sin(swing*Math.PI)*1.7;}
 return {equip,status,inside:insidePickleball,onHit(fn:()=>void){hud.querySelector('button')!.onclick=fn;},state(state:any){info=String(state.notice||'');hud.querySelector('[data-score]')!.textContent=`Biru ${state.score[0]} : ${state.score[1]} Jingga`;ball.visible=shadow.visible=!!state.ball;if(state.ball){target.set(state.ball.x,state.ball.y,state.ball.z);if(ball.position.lengthSq()===0)ball.position.copy(target);}},update(pos:{x:number;z:number},available:boolean,dt:number,online:boolean){hud.hidden=!available||!insidePickleball(pos);hud.querySelector('[data-info]')!.textContent=online?info:'Sambung ke city online untuk bermain.';hud.querySelector('button')!.disabled=!online;ball.position.lerp(target,1-Math.exp(-25*dt));shadow.position.set(ball.position.x,.2,ball.position.z);}};
}
