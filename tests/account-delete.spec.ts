import {test,expect} from '@playwright/test';
import {createAccounts,OWNED_ROWS} from '../server/account.mjs';

// A fake Supabase that records what was asked of it, so deletion order and the guards
// around it can be checked without a live project.
const stub=(overrides:any={})=>{
 const deleted:any[]=[]; const removed:string[]=[];
 const db={
  auth:{
   getUser:overrides.getUser||(async(token:string)=>token==='good'?{data:{user:{id:'u-1'}}}:{error:{message:'bad token'},data:{}}),
   admin:{deleteUser:async(id:string)=>{removed.push(id);return overrides.deleteUser?.(id)||{};}},
  },
  from:(table:string)=>({delete:()=>({eq:async(column:string,value:string)=>{deleted.push([table,column,value]);return overrides.rowError?.(table)||{};}})}),
 };
 return {db,deleted,removed};
};
const call=async(accounts:any,{token='good',body={confirm:'DELETE'},method='POST'}:any={})=>{
 const chunks=[Buffer.from(JSON.stringify(body))];
 const request:any={url:'/account/delete',method,headers:token?{authorization:`Bearer ${token}`}:{},
  [Symbol.asyncIterator]:async function*(){yield* chunks;}};
 let status=0,payload:any=null;
 const response:any={setHeader(){},writeHead(code:number){status=code;},end(text:string){payload=text?JSON.parse(text):null;}};
 const handled=await accounts.handle(request,response);
 return {handled,status,payload};
};

test('a confirmed delete clears every owned row before the account goes',async()=>{
 const {db,deleted,removed}=stub();
 const kicked:string[]=[];
 const accounts=createAccounts({db,onDeleted:(id:string)=>kicked.push(id)});
 const result=await call(accounts);
 expect(result.status).toBe(200);
 expect(result.payload).toEqual({deleted:true});
 expect(deleted).toEqual(OWNED_ROWS.map(([table,column]:any)=>[table,column,'u-1']));
 expect(removed).toEqual(['u-1']);
 // The session has to go too, or a deleted player keeps walking around the city.
 expect(kicked).toEqual(['u-1']);
});

test('rows are cleared first, so a failure never orphans them',async()=>{
 const {db,removed}=stub({rowError:(table:string)=>table==='social_posts'?{error:{message:'nope'}}:null});
 const result=await call(createAccounts({db}));
 expect(result.status).toBe(502);
 expect(removed).toEqual([]);
});

test('nothing is deleted without a session and the typed confirmation',async()=>{
 const {db,deleted,removed}=stub();
 const accounts=createAccounts({db});
 expect((await call(accounts,{token:''})).status).toBe(401);
 expect((await call(accounts,{token:'bad'})).status).toBe(401);
 expect((await call(accounts,{body:{}})).status).toBe(400);
 expect((await call(accounts,{body:{confirm:'delete'}})).status).toBe(400);
 expect((await call(accounts,{method:'GET'})).status).toBe(405);
 expect(deleted).toEqual([]); expect(removed).toEqual([]);
});

test('the endpoint answers only for its own path, and refuses unknown origins',async()=>{
 const {db}=stub();
 const accounts=createAccounts({db});
 const request:any={url:'/wall/posts',method:'POST',headers:{}};
 expect(await accounts.handle(request,{setHeader(){},writeHead(){},end(){}})).toBe(false);

 let status=0;
 const evil:any={url:'/account/delete',method:'POST',headers:{origin:'https://evil.test',authorization:'Bearer good'}};
 await accounts.handle(evil,{setHeader(){},writeHead(code:number){status=code;},end(){}});
 expect(status).toBe(403);
});

test('a second attempt is held off, so a stuck button cannot hammer it',async()=>{
 let clock=1000;
 const {db}=stub();
 const accounts=createAccounts({db,now:()=>clock});
 expect((await call(accounts)).status).toBe(200);
 expect((await call(accounts)).status).toBe(429);
 clock+=3000;
 expect((await call(accounts)).status).toBe(200);
});

test('deletion is refused outright when the service role is not configured',async()=>{
 const accounts=createAccounts({db:null});
 expect((await call(accounts)).status).toBe(503);
});
