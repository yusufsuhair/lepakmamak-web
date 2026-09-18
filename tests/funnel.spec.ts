import {test,expect} from '@playwright/test';
import {createFunnel,CLIENT_EVENTS,SERVER_EVENTS} from '../server/funnel.mjs';

const DEVICE='3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b';
function fakeDb(fail=false){
 const rows:any[]=[];
 return {rows,from(table:string){expect(table).toBe('funnel_events');return {insert:async(row:any)=>{if(fail)throw new Error('db down');rows.push(row);return {error:null};}};}};
}
function post(body:unknown,headers:Record<string,string>={origin:'https://lepakmamak.my'}){
 const text=typeof body==='string'?body:JSON.stringify(body);
 const request:any={url:'/event',method:'POST',headers,socket:{remoteAddress:'10.0.0.1'},async *[Symbol.asyncIterator](){yield Buffer.from(text);}};
 let status=0;const response:any={setHeader(){},writeHead(code:number){status=code;},end(){}};
 return {request,response,status:()=>status};
}

test('the browser may report only the steps that happen before there is a socket',async()=>{
 const db=fakeDb(),funnel=createFunnel({db});
 for(const event of CLIENT_EVENTS){const call=post({device:DEVICE,event});expect(await funnel.handle(call.request,call.response)).toBe(true);expect(call.status()).toBe(204);}
 expect(db.rows.map(row=>row.event)).toEqual([...CLIENT_EVENTS]);
 expect(db.rows[0]).toEqual({device_id:DEVICE,user_id:null,guest:false,event:'page_load'});
 // Sitting down and starting a game are the server's to say. A client claiming them is refused.
 for(const event of SERVER_EVENTS){const call=post({device:DEVICE,event});await funnel.handle(call.request,call.response);expect(call.status()).toBe(400);}
 expect(db.rows).toHaveLength(CLIENT_EVENTS.size);
});

test('malformed, foreign and oversized reports are refused before the database',async()=>{
 const db=fakeDb(),funnel=createFunnel({db});
 const refused=async(body:unknown,headers?:Record<string,string>)=>{const call=post(body,headers);await funnel.handle(call.request,call.response);return call.status();};
 expect(await refused({device:'not-a-uuid',event:'page_load'})).toBe(400);
 expect(await refused({device:DEVICE,event:'made_up'})).toBe(400);
 expect(await refused('{not json')).toBe(400);
 expect(await refused({device:DEVICE,event:'page_load',pad:'x'.repeat(600)})).toBe(413);
 expect(await refused({device:DEVICE,event:'page_load'},{origin:'https://evil.example'})).toBe(403);
 expect(db.rows).toHaveLength(0);
 // Other routes are not this module's business.
 const other=post({});other.request.url='/leaderboard';expect(await funnel.handle(other.request,other.response)).toBe(false);
});

test('one address cannot flood the table',async()=>{
 const db=fakeDb(),funnel=createFunnel({db,limit:3});
 const codes:number[]=[];
 for(let i=0;i<5;i++){const call=post({device:DEVICE,event:'page_load'});await funnel.handle(call.request,call.response);codes.push(call.status());}
 expect(codes).toEqual([204,204,204,429,429]);expect(db.rows).toHaveLength(3);
});

test('forging a new address for every request still runs into the total',async()=>{
 const db=fakeDb(),funnel=createFunnel({db,total:4});
 const codes:number[]=[];
 for(let i=0;i<6;i++){const call=post({device:DEVICE,event:'page_load'},{origin:'https://lepakmamak.my','x-forwarded-for':`203.0.113.${i}`});await funnel.handle(call.request,call.response);codes.push(call.status());}
 expect(codes).toEqual([204,204,204,204,429,429]);expect(db.rows).toHaveLength(4);
});

test('the server records each of its own steps once per visit, and only for a known device',async()=>{
 const db=fakeDb(),funnel=createFunnel({db});
 const guest={id:'a',guest:true},member={id:'b',guest:false,userId:'9d8c7b6a-5e4f-4a3b-8c2d-1e0f9a8b7c6d'},unknown={id:'c'};
 funnel.attach(guest,DEVICE);funnel.attach(member,DEVICE);funnel.attach(unknown,'garbage');
 for(const player of [guest,member,unknown])for(const event of ['entered_city','first_sit','first_sit','first_game'])await funnel.once(player,event);
 expect(db.rows.map(row=>[row.guest,row.event])).toEqual([[true,'entered_city'],[true,'first_sit'],[true,'first_game'],[false,'entered_city'],[false,'first_sit'],[false,'first_game']]);
 expect(db.rows[3].user_id).toBe(member.userId);expect(db.rows[0].user_id).toBeNull();
 // Nothing about the device is left on the player, because the player object is broadcast.
 expect(Object.keys(guest)).toEqual(['id','guest']);
});

test('a database that is down never reaches the player',async()=>{
 const funnel=createFunnel({db:fakeDb(true)}),player={id:'a'};
 funnel.attach(player,DEVICE);
 await expect(funnel.once(player,'entered_city')).resolves.toBeUndefined();
 const call=post({device:DEVICE,event:'page_load'});await funnel.handle(call.request,call.response);expect(call.status()).toBe(204);
 // And with no database configured at all, it is simply off.
 const off=createFunnel({db:null});off.attach(player,DEVICE);await expect(off.once(player,'entered_city')).resolves.toBeUndefined();
});

test('counts older than thirteen months are deleted, which is what the privacy policy promises',async()=>{
 const cutoffs:string[]=[];
 const db:any={from(table:string){expect(table).toBe('funnel_events');return {delete:()=>({lt:async(column:string,value:string)=>{expect(column).toBe('at');cutoffs.push(value);return {error:null};}})};}};
 await createFunnel({db,now:()=>Date.parse('2027-10-20T00:00:00Z')}).purge();
 expect(cutoffs).toEqual(['2026-09-19T00:00:00.000Z']);
 // Off without a database, and a failing one is swallowed like every other funnel error.
 await expect(createFunnel({db:null}).purge()).resolves.toBeUndefined();
 await expect(createFunnel({db:{from(){throw new Error('db down');}}}).purge()).resolves.toBeUndefined();
});
