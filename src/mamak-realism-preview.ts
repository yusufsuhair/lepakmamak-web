import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadMamakRealism,mamakRealismStatus} from './mamak-realism';
import {loadWebAsset,configureMamakLighting} from './web-assets';
import './mamak-realism-preview.css';

document.body.innerHTML='<header><small>LEPAK CITY / DETAIL STUDIO</small><h1>Mamak, lebih dekat.</h1><p id="status">Memuatkan meja dan kerusi…</p><p>Seret untuk pusing · Scroll untuk zoom</p></header><nav aria-label="Preview"><button data-view="dining" aria-pressed="true">Meja & kerusi</button><button data-view="table" aria-pressed="false">Atas meja</button><button data-view="site" aria-pressed="false">Mamak</button><button id="before" aria-pressed="false">Asal V6</button><button id="night" aria-pressed="false">Malam</button></nav>';
const scene=new THREE.Scene();scene.background=new THREE.Color('#d8d2c8');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);
const camera=new THREE.PerspectiveCamera(45,1,.025,200),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.6;controls.maxDistance=75;controls.maxPolarAngle=Math.PI*.49;
const hemi=new THREE.HemisphereLight('#dee9ef','#77705e',1.9);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff1d8',2.6);sun.position.set(-16,35,63);sun.target.position.set(-29,0,45);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;sun.shadow.camera.far=90;sun.shadow.normalBias=.012;scene.add(sun,sun.target);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:'#aaa18d',roughness:.98}));floor.rotation.x=-Math.PI/2;floor.position.set(-29,-.015,42);floor.receiveShadow=true;scene.add(floor);
let detail:THREE.Group|undefined,baseline:THREE.Group|undefined,night=false,before=false;
let lighting:ReturnType<typeof configureMamakLighting>|undefined,oldLighting:ReturnType<typeof configureMamakLighting>|undefined;
function view(name:string){const views:Record<string,number[][]>={dining:[[-26.3,2.6,55.4],[-29,.95,52]],table:[[-27.8,2.45,53.4],[-29,1.2,52]],site:[[-14,15,75],[-29,2.5,43]]};const [pos,target]=views[name]||views.dining;camera.position.fromArray(pos);controls.target.fromArray(target);controls.update();document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));}
function setNight(value:boolean){night=value;hemi.intensity=value?.3:1.9;sun.intensity=value?.25:2.6;scene.background=new THREE.Color(value?'#101a25':'#d8d2c8');lighting?.setNight(value);oldLighting?.setNight(value);document.querySelector('#night')!.setAttribute('aria-pressed',String(value));}
function setBefore(value:boolean){before=value;if(detail)detail.visible=!value;if(baseline)baseline.visible=value;document.querySelector('#before')!.setAttribute('aria-pressed',String(value));}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view!));document.querySelector<HTMLButtonElement>('#before')!.onclick=()=>setBefore(!before);document.querySelector<HTMLButtonElement>('#night')!.onclick=()=>setNight(!night);
void loadMamakRealism(scene,renderer).then(async asset=>{detail=asset;lighting=configureMamakLighting(asset);lighting.setNight(night);document.querySelector('#status')!.textContent=mamakRealismStatus.state==='ready'?'Dining batch 01 · Blender + PBR':'Menggunakan model asal';baseline=await loadWebAsset('/assets/models/environment/LM_ENV_MamakMaju.glb?v=mamak-v6',scene,new THREE.Vector3(-29,0,30),'Mamak V6 comparison');oldLighting=configureMamakLighting(baseline);oldLighting.setNight(night);setBefore(before);});
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();view('dining');
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
Object.assign(window,{__mamakRealismPreview:{view,setNight,setBefore,state:()=>({...mamakRealismStatus,comparisonReady:!!baseline,night,before,renderCalls:renderer.info.render.calls}),asset:()=>detail}});
