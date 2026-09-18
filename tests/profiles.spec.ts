import {test,expect} from '@playwright/test';
import {cleanProfile,publicProfile} from '../server/profiles.mjs';
import {earnedAchievementIds} from '../server/social-profiles.mjs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
test('public profiles whitelist fields, mask profanity and never expose guest metadata',()=>{
 const details=cleanProfile({bio:'bodoh',hometown:'x'.repeat(80),email:'secret@test.com',gameMaster:true});expect(details.bio).toBe('***');expect(details.hometown).toHaveLength(40);expect(details).not.toHaveProperty('email');
 expect(publicProfile({id:'g',name:'Guest',profile:{bio:'Fake'}})).toMatchObject({registered:false,details:null});
});
test('achievement thresholds are server-owned and deterministic',()=>{
 expect(earnedAchievementIds({sessions:1,recalls:49,dances:9,punches:24,tables_sat:9,basketball_points:24})).toEqual(['first_lepak']);
 expect(earnedAchievementIds({sessions:7,recalls:50,dances:10,punches:25,tables_sat:10,basketball_points:25})).toEqual(['first_lepak','regular','recall_rider','dance_floor','street_fighter','table_regular','hoops']);
});
test('profile reads and refreshes trust the authenticated account, not guest or payload claims',async()=>{
 const user={id:'account-a',user_metadata:{display_name:'Member',profile:{bio:'Teh tarik fan',socialMedia:'@tehtarikfan'}}};
 const authServer=createServer((_req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(user));});await new Promise<void>(r=>authServer.listen(0,'127.0.0.1',r));
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8087',ALLOW_GUESTS:'true',SUPABASE_URL:`http://127.0.0.1:${(authServer.address() as any).port}`,SUPABASE_PUBLISHABLE_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});const clients:WebSocket[]=[];
 const token=`x.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.x`;
 async function join(payload:any){const ws=new WebSocket('ws://127.0.0.1:8087/ws');clients.push(ws);const messages:any[]=[];await new Promise<void>((r,j)=>{ws.on('error',j);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'profiles',...payload})));ws.on('message',raw=>{const m=JSON.parse(String(raw));messages.push(m);if(m.type==='welcome')r();});});return{ws,messages,id:messages.find(m=>m.type==='welcome').id};}
 try{await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8087/health')).ok;}catch{return false;}}).toBe(true);
 const member=await join({accessToken:token});const guest=await join({guest:true,name:'Roti Canai 42',profile:{bio:'Spoofed'}});
 expect(member.messages.find(m=>m.type==='welcome').players[0]).not.toHaveProperty('profile');
 guest.ws.send(JSON.stringify({type:'profile-view',id:member.id}));await expect.poll(()=>guest.messages.find(m=>m.type==='profile')?.profile?.details.bio).toBe('Teh tarik fan');await expect.poll(()=>guest.messages.find(m=>m.type==='profile')?.profile?.details.socialMedia).toBe('@tehtarikfan');
 user.user_metadata.profile.bio='Updated account bio';member.ws.send(JSON.stringify({type:'profile-refresh',accessToken:token,profile:{bio:'Forged socket bio'}}));await expect.poll(()=>guest.messages.filter(m=>m.type==='profile').at(-1)?.profile?.details.bio).toBe('Updated account bio');
 guest.ws.send(JSON.stringify({type:'profile-refresh',accessToken:token}));await new Promise(r=>setTimeout(r,270));guest.ws.send(JSON.stringify({type:'profile-view',id:guest.id}));await expect.poll(()=>guest.messages.filter(m=>m.type==='profile').at(-1)?.profile?.registered).toBe(false);
 }finally{clients.forEach(ws=>ws.close());server.kill();authServer.close();}
});
test('profile editor shows a skeleton while the account is loading',async({page})=>{
 await page.route('**/profile-loading-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><main></main>'}));
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export let guestName='';export let session={user:{id:'member'}};export const auth={auth:{getUser:()=>new Promise(resolve=>{window.releaseProfile=()=>resolve({data:{user:{id:'member',user_metadata:{display_name:'Member',profile:{}}}},error:null});}),updateUser:async()=>({error:null})}};`}));
 await page.goto('/profile-loading-harness');
 await page.evaluate(async()=>{const m=await import('/src/profile.ts');const editor=m.setupProfileEditor(async()=>{});(window as any).profileOpen=editor.open();});
 await expect(page.locator('#profile-editor-skeleton')).toBeVisible();await expect(page.locator('#profile-fields')).toBeHidden();await expect(page.locator('#profile-save-status')).toContainText('Loading your profile');await expect(page.getByRole('button',{name:'Loading…'})).toBeDisabled();
 await page.evaluate(()=>{(window as any).releaseProfile();});await page.evaluate(()=> (window as any).profileOpen);await expect(page.locator('#profile-editor-skeleton')).toBeHidden();await expect(page.locator('#profile-fields')).toBeVisible();await expect(page.getByRole('button',{name:'Save profile',exact:true})).toBeEnabled();
});
test('profile editor saves optional account fields, reloads them and renders safely on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/profile-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="profile-details"></div>'}));
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export let guestName='';export let session={user:{id:'member'}};export const auth={auth:{getUser:async()=>({data:{user:{id:'member',user_metadata:{display_name:localStorage.getItem('test-name')||'Member',profile:JSON.parse(localStorage.getItem('test-profile')||'{}')}}}}),updateUser:async({data})=>{localStorage.setItem('test-name',data.display_name);localStorage.setItem('test-profile',JSON.stringify(data.profile));return {error:null};}}};`}));
 const open=async()=>{await page.evaluate(async()=>{const m=await import('/src/profile.ts');(window as any).profileModule=m;const editor=m.setupProfileEditor(async()=>{});await editor.open();});};
 await page.goto('/profile-harness');await open();await page.locator('#profile-display-name').fill('Aina Baru');await page.locator('#profile-bio').fill('Here for good company');await page.locator('#profile-socialMedia').fill('@tehtarikfan');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.locator('#edit-profile')).not.toBeVisible();
 await page.reload();await open();await expect(page.locator('#profile-display-name')).toHaveValue('Aina Baru');await expect(page.locator('#profile-bio')).toHaveValue('Here for good company');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>{(window as any).profileModule.renderProfile(document.getElementById('profile-details'),{id:'member',name:'Member',registered:true,details:{bio:'<img src=x onerror=alert(1)>',socialMedia:'@tehtarikfan'}});});
 await expect(page.locator('#profile-details img')).toHaveCount(0);await expect(page.locator('#profile-details')).toContainText('@tehtarikfan');
});

test('viewing another player shows a full-width loading state, not text jammed at the top',async({page})=>{
 await page.route('**/social-profile-loading-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/profile-social.css"><div id="profile-details"></div>'}));
 await page.goto('/social-profile-loading-harness');
 await page.evaluate(async()=>{const {renderProfileLoading}=await import('/src/profile.ts');renderProfileLoading(document.getElementById('profile-details')!);});
 const details=page.locator('#profile-details');
 await expect(details.locator('.profile-hero-skeleton')).toBeVisible();
 await expect(details.locator('.profile-message')).toHaveText('Loading profile…');
 // The old bare textContent had no top padding, so it sat flush under the (visually hidden)
 // dialog title. The skeleton hero now occupies that space, same as a loaded profile would.
 const heroTop=await details.locator('.profile-hero-skeleton').evaluate(el=>el.getBoundingClientRect().top);
 const containerTop=await details.evaluate(el=>el.getBoundingClientRect().top);
 expect(heroTop-containerTop).toBeLessThan(4);
 await page.evaluate(async()=>{const {renderProfileMessage}=await import('/src/profile.ts');renderProfileMessage(document.getElementById('profile-details')!,'This player has left the city.');});
 const message=details.locator('.profile-message');
 await expect(message).toHaveText('This player has left the city.');
 const paddingTop=await message.evaluate(el=>parseFloat(getComputedStyle(el).paddingTop));
 expect(paddingTop).toBeGreaterThan(20);   // centred with real padding, not jammed at the edge
});
test('signed-out players have no profile editor in settings',async({page})=>{
 await page.goto('/');await expect(page.locator('#open-edit-profile')).toBeHidden();
});
test('settings has no duplicate social profile action',async({page})=>{
 await page.goto('/');await expect(page.locator('#open-my-profile')).toHaveCount(0);
});
test('profile view keeps unset detail fields visible as dashes',async({page})=>{
 await page.route('**/profile-empty-details-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="profile-details"></div>'}));await page.goto('/profile-empty-details-harness');
 await page.evaluate(async()=>{const {renderProfile}=await import('/src/profile.ts');renderProfile(document.getElementById('profile-details')!,{id:'member',name:'Member',registered:true,details:{}});});
 await expect(page.locator('.profile-about dt')).toHaveCount(6);await expect(page.locator('.profile-about dd')).toHaveCount(6);await expect(page.locator('.profile-about dd').first()).toHaveText('-');await expect(page.locator('.profile-about dd').last()).toHaveText('-');
});
test('complete social profile renders achievements, activity and a safe guestbook on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.route('**/social-profile-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="profile-details"></div>'}));await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export let guestName='';export let session={access_token:'token',user:{id:'viewer'}};export const auth=null;`}));await page.goto('/social-profile-harness');
 await page.evaluate(async()=>{const {renderProfile}=await import('/src/profile.ts');renderProfile(document.getElementById('profile-details'),{id:'member',name:'Aina <script>',registered:true,details:{bio:'Mamak explorer',favouriteHangout:'Basket Lepak',geng:'Geng Malam'},stats:{sessions:9,recalls:54,dances:12,basketballPoints:31},achievements:[{id:'hoops',name:'Hoops!',detail:'Scored 25 basketball points',unlockedAt:new Date().toISOString()}],activity:[{type:'achievement',label:'Unlocked Hoops!',createdAt:new Date().toISOString()}],posts:[{id:'p',text:'Jumpa kat mamak',mediaType:null,createdAt:new Date().toISOString()}],guestbook:[{id:'g',authorId:'x',author:'<img onerror=alert(1)>',text:'Hello <script>',createdAt:new Date().toISOString()}]});});
 await expect(page.locator('.profile-hero h3')).toHaveText('Aina <script>');await expect(page.locator('.profile-achievements')).toContainText('Hoops!');await expect(page.locator('.profile-stats')).toContainText('31');await expect(page.locator('.profile-activity')).toContainText('Jumpa kat mamak');await expect(page.locator('#profile-details script,#profile-details img')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
