import * as THREE from 'three';
import type {WebAssetState} from './web-assets';

export interface CloudWeather {condition: string; night: boolean}

/** Cycles-rendered cloud cards: soft volume appearance without runtime ray marching. */
export function createClouds(scene: THREE.Scene) {
  const group=new THREE.Group();group.name='LM_SKY_CloudLayer';scene.add(group);
  let state:WebAssetState='loading', weather:CloudWeather={condition:'sunny',night:false},rotation=0;
  let instances:THREE.InstancedMesh|null=null;
  let material:THREE.MeshBasicMaterial|null=null;
  const placements=Array.from({length:12},(_,i)=>({angle:i*2.399963229728653,
    height:110+(i%4)*40,width:140+(i%3)*28}));
  const transform=new THREE.Object3D();
  const ready=new THREE.TextureLoader().loadAsync('/assets/models/environment/LM_SKY_Cumulus.png?v=clouds-v1')
    .then(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,fog:false});
      // Treat cards as background depth even when a landmark is farther than the ring.
      material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace(
        '#include <project_vertex>','#include <project_vertex>\n gl_Position.z = gl_Position.w * 0.99999;');};
      material.customProgramCacheKey=()=> 'lm-cloud-background-v1';
      instances=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,.5),material,placements.length);
      instances.name='LM_SKY_CumulusCards';instances.renderOrder=-1000;instances.frustumCulled=false;
      instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Never write depth: the city must occlude even these distant cloud cards.
      group.add(instances);state='ready';applyWeather();
    }).catch(error=>{state='fallback';console.warn('[clouds] Cloud atlas unavailable; keeping clear sky',error);});
  function applyWeather() {
    group.visible=weather.condition!=='fog' && weather.condition!=='haze';
    if(material) material.color.set(weather.night?'#536078':weather.condition==='rain'?'#91a2ae':weather.condition==='cloudy'?'#d7e0e2':'#fff4e6');
  }
  return {
    ready,
    setWeather(value:CloudWeather){weather=value;applyWeather();},
    update(elapsed:number,camera:THREE.Camera,reducedMotion:boolean,smooth:boolean){
      group.position.copy(camera.position);rotation=reducedMotion?0:elapsed*.0007;
      if(!instances) return;
      instances.count=smooth?6:weather.condition==='sunny'?9:12;
      for(let i=0;i<instances.count;i++) {
        const p=placements[i],angle=p.angle+rotation;
        transform.position.set(Math.sin(angle)*430,p.height,Math.cos(angle)*430);
        transform.quaternion.copy(camera.quaternion);transform.scale.set(p.width,p.width*(.75+.2*(i%3)),1);
        transform.updateMatrix();instances.setMatrixAt(i,transform.matrix);
      }
      instances.instanceMatrix.needsUpdate=true;
    },
    get status(){return {state,visible:group.visible,instances:instances?.count??0,
      drawCalls:instances&&group.visible?1:0,rotation,weather:{...weather}};},
  };
}
