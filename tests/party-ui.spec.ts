import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

const PORT='8126', VITE='5189';

test('an invite can be answered in the city without a numeric map count',async({page})=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',VITE,'--strictPort'],{env:{...process.env,VITE_MULTIPLAYER_URL:`ws://127.0.0.1:${PORT}`,VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 let friend:WebSocket|undefined;
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok&&(await fetch(`http://127.0.0.1:${VITE}`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);

  await page.goto(`http://127.0.0.1:${VITE}/?room=party-ui`);
  await page.getByRole('button',{name:"Jom, let's go"}).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Player');
  await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');

  // A friend joins over the socket and finds the player by the name they entered with.
  const peers:any[]=[];
  friend=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  await new Promise<void>((resolve,reject)=>{
   friend!.on('error',reject);
   friend!.on('open',()=>friend!.send(JSON.stringify({type:'join',room:'party-ui',guest:true,name:'Geng'})));
   friend!.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='welcome'){friend!.send(JSON.stringify({type:'state',x:0,z:0}));resolve();}if(m.players)peers.push(...m.players);});
  });
  await expect.poll(()=>peers.some(p=>p.name==='Player')).toBe(true);
  const playerId=peers.find(p=>p.name==='Player').id;

  // No party yet, so no party channel to pick and no voice audience to choose.
  await page.locator('#chat-compose').click();
  await page.locator('#chat-channel').click();
  await expect(page.getByRole('option',{name:/PARTY/})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mic-scope')).toBeHidden();

  friend.send(JSON.stringify({type:'party-invite',id:playerId}));
  await expect(page.locator('#party-invite')).toBeVisible();
  await expect(page.locator('#party-invite-text')).toContainText('join their Party');

  await page.getByRole('button',{name:'Jom',exact:true}).click();
  await expect(page.locator('#party-invite')).toBeHidden();
  await page.locator('#chat-compose').click();
  await page.locator('#chat-channel').click();
  await expect(page.getByRole('option',{name:/PARTY/})).toBeVisible();
  await page.keyboard.press('Escape');
  // A party gives voice a second audience, so the scope buttons appear.
  await expect(page.locator('#mic-scope')).toBeVisible();
  await expect(page.locator('#speaker-scope')).toBeVisible();
  await page.locator('#mic-scope').click();
  await page.locator('#speaker-scope').click();
  await expect(page.locator('#mic-scope')).toHaveText('Cakap: PARTY');
  await expect(page.locator('#speaker-scope')).toHaveText('Dengar: PARTY');
  await expect(page.locator('#party-roster')).toBeVisible();
  await expect(page.locator('.party-roster-member')).toHaveCount(2);
  await expect(page.locator('#party-roster').getByText('Player', {exact: true})).toBeVisible();
  await expect(page.locator('#party-roster').getByText('Geng', {exact: true})).toBeVisible();
  await expect(page.locator('.party-leader-crown')).toHaveCount(1);

  await expect.poll(async()=>page.evaluate(()=>{
   const canvas=document.getElementById('minimap') as HTMLCanvasElement;
   const {data}=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height);
   let red=0;
   for(let i=0;i<data.length;i+=4) if(data[i]>200&&data[i+1]<120&&data[i+2]<110) red++;
   return red;
  }),{timeout:15000}).toBeGreaterThan(0);
  await expect(page.locator('#map-online')).toHaveCount(0);
 } finally { friend?.close(); vite.kill(); server.kill(); }
});
