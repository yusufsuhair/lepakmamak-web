import {test,expect} from '@playwright/test';
import * as THREE from 'three';
import {NIGHT_SUN,klMoon,klSunDirection,lightOffset,skyPalette} from '../src/weather';

const lum=(c:THREE.Color)=>c.r*.2126+c.g*.7152+c.b*.0722;

test('the sky follows the real KL sun and moon',()=>{
 const rise=klSunDirection(new Date('2026-09-12T23:30:00Z'));   // 07:30 MYT
 const dusk=klSunDirection(new Date('2026-09-12T10:45:00Z'));   // 18:45 MYT
 expect(rise.x).toBeGreaterThan(.9);expect(rise.y).toBeGreaterThan(0);   // east is +x
 expect(dusk.x).toBeLessThan(-.9);expect(dusk.y).toBeGreaterThan(0);
 expect(klSunDirection(new Date('2026-09-12T05:10:00Z')).y).toBeGreaterThan(.99);   // near-overhead KL noon
 const when=new Date('2026-09-26T16:49:00Z'),full=klMoon(when);   // the September 2026 full moon
 expect(full.lit).toBeGreaterThan(.99);
 expect(full.direction.dot(klSunDirection(when))).toBeLessThan(-.95);
 // A horizon sun would smear the one shadow map across the city; noon overhead would flatten facades.
 const low=lightOffset(new THREE.Vector3(-1,.01,0).normalize()),high=lightOffset(new THREE.Vector3(0,1,.001).normalize());
 expect(low.x).toBeLessThan(0);expect(low.y/low.length()).toBeCloseTo(Math.sin(18*Math.PI/180),5);
 expect(high.y/high.length()).toBeCloseTo(Math.sin(70*Math.PI/180),5);
});

test('one palette: dark starry night, warm sunset, weather flattens and closes in',()=>{
 const at=(time:string,condition='sunny')=>skyPalette(klSunDirection(new Date(time)),condition);
 const noon=at('2026-09-12T05:00:00Z'),sunset=at('2026-09-12T11:05:00Z'),night=at('2026-09-12T14:00:00Z');
 expect(lum(night.zenith)).toBeLessThan(lum(noon.zenith)*.1);
 expect(night.stars).toBe(1);expect(noon.stars).toBe(0);
 expect(night.lightIntensity).toBe(NIGHT_SUN);
 expect(sunset.glow.r).toBeGreaterThan(sunset.glow.b*3);
 expect(sunset.lightIntensity).toBeLessThan(noon.lightIntensity);
 const clear=at('2026-09-12T08:00:00Z'),rain=at('2026-09-12T08:00:00Z','rain'),haze=at('2026-09-12T08:00:00Z','haze');
 expect(lum(rain.horizon)).toBeLessThan(lum(clear.horizon));
 expect(rain.sunDisc).toBe(0);expect(rain.fogFar).toBeLessThan(clear.fogFar);
 expect(haze.clouds).toBe(0);expect(haze.fogFar).toBeLessThan(rain.fogFar);
 // Fog must hide the far clip (camera far is 600) so distant geometry melts into the horizon.
 for(const p of [noon,rain,haze])expect(p.fogFar).toBeLessThan(600);
});

// beach.ts tints the sea from scene.background as a THREE.Color, and every material fogs toward
// scene.fog: both have to be the colour the sky dome draws at its horizon.
test('background stays a Color equal to the fog and the dome horizon, and the light follows the clock',async({page})=>{
 await page.route('**/sky-harness',r=>r.fulfill({contentType:'text/html',body:'<label><input id="rain-toggle" type="checkbox"></label><p id="weather-label"></p>'}));
 await page.route('**/weather',r=>r.fulfill({json:{available:false}}));
 await page.clock.install({time:'2026-09-12T05:00:00Z'});
 await page.goto('/sky-harness');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js' as string);
  const {setupWeather}=await import('/src/weather.ts' as string);const {createClouds}=await import('/src/clouds.ts' as string);
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,1,100);
  const sun=new THREE.DirectionalLight(),ambient=new THREE.HemisphereLight(),clouds=createClouds(scene);
  let night:boolean|null=null;
  const weather=setupWeather(scene,sun,ambient,'',()=>{},()=>true,(value:boolean)=>{night=value;},(value:unknown)=>clouds.setWeather(value));
  const read=(time:string,condition='sunny')=>{weather.preview({condition,time});return {isColor:scene.background.isColor===true,
   background:`#${scene.background.getHexString()}`,fog:`#${scene.fog.color.getHexString()}`,dome:clouds.status.horizon,
   offset:weather.sunOffset.toArray(),intensity:sun.intensity,night,stars:clouds.status.stars};};
  return {morning:read('08:00'),noon:read('13:00'),golden:read('18:30'),night:read('21:00'),rain:read('16:00','rain')};
 });
 for(const state of Object.values(result)){expect(state.isColor).toBe(true);expect(state.background).toBe(state.fog);expect(state.dome).toBe(state.fog);}
 expect(result.morning.offset[0]).toBeGreaterThan(0);expect(result.golden.offset[0]).toBeLessThan(0);
 expect(result.noon.night).toBe(false);expect(result.night.night).toBe(true);expect(result.night.stars).toBe(1);
 expect(result.golden.intensity).toBeLessThan(result.noon.intensity);
 expect(parseInt(result.night.background.slice(1),16)).not.toBe(parseInt(result.noon.background.slice(1),16));
 expect(result.rain.background).not.toBe(result.noon.background);
});

// klcc.ts and skyline.ts reflect one shared probe painted from this palette. three caches a PMREM per
// texture, so a visible change must hand out a new texture (and dispose the old); an unchanged sky,
// like the 30 s clock tick, must not.
test('the glass reflection probe follows the sky and repaints only when it visibly changes',async({page})=>{
 await page.route('**/probe-harness',r=>r.fulfill({contentType:'text/html',body:'<label><input id="rain-toggle" type="checkbox"></label><p id="weather-label"></p>'}));
 await page.route('**/weather',r=>r.fulfill({json:{available:false}}));
 await page.clock.install({time:'2026-09-12T05:00:00Z'});
 await page.goto('/probe-harness');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js' as string);
  const W=await import('/src/weather.ts' as string);
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,1,100);
  const weather=W.setupWeather(scene,new THREE.DirectionalLight(),new THREE.HemisphereLight(),'',()=>{},()=>true);
  let probe:any=null,handed=0,skies=0;const disposed=new Set<string>();
  W.onSkyProbe((t:any)=>{probe=t;handed++;t.addEventListener('dispose',()=>disposed.add(t.uuid));});
  W.onSkyChange(()=>skies++);
  // Mean sRGB of a row of the equirect (row 0 is straight up); the horizon row is the middle.
  const row=(y:number)=>{const d=probe.image.getContext('2d').getImageData(0,y,256,1).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}return [r,g,b].map(v=>v/256);};
  const look=(condition:string,time:string)=>{weather.preview({condition,time});return {uuid:probe.uuid,zenith:row(2),horizon:row(62),handed,skies,horizonColour:`#${W.skyState().horizon.getHexString()}`};};
  const noon=look('sunny','13:00'),again=look('sunny','13:00'),minute=look('sunny','13:01'),night=look('sunny','21:00'),rain=look('rain','13:00');
  return {noon,again,minute,night,rain,disposed:[...disposed],fog:`#${scene.fog.color.getHexString()}`};
 });
 const lum=([r,g,b]:number[])=>r*.2126+g*.7152+b*.0722;
 expect(result.again.uuid).toBe(result.noon.uuid);expect(result.minute.uuid).toBe(result.noon.uuid);   // no repaint for a tick
 expect(result.again.skies).toBe(result.noon.skies);
 expect(result.night.uuid).not.toBe(result.noon.uuid);expect(result.disposed).toContain(result.noon.uuid);
 expect(lum(result.night.zenith)).toBeLessThan(lum(result.noon.zenith)*.25);
 expect(lum(result.rain.horizon)).toBeLessThan(lum(result.noon.horizon));
 expect(result.rain.horizonColour).toBe(result.fog);   // the probe's sky is the one the fog and dome use
});

test('the running game lights its sky from the KL clock',async({page})=>{
 const now=Date.parse('2026-09-12T10:30:00Z');   // 18:30 MYT, golden hour
 await page.clock.install({time:now});
 await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'sunny',observedAt:now,serverTime:now,source:'Sky test'}}));
 await page.goto('/');
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepakClouds?.sun?.[0])).toBeLessThan(-.9);
 const sky=await page.evaluate(()=>(window as any).__lepakClouds);
 expect(sky.sun[1]).toBeGreaterThan(0);expect(sky.weather.night).toBe(false);expect(sky.stars).toBe(0);expect(sky.drawCalls).toBe(1);
});
