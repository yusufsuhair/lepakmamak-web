import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';

test('Wall server owns identity, filters text, stores media and protects deletion',async()=>{
 const rows:any[]=[{id:'11111111-1111-4111-8111-111111111111',user_id:'u2',author_name:'Friend',body:'hello',media_path:null,media_type:null,media_mime:null,created_at:'2026-09-08T12:00:00Z'}];
 const uploads:string[]=[],removed:string[]=[];
 const ownId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',friendId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const users:any={valid:{id:ownId,is_anonymous:false,user_metadata:{display_name:'Real Name',profile:{bio:'Mamak fan'}}},other:{id:friendId,is_anonymous:false,user_metadata:{display_name:'Friend'}}};
 const db:any={
  auth:{getUser:async(token:string)=>({data:{user:users[token]||null},error:users[token]?null:{}}),admin:{getUserById:async(id:string)=>({data:{user:id===friendId?users.other:null},error:id===friendId?null:{}})}},
  storage:{from:()=>({getPublicUrl:(path:string)=>({data:{publicUrl:`https://cdn.test/${path}`}}),upload:async(path:string)=>{uploads.push(path);return{error:null};},remove:async(paths:string[])=>{removed.push(...paths);return{error:null};}})},
  from:()=>{let mode='list',inserted:any,filters:Record<string,string>={};const q:any={select:()=>q,order:()=>q,limit:()=>Promise.resolve({data:[...rows].reverse(),error:null}),insert:(value:any)=>{mode='insert';inserted=value;return q;},delete:()=>{mode='delete';return q;},eq:(key:string,value:string)=>{filters[key]=value;return q;},single:async()=>{if(mode==='insert'){const row={id:'22222222-2222-4222-8222-222222222222',created_at:'2026-09-08T12:01:00Z',...inserted};rows.push(row);return{data:row,error:null};}const row=rows.find(item=>(!filters.id||item.id===filters.id));return row?{data:row,error:null}:{data:null,error:{}};},then:(resolve:any)=>{if(mode==='delete'){const index=rows.findIndex(item=>item.id===filters.id);if(index>=0)rows.splice(index,1);}resolve({data:null,error:null});}};return q;}
 };
 const {createWall}=await import('../server/wall.mjs');const wall=createWall({db});const server=createServer((req,res)=>void wall.handle(req,res));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as any).port;
 const call=(path:string,method='GET',body?:any,token?:string)=>fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  expect((await call('/wall/posts')).status).toBe(200);
  expect((await call('/wall/posts','POST',{text:'forged'},undefined)).status).toBe(401);
  const created=await (await call('/wall/posts','POST',{text:'bodoh',author:'Admin',userId:'u2',mimeType:'image/png',data:'aGVsbG8='},'valid')).json();
  expect(created.post).toMatchObject({userId:ownId,author:'Real Name',text:'***',mediaType:'image'});expect(uploads).toHaveLength(1);
  expect((await call('/wall/posts/11111111-1111-4111-8111-111111111111','DELETE',undefined,'valid')).status).toBe(403);
  expect((await call('/wall/posts/22222222-2222-4222-8222-222222222222','DELETE',undefined,'valid')).status).toBe(200);expect(removed).toEqual(uploads);
  const profile=await (await call(`/wall/profile/${friendId}`)).json();expect(profile.profile).toMatchObject({name:'Friend',registered:true});
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('Wall UI is responsive, renders mixed posts and opens a social profile',async({page})=>{
 await page.route('**/src/auth.ts*',route=>route.fulfill({contentType:'application/javascript',body:'export const auth=null; export let guestName=""; export let session={access_token:"token",user:{id:"u1"}};'}));
 await page.route('**/wall-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><button id="open-wall">Wall<i id="wall-unread" hidden></i></button>'}));
 await page.route('http://wall.test/wall/posts',async route=>{if(route.request().method()==='POST'){expect(route.request().headers().authorization).toBe('Bearer token');return route.fulfill({json:{post:{id:'p2',userId:'u1',author:'Saya',text:'New post',mediaType:null,mediaUrl:null,mimeType:null,createdAt:'2026-09-08T12:10:00Z'}}});}return route.fulfill({json:{posts:[{id:'p1',userId:'u2',author:'Aina',text:'Jom lepak!',mediaType:'image',mediaUrl:'data:image/png;base64,iVBORw0KGgo=',mimeType:'image/png',createdAt:'2026-09-08T12:00:00Z'}]}});});
 await page.route('http://wall.test/wall/profile/u2',route=>route.fulfill({json:{profile:{id:'u2',name:'Aina',registered:true,details:{bio:'Teh tarik hunter'}}}}));
 await page.goto('/wall-harness');await page.evaluate(async()=>{const{setupWall}=await import('/src/wall.ts');(window as any).wall=setupWall('ws://wall.test/ws',()=>{});(window as any).wall.open();});
 await expect(page.locator('#social-wall')).toBeVisible();await expect(page.locator('.wall-post')).toContainText('Jom lepak!');await expect(page.locator('.wall-photo')).toHaveCount(1);
 await page.getByRole('button',{name:'Aina'}).click();await expect(page.locator('#wall-profile')).toBeVisible();await expect(page.locator('#wall-profile-details')).toContainText('Teh tarik hunter');await page.locator('#wall-profile-close').click();
 await page.locator('#wall-text').fill('New post');await page.locator('#wall-post').click();await expect(page.locator('.wall-post').first()).toContainText('New post');
});
