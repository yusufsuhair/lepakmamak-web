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
    await page.waitForTimeout(300);expect(audioRequests).toEqual([]);
    await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');await expect(page.locator('#loading')).toBeHidden();
  }finally{vite.kill();for(const client of server.clients)client.terminate();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('a failed first socket reports entry failure instead of pretending to reconnect',async({page})=>{
  let connections=0;
  await page.routeWebSocket('**/ws',ws=>{
    connections++;
    ws.onMessage(raw=>{
      if(JSON.parse(String(raw)).type!=='join')return;
      ws.close({code:1012,reason:'Temporary restart'});
    });
  });
  await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();
  await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Retry Friend');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await expect(page.locator('#multiplayer-status-text')).toHaveText('CONNECTION FAILED');
  await expect(page.locator('#loading')).toBeHidden();
  await page.waitForTimeout(3000);
  expect(connections).toBe(1);
  await expect(page.locator('#multiplayer-status-text')).not.toContainText('RECONNECT');
});
