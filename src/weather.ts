import * as THREE from 'three';
import type {CloudWeather} from './clouds';
// Night used to sit at .22 / .7, which read as pitch black once the lamps went in.
export const NIGHT_SUN = .34, NIGHT_AMBIENT = 1.15;
export type WeatherPreview = {condition: string; time: string};

const LATITUDE = 3.16 * Math.PI / 180;
function solar(now: Date) {
  // Approximate local solar time for KL (101.71°E), including seasonal declination.
  const day = (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000;
  const declination = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + day) / 365);
  const b=2*Math.PI*(day-81)/364;
  const equationMinutes=9.87*Math.sin(2*b)-7.53*Math.cos(b)-1.5*Math.sin(b);
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60 + 101.71 / 15 + equationMinutes/60;
  return {declination, hourAngle: (hour - 12) * Math.PI / 12};
}
/** Unit vector toward a body at this declination and hour angle, in world axes: +x east, +y up, -z north. */
function skyDirection(declination: number, hourAngle: number) {
  const c = Math.cos(declination);
  return new THREE.Vector3(-c * Math.sin(hourAngle),
    Math.sin(LATITUDE) * Math.sin(declination) + Math.cos(LATITUDE) * c * Math.cos(hourAngle),
    c * Math.sin(LATITUDE) * Math.cos(hourAngle) - Math.sin(declination) * Math.cos(LATITUDE));
}
export function klSunDirection(now = new Date()) {const {declination, hourAngle} = solar(now); return skyDirection(declination, hourAngle);}
export function klSunAltitude(now = new Date()) {return Math.asin(THREE.MathUtils.clamp(klSunDirection(now).y, -1, 1)) * 180 / Math.PI;}
export function isKlNight(now = new Date()) {return klSunAltitude(now)<0;}
export function klTwilight(now = new Date()) {return Math.max(0,1-Math.abs(klSunAltitude(now)-1)/12);}
/** The moon from its mean synodic phase (within a day of the real one): it trails the sun by phase × 24 h.
 * ponytail: ignores the moon's own ±28° declination swing; add a lunar ephemeris if anyone plots it. */
export function klMoon(now = new Date()) {
  const phase = ((now.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000 / 29.530588 % 1 + 1) % 1;
  const {declination, hourAngle} = solar(now);
  return {direction: skyDirection(declination, hourAngle - phase * 2 * Math.PI), lit: (1 - Math.cos(phase * 2 * Math.PI)) / 2};
}

export interface SkyPalette {
  sun: THREE.Vector3; moon: THREE.Vector3; moonLit: number; moonGlow: number;
  zenith: THREE.Color; horizon: THREE.Color; glow: THREE.Color; cloudLight: THREE.Color; cloudShadow: THREE.Color;
  light: THREE.Color; lightIntensity: number; ambientSky: THREE.Color; ambientIntensity: number;
  clouds: number; coverage: number; sunDisc: number; stars: number; fogNear: number; fogFar: number;
}
// Clear-sky keys by sun altitude in degrees, all display sRGB: zenith, horizon away from the sun,
// horizon under the sun, lit cloud, cloud shade, sunlight, sunlight intensity, hemisphere sky, hemisphere intensity.
// KL is humid, so even noon keeps a pale, milky horizon; night keeps the city's sodium glow low on the sky.
type Key = [number, string, string, string, string, string, string, number, string, number];
const CLEAR: Key[] = [
  [-90, '#060c1d', '#2a2829', '#2a2829', '#312e33', '#121726', '#9cb8ed', NIGHT_SUN, '#c3cde6', NIGHT_AMBIENT],
  [-12, '#08122a', '#2e2b2d', '#302c2e', '#35313a', '#141a2b', '#9cb8ed', NIGHT_SUN, '#c3cde6', NIGHT_AMBIENT],
  [-6, '#172b58', '#46506e', '#7a5a58', '#4c4c62', '#27304e', '#9cb8ed', NIGHT_SUN, '#c3cde6', NIGHT_AMBIENT],
  [-2, '#2b4780', '#8f8492', '#d67e58', '#dc967c', '#57536c', '#ff9860', .6, '#cfc8d4', 1.25],
  [1, '#3f63a2', '#c2a59e', '#f58f48', '#f7b080', '#77728a', '#ff9a5a', .95, '#d8cdcc', 1.3],
  [6, '#4a78b6', '#cfc0b2', '#f8b872', '#fbd4ac', '#8590a8', '#ffb46a', 1.85, '#d9dade', 1.45],
  [15, '#4d86c2', '#d0d5d2', '#f2d7ae', '#fbeee0', '#8e9fb2', '#ffcc8e', 2.45, '#e2e5e3', 1.65],
  [32, '#4d8ac7', '#cddce2', '#e6e4d9', '#fbf8f2', '#96a9b8', '#ffe2b6', 2.65, '#eaebe4', 1.8],
  [90, '#4787c7', '#c9dbe3', '#dfe7e8', '#fdfbf6', '#9aaebd', '#fff0d6', 2.7, '#ecede6', 1.8],
];
const scratch = new THREE.Color();
function tint(color: THREE.Color, amount: number, target: string, level = 1) {
  // Toward a grey of the colour's own brightness, so an overcast night stays a night.
  const l = color.r * .2126 + color.g * .7152 + color.b * .0722;
  color.lerp(scratch.set(target).multiplyScalar(l * level / (scratch.r * .2126 + scratch.g * .7152 + scratch.b * .0722)), amount);
}
/** One sky for everything under it: the dome, sunlight, hemisphere light, fog and the sea read the same palette. */
export function skyPalette(sun: THREE.Vector3, condition: string, moon = new THREE.Vector3(0, -1, 0), moonLit = 0): SkyPalette {
  const altitude = Math.asin(THREE.MathUtils.clamp(sun.y, -1, 1)) * 180 / Math.PI;
  let i = 1; while (i < CLEAR.length - 1 && CLEAR[i][0] < altitude) i++;
  const a = CLEAR[i - 1], b = CLEAR[i], t = THREE.MathUtils.clamp((altitude - a[0]) / (b[0] - a[0]), 0, 1);
  const mix = (k: number) => new THREE.Color(a[k] as string).lerp(new THREE.Color(b[k] as string), t);
  const p: SkyPalette = {sun: sun.clone(), moon: moon.clone(), moonLit,
    moonGlow: THREE.MathUtils.smoothstep(-altitude, 2, 8) * THREE.MathUtils.smoothstep(moon.y, -.02, .06),
    zenith: mix(1), horizon: mix(2), glow: mix(3), cloudLight: mix(4), cloudShadow: mix(5),
    light: mix(6), lightIntensity: THREE.MathUtils.lerp(a[7], b[7], t), ambientSky: mix(8), ambientIntensity: THREE.MathUtils.lerp(a[9], b[9], t),
    clouds: 1, coverage: .43, sunDisc: 1, stars: THREE.MathUtils.smoothstep(-altitude, 5, 13), fogNear: 120, fogFar: 560};
  const night = 1 - THREE.MathUtils.smoothstep(altitude, -8, -1);
  if (condition === 'cloudy') {
    for (const c of [p.zenith, p.horizon, p.cloudShadow]) tint(c, .5, '#dfe4e6', .92);
    for (const c of [p.glow, p.cloudLight]) tint(c, .45, '#eeeae4');
    p.lightIntensity *= .6; p.coverage = .34; p.sunDisc = .35; p.stars *= .3; p.moonGlow *= .5; p.fogNear = 100; p.fogFar = 480;
  } else if (condition === 'rain') {
    // Monsoon cloud base: slate by day, lit brown-orange from below by the city at night.
    for (const c of [p.zenith, p.horizon, p.glow, p.cloudLight, p.cloudShadow]) tint(c, .88, night > .5 ? '#c09a80' : '#b8c6cc', .42 + night * .7);
    p.lightIntensity *= .3; p.ambientIntensity *= .9; p.coverage = .2; p.sunDisc = 0; p.stars = p.moonGlow = 0; p.fogNear = 70; p.fogFar = 300;
  } else if (condition === 'haze' || condition === 'fog') {
    const haze = condition === 'haze';
    // Jerebu turns the whole sky a flat yellow-brown with the sun a dim orange ball; fog is a soft white-grey.
    for (const c of [p.zenith, p.horizon, p.cloudShadow]) tint(c, haze ? .82 : .9, haze ? '#e3cfa8' : '#e2e5e3', haze ? 1.02 : 1.08);
    tint(p.glow, haze ? .55 : .8, haze ? '#f0c090' : '#eceae4', 1.05);
    p.light.lerp(scratch.set(haze ? '#ffb070' : '#fff4e6'), .5); p.lightIntensity *= haze ? .5 : .42; p.ambientIntensity *= 1.02;
    p.clouds = 0; p.sunDisc = haze ? .8 : .12; p.stars = p.moonGlow = 0; p.fogNear = 20; p.fogFar = haze ? 210 : 170;
  }
  return p;
}

// The light direction follows the sun but stays between these elevations: a horizon sun would stretch
// the one shadow map across the city, and a KL noon sun straight overhead flattens every facade.
const LIGHT_MIN = 18 * Math.PI / 180, LIGHT_MAX = 70 * Math.PI / 180, LIGHT_DISTANCE = 144;
// GM "day" keeps the old fixed afternoon sun; GM "night" parks the sun well below the horizon.
export const GM_DAY_SUN = new THREE.Vector3(-70, 110, 60).normalize(), GM_NIGHT_SUN = new THREE.Vector3(.6, -.5, .2).normalize();
export function lightOffset(direction: THREE.Vector3, target = new THREE.Vector3()) {
  const elevation = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)), LIGHT_MIN, LIGHT_MAX);
  const heading = Math.atan2(direction.z, direction.x);
  return target.set(Math.cos(elevation) * Math.cos(heading), Math.sin(elevation), Math.cos(elevation) * Math.sin(heading)).multiplyScalar(LIGHT_DISTANCE);
}

export function setupWeather(scene: THREE.Scene, sun: THREE.DirectionalLight, ambient: THREE.HemisphereLight, endpoint: string, setRain: (value: boolean) => void, send: (message: object) => boolean, setNight: (value: boolean) => void = () => {}, setClouds: (value: CloudWeather) => void = () => {}) {
  let report: {available:boolean;condition:string;source:string;observedAt?:number} = {available:false,condition:'sunny',source:'Weather unavailable · time-only fallback'};
  let clockOffset=0, gm=false;
  let override={condition:'live',daylight:'live'};
  let preview: WeatherPreview = {condition:'live',time:''};
  // Where the shadow-casting light sits relative to the player; main.ts adds the player position each frame.
  const sunOffset = new THREE.Vector3(-70, 110, 60);
  const label=document.getElementById('weather-label')!;
  const toggle=document.getElementById('rain-toggle') as HTMLInputElement;
  const container=toggle.closest('label')!;
  const controls=document.createElement('section');controls.hidden=true;controls.id='gm-weather';
  controls.innerHTML='<strong>Game Master · Room weather</strong><p>Changes affect everyone in this room.</p><label>Weather<select aria-label="GM weather"><option value="live">Live weather</option><option value="sunny">Clear / sunny</option><option value="cloudy">Cloudy</option><option value="rain">Rain</option><option value="haze">Haze</option><option value="fog">Fog</option></select></label><label>Day / night<select aria-label="GM daylight"><option value="live">Real KL day / night</option><option value="day">Daytime</option><option value="night">Night</option></select></label><button type="button" class="secondary">Return to live weather</button><p role="status"></p>';
  // The GM panel goes after the player's own rain switch, not over it: replacing the
  // label took "Rain over KL" away from everybody, GM or not.
  container.after(controls);
  // Live weather drives the switch until you touch it; after that it is your own setting.
  let manualRain: boolean | null = null;
  toggle.onchange = () => { manualRain = toggle.checked; apply(); };
  const weatherSelect=controls.querySelectorAll('select')[0],daySelect=controls.querySelectorAll('select')[1];
  const status=controls.querySelector('[role="status"]')!;
  function request(condition:string,daylight:string){if(!gm)return;if(!send({type:'weather-set',condition,daylight})){status.textContent='Reconnect to change room weather.';return;}status.textContent='Applying…';}
  weatherSelect.onchange=()=>request(weatherSelect.value,daySelect.value);
  daySelect.onchange=()=>request(weatherSelect.value,daySelect.value);
  controls.querySelector('button')!.onclick=()=>request('live','live');
  const credit=document.createElement('a');credit.href='https://aviationweather.gov/data/api/';credit.target='_blank';credit.rel='noopener';credit.textContent='Weather: NOAA AWC · Subang';// After the settings list, not wedged between two of its rows.
  (container.parentElement || controls).append(credit);
  function apply() {
    const now=new Date(Date.now()+clockOffset);
    const previewing=preview.condition!=='live'||preview.time!=='';
    const visualNow=new Date(now);
    if(preview.time){const [h,m]=preview.time.split(':').map(Number);visualNow.setUTCHours(h-8,m,0,0);}
    const fresh=report.available && !!report.observedAt && now.getTime()-report.observedAt<3*3600000;
    const manual=override.condition!=='live'||override.daylight!=='live';
    const condition=preview.condition!=='live'?preview.condition:override.condition!=='live'?override.condition:fresh?report.condition:'sunny';
    const night=preview.time?isKlNight(visualNow):override.daylight==='live'?isKlNight(now):override.daylight==='night';
    const twilight=preview.time?klTwilight(visualNow):override.daylight==='live'?klTwilight(now):0;
    const rain=condition==='rain', mist=condition==='haze'||condition==='fog';
    const wet = preview.condition!=='live'?rain:manualRain ?? rain;
    setRain(wet);toggle.checked=wet;
    const skyNow=preview.time?visualNow:now, clock=preview.time!==''||override.daylight==='live';
    const moon=klMoon(skyNow);
    const look=mist?condition:wet?'rain':condition==='rain'?'cloudy':condition;
    const sky=skyPalette(clock?klSunDirection(skyNow):override.daylight==='night'?GM_NIGHT_SUN:GM_DAY_SUN,look,moon.direction,moon.lit);
    (scene.background as THREE.Color).copy(sky.horizon);const fog=scene.fog as THREE.Fog;fog.color.copy(sky.horizon);fog.near=sky.fogNear;fog.far=sky.fogFar;
    sun.intensity=sky.lightIntensity;sun.color.copy(sky.light);
    ambient.intensity=sky.ambientIntensity;ambient.color.copy(sky.ambientSky);
    // Once twilight has cooled (sun below -4°) the shadow-casting light is moonlight, from wherever the moon is.
    lightOffset(sky.sun.y<-.07?moon.direction:sky.sun,sunOffset);
    setNight(night);
    setClouds({condition:look,night,twilight,sky});
    const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'}).format(visualNow);
    label.textContent=`${time} MYT · ${night?'Night':'Daytime'} · ${!fresh&&override.condition==='live'&&preview.condition==='live'?'Weather unavailable':night&&condition==='sunny'?'Clear':condition}${previewing?' · Local preview':manual?' · GM override':''}`;
    label.title=manual?'Game Master override · real MYT clock':fresh?`${report.source} · observed ${new Date(report.observedAt!).toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur'})}`:'Weather unavailable; showing KL day/night only';
  }
  async function refresh(){try{const sent=Date.now();const response=await fetch(`${endpoint}/weather`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const value=await response.json();if(Number.isFinite(value.serverTime))clockOffset=value.serverTime+(Date.now()-sent)/2-Date.now();if(typeof value.available==='boolean'&&['sunny','cloudy','rain','haze','fog'].includes(value.condition))report=value;}catch{}apply();}
  apply();void refresh();setInterval(()=>void refresh(),10*60000);setInterval(apply,30000);
  return {sunOffset,preview(value:WeatherPreview){if(!['live','sunny','cloudy','rain','haze','fog'].includes(value.condition)|| (value.time!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)))return;preview={...value};apply();},role(value:boolean){gm=value;controls.hidden=!value;},override(value:{condition:string;daylight:string}){if(!value||!['live','sunny','cloudy','rain','haze','fog'].includes(value.condition)||!['live','day','night'].includes(value.daylight))return;override=value;weatherSelect.value=value.condition;daySelect.value=value.daylight;status.textContent='Room weather updated.';apply();}};
}
