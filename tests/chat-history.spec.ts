import {test,expect} from '@playwright/test';
import {createChatHistory} from '../server/chat-history.mjs';

test('chat storage saves server-owned identity and returns the latest 50 in chronological order',async()=>{
 const rows:any[]=[];
 const db={from(){return {
  insert:async(row:any)=>{rows.push({...row,id:rows.length+1});return{error:null};},
  select(){
   let result=[...rows]; const orderBy:{key:string;ascending:boolean}[]=[];
   const query:any={
    eq(_key:string,value:string){result=result.filter(row=>row.room===value);return query;},
    order(key:string,{ascending}:{ascending:boolean}){orderBy.push({key,ascending});return query;},
    limit(n:number){result.sort((a,b)=>{for(const order of orderBy){const compared=String(a[order.key]).localeCompare(String(b[order.key]));if(compared)return order.ascending?compared:-compared;}return 0;});return Promise.resolve({data:result.slice(0,n),error:null});},
   };
   return query;
  },
 };}};
 const history=createChatHistory({db});
 for(let i=0;i<55;i++)await history.save('kampung',{id:'11111111-1111-4111-8111-111111111111',userId:null,name:'Ali'},`Mesej ${i}`,new Date(1800000000000+i*1000).toISOString());
 await history.save('bilik-lain',{id:'22222222-2222-4222-8222-222222222222',userId:null,name:'Mei'},'Rahsia bilik lain',new Date().toISOString());
 const restored=await history.recent('kampung');
 expect(restored).toHaveLength(50);expect(restored[0].text).toBe('Mesej 5');expect(restored.at(-1).text).toBe('Mesej 54');expect(restored.some((m:any)=>m.text.includes('Rahsia'))).toBe(false);
 expect(restored[0]).toEqual({id:'11111111-1111-4111-8111-111111111111',name:'Ali',text:'Mesej 5',sentAt:new Date(1800000000000+5000).toISOString()});
});
