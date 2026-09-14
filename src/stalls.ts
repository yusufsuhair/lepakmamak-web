import * as THREE from 'three';
import stalls from '../shared/stalls.json';
import {batchShopFallback, createPerson, nearLoader} from './world';
import type {Solid} from './physics';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {cdnUrl} from './cdn';

export const stallVoiceSpots = stalls.map(({id,name,x,z}) => ({id,name,x,z}));
export const STALL_VOICE_REACH = 5;
export const STALL_VOICE_FULL = 1.5;
export const STALL_VOICE_PEAK = .44;

export function nearestStallDistance(position:{x:number;z:number}) {
 return Math.min(...stallVoiceSpots.map(stall => Math.hypot(position.x-stall.x,position.z-stall.z)));
}

// Keep the hawker call at the counter so it does not wash over the surrounding street.
export function stallVoiceVolume(distance:number) {
 const t=Math.max(0,Math.min(1,(STALL_VOICE_REACH-distance)/(STALL_VOICE_REACH-STALL_VOICE_FULL)));
 return STALL_VOICE_PEAK*t*t*(3-2*t);
}

export function createStallWorld(scene:THREE.Scene,solids:Solid[]){
 // The procedural carts below are the fallback. The Blender gerai
 // (scripts/blender/build_stalls.py) replaces them wholesale once it loads, so they live in
 // one group; the canvas name and price boards are drawn on top of either and stay.
 const group=new THREE.Group();group.name='stalls';scene.add(group);
 for(const stall of stalls){
  const g=new THREE.Group();g.position.set(stall.x,0,stall.z);group.add(g);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));m.position.set(x,y,z);g.add(m);return m;};
  box(0,.65,0,3.8,1.3,1.35,stall.color);box(0,1.34,0,4,.12,1.55,'#e6e0cf');
  for(const x of [-1.9,1.9])for(const z of [-.7,.7])box(x,1.6,z,.07,3.2,.07,'#ddd4bc');
  for(let i=0;i<8;i++)box(-1.75+i*.5,3.1,0,.5,.14,2.8,i%2?'#fff0ca':stall.color);
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d')!;ctx.fillStyle=stall.color;ctx.fillRect(0,0,768,160);ctx.fillStyle='#fff8db';ctx.textAlign='center';ctx.font='bold 45px sans-serif';ctx.fillText(stall.name,384,72);ctx.font='26px sans-serif';ctx.fillText(stall.id==='air-balang'?'SEJUK • SEGAR • PADU':'PANAS-PANAS BARU ANGKAT',384,122);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.9,.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));sign.position.set(0,2.6,.8);g.add(sign);
  for(let i=0;i<3;i++){
   if(stall.id==='air-balang'){
    const jar=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.72,12),new THREE.MeshStandardMaterial({color:stall.items[i].color,roughness:.2}));jar.position.set(-1.2+i*1.2,1.75,0);g.add(jar);
    box(-1.2+i*1.2,2.13,0,.77,.08,.77,'#ece8d6');box(-1.2+i*1.2,1.49,.4,.08,.1,.18,'#eeeeee');
   }else{
    box(-1.2+i*1.2,1.45,0,1,.08,1,'#a9aaa0');
    for(let j=0;j<6;j++){const fritter=box(-1.5+i*1.2+(j%3)*.25,1.53+Math.floor(j/3)*.07,-.25+Math.floor(j/3)*.4,.15,.12,.36,stall.items[i].color);fritter.rotation.y=.3*(j%2?1:-1);}
   }
  }
  // The hawker rig stays outside the replaced group: its character parts stream in later.
  const seller=createPerson(stall.id==='air-balang'?'#f3e7c3':'#7e608d');seller.group.position.set(stall.x,.12,stall.z-1.4);scene.add(seller.group);
  box(2.2,.4,-.3,.7,.8,.7,'#394e41');solids.push({x:stall.x,z:stall.z,hx:2,hz:.8},{x:stall.x,z:stall.z-1.4,hx:.4,hz:.4});
 }
 group.traverse(o=>{o.userData.keepUnbatched=true;});
 batchShopFallback(group);
 void nearLoader(group,150,230).loadAsync(cdnUrl('assets/models/environment/LM_ENV_Stalls.glb')).then(gltf=>{
  gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;if(m.transparent){m.depthWrite=false;o.castShadow=false;}
   // The slab and its puddles only receive: they are flat, and casting would cost a shadow draw each.
   if(/slab|puddle/i.test(m.name))o.castShadow=false;});
  lightHawker(gltf.scene);
  gltf.scene.add(createStallEffects());
  for(const child of [...group.children])if(!(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial))child.removeFromParent();
  group.add(gltf.scene);
 }).catch(error=>console.warn('[STALLS] keeping procedural stalls',error));
}

/** Night lighting shared by LM_ENV_Stalls.glb and LM_ENV_Busking.glb (scripts/blender/build_stalls.py,
 * build_busking.py). The material names are the contract: lamps glow a little by day and fully after
 * dark, 'Night wash' pools and 'Night beam' cones are additive light drawn only at night. Night is a
 * flag, so a model that streams in after dark still lights up. */
const GLOW:Record<string,[day:number,night:number]>={'Night tube':[.6,2.4],'Night bulb':[.5,3.2],'Night ember':[1.5,2.3],'Night fairy':[.15,2.8],'Night LED':[.35,2.2],'Night par':[0,3.2]};
const glows:{material:THREE.MeshStandardMaterial;day:number;night:number}[]=[];
const washes:THREE.Mesh[]=[];
const smokeLight={value:1};
let hawkerNight=false;

export function lightHawker(model:THREE.Object3D):void{
 model.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  const material=object.material as THREE.MeshStandardMaterial;
  if(!material.name.startsWith('Night'))return;
  object.castShadow=false;
  if(material.name.startsWith('Night wash')||material.name.startsWith('Night beam')){
   // Light, not paint: the texture becomes emission over black and is added on top.
   material.emissiveMap=material.map;material.map=null;material.color.setRGB(0,0,0);material.emissive.set(material.name.startsWith('Night beam')?'#ffe2b0':'#ffc987');
   material.emissiveIntensity=material.name.startsWith('Night beam')?.32:.85;
   Object.assign(material,{blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide});
   material.needsUpdate=true;object.receiveShadow=false;object.renderOrder=2;washes.push(object);
  }else if(material.name in GLOW&&!glows.some(glow=>glow.material===material)){
   const [day,night]=GLOW[material.name];glows.push({material,day,night});
  }
 });
 setHawkerNight(hawkerNight);
}

export function setHawkerNight(night:boolean):void{
 hawkerNight=night;
 for(const glow of glows)glow.material.emissiveIntensity=night?glow.night:glow.day;
 for(const wash of washes)wash.visible=night;
 smokeLight.value=night?.28:1;
}

export const hawkerStatus=()=>({night:hawkerNight,glows:glows.length,washes:washes.length});

/** Mirrors the anchors build_stalls.py writes to assets/stalls/manifest.json (offsets from the stall). */
export const STALL_EFFECTS:Record<string,{flame?:number[];smoke?:number[];steam?:number[]}>={'pisang-goreng':{flame:[1.22,1.46,-.05],smoke:[2.42,.96,-.6]},'air-balang':{steam:[1.25,1.8,-.1]}};

function flameTexture(){
 const c=document.createElement('canvas');c.width=32;c.height=64;const ctx=c.getContext('2d')!;
 const body=ctx.createLinearGradient(0,64,0,0);body.addColorStop(0,'rgba(60,110,255,.75)');body.addColorStop(.35,'rgba(90,120,240,.45)');body.addColorStop(.6,'rgba(255,150,50,.5)');body.addColorStop(1,'rgba(255,80,20,0)');
 ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(16,2);ctx.bezierCurveTo(30,30,30,52,16,62);ctx.bezierCurveTo(2,52,2,30,16,2);ctx.fill();
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

/** Wok flame, satay smoke and kettle steam: one draw for the flames, one for every puff. Both animate in
 * onBeforeRender, so they cost nothing while off screen, need no hook in the game loop and look the
 * same at every graphics quality. Reduced motion holds them still. */
export function createStallEffects():THREE.Group{
 const fx=new THREE.Group();fx.name='stall-effects';
 const still=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const now=()=>still?1.7:performance.now()/1000;
 // Flame tongues ring the kuali's belly: two crossed cards each, blue at the burner, orange at the tips.
 const cards:THREE.BufferGeometry[]=[],puffs:{origin:number[];rise:number;size:[number,number];life:number;spread:number;tone:number;alpha:number}[]=[];
 for(const stall of stalls){
  const spots=STALL_EFFECTS[stall.id]??{};
  if(spots.flame){
   const [fx0,fy,fz]=spots.flame;
   for(let i=0;i<16;i++){const a=i/16*Math.PI*2,h=.09+(i%3)*.025;for(const turn of [0,Math.PI/2]){
    const card=new THREE.PlaneGeometry(.06,h);card.translate(0,h/2,0);card.rotateY(a+turn);card.translate(stall.x+fx0+Math.cos(a)*.14,fy,stall.z+fz+Math.sin(a)*.14);cards.push(card);}}
  }
  if(spots.smoke){const [sx,sy,sz]=spots.smoke;for(let i=0;i<16;i++)puffs.push({origin:[stall.x+sx+((i*7)%5/4-.5)*.16,sy,stall.z+sz+(i/15-.5)*.9],rise:1.8,size:[.16,.62],life:4.2,spread:.45,tone:.84,alpha:.28});}
  if(spots.steam){const [tx,ty,tz]=spots.steam;for(let i=0;i<6;i++)puffs.push({origin:[stall.x+tx,ty,stall.z+tz],rise:.55,size:[.05,.24],life:2.2,spread:.12,tone:.96,alpha:.2});}
 }
 if(cards.length){
  const geometry=mergeGeometries(cards)!;geometry.computeBoundingBox();
  for(const card of cards)card.dispose();
  const flameMaterial=new THREE.MeshBasicMaterial({map:flameTexture(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const flame=new THREE.Mesh(geometry,flameMaterial);flame.name='stall-wok-flame';flame.renderOrder=3;
  const base=geometry.boundingBox!.min.y,ember=glows.find(glow=>glow.material.name==='Night ember');
  // Stretch the tongues from their base, and let the satay coals breathe with them.
  flame.onBeforeRender=()=>{const t=now();flame.scale.y=.85+Math.sin(t*17)*.1+Math.sin(t*29)*.07;flame.position.y=base*(1-flame.scale.y);
   if(ember)ember.material.emissiveIntensity=(hawkerNight?ember.night:ember.day)*(.88+Math.sin(t*3.1)*.08+Math.sin(t*7.3)*.04);};
  fx.add(flame);
 }
 if(puffs.length){
  // Billboard quads expanded in view space: rise, grow and fade over each puff's life.
  const count=puffs.length,origin=new Float32Array(count*12),corner=new Float32Array(count*8),shape=new Float32Array(count*16),phase=new Float32Array(count*16),index:number[]=[];
  const corners=[-1,-1,1,-1,1,1,-1,1];
  puffs.forEach((p,i)=>{
   const start=i/count*p.life*3%p.life;   // stagger, so the column is never one synchronised plume
   for(let k=0;k<4;k++){origin.set(p.origin,i*12+k*3);shape.set([p.rise,p.size[0],p.size[1],p.life],i*16+k*4);phase.set([start,p.spread,p.tone,p.alpha],i*16+k*4);}
   corner.set(corners,i*8);index.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(origin,3));geometry.setAttribute('corner',new THREE.BufferAttribute(corner,2));
  geometry.setAttribute('shape',new THREE.BufferAttribute(shape,4));geometry.setAttribute('phase',new THREE.BufferAttribute(phase,4));geometry.setIndex(index);
  geometry.computeBoundingSphere();geometry.boundingSphere!.radius+=2.5;
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},light:smokeLight},
   vertexShader:`attribute vec2 corner;attribute vec4 shape;attribute vec4 phase;uniform float time;varying vec2 vUv;varying float vAlpha;varying float vTone;
    void main(){float life=fract((time+phase.x)/shape.w);vec3 p=position;
     p.y+=life*shape.x;p.x+=life*life*phase.y+sin(life*5.+phase.x*3.)*.06;p.z+=sin(life*3.+phase.x)*.04*phase.y;
     vec4 view=modelViewMatrix*vec4(p,1.);float size=mix(shape.y,shape.z,sqrt(life));view.xy+=corner*size;
     gl_Position=projectionMatrix*view;vUv=corner;vTone=phase.z;
     vAlpha=phase.w*smoothstep(0.,.12,life)*(1.-smoothstep(.45,1.,life))*(1.-smoothstep(60.,110.,-view.z));}`,
   fragmentShader:`uniform float light;varying vec2 vUv;varying float vAlpha;varying float vTone;
    void main(){float d=length(vUv);float a=vAlpha*smoothstep(1.,.15,d);if(a<.003)discard;gl_FragColor=vec4(vec3(vTone)*light*vec3(1.,.97,.92),a);}`});
  const smoke=new THREE.Mesh(geometry,material);smoke.name='stall-smoke';smoke.renderOrder=4;
  smoke.onBeforeRender=()=>{material.uniforms.time.value=now();};
  fx.add(smoke);
 }
 return fx;
}

// Stalls name themselves when you walk up and carry the nearby hawker call.
export function setupStalls(hud:HTMLElement){
 const labels=stalls.map(stall=>{const label=document.createElement('div');label.className='table-label stall-name';label.hidden=true;label.textContent=stall.name;hud.append(label);return {stall,label};});
 return {update(pos:{x:number;z:number},camera:THREE.Camera,enabled:boolean){
  for(const {stall,label} of labels){
   if(!enabled||Math.hypot(pos.x-stall.x,pos.z-stall.z)>5){label.hidden=true;continue;}
   const p=new THREE.Vector3(stall.x,3.8,stall.z).project(camera);
   label.hidden=p.z<-1||p.z>1||Math.abs(p.x)>.85||Math.abs(p.y)>.9;
   if(!label.hidden){label.style.left=`${(p.x+1)*innerWidth/2}px`;label.style.top=`${(1-p.y)*innerHeight/2}px`;}
  }
 }};
}
