import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
test('self dance menu triggers a synchronized ten second dance and cannot be spammed',async({page})=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8088',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5180','--strictPort'],{env:{...process.env,VITE_MULTIPLAYER_URL:'ws://127.0.0.1:8088',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});let friend:WebSocket|undefined;let players:any[]=[];let friendId='';
 // A node server and a cold vite cannot both be serving inside expect.poll's default 5 s on a
 // machine that is also running the rest of the suite. Wait for them properly instead.
 try{await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8088/health')).ok&&(await fetch('http://127.0.0.1:5180')).ok;}catch{return false;}},{timeout:90000}).toBe(true);
 await page.goto('http://127.0.0.1:5180/?room=dance-test');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Dancer');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');
 friend=new WebSocket('ws://127.0.0.1:8088/ws');friend.on('open',()=>friend!.send(JSON.stringify({type:'join',guest:true,name:'Watcher',room:'dance-test',resume:{x:0,z:0,yaw:0}})));friend.on('message',raw=>{const m=JSON.parse(String(raw));if(m.players)players=m.players;if(m.type==='welcome')friendId=m.id;});await expect.poll(()=>friendId).not.toBe('');
 // profileScreen is projected through a camera that is still easing in, and it now starts at the
 // widest zoom, so a point read a frame ago can land beside a smaller avatar and the raycast
 // finds nobody. Re-aim and click again; a menu that never opens still fails.
 const rightClickSelf=()=>expect(async()=>{const p=await page.evaluate(()=>(window as any).__lepak.profileScreen);await page.mouse.click(p.x,p.y,{button:'right'});await expect(page.locator('#dance-action')).toBeVisible({timeout:1000});}).toPass({timeout:20000});
 await rightClickSelf();await page.locator('#dance-action').click();await expect.poll(()=>players.find(p=>p.name==='Dancer')?.danceUntil).toBeGreaterThan(Date.now());
 const before=await page.evaluate(()=>(window as any).__lepak.position);await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');expect(await page.evaluate(()=>(window as any).__lepak.position)).toEqual(before);
 friend.send(JSON.stringify({type:'dance'}));await expect.poll(()=>players.find(p=>p.id===friendId)?.danceUntil).toBeGreaterThan(Date.now());const until=players.find(p=>p.id===friendId).danceUntil;friend.send(JSON.stringify({type:'dance'}));await page.waitForTimeout(150);expect(players.find(p=>p.id===friendId).danceUntil).toBe(until);
 await rightClickSelf();await expect(page.locator('#dance-action')).toHaveText('Stop dance');await page.locator('#dance-action').click();await expect.poll(()=>players.find(p=>p.name==='Dancer')?.danceUntil).toBe(0);expect(players.find(p=>p.id===friendId).danceUntil).toBe(until);
 }finally{friend?.close();vite.kill();server.kill();}
});
test('dance audio falls off with distance',async({page})=>{await page.goto('/');const gains=await page.evaluate(async()=>{const {danceVolume}=await import('/src/dance.ts');return [0,3,10,18,50].map(danceVolume);});expect(gains[0]).toBe(.42);expect(gains[2]).toBeLessThan(gains[1]);expect(gains[3]).toBe(0);expect(gains[4]).toBe(0);});
test('dance bends elbows and restores the avatar hierarchy when finished',async({page})=>{await page.goto('/');const result=await page.evaluate(async()=>{const {createPerson}=await import('/src/world.ts');const {dancePose}=await import('/src/dance.ts');const p=createPerson();const parts=[...p.group.children];const forearm=p.leftArm.children[1];const y=forearm.position.y;dancePose(p,8000,2.2);const bent=forearm.parent!==p.leftArm;dancePose(p,0,10);return {bent,restored:parts.every(o=>o.parent===p.group)&&forearm.parent===p.leftArm&&forearm.position.y===y};});expect(result).toEqual({bent:true,restored:true});});
