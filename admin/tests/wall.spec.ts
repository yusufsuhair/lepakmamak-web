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

function deleteHarness(post:any, opts:{auditFails?:boolean;storageFails?:boolean}={}){
 const removed:string[]=[], audits:any[]=[]; let deleted=false; let deletedId:string|undefined;
 const client:any={
  from(table:string){
   if(table==='admin_audit_log')return{insert:async(value:any)=>{
    if(opts.auditFails)return{error:{message:'audit insert failed'}};
    audits.push(value);return{error:null};
   }};
   return{
    select(){return{eq(){return{single:async()=>post?{data:post,error:null}:{data:null,error:{message:'missing'}}};}};},
    delete(){return{eq:async(_col:string,value:string)=>{deleted=true;deletedId=value;return{error:null};}};},
   };
  },
  storage:{from(){return{remove:async(paths:string[])=>{
   if(opts.storageFails)return{error:{message:'network blip'}};
   removed.push(...paths);return{error:null};
  }};}},
 };
 return {client,removed,audits,wasDeleted:()=>deleted,deletedId:()=>deletedId};
}

test('deleting a post removes its row, its stored file and writes an audit entry',async()=>{
 const h=deleteHarness({id:'p1',user_id:'u1',author_name:'Aina',media_path:'u1/x.png'});
 await deleteWallPost(h.client,'p1','yusufmohdsuhair@gmail.com');
 expect(h.wasDeleted()).toBe(true);
 expect(h.deletedId()).toBe('p1');
 expect(h.removed).toEqual(['u1/x.png']);
 expect(h.audits[0]).toMatchObject({action:'wall.delete',target_table:'social_posts',target_id:'p1',actor:'yusufmohdsuhair@gmail.com'});
});

test('a text-only post deletes without touching storage',async()=>{
 const h=deleteHarness({id:'p2',user_id:'u1',author_name:'Aina',media_path:null});
 await deleteWallPost(h.client,'p2','yusufmohdsuhair@gmail.com');
 expect(h.wasDeleted()).toBe(true);
 expect(h.deletedId()).toBe('p2');
 expect(h.removed).toEqual([]);
});

test('deleting a post that does not exist throws and writes no audit entry',async()=>{
 const h=deleteHarness(null);
 await expect(deleteWallPost(h.client,'nope','yusufmohdsuhair@gmail.com')).rejects.toThrow();
 expect(h.audits).toEqual([]);
});

test('when the audit write fails, the post row is not deleted',async()=>{
 const h=deleteHarness({id:'p4',user_id:'u1',author_name:'Aina',media_path:'u1/y.png'},{auditFails:true});
 await expect(deleteWallPost(h.client,'p4','yusufmohdsuhair@gmail.com')).rejects.toThrow();
 expect(h.wasDeleted()).toBe(false);
 expect(h.removed).toEqual([]);
});

test('a storage removal failure throws naming the orphaned path, after the row is deleted and audited',async()=>{
 const h=deleteHarness({id:'p5',user_id:'u1',author_name:'Aina',media_path:'u1/z.png'},{storageFails:true});
 await expect(deleteWallPost(h.client,'p5','yusufmohdsuhair@gmail.com')).rejects.toThrow(/u1\/z\.png/);
 expect(h.wasDeleted()).toBe(true);
 expect(h.audits.length).toBe(1);
});
