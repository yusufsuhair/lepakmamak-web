import * as THREE from 'three';
import stalls from '../shared/stalls.json';
import {createPerson} from './world';
import type {Solid} from './physics';
export function createStallWorld(scene:THREE.Scene,solids:Solid[]){
 for(const stall of stalls){
  const g=new THREE.Group();g.position.set(stall.x,0,stall.z);scene.add(g);
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
  const seller=createPerson(stall.id==='air-balang'?'#f3e7c3':'#7e608d');seller.group.position.set(0,.12,-1.4);g.add(seller.group);
  box(2.2,.4,-.3,.7,.8,.7,'#394e41');solids.push({x:stall.x,z:stall.z,hx:2,hz:.8},{x:stall.x,z:stall.z-1.4,hx:.4,hz:.4});
 }
}
export function setupStalls(hud:HTMLElement,send:(m:object)=>boolean,release:()=>void){
 const dialog=document.createElement('dialog');dialog.id='street-stall';dialog.innerHTML='<h2 id="stall-title"></h2><p>Pilih yang berkenan, boss. Percuma untuk lepak!</p><div id="stall-menu"></div><p id="stall-status" role="status"></p><button id="stall-close">Tutup</button>';document.body.append(dialog);
 const bag=document.createElement('button');bag.id='street-snack';bag.hidden=true;hud.querySelector('.brand-status')!.append(bag);
 let snack:string|null=null,selected=stalls[0],connected=false;
 function render(){dialog.querySelector('h2')!.textContent=selected.name;const menu=dialog.querySelector('#stall-menu')!;menu.replaceChildren();for(const item of selected.items){const b=document.createElement('button');b.textContent=item.name;b.disabled=!!snack||!connected;b.onclick=()=>{send({type:'stall-order',stallId:selected.id,itemId:item.id});};menu.append(b);}dialog.querySelector('#stall-status')!.textContent=snack?'Pesanan dah siap! Tekan butang makan/minum di bawah logo.':connected?'Ambil satu dahulu. Lepas habis boleh pesan lagi.':'Sambung ke bandar dahulu.';}
 bag.onclick=()=>{send({type:'stall-consume'});};dialog.querySelector('#stall-close')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('keydown',e=>e.stopPropagation());
 const labels=stalls.map(stall=>{const button=document.createElement('button');button.className='table-label';button.hidden=true;button.textContent='Pesan · '+stall.name;hud.append(button);button.onclick=()=>{selected=stall;release();dialog.showModal();render();};return {stall,button};});
 return {get opened(){return dialog.open;},close(){dialog.close();},state(value:string|null,online:boolean){if(snack===value&&connected===online)return;snack=value;connected=online;const item=stalls.flatMap(s=>s.items).find(i=>i.id===snack);bag.hidden=!item||!online;bag.textContent=item?`${item.kind==='drink'?'Minum':'Makan'} · ${item.name}`:'';if(dialog.open)render();},update(pos:{x:number;z:number},camera:THREE.Camera,enabled:boolean){if(dialog.open&&(!enabled||Math.hypot(pos.x-selected.x,pos.z-selected.z)>5))dialog.close();for(const {stall,button} of labels){button.hidden=!enabled||dialog.open||Math.hypot(pos.x-stall.x,pos.z-stall.z)>5;if(!button.hidden){const p=new THREE.Vector3(stall.x,3.8,stall.z).project(camera);button.hidden=p.z< -1||p.z>1||Math.abs(p.x)>.85||Math.abs(p.y)>.9;button.style.left=`${(p.x+1)*innerWidth/2}px`;button.style.top=`${(1-p.y)*innerHeight/2}px`;}}}};
}
