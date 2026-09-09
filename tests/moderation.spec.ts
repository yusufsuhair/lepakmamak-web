import {test,expect} from '@playwright/test';
import {createModeration} from '../server/moderation.mjs';

// Minimal stand-in for the Supabase query builder: enough of .select().eq().limit(),
// .select().in() and .insert() for the three calls the module actually makes.
function fakeDb(rows:any[],options:{fail?:boolean}={}){
 const inserted:any[]=[];
 const db={from(table:string){
  if(options.fail)return{select(){return{eq(){return{limit:async()=>({data:null,error:{message:'down'}})};},in:async()=>({data:null,error:{message:'down'}})};},insert:async()=>({error:{message:'down'}})};
  return {
   select(){return{
    eq(_k:string,value:string){return{limit:async(n:number)=>({data:rows.filter(r=>r.user_id===value).slice(0,n),error:null})};},
    in:async(_k:string,values:string[])=>({data:rows.filter(r=>values.includes(r.user_id)),error:null}),
   };},
   insert:async(row:any)=>{inserted.push({table,...row});return{error:null};},
  };
 }};
 return {db,inserted};
}
const hour=3600000;

test('a permanent ban and a live mute are reported, and an expired penalty is not',async()=>{
 const {db}=fakeDb([
  {user_id:'banned',kind:'ban',expires_at:null,reason:'threats'},
  {user_id:'muted',kind:'mute',expires_at:new Date(Date.now()+hour).toISOString(),reason:'slurs'},
  {user_id:'served',kind:'mute',expires_at:new Date(Date.now()-hour).toISOString(),reason:'old'},
 ]);
 const moderation=createModeration({db});
 expect(await moderation.status('banned')).toMatchObject({banned:true,muted:false,reason:'threats'});
 expect(await moderation.status('muted')).toMatchObject({banned:false,muted:true,reason:'slurs'});
 // A penalty that has run out is simply over. Nothing has to sweep it away for the player
 // to get their voice back, which is what makes an expiring mute safe to hand out.
 expect(await moderation.status('served')).toMatchObject({banned:false,muted:false});
 expect(await moderation.status('stranger')).toMatchObject({banned:false,muted:false});
});

test('the sweep answers for every connected account at once and omits the clear ones',async()=>{
 const {db}=fakeDb([
  {user_id:'banned',kind:'ban',expires_at:null,reason:''},
  {user_id:'muted',kind:'mute',expires_at:new Date(Date.now()+hour).toISOString(),reason:''},
  {user_id:'served',kind:'mute',expires_at:new Date(Date.now()-hour).toISOString(),reason:''},
  {user_id:'elsewhere',kind:'ban',expires_at:null,reason:''},
 ]);
 const statuses=await createModeration({db}).statuses(['banned','muted','served','clean','clean']);
 expect([...statuses.keys()].sort()).toEqual(['banned','muted']);
 expect(statuses.get('banned')!.banned).toBe(true);
 expect(statuses.get('muted')!.muted).toBe(true);
});

test('a database failure is raised rather than being reported as no penalty',async()=>{
 // The callers each decide what an outage means for them, so this must never quietly
 // answer "clear" — that would turn a Supabase blip into an unban for everybody.
 const {db}=fakeDb([],{fail:true});
 const moderation=createModeration({db});
 await expect(moderation.status('banned')).rejects.toThrow();
 await expect(moderation.statuses(['banned'])).rejects.toThrow();
 await expect(moderation.report({reporterName:'A',reportedName:'B',room:'kampung',surface:'voice',reason:'hate'})).rejects.toThrow();
});

test('a report stores who, where and who else could hear, and nothing else',async()=>{
 const {db,inserted}=fakeDb([]);
 await createModeration({db}).report({
  reporterUserId:'r1',reporterName:'Aina',reportedUserId:'t1',reportedName:'Faiz',
  room:'kampung',surface:'voice',reason:'harassment',note:'kept swearing at me',witnesses:['Mei','Ali'],
 });
 expect(inserted[0]).toEqual({
  table:'player_reports',reporter_user_id:'r1',reporter_name:'Aina',reported_user_id:'t1',reported_name:'Faiz',
  room:'kampung',surface:'voice',reason:'harassment',note:'kept swearing at me',witnesses:['Mei','Ali'],
 });
});

test('a report about a guest keeps the name even though there is no account to penalise',async()=>{
 const {db,inserted}=fakeDb([]);
 await createModeration({db}).report({reporterName:'Aina',reportedName:'Faiz',room:'kampung',surface:'chat',reason:'hate'});
 expect(inserted[0]).toMatchObject({reporter_user_id:null,reported_user_id:null,reported_name:'Faiz',note:'',witnesses:[]});
});

test('without Supabase, penalties read as clear but a report refuses rather than vanishing',async()=>{
 const moderation=createModeration({db:null});
 expect(moderation.available).toBe(false);
 expect(await moderation.status('anyone')).toMatchObject({banned:false,muted:false});
 await expect(moderation.report({reporterName:'A',reportedName:'B',room:'k',surface:'chat',reason:'other'})).rejects.toThrow();
});
