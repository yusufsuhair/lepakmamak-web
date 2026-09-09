import * as THREE from 'three';
export function isKlNight(now = new Date()) {
  // Approximate local solar time for KL (101.71°E), including seasonal declination.
  const day = (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000;
  const declination = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + day) / 365);
  const b=2*Math.PI*(day-81)/364;
  const equationMinutes=9.87*Math.sin(2*b)-7.53*Math.cos(b)-1.5*Math.sin(b);
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60 + 101.71 / 15 + equationMinutes/60;
  return Math.sin(3.16 * Math.PI / 180) * Math.sin(declination) + Math.cos(3.16 * Math.PI / 180) * Math.cos(declination) * Math.cos((hour - 12) * Math.PI / 12) < 0;
}
export function setupWeather(scene: THREE.Scene, sun: THREE.DirectionalLight, ambient: THREE.HemisphereLight, endpoint: string, setRain: (value: boolean) => void) {
  let report: {available:boolean;condition:string;source:string;observedAt?:number} = {available:false,condition:'sunny',source:'Weather unavailable · time-only fallback'};
  let manual = false, manualRain = false, clockOffset=0;
  const label = document.getElementById('weather-label')!;
  const toggle = document.getElementById('rain-toggle') as HTMLInputElement;
  const live = document.createElement('button'); live.type='button'; live.className='secondary'; live.textContent='Use live KL weather';
  toggle.closest('label')!.after(live);
  const credit=document.createElement('a');credit.href='https://aviationweather.gov/data/api/';credit.target='_blank';credit.rel='noopener';credit.textContent='Weather: NOAA AWC · Subang';live.after(credit);
  function apply() {
    const now=new Date(Date.now()+clockOffset);
    const fresh=report.available && !!report.observedAt && now.getTime()-report.observedAt<3*3600000;
    const condition=manual?(manualRain?'rain':'sunny'):fresh?report.condition:'sunny';
    const night=isKlNight(now), rain=condition==='rain', mist=condition==='haze'||condition==='fog';
    setRain(rain);toggle.checked=rain;
    const color=night?'#172535':mist?'#b7ada0':rain?'#82969f':condition==='cloudy'?'#b3c3c9':'#b9dcec';
    (scene.background as THREE.Color).set(color);const fog=scene.fog as THREE.Fog;fog.color.set(color);fog.near=mist?20:rain?70:145;fog.far=mist?170:rain?300:650;
    sun.intensity=night?.22:rain?.8:mist?1.1:condition==='cloudy'?1.5:2.7;ambient.intensity=night?.7:1.8;sun.color.set(night?'#9cb8ed':'#ffdfa3');
    const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'}).format(now);
    label.textContent=`${time} MYT · ${night?'Night':'Daytime'} · ${!fresh&&!manual?'Weather unavailable':night&&condition==='sunny'?'Clear':condition}${manual?' · preview':''}`;
    label.title=manual?'Manual weather preview':fresh?`${report.source} · observed ${new Date(report.observedAt!).toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur'})}`:'Weather unavailable; showing KL day/night only';
  }
  toggle.onchange=()=>{manual=true;manualRain=toggle.checked;apply();};live.onclick=()=>{manual=false;apply();};
  async function refresh(){try{const sent=Date.now();const response=await fetch(`${endpoint}/weather`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const value=await response.json();if(Number.isFinite(value.serverTime))clockOffset=value.serverTime+(Date.now()-sent)/2-Date.now();if(typeof value.available==='boolean'&&['sunny','cloudy','rain','haze','fog'].includes(value.condition))report=value;}catch{}apply();}
  apply();void refresh();setInterval(()=>void refresh(),10*60000);setInterval(apply,30000);
}
