import * as THREE from 'three';
import tables from '../shared/tables.json';
import tabletop from '../shared/mamak-tabletop.json';

/** Hot-drink state cue: a single lightweight draw, no per-frame allocations. */
export function createMamakSteam(scene: THREE.Scene) {
  const points:number[]=[];
  for(const table of tables.filter(t=>['meja-1','meja-2','meja-3','meja-4','meja-9'].includes(t.id))) {
    const yaw=tabletop.rotations[table.id as keyof typeof tabletop.rotations];
    for(const [dx,dz] of tabletop.cups) for(let i=0;i<3;i++)
      points.push(table.x+dx*Math.cos(yaw)+dz*Math.sin(yaw),tabletop.steamHeight,table.z-dx*Math.sin(yaw)+dz*Math.cos(yaw));
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('phase',new THREE.Float32BufferAttribute(points.filter((_,i)=>i%3===0).map((_,i)=>(i%3)/3),1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{time:{value:0}},
    vertexShader:`attribute float phase; uniform float time; varying float alpha;
      void main(){float life=fract(time*.35+phase);vec3 p=position;
      p.y+=life*.55;p.x+=sin(life*6.2831+phase)*.035;
      vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
      gl_PointSize=clamp(90./max(1.,-view.z),1.,12.);alpha=sin(life*3.14159)*.17;}`,
    fragmentShader:`varying float alpha;void main(){float d=length(gl_PointCoord-vec2(.5));
      gl_FragColor=vec4(.93,.94,.92,alpha*(1.-smoothstep(.1,.5,d)));}`});
  const steam=new THREE.Points(geometry,material);steam.name='LM_Mamak_TeaSteam';
  geometry.computeBoundingSphere();if(geometry.boundingSphere)geometry.boundingSphere.radius+=.6;
  steam.visible=false;scene.add(steam);
  const setLayout=(layout:'realism'|'baseline'|'procedural')=>{
    const positions=geometry.getAttribute('position') as THREE.BufferAttribute;let index=0;
    for(const table of tables.filter(t=>['meja-1','meja-2','meja-3','meja-4','meja-9'].includes(t.id))){
      const yaw=layout==='baseline'?tabletop.rotations[table.id as keyof typeof tabletop.rotations]:0;
      const cups=layout==='realism'?tabletop.realism.cups:layout==='baseline'?tabletop.cups:[[.38,.12],[-.40,-.20]];
      for(const [dx,dz] of cups)for(let i=0;i<3;i++)positions.setXYZ(index++,table.x+dx*Math.cos(yaw)+dz*Math.sin(yaw),layout==='realism'?tabletop.realism.steamHeight:1.46,table.z-dx*Math.sin(yaw)+dz*Math.cos(yaw));
    }
    positions.needsUpdate=true;geometry.computeBoundingSphere();if(geometry.boundingSphere)geometry.boundingSphere.radius+=.6;
    steam.userData.layout=layout;
  };
  return {setLayout,update(time:number,enabled:boolean){steam.visible=enabled;if(enabled)material.uniforms.time.value=time;},
    get visible(){return steam.visible;},count:points.length/3};
}
