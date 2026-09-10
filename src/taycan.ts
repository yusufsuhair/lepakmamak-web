import * as THREE from 'three';

// Authored from Yusuf's Frozen Berry reference: long low bonnet, rounded shoulders,
// four-point lamps, black air curtains, glass roof and a full-width rear light bar.
export const frozenBerry='#c6a1b2';
export function createTaycan(){
 const group=new THREE.Group(),wheels:THREE.Group[]=[];
 group.userData.model='taycan';group.userData.displayName='Porsche Taycan · Frozen Berry';
 const paint=new THREE.MeshPhysicalMaterial({color:frozenBerry,metalness:.48,roughness:.28,clearcoat:1,clearcoatRoughness:.17});
 const glass=new THREE.MeshPhysicalMaterial({color:'#24343e',metalness:.28,roughness:.16,clearcoat:1});
 const black=new THREE.MeshStandardMaterial({color:'#172124',roughness:.48});
 const rim=new THREE.MeshStandardMaterial({color:'#797b80',metalness:.8,roughness:.26});
 const white=new THREE.MeshStandardMaterial({color:'#edffff',emissive:'#bddfff',emissiveIntensity:.8});
 const red=new THREE.MeshStandardMaterial({color:'#e23553',emissive:'#da1636',emissiveIntensity:.6});
 function block(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,parent:THREE.Object3D=group){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 // Rounded cross-sections joined along the length, rather than a box-shaped sedan.
 function shell(rows:number[][],mat:THREE.Material){
  const vertices:number[]=[],indices:number[]=[],segments=16;
  for(const [z,width,bottom,top] of rows)for(let i=0;i<segments;i++){
   const a=i/segments*Math.PI*2;
   const sx=Math.sin(a),cy=Math.cos(a);
   vertices.push(Math.sign(sx)*Math.pow(Math.abs(sx),.65)*width,(bottom+top)/2+Math.sign(cy)*Math.pow(Math.abs(cy),.65)*(top-bottom)/2,z);
  }
  for(let r=0;r<rows.length-1;r++)for(let i=0;i<segments;i++){
   const a=r*segments+i,b=r*segments+(i+1)%segments,c=b+segments,d=a+segments;indices.push(a,d,b,b,d,c);
  }
  for(const r of [0,rows.length-1]){
   const center=vertices.length/3;const [z,,bottom,top]=rows[r];vertices.push(0,(bottom+top)/2,z);
   for(let i=0;i<segments;i++){const a=r*segments+i,b=r*segments+(i+1)%segments;indices.push(center,...(r===0?[a,b]:[b,a]));}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
 }
 shell([[-2.2,.76,.42,.87],[-2.05,.93,.36,.98],[-1.5,1.02,.36,1.08],[-.7,.97,.35,1.06],[.5,.97,.35,1.03],[1.4,1.02,.36,1.03],[1.95,.93,.4,.84],[2.2,.76,.45,.76]],paint);
 shell([[-1.6,.64,.98,1.03],[-1.03,.77,.99,1.42],[-.65,.75,1.01,1.56],[.05,.71,1.01,1.57],[.45,.69,1.01,1.48],[.95,.71,.97,1.04]],glass);
 // Flush details follow the low shell; no SUV roof bars or oversized rear wing.
 for(const side of [-1,1]){
  block(side*.84,1.1,.61,.22,.09,.23,paint);
  block(side*.91,.43,0,.07,.09,2.7,black);
  for(const z of [-.68,.35])block(side*.97,.88,z,.025,.035,.2,paint);
  const lamp=block(side*.72,.82,1.86,.4,.045,.23,black);lamp.rotation.y=side*.22;
  for(const x of [-.105,.105])for(const z of [-.06,.06])block(side*.72+x,.85,1.86+z,.085,.014,.033,white);
  const curtain=block(side*.8,.65,2.02,.09,.26,.035,black);curtain.rotation.z=-side*.2;
  for(const z of [-1.4,1.38]){
   const axle=new THREE.Group();axle.position.set(side*.96,.43,z);group.add(axle);wheels.push(axle);
   const tire=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.24,24),black);tire.rotation.z=Math.PI/2;axle.add(tire);
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(.325,.325,.025,24),black);hub.rotation.z=Math.PI/2;hub.position.x=side*.135;axle.add(hub);
   const lip=new THREE.Mesh(new THREE.TorusGeometry(.322,.012,5,24),rim);lip.rotation.y=Math.PI/2;lip.position.x=side*.155;axle.add(lip);
   for(let i=0;i<10;i++){
    const a=i*Math.PI/5;const spoke=block(side*.158,Math.sin(a)*.17,Math.cos(a)*.17,.025,.022,.28,rim,axle);spoke.rotation.x=-a;
   }
   block(side*.17,0,0,.025,.095,.095,rim,axle);
  }
 }
 block(0,.43,2.1,1.6,.06,.16,black);
 block(0,.57,2.15,1.05,.16,.08,black);
 block(0,.82,-2.16,1.5,.035,.035,red);
 block(0,.43,-2.13,1.55,.16,.1,black);
 const badge=new THREE.Mesh(new THREE.CircleGeometry(.045,5),new THREE.MeshStandardMaterial({color:'#bfaa5a',metalness:.55,roughness:.35}));badge.rotation.x=-Math.PI/2;badge.position.set(0,.873,1.8);group.add(badge);
 function plate(text:string,z:number,y:number,flip=false){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#eeedf0';ctx.fillRect(0,0,512,128);ctx.fillStyle='#24303b';ctx.font='italic 70px serif';ctx.textAlign='center';ctx.fillText(text,256,87);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.66,.165),new THREE.MeshBasicMaterial({map:texture}));mesh.position.set(0,y,z);mesh.rotation.y=flip?Math.PI:0;group.add(mesh);
 }
 plate('Taycan',2.22,.67);plate('Taycan',-2.21,.67,true);
 return{group,wheels};
}
