import{test,expect}from'@playwright/test';
import{createPlayerStream}from'../server/player-stream.mjs';
import{PlayerStateStream,createHeartbeat,createFrameQueue}from'../src/network-stream';

test('deltas converge after slow-client drops, joins, appearance mutation and removal',()=>{
 const server=createPlayerStream(),room=new Map(),fast={},slow={};const client=new PlayerStateStream<any>();
 let rows=[{id:'a',x:1,appearance:{shirt:'red'}},{id:'b',x:2,appearance:{shirt:'blue'}}];
 let frame=server.frame(room,rows);expect(frame.forSocket(fast).type).toBe('players');client.full(rows,frame.full.revision);frame.sent(fast);frame.sent(slow);
 rows[0].x=3;frame=server.frame(room,rows);expect(frame.forSocket(fast).changes).toEqual([{id:'a',x:3}]);expect(client.delta(frame.delta)).toEqual(rows);frame.sent(fast);
 rows[0].appearance.shirt='green';rows=rows.slice(0,1);frame=server.frame(room,rows);expect(frame.forSocket(slow).type).toBe('players');expect(client.delta(frame.delta)).toEqual(rows);expect(frame.delta.removed).toEqual(['b']);
 expect(client.delta(frame.delta)).toBeNull();
});
test('heartbeat accepts delayed earlier probes and times out without pong; background wake gets grace',()=>{
 let time=0;const heart=createHeartbeat(()=>time);const a=heart.probe();time=3000;const b=heart.probe();time=4000;expect(heart.reply(a)).toBe(4000);expect(heart.reply(b)).toBe(1000);
 for(time=5000;time<=19000;time+=1000)expect(heart.tick()).toBe(false);time=20001;expect(heart.tick()).toBe(true);
 time=100000;expect(heart.tick()).toBe(false);expect(heart.reply(999)).toBeNull();
});
test('decode queue is bounded and never applies work after overflow/close',async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);let over=0;const applied:string[]=[];
 const queue=createFrameQueue<string>(async text=>{await gate;return text;},v=>applied.push(v),()=>over++);
 for(let i=0;i<40;i++)queue.push(String(i));expect(over).toBe(1);release();await new Promise(r=>setTimeout(r,0));expect(applied).toEqual([]);
});


test('server heartbeat releases dead sockets while browser-native pongs retain background players',async()=>{
 const {createSocketHeartbeat}=await import('../server/socket-heartbeat.mjs');let time=0,pong=()=>{},terminated=0,pings=0;
 const ws={readyState:1,on:(_event:string,handler:()=>void)=>pong=handler,ping:()=>pings++,terminate:()=>terminated++};
 const heartbeat=createSocketHeartbeat(()=>time);heartbeat.track(ws);time=30000;heartbeat.tick([ws]);expect(pings).toBe(1);
 pong();time=60000;heartbeat.tick([ws]);expect(terminated).toBe(0);time=90000;heartbeat.tick([ws]);expect(terminated).toBe(1);
});

test('large SFU signalling is accepted; oversized socket payload cannot crash the city',async()=>{
 const {spawn}=await import('node:child_process');const {default:WebSocket}=await import('ws');
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'18997',ALLOW_GUESTS:'true',CF_SFU_APP_ID:'',CF_SFU_APP_SECRET:'',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 const clients:any[]=[];
 try{
  await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:18997/health')).ok;}catch{return false;}}).toBe(true);
  const ws=new WebSocket('ws://127.0.0.1:18997/ws');clients.push(ws);const messages:any[]=[];ws.on('message',data=>messages.push(JSON.parse(String(data))));await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({type:'join',guest:true,name:'SignalProbe',room:'signal-test'}));await expect.poll(()=>messages.some(m=>m.type==='welcome')).toBe(true);
  ws.send(JSON.stringify({type:'voice-rpc',requestId:1,op:'init',description:{type:'offer',sdp:'a'.repeat(8000)}}));await expect.poll(()=>messages.find(m=>m.type==='voice-rpc-result')?.error).toBe('Voice service is unavailable.');
  ws.send('x'.repeat(70000));await expect.poll(()=>ws.readyState).toBe(WebSocket.CLOSED);expect((await fetch('http://127.0.0.1:18997/health')).ok).toBe(true);
 }finally{for(const ws of clients)ws.terminate();server.kill();}
});
