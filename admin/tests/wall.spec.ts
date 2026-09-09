import {test,expect} from '@playwright/test';
import {listWallPosts} from '../src/lib/wall';

function fakeClient(rows:any[]){
 return {
  from(){return{select(){return{order(){return{order(){return{limit:async()=>({data:rows,error:null})};}};}};}};},
  storage:{from(){return{getPublicUrl:(path:string)=>({data:{publicUrl:`https://cdn.test/${path}`}})};}},
 } as any;
}

test('posts are returned newest-first with a resolved media url',async()=>{
 const client=fakeClient([
  {id:'p2',user_id:'u2',author_name:'Aina',body:'later',media_path:'u2/x.png',media_type:'image',created_at:'2026-09-09T10:00:00Z'},
  {id:'p1',user_id:'u1',author_name:'Yusuf',body:'earlier',media_path:null,media_type:null,created_at:'2026-09-09T09:00:00Z'},
 ]);
 const posts=await listWallPosts(client);
 expect(posts.map(p=>p.id)).toEqual(['p2','p1']);
 expect(posts[0]).toMatchObject({author:'Aina',mediaType:'image',mediaPath:'u2/x.png',mediaUrl:'https://cdn.test/u2/x.png'});
 expect(posts[1].mediaUrl).toBeNull();
});

test('an audio post resolves mediaType and mediaUrl',async()=>{
 const client=fakeClient([
  {id:'p3',user_id:'u3',author_name:'Faiz',body:'',media_path:'u3/note.webm',media_type:'audio',created_at:'2026-09-09T11:00:00Z'},
 ]);
 const posts=await listWallPosts(client);
 expect(posts[0]).toMatchObject({mediaType:'audio',mediaPath:'u3/note.webm',mediaUrl:'https://cdn.test/u3/note.webm'});
});
