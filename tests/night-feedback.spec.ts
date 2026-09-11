import {test,expect} from '@playwright/test';
import {createTableLobby} from '../server/table-lobby.mjs';
import chairs from '../shared/chairs.json' with {type:'json'};
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('Lukis accepts nine consenting players at a nine-chair table and starts that roster',()=>{
 const table=chairs.find(c=>chairs.filter(q=>q.tableId===c.tableId).length===9)!.tableId;
 const seats=chairs.filter(c=>c.tableId===table);let now=10000;const events:any[]=[];let roster:any[]=[];
 const ps=new Map(seats.map((c,i)=>[String(i),{id:String(i),name:`P${i}`,chairId:c.id,ws:String(i)}]));
 const lobby=createTableLobby((ws:any,m:any)=>events.push({ws,...m}),{lukis:{start:(_ps:any,_p:any,r:any[])=>{roster=r;}}},()=>now);
 for(const p of ps.values())lobby.handle(ps,p,{type:'lobby-join',game:'lukis'});
 expect(events.at(-1).lobby.max).toBe(9);expect(events.at(-1).lobby.members).toHaveLength(9);
 for(const p of ps.values())lobby.handle(ps,p,{type:'lobby-ready',ready:true});
 now+=3001;lobby.tick(ps);expect(roster).toHaveLength(9);
});

test('capture frames carry audio-clock time so a blocked main thread can discard stale speech',()=>{
 let Capture:any;const sent:any[]=[];
 const context=vm.createContext({AudioWorkletProcessor:class {port={postMessage:(m:any)=>sent.push(m)};},sampleRate:16000,currentTime:42,registerProcessor:(_n:string,c:any)=>Capture=c,Int16Array});
 vm.runInContext(readFileSync('public/voice-capture.js','utf8'),context);
 new Capture().process([[new Float32Array(640).fill(.25)]]);
 expect(sent).toHaveLength(1);expect(sent[0].capturedAt).toBe(42);expect(sent[0].buffer.byteLength).toBe(1280);
});

test('arming your own UNO leaves Catch usable for another player',async({page})=>{
 await page.route('**/feedback-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="table-social"></div>'}));
 await page.goto('/feedback-harness');
 await page.evaluate(async()=>{
  const {setupUno}=await import('/src/uno.ts');(window as any).sent=[];
  const ui=setupUno(m=>{(window as any).sent.push(m);return true;});document.querySelector('#table-social')!.append(ui.root);
  ui.state({id:'match',tableId:'meja-1',revision:3,phase:'playing',round:1,host:'me',self:'me',turn:'me',direction:1,color:'red',top:{id:'top',color:'red',value:'2'},ends:0,serverTime:Date.now(),event:null,winner:null,roundPoints:0,target:200,breakdown:null,unoTarget:'other',drawn:null,hand:[{id:'a',color:'red',value:'3'},{id:'b',color:'blue',value:'5'}],players:[{id:'me',name:'Me',count:2,score:0,left:false,online:true,uno:false},{id:'other',name:'Other',count:1,score:0,left:false,online:true,uno:false}],playable:['a']});
 });
 await page.locator('.uno-call').click();await expect(page.locator('.uno-call')).toHaveText('✓ UNO armed');
 await page.getByRole('button',{name:'Catch! +2'}).click();
 expect(await page.evaluate(()=>(window as any).sent.at(-1))).toMatchObject({type:'uno-catch',target:'other',gameId:'match'});
});
