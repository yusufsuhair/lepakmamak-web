import {test,expect} from '@playwright/test';
import {createTableAlert,unoAlert,pokerAlert,lukisAlert,werewolfAlert,NO_ALERT} from '../src/table-alert';

test('each table game only nudges the player it actually needs',()=>{
 const uno={id:'g',round:1,self:'me',ends:9,unoTarget:null};
 expect(unoAlert({...uno,phase:'playing',turn:'me'}).body).toBe('It is your turn.');
 expect(unoAlert({...uno,phase:'playing',turn:'you'})).toBe(NO_ALERT);
 expect(unoAlert({...uno,phase:'playing',turn:'you',unoTarget:'me'}).key).toBe('uno:g:1');
 expect(unoAlert({...uno,phase:'dealing',turn:'you'}).key).toBe('deal:g:1');

 const hand={hand:'h1',phase:'preflop',ends:5,players:[{id:'me'}]};
 expect(pokerAlert({...hand,actions:{call:0,raise:true}},'me').key).toBe('turn:h1:5');
 expect(pokerAlert({...hand,actions:null},'me').key).toBe('hand:h1');
 expect(pokerAlert({...hand,actions:{call:0,raise:true}},'stranger')).toBe(NO_ALERT);
 expect(pokerAlert({...hand,phase:'finished',actions:null},'me')).toBe(NO_ALERT);

 const round={id:'l',round:2,self:'me',drawer:'you',scores:[{id:'me'},{id:'you'}]};
 expect(lukisAlert({...round,phase:'choosing',drawer:'me'}).key).toBe('pick:l:2');
 expect(lukisAlert({...round,phase:'drawing',drawer:'me'}).key).toBe('draw:l:2');
 expect(lukisAlert({...round,phase:'drawing',drawer:'you'}).key).toBe('guess:l:2');
 expect(lukisAlert({...round,phase:'choosing',drawer:'you'})).toBe(NO_ALERT);
 expect(lukisAlert({...round,phase:'drawing',drawer:'you',scores:[{id:'you'}]})).toBe(NO_ALERT);

 const night={id:'w',phase:'night',day:1,self:'me',role:'villager',selected:null,canJudge:false,players:[{id:'me',alive:true}]};
 expect(werewolfAlert({...night,role:'seer'}).key).toBe('night:1');
 expect(werewolfAlert({...night,role:'seer',selected:'you'}).key).toBe('start:w');
 expect(werewolfAlert({...night,role:'villager'}).key).toBe('start:w');
 expect(werewolfAlert({...night,role:'villager',day:2})).toBe(NO_ALERT);
 expect(werewolfAlert({...night,phase:'vote',role:'villager'}).key).toBe('vote:1');
 expect(werewolfAlert({...night,phase:'judgment',role:'villager',canJudge:true}).key).toBe('judgment:1');
 expect(werewolfAlert({...night,phase:'judgment',role:'villager',canJudge:false})).toBe(NO_ALERT);
 expect(werewolfAlert({...night,role:'seer',players:[{id:'me',alive:false}]})).toBe(NO_ALERT);
});

test('a nudge fires once per turn, stays quiet on screen, and rearms afterwards',()=>{
 const sent:string[]=[],alerts=createTableAlert((title,body)=>sent.push(`${title}|${body}`));
 const turn=(ends:number)=>unoAlert({id:'g',round:1,phase:'playing',turn:'me',self:'me',unoTarget:null,ends});

 alerts.fire('uno',turn(1),false);
 alerts.fire('uno',turn(1),false);
 expect(sent).toEqual(['UNO Lepak|It is your turn.']);

 alerts.fire('uno',NO_ALERT,false);
 alerts.fire('uno',turn(2),true);
 expect(sent).toHaveLength(1);

 alerts.fire('uno',NO_ALERT,false);
 alerts.fire('uno',turn(3),false);
 expect(sent).toHaveLength(2);

 alerts.clear();
 alerts.fire('uno',turn(3),false);
 expect(sent).toHaveLength(3);
});

test('a turn nudge reaches the world toast when the table dialog is closed',async({page})=>{
 await page.goto('/');await page.waitForTimeout(300);
 const shown=await page.evaluate(async()=>{
  document.querySelectorAll('#table-social').forEach(e=>e.remove());
  const{setupTableSocial}=await import('/src/table-social.ts');
  const seen:string[]=[];
  const ui=setupTableSocial(()=>true,'test',()=>{},(title:string,body:string)=>seen.push(`${title}|${body}`));
  ui.state([{id:'meja-1',name:'Meja 1',capacity:3,occupants:[{id:'a',name:'A',chairId:'chair-0'}]}],'a',true);
  const turn={id:'g1',tableId:'meja-1',revision:1,phase:'playing',round:1,host:'a',self:'a',turn:'a',direction:1,
   color:'red',top:{id:'t',color:'red',value:'5'},ends:Date.now()+25000,serverTime:Date.now(),event:null,winner:null,
   roundPoints:0,unoTarget:null,drawn:null,hand:[{id:'c1',color:'red',value:'7'}],
   players:[{id:'a',name:'A',count:1,score:0,left:false,online:true,uno:false}],playable:['c1']};
  ui.uno(turn);                       // walked away from the table: dialog shut
  ui.uno({...turn,revision:2});       // same turn must not nudge twice
  ui.open('meja-1');                  // back at the table
  ui.uno({...turn,revision:3,ends:turn.ends+25000});
  return seen;
 });
 expect(shown).toEqual(['UNO Lepak|It is your turn.']);
});
