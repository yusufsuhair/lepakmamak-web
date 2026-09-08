import { spawn } from 'node:child_process';
import WebSocket from 'ws';
const count=12, port=8099;
const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
const clients=[];let timer;
try {
 for(let i=0;i<50;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(let i=0;i<count;i++){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);clients.push(ws);await new Promise((resolve,reject)=>{ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'load'})));ws.on('message',raw=>{if(JSON.parse(String(raw)).type==='welcome')resolve();});});}
 let packets=0,bytes=0;
 clients[0].on('message',raw=>{if(JSON.parse(String(raw)).type==='players'){packets++;bytes+=raw.length;}});
 let tick=0;timer=setInterval(()=>{tick++;clients.forEach((ws,i)=>ws.send(JSON.stringify({type:'state',x:-18+Math.sin(tick*.1)+i,z:52,yaw:0,speed:3,riding:false})));},50);
 await new Promise(r=>setTimeout(r,3000));
 console.log(JSON.stringify({players:count,snapshotsPerSecond:Math.round(packets/3),kilobytesPerSecondPerClient:Math.round(bytes/3000)},null,2));
}finally{clearInterval(timer);clients.forEach(ws=>ws.close());server.kill();}
