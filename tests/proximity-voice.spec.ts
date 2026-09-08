import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
test('voice never reaches distant listeners and follows movement',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8093',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 const clients:WebSocket[]=[],received:any[][]=[[],[],[]],audiences:any[]=[];
 try{
 await expect.poll(async()=>{try{return (await fetch('http://127.0.0.1:8093/health')).ok;}catch{return false;}}).toBe(true);
 for(let i=0;i<3;i++){const ws=new WebSocket('ws://127.0.0.1:8093/ws');clients.push(ws);await new Promise<void>((resolve,reject)=>{ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'nearby',guest:true,name:`Listener ${i}`})));ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='welcome')resolve();if(m.type==='voice-audio')received[i].push(m);if(i===0&&m.type==='voice-audience')audiences.push(m);});});ws.send(JSON.stringify({type:'voice-state',mic:i===0,speaker:true}));}
 const move=(i:number,x:number)=>clients[i].send(JSON.stringify({type:'state',x,z:52}));
 move(1,-8);move(2,50);await new Promise(r=>setTimeout(r,100));
 const speak=()=>clients[0].send(JSON.stringify({type:'voice-audio',audio:Buffer.alloc(1280).toString('base64')}));speak();
 await expect.poll(()=>received[1].length).toBe(1);expect(received[1][0].volume).toBeCloseTo(.5);expect(received[0]).toHaveLength(0);expect(received[2]).toHaveLength(0);expect(audiences.at(-1)).toMatchObject({count:1,names:['Listener 1']});
 move(1,50);move(2,-18);await new Promise(r=>setTimeout(r,100));speak();
 await expect.poll(()=>received[2].length).toBe(1);expect(received[2][0].volume).toBe(1);expect(received[1]).toHaveLength(1);
 }finally{clients.forEach(ws=>ws.close());server.kill();}
});
