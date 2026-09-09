import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';

test('Wall server owns identity, filters text, stores media and protects deletion',async()=>{
 const rows:any[]=[{id:'11111111-1111-4111-8111-111111111111',user_id:'u2',author_name:'Friend',body:'hello',media_path:null,media_type:null,media_mime:null,created_at:'2026-09-08T12:00:00Z'}];
 const likeRows:{post_id:string;user_id:string}[]=[],replyRows:any[]=[];
 const uploads:string[]=[],removed:string[]=[];
 const ownId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',friendId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',adminId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',singerId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 const users:any={
  valid:{id:ownId,is_anonymous:false,user_metadata:{display_name:'Real Name',profile:{bio:'Mamak fan'}}},
  other:{id:friendId,is_anonymous:false,user_metadata:{display_name:'Friend'}},
  admin:{id:adminId,is_anonymous:false,email_confirmed_at:'2026-09-01T00:00:00Z',email:'yusufmohdsuhair@gmail.com',user_metadata:{display_name:'Yusuf'}},
  singer:{id:singerId,is_anonymous:false,user_metadata:{display_name:'Singer'}},
  nokey:{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',is_anonymous:false,user_metadata:{display_name:'No Key'}},
 };
 let postSeq=0,replySeq=0;
 const postsFrom=()=>{let mode='list',inserted:any,filters:Record<string,string>={};const q:any={select:()=>q,order:()=>q,limit:()=>Promise.resolve({data:[...rows].reverse(),error:null}),insert:(value:any)=>{mode='insert';inserted=value;return q;},delete:()=>{mode='delete';return q;},eq:(key:string,value:string)=>{filters[key]=value;return q;},single:async()=>{if(mode==='insert'){postSeq++;const row={id:`22222222-2222-4222-8222-${String(postSeq).padStart(12,'0')}`,created_at:'2026-09-08T12:01:00Z',...inserted};rows.push(row);return{data:row,error:null};}const row=rows.find(item=>(!filters.id||item.id===filters.id));return row?{data:row,error:null}:{data:null,error:{}};},then:(resolve:any)=>{if(mode==='delete'){const index=rows.findIndex(item=>item.id===filters.id);if(index>=0)rows.splice(index,1);}resolve({data:null,error:null});}};return q;};
 const likesFrom=()=>{const filters:Record<string,string>={};let inKey='',inValues:string[]=[],mode:'select'|'delete'='select';const matches=(row:any)=>Object.entries(filters).every(([k,v])=>row[k]===v)&&(!inKey||inValues.includes(row[inKey]));const q:any={select:()=>q,eq:(key:string,value:string)=>{filters[key]=value;return q;},in:(key:string,values:string[])=>{inKey=key;inValues=values;return q;},delete:()=>{mode='delete';return q;},insert:(value:any)=>{likeRows.push(value);return Promise.resolve({data:null,error:null});},single:async()=>{const row=likeRows.find(matches);return row?{data:row,error:null}:{data:null,error:{code:'PGRST116'}};},then:(resolve:any)=>{if(mode==='delete'){for(let i=likeRows.length-1;i>=0;i--)if(matches(likeRows[i]))likeRows.splice(i,1);resolve({data:null,error:null});return;}resolve({data:likeRows.filter(matches),error:null});}};return q;};
 const repliesFrom=()=>{const filters:Record<string,string>={};let inKey='',inValues:string[]=[],mode:'select'|'insert'='select',inserted:any;const matches=(row:any)=>Object.entries(filters).every(([k,v])=>row[k]===v)&&(!inKey||inValues.includes(row[inKey]));const q:any={select:()=>q,eq:(key:string,value:string)=>{filters[key]=value;return q;},in:(key:string,values:string[])=>{inKey=key;inValues=values;return q;},order:()=>q,insert:(value:any)=>{mode='insert';inserted=value;return q;},limit:(n:number)=>Promise.resolve({data:replyRows.filter(matches).slice(0,n),error:null}),single:async()=>{if(mode==='insert'){replySeq++;const row={id:`33333333-3333-4333-8333-${String(replySeq).padStart(12,'0')}`,created_at:'2026-09-08T12:02:00Z',...inserted};replyRows.push(row);return{data:row,error:null};}const row=replyRows.find(matches);return row?{data:row,error:null}:{data:null,error:{}};},then:(resolve:any)=>{resolve({data:replyRows.filter(matches),error:null});}};return q;};
 const db:any={
  auth:{getUser:async(token:string)=>({data:{user:users[token]||null},error:users[token]?null:{}}),admin:{getUserById:async(id:string)=>({data:{user:id===friendId?users.other:null},error:id===friendId?null:{}})}},
  storage:{from:()=>({getPublicUrl:(path:string)=>({data:{publicUrl:`https://cdn.test/${path}`}}),upload:async(path:string)=>{uploads.push(path);return{error:null};},remove:async(paths:string[])=>{removed.push(...paths);return{error:null};}})},
  from:(table:string)=>table==='social_post_likes'?likesFrom():table==='social_post_replies'?repliesFrom():postsFrom(),
 };
 let verdict:any={safe:true};
 const {createWall}=await import('../server/wall.mjs');const {createRateLimiter}=await import('../server/limits.mjs');
 const wall=createWall({db,moderateImage:async()=>verdict,profileLimit:createRateLimiter({limit:1,windowMs:60000})});const server=createServer((req,res)=>void wall.handle(req,res));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as any).port;
 const call=(path:string,method='GET',body?:any,token?:string)=>fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  expect((await call('/wall/posts')).status).toBe(200);
  expect((await call('/wall/posts','POST',{text:'forged'},undefined)).status).toBe(401);
  expect((await call('/wall/posts','POST',{text:'fake image',mimeType:'image/png',data:'PHNjcmlwdD4='},'valid')).status).toBe(400);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  verdict={safe:false,reason:'explicit'};
  expect((await call('/wall/posts','POST',{text:'nudes',mimeType:'image/png',data:png},'valid')).status).toBe(422);
  verdict={safe:false,reason:'unreachable'};
  expect((await call('/wall/posts','POST',{text:'photo',mimeType:'image/png',data:png},'valid')).status).toBe(503);
  expect(uploads).toHaveLength(0);
  verdict={safe:true};
  const created=await (await call('/wall/posts','POST',{text:'bodoh',author:'Admin',userId:'u2',mimeType:'image/png',data:png},'valid')).json();
  expect(created.post).toMatchObject({userId:ownId,author:'Real Name',text:'***',mediaType:'image',gameMaster:false,likeCount:0,likedByMe:false,replyCount:0});expect(uploads).toHaveLength(1);
  const adminCreated=await (await call('/wall/posts','POST',{text:'GM here'},'admin')).json();
  expect(adminCreated.post).toMatchObject({userId:adminId,author:'Yusuf',text:'GM here',gameMaster:true,likeCount:0,likedByMe:false,replyCount:0});
  const adminPostId=adminCreated.post.id;
  expect((await call(`/wall/posts/${adminPostId}/like`,'POST')).status).toBe(401);
  expect(await (await call(`/wall/posts/${adminPostId}/like`,'POST',undefined,'valid')).json()).toEqual({liked:true,likeCount:1});
  expect(await (await call(`/wall/posts/${adminPostId}/like`,'POST',undefined,'valid')).json()).toEqual({liked:false,likeCount:0});
  expect(await (await call(`/wall/posts/${adminPostId}/like`,'POST',undefined,'valid')).json()).toEqual({liked:true,likeCount:1});
  expect((await call(`/wall/posts/${adminPostId}/replies`,'POST',{text:'hi'})).status).toBe(401);
  const repliedRaw=await call(`/wall/posts/${adminPostId}/replies`,'POST',{text:'bodoh'},'other');expect(repliedRaw.status).toBe(201);
  const replied=await repliedRaw.json();expect(replied.reply).toMatchObject({postId:adminPostId,userId:friendId,author:'Friend',text:'***',gameMaster:false});
  const repliesList=await (await call(`/wall/posts/${adminPostId}/replies`)).json();expect(repliesList.replies).toHaveLength(1);expect(repliesList.replies[0].text).toBe('***');
  const feed=await (await call('/wall/posts','GET',undefined,'valid')).json();
  expect(feed.posts.find((post:any)=>post.id===adminPostId)).toMatchObject({gameMaster:true,likeCount:1,likedByMe:true,replyCount:1});
  expect((await call('/wall/posts/11111111-1111-4111-8111-111111111111','DELETE',undefined,'valid')).status).toBe(403);
  expect((await call(`/wall/posts/${created.post.id}`,'DELETE',undefined,'valid')).status).toBe(200);expect(removed).toEqual(uploads);
  const profile=await (await call(`/wall/profile/${friendId}`)).json();expect(profile.profile).toMatchObject({name:'Friend',registered:true});
  // Reading a profile is unauthenticated but spends a Supabase admin call, so it is capped.
  expect((await call(`/wall/profile/${friendId}`)).status).toBe(429);
  verdict={safe:false,reason:'explicit'};
  expect((await call('/wall/posts','POST',{mimeType:'audio/ogg',data:Buffer.from('OggSvoicenote').toString('base64')},'singer')).status).toBe(201);
  // No OPENAI_API_KEY must block the photo rather than publish it unchecked: README and
  // the release notes both promise screening fails closed without a key.
  verdict={safe:false,reason:'unconfigured'};
  expect((await call('/wall/posts','POST',{text:'screening off',mimeType:'image/png',data:png},'nokey')).status).toBe(503);
  // Text-only posts stay available while photos are blocked.
  expect((await call('/wall/posts','POST',{text:'no photo, still fine'},'nokey')).status).toBe(201);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('image moderator flags explicit uploads and fails closed when it cannot decide',async()=>{
 const {createImageModerator}=await import('../server/image-moderation.mjs');
 const bytes=Buffer.from('fake-image-bytes');
 const ok=(body:any):any=>async()=>({ok:true,json:async()=>body});
 const check=(fetch:any,apiKey='k')=>createImageModerator({apiKey,fetch}).check(bytes,'image/png');
 expect(await createImageModerator({apiKey:''}).check(bytes,'image/png')).toEqual({safe:false,reason:'unconfigured'});
 let sent:any;
 expect(await check((async(url:string,init:any)=>{sent={url,init};return{ok:true,json:async()=>({results:[{categories:{sexual:false},category_scores:{sexual:0.01}}]})};}) as any)).toEqual({safe:true});
 expect(sent.url).toBe('https://api.openai.com/v1/moderations');
 expect(sent.init.headers.Authorization).toBe('Bearer k');
 expect(JSON.parse(sent.init.body)).toMatchObject({model:'omni-moderation-latest',input:[{type:'image_url',image_url:{url:`data:image/png;base64,${bytes.toString('base64')}`}}]});
 expect(await check(ok({results:[{categories:{sexual:true},category_scores:{sexual:0.99}}]}))).toEqual({safe:false,reason:'explicit'});
 expect(await check(ok({results:[{categories:{sexual:false},category_scores:{sexual:0.8}}]}))).toEqual({safe:false,reason:'explicit'});
 expect(await check((async()=>{throw Error('offline');}) as any)).toEqual({safe:false,reason:'unreachable'});
 expect(await check((async()=>({ok:false})) as any)).toEqual({safe:false,reason:'unavailable'});
 expect(await check(ok({results:[]}))).toEqual({safe:false,reason:'unreadable'});
});

test('Wall UI is responsive, renders mixed posts and opens a social profile',async({page})=>{
 await page.route('**/src/auth.ts*',route=>route.fulfill({contentType:'application/javascript',body:'export const auth=null; export let guestName=""; export let session={access_token:"token",user:{id:"u1"}};'}));
 await page.route('**/wall-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><button id="open-wall">Wall<i id="wall-unread" hidden></i></button>'}));
 await page.route('http://wall.test/wall/posts',async route=>{if(route.request().method()==='POST'){expect(route.request().headers().authorization).toBe('Bearer token');return route.fulfill({json:{post:{id:'p2',userId:'u1',author:'Saya',text:'New post',mediaType:null,mediaUrl:null,mimeType:null,createdAt:'2026-09-08T12:10:00Z',gameMaster:false,likeCount:0,likedByMe:false,replyCount:0}}});}return route.fulfill({json:{posts:[{id:'p1',userId:'u2',author:'Aina',text:'<script>window.pwned=1</script><img src=x onerror=alert(1)> Jom lepak!',mediaType:'image',mediaUrl:'data:image/png;base64,iVBORw0KGgo=',mimeType:'image/png',createdAt:'2026-09-08T12:00:00Z',gameMaster:true,likeCount:2,likedByMe:false,replyCount:1}]}});});
 await page.route('http://wall.test/wall/profile/u2',route=>route.fulfill({json:{profile:{id:'u2',name:'Aina',registered:true,details:{bio:'Teh tarik hunter'}}}}));
 await page.route('http://wall.test/wall/posts/p1/like',route=>route.fulfill({json:{liked:true,likeCount:3}}));
 await page.route('http://wall.test/wall/posts/p1/replies',async route=>{if(route.request().method()==='POST')return route.fulfill({json:{reply:{id:'r2',postId:'p1',userId:'u1',author:'Saya',text:'Setuju!',gameMaster:false,createdAt:'2026-09-08T12:11:00Z'}}});return route.fulfill({json:{replies:[{id:'r1',postId:'p1',userId:'u3',author:'Bob',text:'Jom!',gameMaster:false,createdAt:'2026-09-08T12:05:00Z'}]}});});
 await page.goto('/wall-harness');await page.evaluate(async()=>{const{setupWall}=await import('/src/wall.ts');(window as any).wall=setupWall('ws://wall.test/ws',()=>{});(window as any).wall.open();});
 await expect(page.locator('#social-wall')).toBeVisible();await expect(page.locator('.wall-post')).toContainText('<script>window.pwned=1</script>');await expect(page.locator('.wall-photo')).toHaveCount(1);await expect(page.locator('.wall-post script, .wall-post img[src="x"]')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).pwned)).toBeUndefined();
 await expect(page.locator('.wall-gm-badge')).toContainText('GM');
 await page.locator('.wall-like').click();await expect(page.locator('.wall-like')).toContainText('3');await expect(page.locator('.wall-like')).toHaveClass(/liked/);
 await page.locator('.wall-reply-toggle').click();await expect(page.locator('.wall-reply')).toContainText('Jom!');
 await page.locator('.wall-reply-composer input').fill('Setuju!');await page.locator('.wall-reply-composer button').click();await expect(page.locator('.wall-reply-thread')).toContainText('Setuju!');
 await page.getByRole('button',{name:'Aina'}).click();await expect(page.locator('#wall-profile')).toBeVisible();await expect(page.locator('#wall-profile-details')).toContainText('Teh tarik hunter');await page.locator('#wall-profile-close').click();
 await page.locator('#wall-text').fill('New post');await page.locator('#wall-post').click();await expect(page.locator('.wall-post').first()).toContainText('New post');
});
