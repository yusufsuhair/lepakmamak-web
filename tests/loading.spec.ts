import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {WebSocketServer} from 'ws';

test('loading UI reports startup progress and clears when the city is ready',async({page})=>{
  await page.goto('/');
  const loader=page.locator('#loading');
  await expect(loader).toBeHidden();
  await expect(loader).toHaveAttribute('role','status');
  await expect(page.locator('#loading-progress')).toHaveAttribute('aria-valuenow','100');
  await expect(page.locator('#loading-percent')).toHaveText('100%');
  await expect(page.locator('#loading-stage')).toHaveText('READY');
  await expect(page.locator('#loading-detail')).toHaveText('The city is ready.');
});

test('entering online keeps a real loading state until the welcome arrives',async({page})=>{
  const audioRequests:string[]=[];
  page.on('request',request=>{if(/\.(?:mp3|wav)(?:\?|$)/.test(request.url()))audioRequests.push(new URL(request.url()).pathname);});
  const server=new WebSocketServer({port:8094});
  await new Promise<void>(resolve=>server.once('listening',()=>resolve()));
  server.on('connection',socket=>socket.on('message',raw=>{const message=JSON.parse(String(raw));if(message.type==='join')setTimeout(()=>socket.send(JSON.stringify({type:'welcome',id:'loading-player',players:[{id:'loading-player',name:'Loading Friend',color:'#72c8ba',x:-18,z:52,yaw:Math.PI,riding:false,speed:0,guest:true}]})),2500);}));
  const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5184','--strictPort'],{env:{...process.env,VITE_MULTIPLAYER_URL:'ws://127.0.0.1:8094',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
  try{
    await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:5184')).ok;}catch{return false;}}).toBe(true);
    await page.goto('http://127.0.0.1:5184/?room=loading-test');await page.getByRole('button',{name:"Jom, let's go"}).click();
    await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Loading Friend');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
    await expect(page.locator('#loading')).toBeVisible();await expect(page.locator('#loading-title')).toContainText(/Entering|Connecting|Joining|Welcome/);
    await expect(page.locator('#loading-progress')).toHaveAttribute('aria-valuenow',/68|74|90|100/);
    await expect(page.locator('#multiplayer-status-text')).toHaveText('JOINING CITY');
    await expect(page.locator('#force-refresh')).toBeHidden();
    await page.waitForTimeout(300);expect(audioRequests).toEqual([]);
    await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');await expect(page.locator('#loading')).toBeHidden();
  }finally{vite.kill();for(const client of server.clients)client.terminate();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('a transient first socket failure retries before reporting entry failure',async({page})=>{
  let connections=0;
  await page.routeWebSocket('**/ws',ws=>{
    connections++;
    ws.onMessage(raw=>{
      if(JSON.parse(String(raw)).type!=='join')return;
      if (connections < 3) ws.close({code:1012,reason:'Temporary restart'});
      else ws.send(JSON.stringify({type:'welcome',id:'retry-player',players:[{id:'retry-player',name:'Retry Friend',color:'#72c8ba',x:0,z:0,yaw:0,riding:false,guest:true}]}));
    });
  });
  await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();
  await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Retry Friend');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE',{timeout:15000});
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#force-refresh')).toBeHidden();
  expect(connections).toBe(3);
});

// A returning member never sees the title screen: init() finishes the world and auto-enters.
// The bar used to reach 100% and announce "The city is ready" before the city link had even
// opened, then slide back to 74% for the connection — which reads as the game restarting.
test('auto-entry never runs the loading bar backwards',async({page})=>{
  await page.route('**/src/auth.ts*',route=>route.fulfill({contentType:'application/javascript',body:`export const session={access_token:'t',user:{id:'a',user_metadata:{display_name:'Returning'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=>'Returning';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`}));
  await page.routeWebSocket('**/ws',ws=>ws.onMessage(raw=>{
    if(JSON.parse(String(raw)).type==='join')setTimeout(()=>ws.send(JSON.stringify({type:'welcome',id:'a',players:[{id:'a',name:'Returning',x:0,z:0,yaw:0}],version:'1.0.0'})),400);
  }));
  await page.addInitScript(()=>{
    (window as any).__steps=[];
    const watch=()=>{const bar=document.getElementById('loading-progress');if(!bar){requestAnimationFrame(watch);return;}
      const read=()=>({value:Number(bar.getAttribute('aria-valuenow')),title:document.getElementById('loading-title')?.textContent||''});
      const push=()=>{const step=read(),last=(window as any).__steps.at(-1);
        if(!last||last.value!==step.value||last.title!==step.title)(window as any).__steps.push(step);};
      push();new MutationObserver(push).observe(document.getElementById('loading')!,{attributes:true,subtree:true,childList:true,characterData:true});};
    watch();
  });
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  const steps=await page.evaluate(()=>(window as any).__steps as {value:number;title:string}[]);
  // Monotonic: every step is at least as far along as the one before it.
  expect(steps.map(step=>step.value)).toEqual([...steps.map(step=>step.value)].sort((a,b)=>a-b));
  // And the overlay only claims the city is ready once, at the end.
  expect(steps.filter(step=>step.value===100)).toHaveLength(1);
});
