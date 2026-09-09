import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {gmAnnouncement} from '../server/announce.mjs';

const PORT='8129';

test('only a Game Master turns /gm into an announcement',()=>{
 const gm={gameMaster:true}, player={gameMaster:false};
 expect(gmAnnouncement(gm,'/gm Jom kumpul pukul 9')).toEqual({allowed:true,text:'Jom kumpul pukul 9'});
 expect(gmAnnouncement(player,'/gm Jom kumpul pukul 9')).toEqual({allowed:false,text:'Jom kumpul pukul 9'});
});

test('ordinary chat is never mistaken for a command',()=>{
 const gm={gameMaster:true};
 expect(gmAnnouncement(gm,'hello everyone')).toBeNull();
 expect(gmAnnouncement(gm,'/gmail is down')).toBeNull();
 // A bare command with nothing to say is not an announcement.
 expect(gmAnnouncement(gm,'/gm   ')).toBeNull();
});

test('a player who is not the Game Master cannot broadcast one',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const sockets:WebSocket[]=[];
 const seen:any[]=[];
 const connect=(name:string,collect=false)=>new Promise<WebSocket>((resolve,reject)=>{
  const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);sockets.push(ws);
  ws.on('error',reject);
  ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'gm-test',guest:true,name})));
  ws.on('message',raw=>{const m=JSON.parse(String(raw));if(collect)seen.push(m);if(m.type==='welcome')resolve(ws);});
 });
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);
  const pretender=await connect('Pretender');
  await connect('Bystander',true);
  await new Promise(r=>setTimeout(r,250));

  pretender.send(JSON.stringify({type:'chat',text:'/gm everyone give me your chips'}));
  await new Promise(r=>setTimeout(r,600));
  expect(seen.some(m=>m.type==='gm-announce')).toBe(false);
  // And it must not leak into the room as ordinary chat either.
  expect(seen.some(m=>m.type==='chat'&&/give me your chips/.test(m.text))).toBe(false);
 } finally { sockets.forEach(ws=>ws.close()); server.kill(); }
});

test('the crawl shows the message, moves the HUD aside, and clears itself',async({page})=>{
 await page.route('**/gm-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/gm-harness');
 await page.evaluate(async()=>{
  const {createAnnouncer}=await import('/src/announce.ts');
  (window as any).gm=createAnnouncer(document.getElementById('hud')!,300);
 });
 await expect(page.locator('#gm-announce')).toBeHidden();

 await page.evaluate(()=>(window as any).gm.show('Jom kumpul di Mamak Maju','Yusuf'));
 await expect(page.locator('#gm-announce')).toBeVisible();
 await expect(page.locator('#gm-announce')).toContainText('Jom kumpul di Mamak Maju');
 await expect(page.locator('#gm-announce')).toContainText('GM');
 // The HUD has to move down while the strip owns the top edge.
 await expect(page.locator('body')).toHaveClass(/gm-announcing/);

 await expect(page.locator('#gm-announce')).toBeHidden({timeout:5000});
 await expect(page.locator('body')).not.toHaveClass(/gm-announcing/);
});

test('a second announcement replaces the first rather than queueing behind it',async({page})=>{
 await page.route('**/gm-replace-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/gm-replace-harness');
 await page.evaluate(async()=>{
  const {createAnnouncer}=await import('/src/announce.ts');
  (window as any).gm=createAnnouncer(document.getElementById('hud')!,4000);
 });
 await page.evaluate(()=>(window as any).gm.show('First message','Yusuf'));
 await page.evaluate(()=>(window as any).gm.show('Second message','Yusuf'));
 await expect(page.locator('#gm-announce')).toContainText('Second message');
 await expect(page.locator('#gm-announce')).not.toContainText('First message');
});
