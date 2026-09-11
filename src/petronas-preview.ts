import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadPetronas,preparePetronasEnvironment,PETRONAS} from './petronas';
import './petronas-preview.css';

document.body.innerHTML=`<header><span class="eyebrow">LEPAK CITY / ASSET STUDIO</span><h1>PETRONAS<span>Mesra forecourt</span></h1><p id="status">Memuatkan model Blender…</p></header><aside>Seret untuk pusing<br>Scroll untuk zoom</aside><nav aria-label="Pandangan"><button data-view="hero" aria-pressed="true">Stesen</button><button data-view="pump" aria-pressed="false">Pam</button><button data-view="shop" aria-pressed="false">Mesra</button><button id="night" aria-pressed="false">Malam</button></nav>`;
const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);
const hemi=new THREE.HemisphereLight('#c9e3ff','#726453',2.2);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0db',3.4);sun.position.set(-70,65,65);sun.target.position.set(-31,0,112);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-42;sun.shadow.camera.right=42;sun.shadow.camera.top=42;sun.shadow.camera.bottom=-42;sun.shadow.camera.far=160;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
const apron=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:'#343d41',roughness:.86}));apron.rotation.x=-Math.PI/2;apron.position.set(-31,-.15,112);apron.receiveShadow=true;scene.add(apron);
const fallback=new THREE.Group();fallback.position.set(PETRONAS.x,0,PETRONAS.z);scene.add(fallback);
const site=loadPetronas(scene,fallback);void preparePetronasEnvironment(renderer,site);
const lights:THREE.PointLight[]=[];
for(const x of [-11,0,11])for(const z of [-14,-5,18]){const light=new THREE.PointLight('#e5f7ff',0,14,2);light.position.set(-31+x,5.9,112+z);scene.add(light);lights.push(light);}
const camera=new THREE.PerspectiveCamera(45,1,.04,350),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.4;controls.maxDistance=120;controls.maxPolarAngle=Math.PI*.495;
let night=false;
function setNight(value:boolean){night=value;scene.background=new THREE.Color(value?'#071324':'#bacbd2');hemi.intensity=value?.22:2.2;sun.intensity=value?.17:3.4;sun.color.set(value?'#749dcf':'#fff0db');lights.forEach(l=>l.intensity=value?85:4);document.querySelector('#night')!.setAttribute('aria-pressed',String(value));document.body.classList.toggle('night',value);}
function view(name:string){
  const positions:Record<string,number[][]>={hero:[[20,16,53],[-31,3,109]],pump:[[-27.5,2.7,97.7],[-31,1.65,102.35]],shop:[[-55,7.5,105],[-31,3,128]]};
  const [pos,target]=positions[name]||positions.hero;camera.position.fromArray(pos);controls.target.fromArray(target);controls.update();
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view!));document.querySelector<HTMLButtonElement>('#night')!.onclick=()=>setNight(!night);
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();setNight(false);view('hero');
function frame(){controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
void site.ready.then(()=>{document.querySelector('#status')!.textContent=site.status.state==='ready'?'Model Blender · enam pam · material PBR':'Model tidak dapat dimuatkan';});
Object.assign(window,{__petronasPreview:{view,setNight,state:()=>({...site.status,drawCalls:renderer.info.render.calls,trianglesRendered:renderer.info.render.triangles,night})}});
