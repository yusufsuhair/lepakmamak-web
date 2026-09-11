import {test,expect} from '@playwright/test';
import {createDevBots} from '../server/dev-bots.mjs';

test('local environment presets control weather and time without room messages',async({page})=>{
 await page.route('**/environment-harness',route=>route.fulfill({contentType:'text/html',body:'<div class="pause-panel"><label><input id="rain-toggle" type="checkbox"></label></div><p id="weather-label"></p>'}));
 await page.route('**/weather',route=>route.fulfill({json:{available:false}}));
 await page.goto('/environment-harness');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');const {setupWeather}=await import('/src/weather.ts');const {setupDeveloperOptions}=await import('/src/developer-options.ts');
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,1,100);
  const state:any={sent:[],night:false,rain:false};(window as any).environment=state;
  const send=(value:any)=>{state.sent.push(value);return true;};
  const weather=setupWeather(scene,new THREE.DirectionalLight(),new THREE.HemisphereLight(),'',(v:boolean)=>state.rain=v,send,(v:boolean)=>state.night=v);
  setupDeveloperOptions(send,weather.preview);
 });
 await page.selectOption('#dev-season','monsoon');
 expect(await page.evaluate(()=>(window as any).environment.rain)).toBe(true);
 await page.selectOption('#dev-time-preset','00:00');
 await expect(page.locator('#weather-label')).toContainText('00:00 MYT · Night');
 for(const condition of ['sunny','cloudy','rain','haze','fog']){
  await page.selectOption('#dev-weather',condition);
  expect(await page.evaluate(()=>(window as any).environment.rain)).toBe(condition==='rain');
 }
 await page.selectOption('#dev-time-preset','12:00');
 expect(await page.evaluate(()=>(window as any).environment.night)).toBe(false);
 await page.locator('#dev-time').fill('23:30');await page.locator('#dev-time').dispatchEvent('change');
 await expect(page.locator('#weather-label')).toContainText('23:30 MYT · Night');
 await page.locator('#dev-environment-reset').click();
 await expect(page.locator('#weather-label')).not.toContainText('Local preview');
 expect(await page.evaluate(()=>(window as any).environment.sent)).toEqual([]);
});

test('development bots spawn nearby with requested voice state and belong to their owner',()=>{
 const owner:any={id:'owner',name:'Yusuf',x:10,z:20,ws:{readyState:1}};
 const players=new Map([['owner',owner]]),bots=createDevBots(40,true);
 const result:any=bots.handle(players,owner,{type:'dev-spawn-bots',count:4,mic:true,speaker:false});
 const spawned=[...players.values()].filter((player:any)=>player.devBot);
 expect(result.changed).toBe(4);expect(spawned).toHaveLength(4);
 expect(spawned.every((player:any)=>player.mic&&!player.speaker&&player.devBotOwner==='owner')).toBe(true);
 expect(spawned.every((player:any)=>Math.hypot(player.x-owner.x,player.z-owner.z)<5)).toBe(true);
 expect(bots.remove(players,'owner')).toBe(4);expect(players.size).toBe(1);
});

test('development tools are inert when the server gate is closed',()=>{
 const owner:any={id:'owner',x:0,z:0},players=new Map([['owner',owner]]),bots=createDevBots(40,false);
 expect(bots.handle(players,owner,{type:'dev-spawn-bots',count:30,mic:true,speaker:true})).toBe(true);
 expect(players.size).toBe(1);
});

test('developer settings send count, mic and speaker and can clear bots',async({page})=>{
 await page.route('**/dev-options',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div class="pause-panel"></div>'}));await page.goto('/dev-options');
 await page.evaluate(async()=>{const sent:any[]=[];const {setupDeveloperOptions}=await import('/src/developer-options.ts');setupDeveloperOptions(message=>{sent.push(message);return true;});(window as any).sent=sent;});
 await page.locator('#dev-user-count').fill('7');await page.locator('#dev-bot-mic').check();await page.locator('#dev-bot-speaker').uncheck();await page.locator('#dev-spawn').click();await page.locator('#dev-remove').click();
 expect(await page.evaluate(()=>(window as any).sent)).toEqual([{type:'dev-spawn-bots',count:7,mic:true,speaker:false},{type:'dev-remove-bots'}]);
});
