import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadMamakRealism,mamakRealismStatus} from './mamak-realism';
import {configureMamakLighting} from './web-assets';
import {createMamakFacade} from './mamak-facade';
import './mamak-realism-preview.css';

document.body.innerHTML='<header><small>LEPAK MAMAK / FAÇADE STUDIO</small><h1>Mamak Maju.</h1><p id="status">Memuatkan façade Blender…</p><p>Seret untuk pusing · Scroll untuk zoom</p></header><nav aria-label="Preview"><button data-view="front">Hadapan</button><button data-view="iso">Sudut</button><button data-view="detail">Detail</button><button id="before" aria-pressed="false">Sebelum</button><button id="night" aria-pressed="false">Malam</button></nav>';
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(45,1,.1,200);
const controls = new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxDistance=95;
const hemi = new THREE.HemisphereLight('#dee9ef','#77705e',1.9);
const sun = new THREE.DirectionalLight('#fff1d8',2.6);sun.position.set(-12,35,63);sun.target.position.set(-29,0,40);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,far:90});sun.shadow.normalBias=.02;
scene.add(hemi,sun,sun.target);
const facade = createMamakFacade(scene);
let lighting: ReturnType<typeof configureMamakLighting> | undefined;
let site: THREE.Group | undefined, night=false, before=false;
function setNight(value:boolean) {
  night=value;hemi.intensity=value?.3:1.9;sun.intensity=value?.25:2.6;
  scene.background=new THREE.Color(value?'#101a25':'#d8d2c8');
  facade.setNight(value);lighting?.setNight(value);
  document.querySelector('#night')!.setAttribute('aria-pressed',String(value));
}
function setBefore(value:boolean) { before=value;facade.setVisible(!value);document.querySelector('#before')!.setAttribute('aria-pressed',String(value)); }
function view(name:string) {
  const views:Record<string,number[][]>={front:[[-29,8,77],[-29,4.5,40]],iso:[[-4,16,70],[-29,4,40]],detail:[[-14,6.7,55],[-20.8,4.8,40]]};
  const [eye,target]=views[name]||views.front;camera.position.fromArray(eye);controls.target.fromArray(target);controls.update();
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.onclick=()=>view(button.dataset.view!));
document.querySelector<HTMLButtonElement>('#before')!.onclick=()=>setBefore(!before);
document.querySelector<HTMLButtonElement>('#night')!.onclick=()=>setNight(!night);
void loadMamakRealism(scene,renderer).then(async asset=>{
  site=asset;lighting=configureMamakLighting(asset);lighting.setNight(night);
  await facade.load();
  document.querySelector('#status')!.textContent=facade.status.state==='ready'?'Façade Blender · 4 lampu · aset berasingan':'Façade tidak tersedia; Mamak asal dikekalkan';
});
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();view('front');setNight(false);
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
Object.assign(window,{__mamakFacadePreview:{view,setNight,setBefore,facade:()=>facade.asset,site:()=>site,
  state:()=>({...facade.status,siteState:mamakRealismStatus.state,night,before,renderCalls:renderer.info.render.calls})}});
