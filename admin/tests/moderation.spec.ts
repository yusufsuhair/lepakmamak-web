import {test,expect} from '@playwright/test';
import {applyPenalty,chatAround,liftPenalty,listPenalties,resolveReport} from '../src/lib/moderation';

function harness(rows:any[]=[],options:{auditFails?:boolean;writeFails?:boolean}={}){
 const audits:any[]=[],upserts:any[]=[],updates:any[]=[],deletes:string[]=[];
 const fail={error:{message:'write failed'}},ok={error:null};
 const client:any={from(table:string){
  if(table==='admin_audit_log')return{insert:async(value:any)=>{if(options.auditFails)return fail;audits.push(value);return ok;}};
  return {
   upsert:async(value:any)=>{if(options.writeFails)return fail;upserts.push(value);return ok;},
   update(value:any){return{eq:async(_column:string,id:string)=>{if(options.writeFails)return fail;updates.push({id,...value});return ok;}};},
   delete(){return{eq:async(_column:string,id:string)=>{if(options.writeFails)return fail;deletes.push(id);return ok;}};},
   select(){
    let result=[...rows];const query:any={
     eq(key:string,value:string){result=result.filter(row=>row[key==='room'?'room':key]===value);return query;},
     gte(key:string,value:string){result=result.filter(row=>row[key]>=value);return query;},
     lte(key:string,value:string){result=result.filter(row=>row[key]<=value);return query;},
     order(){return query;},
     limit:async(n:number)=>({data:result.slice(0,n),error:null}),
     then:(resolve:any)=>resolve({data:result,error:null}),
    };
    return query;
   },
  };
 }};
 return {client,audits,upserts,updates,deletes};
}
const actor='yusufmohdsuhair@gmail.com';

test('a mute is time-boxed, a ban is not, and both are audited before they take effect',async()=>{
 const h=harness();
 await applyPenalty(h.client,{userId:'u1',kind:'mute',hours:24,reason:'slurs in city chat',reportId:'r1',actor});
 expect(h.upserts[0]).toMatchObject({user_id:'u1',kind:'mute',reason:'slurs in city chat',actor,report_id:'r1'});
 const expiry=Date.parse(h.upserts[0].expires_at)-Date.now();
 expect(expiry).toBeGreaterThan(23*3600_000);
 expect(expiry).toBeLessThan(25*3600_000);
 expect(h.audits[0]).toMatchObject({action:'moderation.mute',target_table:'player_bans',target_id:'u1',actor});

 await applyPenalty(h.client,{userId:'u2',kind:'ban',hours:null,reason:'threats',actor});
 // A ban with no expiry has to be lifted by a person, which is the point of a ban.
 expect(h.upserts[1]).toMatchObject({user_id:'u2',kind:'ban',expires_at:null});
});

test('when the audit trail cannot be written, no penalty is applied',async()=>{
 const h=harness([],{auditFails:true});
 await expect(applyPenalty(h.client,{userId:'u1',kind:'ban',reason:'threats',actor})).rejects.toThrow();
 expect(h.upserts).toEqual([]);
});

test('a penalty needs an account and a reason the player can be shown',async()=>{
 const h=harness();
 await expect(applyPenalty(h.client,{userId:'',kind:'ban',reason:'threats',actor})).rejects.toThrow(/no account/i);
 await expect(applyPenalty(h.client,{userId:'u1',kind:'ban',reason:'   ',actor})).rejects.toThrow(/reason/i);
 expect(h.audits).toEqual([]);
 expect(h.upserts).toEqual([]);
});

test('lifting a penalty deletes the row and leaves the reason it happened in the log',async()=>{
 const h=harness();
 await liftPenalty(h.client,'u1',actor);
 expect(h.deletes).toEqual(['u1']);
 expect(h.audits[0]).toMatchObject({action:'moderation.lift',target_id:'u1',actor});
});

test('resolving a report records who closed it and how',async()=>{
 const h=harness();
 await resolveReport(h.client,'r1','dismissed',actor);
 expect(h.updates[0]).toMatchObject({id:'r1',status:'dismissed',resolved_by:actor});
 expect(h.audits[0]).toMatchObject({action:'report.dismissed',target_table:'player_reports',target_id:'r1'});
});

test('an expired penalty is not listed as active',async()=>{
 const h=harness([
  {user_id:'live',kind:'ban',expires_at:null,reason:'',actor,created_at:'2026-09-10T00:00:00Z'},
  {user_id:'ticking',kind:'mute',expires_at:new Date(Date.now()+3600_000).toISOString(),reason:'',actor,created_at:'2026-09-10T00:00:00Z'},
  {user_id:'served',kind:'mute',expires_at:new Date(Date.now()-3600_000).toISOString(),reason:'',actor,created_at:'2026-09-10T00:00:00Z'},
 ]);
 expect((await listPenalties(h.client)).map(p=>p.userId).sort()).toEqual(['live','ticking']);
});

test('a chat report is reviewed from the history the game already keeps, windowed around it',async()=>{
 const at='2026-09-10T12:00:00.000Z';
 const line=(minutes:number,text:string)=>({room:'kampung',player_name:'Faiz',message:text,created_at:new Date(Date.parse(at)+minutes*60_000).toISOString()});
 const h=harness([line(-30,'long before'),line(-2,'just before'),line(1,'just after'),line(30,'long after'),{...line(0,'other room'),room:'pasar'}]);
 const lines=await chatAround(h.client,'kampung',at);
 expect(lines.map(l=>l.text)).toEqual(['just before','just after']);
});

test('a report with an unreadable timestamp returns nothing rather than an unbounded scan',async()=>{
 const h=harness([{room:'kampung',player_name:'Faiz',message:'x',created_at:'2026-09-10T12:00:00.000Z'}]);
 expect(await chatAround(h.client,'kampung','not-a-date')).toEqual([]);
});
