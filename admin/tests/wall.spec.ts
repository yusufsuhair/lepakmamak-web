import {test,expect} from '@playwright/test';
import {listWallPosts,deleteWallPost} from '../src/lib/wall';

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

function deleteHarness(post:any){
 const removed:string[]=[], audits:any[]=[]; let deleted=false;
 const client:any={
  from(table:string){
   if(table==='admin_audit_log')return{insert:async(value:any)=>{audits.push(value);return{error:null};}};
   return{
    select(){return{eq(){return{single:async()=>post?{data:post,error:null}:{data:null,error:{message:'missing'}}};}};},
    delete(){return{eq:async()=>{deleted=true;return{error:null};}};},
   };
  },
  storage:{from(){return{remove:async(paths:string[])=>{removed.push(...paths);return{error:null};}};}},
 };
 return {client,removed,audits,wasDeleted:()=>deleted};
}

test('deleting a post removes its row, its stored file and writes an audit entry',async()=>{
 const h=deleteHarness({id:'p1',user_id:'u1',author_name:'Aina',media_path:'u1/x.png'});
 await deleteWallPost(h.client,'p1','yusufmohdsuhair@gmail.com');
 expect(h.wasDeleted()).toBe(true);
 expect(h.removed).toEqual(['u1/x.png']);
 expect(h.audits[0]).toMatchObject({action:'wall.delete',target_table:'social_posts',target_id:'p1',actor:'yusufmohdsuhair@gmail.com'});
});

test('a text-only post deletes without touching storage',async()=>{
 const h=deleteHarness({id:'p2',user_id:'u1',author_name:'Aina',media_path:null});
 await deleteWallPost(h.client,'p2','yusufmohdsuhair@gmail.com');
 expect(h.wasDeleted()).toBe(true);
 expect(h.removed).toEqual([]);
});

test('deleting a post that does not exist throws and writes no audit entry',async()=>{
 const h=deleteHarness(null);
 await expect(deleteWallPost(h.client,'nope','yusufmohdsuhair@gmail.com')).rejects.toThrow();
 expect(h.audits).toEqual([]);
});
