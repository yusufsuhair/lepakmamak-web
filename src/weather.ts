import * as THREE from 'three';
// Night used to sit at .22 / .7, which read as pitch black once the lamps went in.
export const NIGHT_SUN = .34, NIGHT_AMBIENT = 1.15;

export function isKlNight(now = new Date()) {
  // Approximate local solar time for KL (101.71°E), including seasonal declination.
  const day = (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000;
  const declination = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + day) / 365);
  const b=2*Math.PI*(day-81)/364;
  const equationMinutes=9.87*Math.sin(2*b)-7.53*Math.cos(b)-1.5*Math.sin(b);
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60 + 101.71 / 15 + equationMinutes/60;
  return Math.sin(3.16 * Math.PI / 180) * Math.sin(declination) + Math.cos(3.16 * Math.PI / 180) * Math.cos(declination) * Math.cos((hour - 12) * Math.PI / 12) < 0;
}
export function setupWeather(scene: THREE.Scene, sun: THREE.DirectionalLight, ambient: THREE.HemisphereLight, endpoint: string, setRain: (value: boolean) => void, send: (message: object) => boolean, setNight: (value: boolean) => void = () => {}) {
  let report: {available:boolean;condition:string;source:string;observedAt?:number} = {available:false,condition:'sunny',source:'Weather unavailable · time-only fallback'};
  let clockOffset=0, gm=false;
  let override={condition:'live',daylight:'live'};
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
  toggle.onchange = () => { manualRain = toggle.checked; setRain(manualRain); };
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
    const fresh=report.available && !!report.observedAt && now.getTime()-report.observedAt<3*3600000;
    const manual=override.condition!=='live'||override.daylight!=='live';
    const condition=override.condition!=='live'?override.condition:fresh?report.condition:'sunny';
    const night=override.daylight==='live'?isKlNight(now):override.daylight==='night';
    const rain=condition==='rain', mist=condition==='haze'||condition==='fog';
    const wet = manualRain ?? rain;
    setRain(wet);toggle.checked=wet;
    const color=night?'#172535':mist?'#b7ada0':wet?'#82969f':condition==='cloudy'?'#b3c3c9':'#b9dcec';
    (scene.background as THREE.Color).set(color);const fog=scene.fog as THREE.Fog;fog.color.set(color);fog.near=mist?20:wet?70:145;fog.far=mist?170:wet?300:650;
    sun.intensity=night?NIGHT_SUN:wet?.8:mist?1.1:condition==='cloudy'?1.5:2.7;ambient.intensity=night?NIGHT_AMBIENT:1.8;sun.color.set(night?'#9cb8ed':'#ffdfa3');
    setNight(night);
    const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'}).format(now);
    label.textContent=`${time} MYT · ${night?'Night':'Daytime'} · ${!fresh&&override.condition==='live'?'Weather unavailable':night&&condition==='sunny'?'Clear':condition}${manual?' · GM override':''}`;
    label.title=manual?'Game Master override · real MYT clock':fresh?`${report.source} · observed ${new Date(report.observedAt!).toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur'})}`:'Weather unavailable; showing KL day/night only';
  }
  async function refresh(){try{const sent=Date.now();const response=await fetch(`${endpoint}/weather`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const value=await response.json();if(Number.isFinite(value.serverTime))clockOffset=value.serverTime+(Date.now()-sent)/2-Date.now();if(typeof value.available==='boolean'&&['sunny','cloudy','rain','haze','fog'].includes(value.condition))report=value;}catch{}apply();}
  apply();void refresh();setInterval(()=>void refresh(),10*60000);setInterval(apply,30000);
  return {role(value:boolean){gm=value;controls.hidden=!value;},override(value:{condition:string;daylight:string}){if(!value||!['live','sunny','cloudy','rain','haze','fog'].includes(value.condition)||!['live','day','night'].includes(value.daylight))return;override=value;weatherSelect.value=value.condition;daySelect.value=value.daylight;status.textContent='Room weather updated.';apply();}};
}
