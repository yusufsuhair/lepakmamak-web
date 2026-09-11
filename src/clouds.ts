import * as THREE from 'three';

export interface CloudWeather {condition:string; night:boolean; twilight?:number}

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

const fragmentShader=`
uniform sampler2D uNoise;
uniform vec3 uZenith, uHorizon, uCloudLight, uCloudShadow;
uniform float uTime, uCoverage, uClouds, uTwilight, uDetail;
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
void main() {
  vec3 d=normalize(vSkyDirection);
  float elevation=max(d.y,0.0);
  vec3 sky=mix(uHorizon,uZenith,pow(smoothstep(-0.08,0.9,d.y),0.62));
  // Planar layers projected onto a continuous sky direction: no azimuth seam.
  vec2 p=d.xz/(elevation+0.22)*2.7;
  vec2 wind=vec2(uTime*0.055,uTime*0.018);
  vec2 warp=vec2(noise(p*0.46+wind*0.45),noise(p*0.51+17.1-wind*0.3));
  float body=field(p+warp*1.65+wind);
  float density=smoothstep(uCoverage,uCoverage+0.22,body);
  float horizonFade=smoothstep(-0.005,0.10,d.y);
  float thin=0.0;
  if(uDetail>0.5) thin=smoothstep(0.50,0.74,field(p*1.8-wind*0.55+31.4))*0.22;
  float alpha=clamp(density*0.88+thin,0.0,0.94)*horizonFade*uClouds;
  vec3 cloud=mix(uCloudShadow,uCloudLight,smoothstep(uCoverage+0.025,uCoverage+0.30,body));
  float west=pow(max(dot(d,normalize(vec3(-0.85,0.08,0.52))),0.0),5.0);
  sky+=vec3(0.16,0.052,0.018)*west*uTwilight*(1.0-elevation);
  gl_FragColor=vec4(mix(sky,cloud,alpha),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Atmospheric sky: one dome, a tiny noise lookup, no live volumetric ray marching. */
export function createClouds(scene:THREE.Scene) {
  const texture=noiseTexture();
  const uniforms={uNoise:{value:texture},uTime:{value:0},uCoverage:{value:.43},
    uClouds:{value:1},uTwilight:{value:0},uDetail:{value:1},
    uZenith:{value:new THREE.Color()},uHorizon:{value:new THREE.Color()},
    uCloudLight:{value:new THREE.Color()},uCloudShadow:{value:new THREE.Color()}};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,
    side:THREE.BackSide,depthWrite:false,depthTest:true,toneMapped:true});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(10,32,16),material);
  dome.name='LM_SKY_Atmosphere';dome.frustumCulled=false;dome.renderOrder=1000;
  scene.add(dome);
  let weather:CloudWeather={condition:'sunny',night:false,twilight:0},smooth=false;
  function setWeather(value:CloudWeather) {
    weather={...value,twilight:THREE.MathUtils.clamp(value.twilight??0,0,1)};
    const mist=value.condition==='fog'||value.condition==='haze',wet=value.condition==='rain';
    const overcast=wet||value.condition==='cloudy';
    const dusk=mist||wet?0:weather.twilight!;
    uniforms.uClouds.value=mist?0:1;uniforms.uCoverage.value=overcast?.34:.43;
    uniforms.uTwilight.value=dusk;
    uniforms.uZenith.value.set(value.night?'#111b30':mist?'#aab2b5':overcast?'#657e94':'#4d8bb7').lerp(new THREE.Color('#41475f'),dusk);
    uniforms.uHorizon.value.set(value.night?'#26384e':mist?'#b7ada0':overcast?'#b2bdc4':'#c6dbe3').lerp(new THREE.Color('#c29a87'),dusk);
    uniforms.uCloudLight.value.set(value.night?'#53627a':wet?'#a5b3be':'#f6f1e8').lerp(new THREE.Color('#c5b4bc'),dusk);
    uniforms.uCloudShadow.value.set(value.night?'#253149':wet?'#647582':'#879eae').lerp(new THREE.Color('#646078'),dusk);
    // Horizon and distance fog share a palette; the dome replaces only the old sky.
    if(scene.background instanceof THREE.Color) scene.background.copy(uniforms.uHorizon.value);
    if(scene.fog instanceof THREE.Fog) scene.fog.color.copy(uniforms.uHorizon.value);
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
    get status(){return {state:'ready',mode:'procedural-sky-v2',visible:uniforms.uClouds.value>0,
      drawCalls:1,rotation:uniforms.uTime.value,quality:smooth?'smooth':'detailed',
      layers:smooth?1:2,noiseSize:128,weather:{...weather}};},
  };
}
