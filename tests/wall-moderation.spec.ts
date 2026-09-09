import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {createWall} from '../server/wall.mjs';

// The Wall is the one live surface that never goes through the socket, so the socket's
// mute gate cannot see it. These check the HTTP side refuses on its own.
test('a muted or banned account cannot post or reply on the Wall, but can still like',async()=>{
 const inserted:any[]=[];
 const likes:any[]=[];
 const users:any={
  muted:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:false,user_metadata:{display_name:'Muted'}},
  banned:{id:'22222222-2222-4222-8222-222222222222',is_anonymous:false,user_metadata:{display_name:'Banned'}},
  clear:{id:'33333333-3333-4333-8333-333333333333',is_anonymous:false,user_metadata:{display_name:'Clear'}},
  broken:{id:'44444444-4444-4444-8444-444444444444',is_anonymous:false,user_metadata:{display_name:'Broken'}},
 };
 const table=(name:string)=>{
  const q:any={
   select:()=>q,order:()=>q,eq:()=>q,in:()=>q,delete:()=>q,limit:async()=>({data:[],error:null}),
   insert:(value:any)=>{(name==='social_post_likes'?likes:inserted).push({table:name,...value});return q;},
   // No existing like, so the like endpoint takes its insert branch rather than unliking.
   single:async()=>name==='social_post_likes'?{data:null,error:{code:'PGRST116'}}
    :{data:{id:'55555555-5555-4555-8555-555555555555',created_at:'2026-09-10T12:00:00Z',...inserted.at(-1)},error:null},
   then:(resolve:any)=>resolve({data:[],error:null}),
  };
  return q;
 };
 const db:any={
  auth:{getUser:async(token:string)=>({data:{user:users[token]||null},error:users[token]?null:{}})},
  storage:{from:()=>({getPublicUrl:(path:string)=>({data:{publicUrl:`https://cdn.test/${path}`}})})},
  from:table,
 };
 const moderation={
  status:async(userId:string)=>{
   if(userId===users.muted.id)return{banned:false,muted:true,until:null,reason:'slurs'};
   if(userId===users.banned.id)return{banned:true,muted:false,until:null,reason:'threats'};
   if(userId===users.broken.id)throw new Error('Could not check moderation status');
   return{banned:false,muted:false,until:null,reason:''};
  },
 };
 const wall=createWall({db,moderation});
 const server=createServer((request,response)=>void wall.handle(request,response));
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=(server.address() as any).port;
 const call=(path:string,method:string,token:string,body?:any)=>fetch(`http://127.0.0.1:${port}${path}`,{
  method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{}),
 });
 const postId='66666666-6666-4666-8666-666666666666';
 try{
  const mutedPost=await call('/wall/posts','POST','muted',{text:'this should not land'});
  expect(mutedPost.status).toBe(403);
  expect((await mutedPost.json()).error).toContain('muted');

  expect((await call(`/wall/posts/${postId}/replies`,'POST','muted',{text:'nor this'})).status).toBe(403);
  expect((await call('/wall/posts','POST','banned',{text:'nor this'})).status).toBe(403);
  expect(inserted).toEqual([]);

  // Fails closed: one refused post during a Supabase blip beats a banned account getting
  // a photo onto a public wall because the check could not run.
  const unknown=await call('/wall/posts','POST','broken',{text:'unknowable'});
  expect(unknown.status).toBe(503);
  expect(inserted).toEqual([]);

  // A like carries none of the player's own words, so a mute does not reach it.
  expect((await call(`/wall/posts/${postId}/like`,'POST','muted')).status).toBe(200);
  expect(likes).toHaveLength(1);

  expect((await call('/wall/posts','POST','clear',{text:'ordinary post'})).status).toBe(201);
  expect(inserted).toHaveLength(1);
  expect(inserted[0]).toMatchObject({body:'ordinary post',author_name:'Clear'});
 }finally{
  await new Promise(resolve=>server.close(resolve));
 }
});
