import * as THREE from 'three';
import {GM_DAY_SUN,GM_NIGHT_SUN,skyPalette,type SkyPalette} from './weather';

export interface CloudWeather {condition:string; night:boolean; twilight?:number; sky?:SkyPalette}

// Repeatable value-noise lookup, generated once. No image download or cloud silhouettes.
function noiseTexture() {
  const pixels=new Uint8Array(128*128*4);
  let seed=170911;
  for(let i=0;i<pixels.length;i+=4) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    pixels[i]=pixels[i+1]=pixels[i+2]=seed>>>24;pixels[i+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,128,128,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.colorSpace=THREE.NoColorSpace;texture.generateMipmaps=false;texture.needsUpdate=true;
  return texture;
}

const vertexShader=`
varying vec3 vSkyDirection;
void main() {
  vSkyDirection=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  gl_Position.z=gl_Position.w*0.99999;
}`;

// Colours arrive display-referred and skip tone mapping, so the horizon here is exactly the fog and
// background colour the city's materials fade into.
const fragmentShader=`
uniform sampler2D uNoise;
uniform vec3 uZenith, uHorizon, uGlow, uCloudLight, uCloudShadow, uSun, uSunColor, uMoon;
uniform float uTime, uCoverage, uClouds, uDetail, uSunDisc, uStars, uMoonLit, uMoonGlow;
varying vec3 vSkyDirection;
float noise(vec2 p) {
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return texture2D(uNoise,(i+f+0.5)/128.0).r;
}
float field(vec2 p) {
  float n=noise(p)*0.52;
  p=mat2(1.62,1.17,-1.17,1.62)*p+7.3;
  n+=noise(p)*0.26;
  p=mat2(1.62,1.17,-1.17,1.62)*p+11.9;
  n+=noise(p)*0.13;
  if(uDetail>0.5) {
    p=mat2(1.62,1.17,-1.17,1.62)*p+4.1;n+=noise(p)*0.065;
    p=mat2(1.62,1.17,-1.17,1.62)*p+9.2;n+=noise(p)*0.025;
  } else {n+=0.045;}
  return n;
}
float hash(vec3 p) {p=fract(p*vec3(0.1031,0.1030,0.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
void main() {
  vec3 d=normalize(vSkyDirection);
  float elevation=max(d.y,0.0);
  float cosSun=dot(d,uSun), sunLit=max(cosSun,0.0);
  float facing=dot(normalize(d.xz+vec2(1e-5)),normalize(uSun.xz+vec2(1e-5)))*0.5+0.5;
  // Humid horizon: a thick milky band, warming under the sun's azimuth.
  vec3 horizon=mix(uHorizon,uGlow,pow(facing,2.5)*smoothstep(-0.03,0.02,d.y));
  vec3 sky=mix(horizon,uZenith,pow(smoothstep(-0.02,0.85,d.y),0.48));
  // Forward scattering: a broad aureole in the glow colour, then a tight bright halo.
  sky=mix(sky,uGlow,pow(sunLit,5.0)*0.5*smoothstep(-0.15,0.0,uSun.y));
  vec3 sunLight=min(uSunColor*1.7,vec3(1.0));
  // Around sunset the horizon right under the sun burns yellow-orange before it fades to pink and blue.
  float core=pow(facing,12.0)*exp(-elevation*14.0)*smoothstep(-0.12,-0.01,uSun.y)*(1.0-smoothstep(0.05,0.25,uSun.y));
  sky=mix(sky,sunLight,core*0.55*uSunDisc*smoothstep(-0.03,0.01,d.y));
  sky+=sunLight*(pow(sunLit,64.0)*0.22+pow(sunLit,700.0)*0.5)*uSunDisc*smoothstep(-0.04,0.02,d.y);
  // Earth's shadow and the pink Belt of Venus rise opposite the sun through sunset and blue hour.
  float belt=smoothstep(-0.14,-0.02,uSun.y)*(1.0-smoothstep(0.02,0.1,uSun.y))*pow(1.0-facing,1.5)*uSunDisc;
  sky=mix(sky,sky*vec3(0.74,0.78,0.95),belt*0.55*(1.0-smoothstep(0.0,0.09,d.y)));
  sky+=vec3(0.13,0.05,0.08)*belt*exp(-pow((d.y-0.13)/0.07,2.0));
  sky=mix(sky,sunLight,smoothstep(0.99988,0.99993,cosSun)*uSunDisc*smoothstep(-0.004,0.006,d.y));
  // A few bright stars: KL's own light washes out the rest, and the horizon most of all.
  if(uStars>0.001) {
    vec3 cells=d*260.0, cell=floor(cells);
    float h=hash(cell);
    if(h>0.9962) {
      vec3 centre=cell+0.5+(vec3(hash(cell+1.7),hash(cell+4.1),hash(cell+9.3))-0.5)*0.5;
      float twinkle=0.75+0.25*sin(uTime*25.0+h*400.0);
      sky+=vec3(0.86,0.9,1.0)*smoothstep(0.45,0.0,length(cells-centre))*(h-0.9962)/0.0038*uStars*twinkle*smoothstep(0.1,0.45,d.y);
    }
  }
  // Planar cloud layers projected onto a continuous sky direction: no azimuth seam.
  vec2 p=d.xz/(elevation+0.22)*2.7;
  vec2 wind=vec2(uTime*0.055,uTime*0.018);
  vec2 warp=vec2(noise(p*0.46+wind*0.45),noise(p*0.51+17.1-wind*0.3));
  float body=field(p+warp*1.65+wind);
  float density=smoothstep(uCoverage,uCoverage+0.22,body);
  float horizonFade=smoothstep(-0.005,0.10,d.y);
  float thin=0.0;
  if(uDetail>0.5) thin=smoothstep(0.50,0.74,field(p*1.8-wind*0.55+31.4))*0.22;
  float alpha=clamp(density*0.88+thin,0.0,0.94)*horizonFade*uClouds;
  float shade=smoothstep(uCoverage+0.025,uCoverage+0.30,body);
  vec3 cloud=mix(uCloudShadow,uCloudLight,shade);
  // Silver edges toward the sun, and the underglow that lights cloud bases after it sets.
  cloud+=uGlow*pow(sunLit,4.0)*(1.0-shade*0.5)*0.4*smoothstep(-0.2,0.05,uSun.y)*uSunDisc;
  cloud=mix(cloud,horizon,pow(1.0-elevation,5.0)*0.6);
  sky=mix(sky,cloud,alpha);
  // The moon: a small disc lit on its sunward side (dim earthshine elsewhere) and a soft glow that
  // still carries through thin cloud.
  if(uMoonGlow>0.001) {
    float cosMoon=dot(d,uMoon);
    vec3 toward=uSun-uMoon*dot(uSun,uMoon);toward=length(toward)>1e-3?normalize(toward):vec3(0.0,1.0,0.0);
    vec3 offset=(d-uMoon*cosMoon)/0.0078;
    vec2 q=vec2(dot(offset,toward),dot(offset,cross(uMoon,toward)));
    float disc=(1.0-smoothstep(0.8,1.0,length(q)))*step(0.0,cosMoon);
    float lit=smoothstep(-0.1,0.1,q.x-(1.0-2.0*uMoonLit)*sqrt(max(1.0-q.y*q.y,0.0)));
    sky+=vec3(0.5,0.56,0.68)*(pow(max(cosMoon,0.0),1200.0)*0.35+pow(max(cosMoon,0.0),60.0)*0.07)*uMoonGlow*uMoonLit*(1.0-alpha*0.4);
    sky=mix(sky,vec3(0.93,0.91,0.84),disc*mix(0.05,1.0,lit)*uMoonGlow*(1.0-alpha*0.75));
  }
  gl_FragColor=vec4(sky,1.0);
  #include <colorspace_fragment>
  // Break up 8-bit banding in the long night and dusk gradients.
  gl_FragColor.rgb+=(hash(vec3(gl_FragCoord.xy,uTime))-0.5)/255.0;
}`;

/** Photographic sky: one dome following the real KL sun and moon, a tiny noise lookup, no ray marching. */
export function createClouds(scene:THREE.Scene) {
  const texture=noiseTexture();
  const color=()=>({value:new THREE.Color()}),vector=()=>({value:new THREE.Vector3(0,1,0)});
  const uniforms={uNoise:{value:texture},uTime:{value:0},uCoverage:{value:.43},uClouds:{value:1},uDetail:{value:1},
    uSunDisc:{value:1},uStars:{value:0},uMoonLit:{value:0},uMoonGlow:{value:0},
    uZenith:color(),uHorizon:color(),uGlow:color(),uCloudLight:color(),uCloudShadow:color(),uSunColor:color(),uSun:vector(),uMoon:vector()};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,
    side:THREE.BackSide,depthWrite:false,depthTest:true,toneMapped:false});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(10,32,16),material);
  dome.name='LM_SKY_Atmosphere';dome.frustumCulled=false;dome.renderOrder=1000;
  scene.add(dome);
  let weather:CloudWeather={condition:'sunny',night:false,twilight:0},smooth=false;
  function setWeather(value:CloudWeather) {
    weather={condition:value.condition,night:value.night,twilight:THREE.MathUtils.clamp(value.twilight??0,0,1)};
    const sky=value.sky??skyPalette(value.night?GM_NIGHT_SUN:GM_DAY_SUN,value.condition);
    uniforms.uZenith.value.copy(sky.zenith);uniforms.uHorizon.value.copy(sky.horizon);uniforms.uGlow.value.copy(sky.glow);
    uniforms.uCloudLight.value.copy(sky.cloudLight);uniforms.uCloudShadow.value.copy(sky.cloudShadow);uniforms.uSunColor.value.copy(sky.light);
    uniforms.uSun.value.copy(sky.sun);uniforms.uMoon.value.copy(sky.moon);
    uniforms.uClouds.value=sky.clouds;uniforms.uCoverage.value=sky.coverage;uniforms.uSunDisc.value=sky.sunDisc;
    uniforms.uStars.value=sky.stars;uniforms.uMoonLit.value=sky.moonLit;uniforms.uMoonGlow.value=sky.moonGlow;
  }
  setWeather(weather);
  return {
    ready:Promise.resolve(),setWeather,
    update(elapsed:number,camera:THREE.Camera,reducedMotion:boolean,reducedQuality:boolean) {
      dome.position.copy(camera.position);smooth=reducedQuality;
      uniforms.uTime.value=reducedMotion?0:elapsed*.12;
      uniforms.uDetail.value=smooth?0:1;
    },
    dispose(){scene.remove(dome);dome.geometry.dispose();material.dispose();texture.dispose();},
    get status(){return {state:'ready',mode:'photographic-sky-v3',visible:uniforms.uClouds.value>0,
      drawCalls:1,rotation:uniforms.uTime.value,quality:smooth?'smooth':'detailed',
      layers:smooth?1:2,noiseSize:128,weather:{...weather},
      sun:uniforms.uSun.value.toArray(),stars:uniforms.uStars.value,horizon:`#${uniforms.uHorizon.value.getHexString()}`};},
  };
}
