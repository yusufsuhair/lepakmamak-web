import {test,expect} from '@playwright/test';
import {cleanProfile,publicProfile} from '../server/profiles.mjs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
test('public profiles whitelist fields, mask profanity and never expose guest metadata',()=>{
 const details=cleanProfile({bio:'bodoh',hometown:'x'.repeat(80),email:'secret@test.com',gameMaster:true});expect(details.bio).toBe('***');expect(details.hometown).toHaveLength(40);expect(details).not.toHaveProperty('email');
 expect(publicProfile({id:'g',name:'Guest',profile:{bio:'Fake'}})).toMatchObject({registered:false,details:null});
});
test('profile reads and refreshes trust the authenticated account, not guest or payload claims',async()=>{
 const user={id:'account-a',user_metadata:{display_name:'Member',profile:{bio:'Teh tarik fan',mamakOrder:'Roti telur'}}};
 const authServer=createServer((_req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(user));});await new Promise<void>(r=>authServer.listen(0,'127.0.0.1',r));
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8087',SUPABASE_URL:`http://127.0.0.1:${(authServer.address() as any).port}`,SUPABASE_PUBLISHABLE_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});const clients:WebSocket[]=[];
 const token=`x.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.x`;
 async function join(payload:any){const ws=new WebSocket('ws://127.0.0.1:8087/ws');clients.push(ws);const messages:any[]=[];await new Promise<void>((r,j)=>{ws.on('error',j);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'profiles',...payload})));ws.on('message',raw=>{const m=JSON.parse(String(raw));messages.push(m);if(m.type==='welcome')r();});});return{ws,messages,id:messages.find(m=>m.type==='welcome').id};}
 try{await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8087/health')).ok;}catch{return false;}}).toBe(true);
 const member=await join({accessToken:token});const guest=await join({guest:true,name:'Visitor',profile:{bio:'Spoofed'}});
 expect(member.messages.find(m=>m.type==='welcome').players[0]).not.toHaveProperty('profile');
 guest.ws.send(JSON.stringify({type:'profile-view',id:member.id}));await expect.poll(()=>guest.messages.find(m=>m.type==='profile')?.profile?.details.bio).toBe('Teh tarik fan');
 user.user_metadata.profile.bio='Updated account bio';member.ws.send(JSON.stringify({type:'profile-refresh',accessToken:token,profile:{bio:'Forged socket bio'}}));await expect.poll(()=>guest.messages.filter(m=>m.type==='profile').at(-1)?.profile?.details.bio).toBe('Updated account bio');
 guest.ws.send(JSON.stringify({type:'profile-refresh',accessToken:token}));await new Promise(r=>setTimeout(r,270));guest.ws.send(JSON.stringify({type:'profile-view',id:guest.id}));await expect.poll(()=>guest.messages.filter(m=>m.type==='profile').at(-1)?.profile?.registered).toBe(false);
 }finally{clients.forEach(ws=>ws.close());server.kill();authServer.close();}
});
test('profile editor saves optional account fields, reloads them and renders safely on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/profile-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="profile-details"></div>'}));
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export let guestName='';export let session={user:{id:'member'}};export const auth={auth:{getUser:async()=>({data:{user:{id:'member',user_metadata:{profile:JSON.parse(localStorage.getItem('test-profile')||'{}')}}}}),updateUser:async({data})=>{localStorage.setItem('test-profile',JSON.stringify(data.profile));return {error:null};}}};`}));
 const open=async()=>{await page.evaluate(async()=>{const m=await import('/src/profile.ts');(window as any).profileModule=m;const editor=m.setupProfileEditor(async()=>{});await editor.open();});};
 await page.goto('/profile-harness');await open();await page.locator('#profile-bio').fill('Here for good company');await page.locator('#profile-mamakOrder').fill('Roti telur + teh tarik');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.locator('#edit-profile')).not.toBeVisible();
 await page.reload();await open();await expect(page.locator('#profile-bio')).toHaveValue('Here for good company');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>{(window as any).profileModule.renderProfile(document.getElementById('profile-details'),{id:'member',name:'Member',registered:true,details:{bio:'<img src=x onerror=alert(1)>',mamakOrder:'Roti telur'}});});
 await expect(page.locator('#profile-details img')).toHaveCount(0);await expect(page.locator('#profile-details')).toContainText('Roti telur');
});

test('guests have no profile editor in settings',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#menu').click();await expect(page.locator('#open-edit-profile')).toBeHidden();
});
