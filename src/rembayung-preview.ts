import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createRembayung} from './rembayung';
import {REMBAYUNG,rembayungGroundHeight,rembayungPoint} from './rembayung-layout';
import {moveWithCollisions,type Solid} from './physics';

document.head.insertAdjacentHTML('beforeend',`<style>
*{box-sizing:border-box}body{margin:0;background:#dedbcd;color:#263731;font:14px system-ui,sans-serif}canvas{display:block;touch-action:none}header{position:fixed;top:24px;left:28px;pointer-events:none}h1{margin:0;font-size:26px;letter-spacing:-1px}header p{margin:5px 0;color:#5c645b}nav{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:6px;padding:7px;border:1px solid #fff8;background:#f5f2e9e8;border-radius:14px;backdrop-filter:blur(12px)}button{font:inherit;white-space:nowrap;cursor:pointer;border:0;border-radius:8px;background:transparent;color:#334437;padding:11px 17px}button[aria-pressed=true]{background:#2b4938;color:#fff}button:focus-visible{outline:2px solid #c78a38;outline-offset:2px}#hint{position:fixed;right:25px;top:27px;max-width:260px;color:#556052;text-align:right;font-size:12px;line-height:1.6;pointer-events:none}#pad{position:fixed;left:20px;bottom:95px;display:none;gap:5px}#pad button{background:#f5f2e9e8;border:1px solid #fff8;min-width:44px;min-height:44px}body.walk #pad{display:flex}@media(max-width:600px){header{top:18px;left:18px}h1{font-size:23px}#hint{top:77px;left:18px;right:auto;text-align:left}nav{bottom:15px;gap:2px}nav button{padding:11px 12px;font-size:12px}}
</style>`);
document.head.insertAdjacentHTML('beforeend','<style>header{background:#f5f2e9ed;padding:13px 17px;border-radius:12px;border:1px solid #fff8}#hint{background:#f5f2e9ed;padding:9px 12px;border-radius:9px}@media(max-width:600px){#hint{top:106px}}</style>');
document.body.insertAdjacentHTML('beforeend',`<header><h1>Rembayung</h1><p id="status">Memuatkan model…</p></header><div id="hint">Seret untuk pusing · Scroll untuk zoom</div><nav aria-label="Pandangan model"><button data-view="outside" aria-pressed="true">Luar</button><button data-view="inside" aria-pressed="false">Interior</button><button data-view="upstairs" aria-pressed="false">Mezzanine</button><button data-view="walk" aria-pressed="false">Jalan</button></nav><div id="pad" aria-label="Gerakan"><button data-key="KeyA" aria-label="Kiri">←</button><button data-key="KeyW" aria-label="Maju">↑</button><button data-key="KeyS" aria-label="Undur">↓</button><button data-key="KeyD" aria-label="Kanan">→</button></div>`);
const scene=new THREE.Scene();scene.background=new THREE.Color('#d6decd');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight('#f6edcf','#758b75',1.8));
const sun=new THREE.DirectionalLight('#ffdfa3',2.7);sun.position.set(-165,80,155);sun.target.position.set(-136,0,108);sun.castShadow=true;
sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.035;
scene.add(sun,sun.target);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(70,90),new THREE.MeshStandardMaterial({color:'#b7aa91',roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.set(-130,0,111);floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.05,300);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxDistance=70;controls.minDistance=.4;controls.maxPolarAngle=Math.PI*.495;
const solids:Solid[]=[];const site=createRembayung(scene,solids);
const keys=new Set<string>();let walking=false,yaw=Math.PI,pitch=0,last=performance.now();const pos=rembayungPoint(0,-3);
function view(name:string){
  walking=name==='walk';controls.enabled=!walking;document.body.classList.toggle('walk',walking);keys.clear();
  for(const button of document.querySelectorAll<HTMLButtonElement>('nav button'))button.setAttribute('aria-pressed',String(button.dataset.view===name));
  document.querySelector('#hint')!.textContent=walking?'WASD / butang anak panah untuk jalan · Seret untuk pandang':'Seret untuk pusing · Scroll untuk zoom';
  if(walking){Object.assign(pos,rembayungPoint(0,-3));yaw=Math.PI;pitch=0;}
  else if(name==='inside'){camera.position.set(-136,1.85,107.2);controls.target.set(-136,5.2,95);}
  else if(name==='upstairs'){camera.position.set(-136,6.0,96.8);controls.target.set(-136,3.4,116.5);}
  else {camera.position.set(-156,10.5,151);controls.target.set(-136,6.5,110);}
  controls.update();
}
document.querySelectorAll<HTMLButtonElement>('nav button').forEach(b=>b.onclick=()=>view(b.dataset.view!));
document.querySelectorAll<HTMLButtonElement>('#pad button').forEach(b=>{
  b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key!);};
  b.onpointerup=b.onpointercancel=()=>{keys.delete(b.dataset.key!);};
});
window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
let dragging=false,px=0,py=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(walking){dragging=true;px=e.clientX;py=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);}});
renderer.domElement.addEventListener('pointermove',e=>{if(walking&&dragging){yaw-=(e.clientX-px)*.005;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-py)*.004,-1.1,1.1);px=e.clientX;py=e.clientY;}});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();view('outside');
function frame(now:number){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(walking){
    let f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
    let s=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    const scale=Math.hypot(f,s)>1?Math.SQRT1_2:1;f*=scale;s*=scale;
    moveWithCollisions(pos,(Math.sin(yaw)*f-Math.cos(yaw)*s)*3.7*dt,(Math.cos(yaw)*f+Math.sin(yaw)*s)*3.7*dt,.46,solids);
    camera.position.set(pos.x,(rembayungGroundHeight(pos)??0)+REMBAYUNG.origin.y+1.65,pos.z);
    camera.lookAt(pos.x+Math.sin(yaw)*Math.cos(pitch),camera.position.y+Math.sin(pitch),pos.z+Math.cos(yaw)*Math.cos(pitch));
  }else controls.update();
  renderer.render(scene,camera);
  document.querySelector('#status')!.textContent=site.status.state==='ready'?'Model Blender · preview tempatan':site.status.state==='fallback'?'Model fallback · muat turun tidak tersedia':'Memuatkan model…';
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
Object.assign(window,{__rembayungPreview:{view,state:()=>({...site.status,fallbackVisible:site.fallback.visible,position:{...pos},height:rembayungGroundHeight(pos),drawCalls:renderer.info.render.calls,renderTriangles:renderer.info.render.triangles,walking})}});
