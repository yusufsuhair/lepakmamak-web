import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {lands,attractions,instructions,type Attraction} from './legoland-data';
import './legoland.css';

const root=document.querySelector<HTMLDivElement>('#park')!;
root.innerHTML=`<canvas id="park-world" aria-label="Taman rekreasi 3D LEGOLAND" tabindex="0"></canvas>
<header><div class="park-brand"><small>LEPAKMAMAK · JOHOR</small><strong>LEGOLAND</strong></div><nav class="park-nav"><span id="park-pass">0 / ${attractions.length}</span><button id="park-overview">Panorama</button><button id="park-map-toggle">Peta</button><button id="park-guide">Panduan</button><a href="/">Balik KL ↗</a></nav></header>
<section class="park-card"><small id="park-land">The Beginning</small><h1 id="park-title">Sehari penuh pengembaraan.</h1><p id="park-description">Jalan ke tarikan atau pilih destinasi pada peta. Setiap tarikan mempunyai aktiviti dan cop pasport.</p><p id="park-status" role="status"></p><button id="park-action">Mula jelajah</button><div id="park-tools" hidden><button id="park-build">Letak blok</button><button id="park-undo">Undo</button><button id="park-collect">Kutip</button></div><button id="park-exit" hidden>Keluar tarikan</button><label id="park-reduced"><input type="checkbox" id="park-calm"> Kamera tenang</label></section>
<aside id="park-map"><canvas width="440" height="340" aria-label="Peta resort dan kedudukan anda"></canvas><label for="park-destination">Pergi ke tarikan</label><select id="park-destination"><option value="">Pilih destinasi…</option></select><p>WASD / anak panah: jalan · Shift: lari<br>E: main / kutip · Space: blok · Esc: keluar<br>Interpretasi permainan peminat · Solo</p></aside>
<div id="park-controls" aria-label="Kawalan pergerakan"><button data-key="KeyW" aria-label="Maju">↑</button><button data-key="KeyA" aria-label="Kiri">←</button><button data-key="KeyS" aria-label="Undur">↓</button><button data-key="KeyD" aria-label="Kanan">→</button></div><div id="park-toast" role="status" hidden></div>
<dialog id="park-help"><h2>Selamat datang ke taman</h2><p>10 kawasan, ${attractions.length} aktiviti. Jalan bebas, naik wahana, bina blok dan lengkapkan pasport. Cop disimpan pada peranti ini.</p><p>Ini interpretasi bergaya blok dalam LepakMamak, bukan produk rasmi atau replika berskala tepat. Mekanik tarikan dipermudahkan untuk permainan ini.</p><ul>${lands.map(l=>`<li>${l.name}</li>`).join('')}</ul><p><a href="https://www.legoland.com.my/explore/theme-park/park-map/" target="_blank" rel="noopener">Rujukan peta resort rasmi</a></p><button id="park-help-close">Jom main</button></dialog>`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=el<HTMLCanvasElement>('park-world');
const status=el('park-status'), action=el<HTMLButtonElement>('park-action');
const calm=el<HTMLInputElement>('park-calm');calm.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys=new Set<string>(), stamps=new Set<number>();
try{const saved=JSON.parse(localStorage.getItem('lepak-legoland-pass-v1')||'[]');if(Array.isArray(saved))for(const id of saved)if(Number.isInteger(id)&&attractions[id])stamps.add(id);}catch{/* storage optional */}
function passport(){el('park-pass').textContent=`${stamps.size} / ${attractions.length}`;}passport();
let toastUntil=0;
function toast(message:string){el('park-toast').textContent=message;el('park-toast').hidden=false;toastUntil=performance.now()+4000;}

function start(){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b9e0ed');scene.fog=new THREE.Fog('#b9e0ed',180,510);
 scene.add(new THREE.HemisphereLight('#fff8d9','#66866a',1.7));const sun=new THREE.DirectionalLight('#fff1c2',2);sun.position.set(-90,150,60);scene.add(sun);
 const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,2000);
 const scenery=new THREE.Group();scene.add(scenery);
 const mats=new Map<string,THREE.MeshStandardMaterial>();const cube=new THREE.BoxGeometry(1,1,1),stud=new THREE.CylinderGeometry(.3,.3,.18,8);
 const mat=(color:string)=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.65}));return mats.get(color)!;};
 function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string){const m=new THREE.Mesh(cube,mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;}
 function brick(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string){box(parent,x,y,z,w,h,d,color);for(let i=-w/2+.6;i<w/2;i+=1.2)for(let j=-d/2+.6;j<d/2;j+=1.2){const m=new THREE.Mesh(stud,mat(color));m.position.set(x+i,y+h/2+.09,z+j);parent.add(m);}}
 function label(text:string,x:number,y:number,z:number,color:string,width=16){const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,768,128);ctx.fillStyle='white';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,64,735);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/6),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));m.position.set(x,y,z);scenery.add(m);}
 box(scenery,50,-.7,0,490,1,370,'#7aaf75');
 box(scenery,35,.01,0,360,.12,12,'#ead6ad');box(scenery,0,.02,10,12,.12,275,'#ead6ad');
 for(const land of lands){box(scenery,land.x,.05,land.z,land.name==='Water Park'?112:77,.18,land.name==='Water Park'?112:74,'#b8cf91');box(scenery,land.x,.16,land.z,8,.14,75,'#f2dfb6');box(scenery,land.x,.17,land.z,76,.14,8,'#f2dfb6');label(land.name,land.x,6,land.z,land.color,18);}
 for(const x of [-13,13])brick(scenery,x,6,154,5,12,5,'#e33935');brick(scenery,0,13,154,32,3,6,'#f1c72a');label('LEGOLAND MALAYSIA',0,13.1,157.1,'#e33935',29);
 for(let i=0;i<95;i++){const angle=i*2.399, radius=145+(i%4)*7,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;box(scenery,x,2,z,1,4,1,'#8d6541');brick(scenery,x,5,z,4,3,4,i%2?'#398455':'#4b9557');}
 const curves=new Map<number,THREE.CatmullRomCurve3>(),cars=new Map<number,THREE.Group>();
 const palettes=['#e74438','#f0c533','#357ec5','#4c9b68'];
 function rideCurve(a:Attraction){if(a.name==='LEGOLAND Express')return new THREE.CatmullRomCurve3([[25,1,122],[-55,1,125],[-145,1,45],[-120,1,-85],[0,1,-150],[145,1,-90],[155,1,40],[90,1,105]].map(p=>new THREE.Vector3(...p as [number,number,number])),true,'catmullrom',.2);const points:THREE.Vector3[]=[];for(let i=0;i<17;i++){const t=i/16*Math.PI*2;let y=1.2;if(a.kind==='coaster')y=3+Math.pow((1-Math.cos(t))/2,2)*15+Math.sin(t*3)*1.4;if(a.kind==='slide')y=1+(1-i/16)*18;points.push(new THREE.Vector3(a.x+Math.sin(t)*9,y,a.z+Math.cos(t)*7));}return new THREE.CatmullRomCurve3(points,a.kind!=='slide','catmullrom',.2);}
 for(const a of attractions){const color=lands[a.land].color;box(scenery,a.x,.24,a.z,20,.3,19,'#fff0c8');label(a.name,a.x,3.2,a.z+10,color,12);
  if(['coaster','boat','slide','drive'].includes(a.kind)){
   const curve=rideCurve(a);curves.set(a.id,curve);scenery.add(new THREE.Mesh(new THREE.TubeGeometry(curve,a.id===0?192:64,a.kind==='boat'?1.1:.35,5,false),mat(a.id===0?'#777d80':a.kind==='boat'?'#46c8d7':color)));
   if(a.kind==='coaster'||a.kind==='slide')for(let i=0;i<12;i++){const p=curve.getPoint(i/12);box(scenery,p.x,p.y/2,p.z,.35,p.y,.35,'#d7d6c4');}
   const car=new THREE.Group();box(car,0,.6,0,2.2,.8,3,color);box(car,0,1.2,-.6,2,1,.35,'#333d4a');if(a.id===0){box(car,0,2,-1,2.5,.4,2,'#f3c72c');box(car,0,1.8,1,.6,2,.6,'#333d4a');for(const side of [-1,1])for(const z of [-1,1])box(car,side*1.2,.3,z,.3,.8,.8,'#333d4a');}scene.add(car);cars.set(a.id,car);
  }else if(a.kind==='tower'){brick(scenery,a.x,12,a.z,2,24,2,color);const car=new THREE.Group();box(car,0,.2,0,6,.6,6,'#f3c938');scene.add(car);cars.set(a.id,car);
  }else if(a.kind==='spin'){brick(scenery,a.x,2,a.z,2,4,2,color);const car=new THREE.Group();box(car,0,0,0,15,.4,.6,color);box(car,0,0,0,.6,.4,15,color);for(let i=0;i<4;i++)box(car,Math.sin(i*Math.PI/2)*7,.6,Math.cos(i*Math.PI/2)*7,3,1.3,3,palettes[i]);scene.add(car);cars.set(a.id,car);
  }else if(a.kind==='shoot'){brick(scenery,a.x,4,a.z-5,15,8,3,color);for(let i=0;i<3;i++)brick(scenery,a.x-6+i*6,9,a.z-5,3,2,4,'#e7c462');
  }else if(a.kind==='build'){box(scenery,a.x,1,a.z,12,2,10,'#f5d441');for(let i=0;i<4;i++)brick(scenery,a.x-4+i*2.5,2.6,a.z,2,1,2,palettes[i]);
  }else if(a.land===9){box(scenery,a.x,3,a.z,16,6,10,'#286c97');for(let i=0;i<4;i++){box(scenery,a.x-6+i*4,3,a.z+5.1,3.5,4,.1,'#58d2dd');brick(scenery,a.x-6+i*4,3+(i%2),a.z+5.3,1,.5,.4,'#f4cb47');}
  }else{for(let i=0;i<6;i++){const h=3+(i%3)*3;brick(scenery,a.x-6+(i%3)*6,h/2,a.z-3+Math.floor(i/3)*6,3,h,3,palettes[i%4]);}if(a.name==='Amazing Malaysia')box(scenery,a.x,5,a.z-3,12,.7,1,'#d4dce0');}
 }
 // Distinct landmarks and landscaping make the ten lands readable from a distance.
 const obstacles:{x:number;z:number;w:number;d:number}[]=[];
 function building(x:number,z:number,w:number,h:number,d:number,color:string){brick(scenery,x,h/2,z,w,h,d,color);obstacles.push({x,z,w,d});}
 building(-110,-3,15,10,5,'#bdb4a0');for(const x of [-122,-98]){building(x,-3,6,15,6,'#c8c0b0');const roof=new THREE.Mesh(new THREE.ConeGeometry(4.5,7,4),mat('#ba3848'));roof.position.set(x,18,-3);scenery.add(roof);for(let i=0;i<3;i++)brick(scenery,x-2+i*2,15.5,0,1,1,1,'#d9ceb4');}label('LEGO KINGDOMS',-110,11,1,'#913d47',16);
 for(let i=0;i<6;i++)brick(scenery,15,1+i*2,-110,22-i*3,2,22-i*3,'#d2ad62');obstacles.push({x:15,z:-110,w:22,d:22});
 building(108,32,17,7,9,'#be4440');for(let i=0;i<3;i++){const roof=box(scenery,108,8+i*2.4,32,23-i*4,.7,15-i*3,'#303e44');roof.rotation.z=.02;}label('NINJAGO',108,5,37,'#ab292c',12);
 box(scenery,220,.3,0,32,.3,27,'#42b7d0');for(let i=0;i<8;i++)box(scenery,206+i*4,.49,0,.3,.08,25,'#a5e5e8');label('WATER PARK',220,6,-9,'#087eaa',20);
 box(scenery,110,.3,-65,24,.25,14,'#697775');for(let i=0;i<6;i++)box(scenery,100+i*4,.47,-65,2,.04,.3,'#f8e7b0');
 for(const x of [-5,5]){building(x,-8,3,13,3,'#a9bfc5');brick(scenery,x,14,-8,1,3,1,'#cbd8d6');}box(scenery,0,8,-8,10,.7,1.2,'#8bafb4');label('MINILAND · MALAYSIA',0,3,9,'#358863',17);
 for(const l of lands)for(const side of [-1,1]){const x=l.x+side*34,z=l.z+32;box(scenery,x,1,z,3,.3,1,'#a96a44');box(scenery,x,.5,z,.3,1,.3,'#7c604d');brick(scenery,x+5,2,z,1,4,1,'#79985a');brick(scenery,x+5,4,z,4,2,4,'#408556');}
 // Batch the hundreds of static blocks by material; animated rides remain separate.
 scenery.updateMatrixWorld(true);const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>(),originals:THREE.Mesh[]=[];
 scenery.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const list=buckets.get(o.material)||[];list.push(g);buckets.set(o.material,list);originals.push(o);}});
 for(const [material,geometries] of buckets){const merged=mergeGeometries(geometries);if(merged)scene.add(new THREE.Mesh(merged,material));for(const g of geometries)g.dispose();}for(const o of originals)o.removeFromParent();
 const player=new THREE.Group();brick(player,0,1.2,0,.9,1,.6,'#ed4535');box(player,-.24,.4,0,.35,.8,.4,'#23629d');box(player,.24,.4,0,.35,.8,.4,'#23629d');box(player,0,2,0,.7,.65,.65,'#f5cd3c');scene.add(player);player.position.set(0,0,163);
 let nearby:Attraction|undefined,selected:Attraction|undefined,elapsed=0,score=0,won=false,frame=0,last=0,overview=false,zoom=1;
 el('park-overview').onclick=()=>{overview=!overview;el('park-overview').textContent=overview?'Dekat':'Panorama';keys.clear();};
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom+e.deltaY*.001,.55,2.5);},{passive:false});
 const duration=(a:Attraction)=>a.id===0?60:a.kind==='slide'?18:26;
 const tokens:THREE.Mesh[]=[],blocks:THREE.Mesh[]=[],mini=new THREE.Group();scene.add(mini);
 const targetMaterial=new THREE.MeshStandardMaterial({color:'#ffe353',emissive:'#ae6000',emissiveIntensity:.6});
 function clearMini(){for(const child of [...mini.children]){mini.remove(child);if(child instanceof THREE.Mesh&&child.geometry!==cube)child.geometry.dispose();}tokens.length=0;blocks.length=0;}
 function award(){if(!selected||won)return;won=true;stamps.add(selected.id);passport();try{localStorage.setItem('lepak-legoland-pass-v1',JSON.stringify([...stamps]));}catch{/* optional */}status.textContent='Selesai! Cop pasport dikumpul.';toast(`${selected.name} · Cop dikumpul!`);}
 function leave(){if(!selected)return;player.position.set(selected.x,0,selected.z+13);selected=undefined;clearMini();keys.clear();el('park-exit').hidden=true;el('park-tools').hidden=true;action.hidden=false;el<HTMLSelectElement>('park-destination').disabled=false;status.textContent='Pilih tarikan seterusnya.';}
 function begin(a:Attraction){leave();overview=false;el('park-overview').textContent='Panorama';selected=a;elapsed=0;score=0;won=false;keys.clear();clearMini();el('park-title').textContent=a.name;el('park-land').textContent=lands[a.land].name;el('park-description').textContent=instructions[a.kind];action.hidden=true;el('park-exit').hidden=false;el<HTMLSelectElement>('park-destination').disabled=true;
  const manual=['drive','shoot','build','explore'].includes(a.kind);player.position.set(a.x,a.kind==='drive'?.9:0,a.z+12);status.textContent='Jom!';
  el('park-tools').hidden=!['build','explore'].includes(a.kind);el('park-build').hidden=a.kind!=='build';el('park-undo').hidden=a.kind!=='build';el('park-collect').hidden=a.kind!=='explore';
  if(['shoot','explore','drive'].includes(a.kind)){const count=a.kind==='shoot'?8:5;for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;const geometry=a.kind==='drive'?new THREE.TorusGeometry(1.7,.18,6,16):new THREE.IcosahedronGeometry(.8,0);const m=new THREE.Mesh(geometry,targetMaterial);m.position.set(a.x+Math.sin(angle)*13,a.kind==='shoot'?3+(i%3):1.5,a.z+Math.cos(angle)*12);mini.add(m);tokens.push(m);}}
  if(!manual)toast('Launched! Keluar tarikan bila-bila masa.');
 }
 let blockColor=0;
 const colors=document.createElement('div');colors.id='park-colors';colors.setAttribute('aria-label','Warna blok');colors.hidden=true;el('park-tools').append(colors);
 for(let i=0;i<palettes.length;i++){const button=document.createElement('button');button.textContent=['Merah','Kuning','Biru','Hijau'][i];button.setAttribute('aria-pressed',String(i===0));button.onclick=()=>{blockColor=i;for(const [index,b] of [...colors.children].entries())b.setAttribute('aria-pressed',String(index===i));};colors.append(button);}
 function build(point?:THREE.Vector3){if(selected?.kind!=='build'||won)return;const i=blocks.length;
  const x=point?selected.x+THREE.MathUtils.clamp(Math.round((point.x-selected.x)/2)*2,-4,4):selected.x-3+(i%4)*2;
  const z=point?selected.z+THREE.MathUtils.clamp(Math.round((point.z-selected.z)/2)*2,-4,4):selected.z+2;
  const height=blocks.filter(b=>Math.abs(b.position.x-x)<.2&&Math.abs(b.position.z-z)<.2).length;
  const m=box(mini,x,3+height*1.2,z,1.8,1,1.8,palettes[blockColor]);blocks.push(m);status.textContent=`Binaan ${blocks.length} / 8 blok`;if(blocks.length===8)award();}
 function collect(){if(selected?.kind!=='explore'||won)return;const token=tokens.find(t=>t.visible&&Math.hypot(t.position.x-player.position.x,t.position.z-player.position.z)<3);if(token){token.visible=false;score++;status.textContent=`Penemuan ${score} / 5`;if(score===5)award();}else toast('Dekati objek berkilau dahulu.');}
 action.onclick=()=>{if(nearby)begin(nearby);else{player.position.set(attractions[0].x,0,attractions[0].z+13);}};
 el('park-exit').onclick=leave;el('park-build').onclick=()=>build();el('park-collect').onclick=collect;el('park-undo').onclick=()=>{if(won)return;const b=blocks.pop();if(b)mini.remove(b);status.textContent=`Binaan ${blocks.length} / 8 blok`;};
 const destination=el<HTMLSelectElement>('park-destination');for(let i=0;i<lands.length;i++){const opt=document.createElement('optgroup');opt.label=lands[i].name;for(const a of attractions.filter(a=>a.land===i)){const o=document.createElement('option');o.value=String(a.id);o.textContent=a.name;opt.append(o);}destination.append(opt);}destination.onchange=()=>{if(destination.value==='')return;leave();const a=attractions[Number(destination.value)];player.position.set(a.x,0,a.z+13);destination.value='';keys.clear();toast(`Sampai ${a.name}`);};
 const help=el<HTMLDialogElement>('park-help');el('park-guide').onclick=()=>{keys.clear();help.showModal();};el('park-help-close').onclick=()=>help.close();el('park-map-toggle').onclick=()=>el('park-map').classList.toggle('visible');
 window.addEventListener('keydown',e=>{if(help.open||e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='Escape')leave();if(e.code==='Space')build();if(e.code==='KeyE'){if(selected)collect();else action.click();}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();last=0;});
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-key]')){button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key!);};button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>keys.delete(button.dataset.key!);}
 const ray=new THREE.Raycaster();canvas.addEventListener('pointerdown',e=>{if(!selected||won||overview)return;const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  if(selected.kind==='build'){const p=new THREE.Vector3();if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-2.5),p)&&Math.abs(p.x-selected.x)<6&&Math.abs(p.z-selected.z)<5)build(p);return;}
  if(selected.kind!=='shoot'||elapsed>30)return;const hit=ray.intersectObjects(tokens.filter(t=>t.visible))[0];if(hit){hit.object.visible=false;score++;status.textContent=`Kena ${score} / 8`;if(score===8)award();}});
 const map=el('park-map').querySelector('canvas')!,ctx=map.getContext('2d')!;const mapPoint=(x:number,z:number)=>({x:(x+165)/465*440,y:(z+170)/340*340});
 function drawMap(){ctx.fillStyle='#e9eed8';ctx.fillRect(0,0,440,340);ctx.strokeStyle='#c9bda2';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(150,300);ctx.lineTo(150,70);ctx.moveTo(30,170);ctx.lineTo(420,170);ctx.stroke();lands.forEach((l,i)=>{const p=mapPoint(l.x,l.z);ctx.fillStyle=l.color;ctx.beginPath();ctx.arc(p.x,p.y,22,0,Math.PI*2);ctx.fill();ctx.fillStyle='white';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillText(String(i+1),p.x,p.y+5);});for(const a of attractions){const p=mapPoint(a.x,a.z);ctx.fillStyle=stamps.has(a.id)?'#246544':'#ffffff';ctx.fillRect(p.x-2,p.y-2,4,4);}const p=mapPoint(player.position.x,player.position.z);ctx.strokeStyle='white';ctx.lineWidth=3;ctx.fillStyle='#e33c30';ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill();ctx.stroke();}
 const focus=new THREE.Vector3(),camTarget=new THREE.Vector3();camera.position.set(0,34,184);
 function loop(time:number){frame=requestAnimationFrame(loop);const dt=last?Math.min((time-last)/1000,.05):0;last=time;if(document.hidden||help.open)return;
  if(performance.now()>toastUntil)el('park-toast').hidden=true;colors.hidden=selected?.kind!=='build';
  const manual=!selected||['drive','shoot','explore'].includes(selected.kind);
  if(manual&&!overview){const dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),dz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));const length=Math.hypot(dx,dz)||1,speed=selected?.kind==='drive'?15:keys.has('ShiftLeft')?20:11;
   const blocked=(x:number,z:number)=>obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.6&&Math.abs(z-o.z)<o.d/2+.6);
   const x=THREE.MathUtils.clamp(player.position.x+dx/length*speed*dt,-160,280);if(!blocked(x,player.position.z))player.position.x=x;
   const z=THREE.MathUtils.clamp(player.position.z+dz/length*speed*dt,-155,165);if(!blocked(player.position.x,z))player.position.z=z;
   if(dx||dz)player.rotation.y=Math.atan2(dx,dz);}
  for(const a of attractions){const car=cars.get(a.id);if(!car)continue;const active=selected?.id===a.id;if(active&&a.kind==='drive'){car.position.set(player.position.x,.25,player.position.z);car.rotation.y=player.rotation.y;continue;}const p=active?Math.min(elapsed/duration(a),1):(time/45000+a.id*.13)%1;const curve=curves.get(a.id);if(curve){car.position.copy(curve.getPoint(p));const tangent=curve.getTangent(p);car.rotation.y=Math.atan2(tangent.x,tangent.z);}else if(a.kind==='tower'){car.position.set(a.x,1+Math.sin(p*Math.PI)*23,a.z);}else{car.position.set(a.x,3,a.z);car.rotation.y=p*Math.PI*2;}}
  if(selected){elapsed+=dt;const a=selected;if(!['drive','shoot','build','explore'].includes(a.kind)){const car=cars.get(a.id)!;player.position.copy(car.position);if(a.kind==='spin'){player.position.x+=Math.sin(car.rotation.y)*7;player.position.z+=Math.cos(car.rotation.y)*7;}player.position.y+=1;player.rotation.y=car.rotation.y;if(elapsed>=duration(a)){award();player.position.set(a.x,0,a.z+13);}}
   if(a.kind==='drive'&&!won){tokens.forEach((t,i)=>{t.visible=i>=score;t.scale.setScalar(i===score?1.3:1);});const t=tokens[score];if(t&&Math.hypot(t.position.x-player.position.x,t.position.z-player.position.z)<2.5){score++;if(score===5)award();}if(!won)status.textContent=`Checkpoint ${score} / 5 · ${Math.floor(elapsed)}s`;}
   if(a.kind==='shoot'&&!won)status.textContent=elapsed>=30?'Masa tamat. Keluar dan cuba lagi.':`Sasaran ${score} / 8 · ${Math.ceil(30-elapsed)}s`;
   if(!won&&['coaster','slide','boat','tower','spin'].includes(a.kind))status.textContent=`Perjalanan · ${Math.floor(elapsed)}s`;
  }else{nearby=attractions.reduce<Attraction|undefined>((best,a)=>Math.hypot(a.x-player.position.x,a.z+12-player.position.z)<(best?Math.hypot(best.x-player.position.x,best.z+12-player.position.z):19)?a:best,undefined);if(nearby){el('park-title').textContent=nearby.name;el('park-land').textContent=lands[nearby.land].name;el('park-description').textContent=instructions[nearby.kind];action.textContent=stamps.has(nearby.id)?'Main lagi · E':'Main tarikan · E';}else{el('park-title').textContent='Jalan-jalan dalam taman';el('park-description').textContent='Cari papan tanda tarikan. Pilih destinasi pada peta untuk perjalanan pantas.';action.textContent='Pergi ke pintu masuk';}}
  focus.copy(player.position);focus.y+=1.5;if(calm.checked&&selected&&!manual){focus.set(selected.x,5,selected.z);}if(overview){const fit=Math.max(1,1.6/camera.aspect);focus.set(50,0,0);camTarget.set(50,340*fit,280*fit);}else camTarget.copy(focus).add(new THREE.Vector3(0,27*zoom,34*zoom));const fog=scene.fog as THREE.Fog;fog.near=overview?1100:180;fog.far=overview?1900:510;camera.position.lerp(camTarget,calm.checked?1:1-Math.exp(-5*dt));camera.lookAt(focus);renderer.render(scene,camera);drawMap();
 }
 if(import.meta.env.DEV)Object.defineProperty(window,'__legoland',{get:()=>({selected:selected?.id,won,score,elapsed,position:{x:player.position.x,y:player.position.y,z:player.position.z},drawCalls:renderer.info.render.calls,targets:tokens.map(t=>{const p=t.position.clone().project(camera);return{x:t.position.x,z:t.position.z,screenX:(p.x+1)*innerWidth/2,screenY:(1-p.y)*innerHeight/2,visible:t.visible};})})});
 frame=requestAnimationFrame(loop);window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);renderer.dispose();},{once:true});
}
try{start();}catch(error){console.error(error);const message=document.createElement('section');message.id='park-error';message.innerHTML='<h2>Taman belum dapat dibuka</h2><p>WebGL diperlukan. Cuba muat semula atau gunakan browser lain.</p><a href="/">Balik ke KL</a>';root.append(message);}
