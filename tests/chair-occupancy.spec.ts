import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import chairs from '../shared/chairs.json' with { type: 'json' };
test('chair claims are exclusive and released by stand or disconnect',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8090',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const clients:WebSocket[]=[];const ids:string[]=[];let players:any[]=[]; const chair=chairs[0];
 const send=(i:number,m:any)=>clients[i].send(JSON.stringify(m));
 try{
 await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8090/health')).ok;}catch{return false;}}).toBe(true);
 for(let i=0;i<2;i++){const ws=new WebSocket('ws://127.0.0.1:8090/ws');clients.push(ws);await new Promise<void>((resolve,reject)=>{ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'chairs'})));ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.players)players=m.players;if(m.type==='welcome'){ids.push(m.id);resolve();}});});}
 for(let i=0;i<2;i++)send(i,{type:'state',x:chair.x,z:chair.z+1,seated:true});
 await expect.poll(()=>players.every(p=>p.z===chair.z+1)).toBe(true);
 expect(players.every(p=>!p.seated)).toBe(true);
 for(let i=0;i<2;i++)send(i,{type:'chair-sit',chairId:chair.id});
 await expect.poll(()=>players.filter(p=>p.chairId===chair.id).length).toBe(1);
 const winner=ids.indexOf(players.find(p=>p.chairId===chair.id).id), loser=1-winner;
 await new Promise(r=>setTimeout(r,60));send(winner,{type:'state',x:0,z:0,riding:true});send(loser,{type:'chair-sit',chairId:chair.id});
 await new Promise(r=>setTimeout(r,80));expect(players.find(p=>p.id===ids[winner])).toMatchObject({x:chair.x,z:chair.z,seated:true,riding:false});
 send(winner,{type:'chair-stand'});await expect.poll(()=>players.filter(p=>p.chairId===chair.id).length).toBe(0);
 send(loser,{type:'chair-sit',chairId:chair.id});await expect.poll(()=>players.find(p=>p.id===ids[loser])?.chairId).toBe(chair.id);
 clients[loser].close();await expect.poll(()=>players.length).toBe(1);
 send(winner,{type:'chair-sit',chairId:chair.id});await expect.poll(()=>players[0]?.chairId).toBe(chair.id);
 }finally{clients.forEach(ws=>ws.close());server.kill();}
});
