import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {batchShopFallback,box,material,type World,type Person} from './world';
import {dressDistrict} from './district-night';
import court from '../shared/basketball.json';
import './basketball.css';
export const insideBasketball=(p:{x:number;z:number})=>Math.abs(p.x-court.x)<=court.halfWidth+1&&Math.abs(p.z-court.z)<=court.halfLength+1;
export function createBasketball(scene:THREE.Scene,world:World){
 const group=new THREE.Group();group.position.set(court.x,0,court.z);scene.add(group);
 const canvas=document.createElement('canvas');canvas.width=700;canvas.height=1200;const c=canvas.getContext('2d')!;c.fillStyle='#ba7253';c.fillRect(0,0,700,1200);c.fillStyle='#356d78';c.fillRect(230,0,240,270);c.fillRect(230,930,240,270);c.strokeStyle='#ffeed4';c.lineWidth=4;c.strokeRect(8,8,684,1184);c.beginPath();c.moveTo(0,600);c.lineTo(700,600);c.stroke();c.beginPath();c.arc(350,600,90,0,Math.PI*2);c.stroke();
 for(const y of [0,1200]){c.strokeRect(230,y===0?0:930,240,270);c.beginPath();c.arc(350,y===0?270:930,90,0,Math.PI*2);c.stroke();c.beginPath();c.arc(350,y===0?75:1125,310,y===0?0:Math.PI,y===0?Math.PI:Math.PI*2);c.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const floor=new THREE.Mesh(new THREE.PlaneGeometry(14,24),new THREE.MeshStandardMaterial({map:texture,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=.16;floor.receiveShadow=true;group.add(floor);box(group,0,.06,0,16,.12,26,'#3f7765');
 // The court name is the game's wording, not the mesh's: it rides its own MeshBasicMaterial
 // plane so it survives onto the Blender court instead of being baked into the GLB.
 const nameCanvas=document.createElement('canvas');nameCanvas.width=512;nameCanvas.height=112;const nc=nameCanvas.getContext('2d')!;nc.fillStyle='#fff0d6';nc.font='bold 68px sans-serif';nc.textAlign='center';nc.textBaseline='middle';nc.fillText('BASKET LEPAK',256,58);
 const nameTexture=new THREE.CanvasTexture(nameCanvas);nameTexture.colorSpace=THREE.SRGBColorSpace;
 const name=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1),new THREE.MeshBasicMaterial({map:nameTexture,transparent:true,depthWrite:false}));
 name.rotation.x=-Math.PI/2;name.position.set(0,.21,-.8);group.add(name);
 for(const side of [-1,1]){box(group,0,1.8,side*12.2,.18,3.6,.18,'#344847');box(group,0,3.3,side*11.45,.14,.14,1.5,'#344847');box(group,0,3.65,side*11.2,1.8,1.1,.09,'#f1ead8');box(group,0,3.45,side*11.14,.7,.48,.025,'#cb6646');box(group,0,3.45,side*11.11,.59,.37,.028,'#fff7df');const rim=new THREE.Mesh(new THREE.TorusGeometry(.38,.04,6,20),material('#eb7840'));rim.rotation.x=Math.PI/2;rim.position.set(0,3.05,side*court.hoopOffset);group.add(rim);const points:number[]=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;points.push(Math.cos(a)*.38,3.05,side*court.hoopOffset+Math.sin(a)*.38,Math.cos(a)*.23,2.52,side*court.hoopOffset+Math.sin(a)*.23);}group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),new THREE.LineBasicMaterial({color:'#fff5dd'})));world.solids.push({x:court.x,z:court.z+side*12.2,hx:.25,hz:.25});}
 world.mapBuildings.push({x:court.x,z:court.z,w:16,d:26,color:'#ba7253'});
 // Blender court swaps in over the procedural one. The ball stays outside this group: it is
 // server-owned and moves. No collider is touched, so the timed shot keeps scoring.
 group.name='basketball';
 group.traverse(o=>{o.userData.keepUnbatched=true;});
 batchShopFallback(group);
 const status={state:'loading' as 'loading'|'ready'|'fallback',fallbackMeshes:group.children.length};
 void new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/assets/models/environment/LM_ENV_Basketball.glb?v=courts-v2').then(gltf=>{
  dressDistrict(gltf.scene);
  for(const child of [...group.children])if(!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial))child.removeFromParent();
  group.add(gltf.scene);
  status.state='ready';status.fallbackMeshes=group.children.length-1;
 }).catch(error=>{status.state='fallback';console.warn('[BASKETBALL] keeping procedural court',error);});
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),material('#dd782e'));scene.add(ball);ball.position.set(court.x,.25,court.z);for(const angle of [0,Math.PI/2]){const seam=new THREE.Mesh(new THREE.TorusGeometry(.242,.009,4,28),material('#542c1a'));seam.rotation.y=angle;ball.add(seam);}const shadow=new THREE.Mesh(new THREE.CircleGeometry(.25,12),new THREE.MeshBasicMaterial({color:'#243e34',transparent:true,opacity:.35,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
 const hud=document.createElement('section');hud.id='basketball-hud';hud.hidden=true;hud.innerHTML='<strong>🏀 BASKET LEPAK</strong><p data-info></p><div class="basket-meter"><span></span><i></i></div><button type="button">Ambil bola</button><small>Dekat ring: 2 mata · jauh: 3 mata</small><p data-scores></p>';document.body.append(hud);
 const button=hud.querySelector('button')!,meter=hud.querySelector<HTMLElement>('.basket-meter i')!;let sender:(m:object)=>boolean=()=>false,self='',holder:string|null=null,charging=0,shooting=false,online=false,notice='Dekati bola dan ambil.',near=false;const target=ball.position.clone();
 function cancel(){if(charging)sender({type:'basketball-cancel'});charging=0;}
 function action(){if(!online)return;if(holder===self)sender({type:'basketball-shoot'});else sender({type:'basketball-grab'});}
 button.onpointerdown=e=>{if(button.disabled)return;e.preventDefault();button.setPointerCapture(e.pointerId);if(holder===self){if(sender({type:'basketball-charge'}))charging=performance.now();}else action();};
 button.onpointerup=()=>{if(charging){sender({type:'basketball-shoot'});charging=0;}};button.onpointercancel=cancel;button.onlostpointercapture=cancel;
 button.onkeydown=e=>{if((e.code==='Space'||e.code==='Enter')&&!e.repeat){e.preventDefault();if(holder===self){if(sender({type:'basketball-charge'}))charging=performance.now();}else action();}};button.onkeyup=e=>{if((e.code==='Space'||e.code==='Enter')&&charging){e.preventDefault();sender({type:'basketball-shoot'});charging=0;}};button.onblur=cancel;
 return {action,status,connect(fn:(m:object)=>boolean){sender=fn;},state(g:any){holder=g.holder;shooting=g.shooting;notice=g.notice;target.set(g.ball.x,g.ball.y,g.ball.z);hud.querySelector('[data-scores]')!.textContent=g.scores.map((p:any)=>`${p.name}: ${p.points}`).join(' · ');},pose(person:Person,id:string){if(id&&holder===id){person.rightArm.rotation.x=-.65;person.leftArm.rotation.x=-.3;}},update(pos:{x:number;z:number},available:boolean,dt:number,connected:boolean,id:string){self=id;online=connected;const visible=available&&insideBasketball(pos);hud.hidden=!visible;if(!visible||!connected){cancel();if(!connected){holder=null;target.set(court.x,.25,court.z);}}near=Math.hypot(pos.x-target.x,pos.z-target.z)<=2.5;button.disabled=!online||shooting||!!holder&&holder!==self||!holder&&!near;button.textContent=shooting?'Bola di udara…':holder===self?'Tahan untuk Shoot':holder?'Bola sedang dipegang':near?'Ambil bola':'Dekati bola';hud.querySelector('[data-info]')!.textContent=online?notice:'Sambung ke city online untuk bermain.';meter.style.left=`${Math.min(100,(performance.now()-charging)/1400*100)}%`;meter.hidden=!charging;ball.position.lerp(target,1-Math.exp(-22*dt));ball.rotation.x+=dt*3;shadow.position.set(ball.position.x,.18,ball.position.z);}};
}
