import './developer-options.css';
import type {WeatherPreview} from './weather';

export function setupDeveloperOptions(send:(message:object)=>boolean, preview?:(value:WeatherPreview)=>void){
 const root=document.createElement('section');root.id='developer-options';
 root.innerHTML='<header><small>DEV BUILD ONLY</small><h3>Developer Option</h3></header><label>Nearby test users<input id="dev-user-count" type="number" min="1" max="30" value="4" inputmode="numeric"></label><div class="dev-checks"><label><input id="dev-bot-mic" type="checkbox"> Open mic</label><label><input id="dev-bot-speaker" type="checkbox" checked> Open speaker</label></div><div class="dev-actions"><button id="dev-spawn" type="button">Spawn users</button><button id="dev-remove" type="button">Remove all users</button></div><p id="dev-options-status" role="status"></p>';
 document.querySelector('.pause-panel')!.append(root);
 if(preview){
  const panel=document.createElement('fieldset');panel.className='dev-environment';
  panel.innerHTML=`<legend>Environment preview</legend><p>Local only · does not change room weather. Tropical season presets, not snow or seasonal foliage.</p>
  <label>Season preset<select id="dev-season"><option value="live">Live / room defaults</option><option value="dry">Dry season</option><option value="monsoon">Monsoon / wet season</option><option value="transition">Inter-monsoon / cloudy</option><option value="mist">Misty morning</option></select></label>
  <label>Weather<select id="dev-weather"><option value="live">Live / room weather</option><option value="sunny">Clear / sunny</option><option value="cloudy">Cloudy</option><option value="rain">Rain</option><option value="haze">Haze</option><option value="fog">Fog</option></select></label>
  <label>Time preset<select id="dev-time-preset"><option value="">Live / room time</option><option value="06:45">Dawn</option><option value="07:15">Sunrise</option><option value="09:00">Morning</option><option value="12:00">Noon</option><option value="15:00">Afternoon</option><option value="18:45">Golden hour</option><option value="19:15">Sunset</option><option value="19:45">Dusk</option><option value="21:00">Night</option><option value="00:00">Midnight</option><option value="custom">Custom</option></select></label>
  <label>Custom time (MYT)<input id="dev-time" type="time" value="12:00"></label>
  <button id="dev-environment-reset" type="button">Reset environment to live / room</button><p id="dev-environment-status" role="status">Following live / room environment.</p>`;
  root.append(panel);
  const season=panel.querySelector<HTMLSelectElement>('#dev-season')!,weather=panel.querySelector<HTMLSelectElement>('#dev-weather')!,preset=panel.querySelector<HTMLSelectElement>('#dev-time-preset')!,time=panel.querySelector<HTMLInputElement>('#dev-time')!;
  const apply=()=>{preview({condition:weather.value,time:preset.value==='custom'?time.value:preset.value});panel.querySelector('#dev-environment-status')!.textContent=weather.value==='live'&&!preset.value?'Following live / room environment.':'Local preview active · other players are unaffected.';};
  season.onchange=()=>{const values:Record<string,[string,string]>={live:['live',''],dry:['sunny','15:00'],monsoon:['rain','16:00'],transition:['cloudy','12:00'],mist:['fog','07:15']};const [condition,hour]=values[season.value];weather.value=condition;time.value=hour||'12:00';preset.value=hour==='16:00'?'custom':hour;apply();};
  weather.onchange=apply;preset.onchange=()=>{if(preset.value&&preset.value!=='custom')time.value=preset.value;apply();};time.onchange=()=>{if(!time.value)return;preset.value='custom';apply();};
  panel.querySelector<HTMLButtonElement>('#dev-environment-reset')!.onclick=()=>{season.value='live';weather.value='live';preset.value='';time.value='12:00';apply();};
 }
 const status=root.querySelector<HTMLElement>('#dev-options-status')!;
 root.querySelector<HTMLButtonElement>('#dev-spawn')!.onclick=()=>{const count=Math.max(1,Math.min(30,Number(root.querySelector<HTMLInputElement>('#dev-user-count')!.value)||1));const ok=send({type:'dev-spawn-bots',count,mic:root.querySelector<HTMLInputElement>('#dev-bot-mic')!.checked,speaker:root.querySelector<HTMLInputElement>('#dev-bot-speaker')!.checked});status.textContent=ok?`Spawning ${count} test users nearby…`:'Connect to dev city first.';};
 root.querySelector<HTMLButtonElement>('#dev-remove')!.onclick=()=>{const ok=send({type:'dev-remove-bots'});status.textContent=ok?'Removing your test users…':'Connect to dev city first.';};
 return root;
}
