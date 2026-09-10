import {test, expect} from '@playwright/test';
import {createServer} from 'node:net';
import {spawn, type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import WebSocket from 'ws';
import chairs from '../shared/chairs.json' with {type:'json'};

// Exercise the normal lobby protocol through the real router, rather than calling
// each engine's start handler directly (which bypasses the integration under test).
let server: ChildProcess;
let port: number;
test.beforeAll(async()=>{
  const reservation=createServer();
  reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  port=(reservation.address() as {port:number}).port;
  await new Promise<void>(resolve=>reservation.close(()=>resolve()));
  server=spawn(process.execPath,['server/index.mjs'],{
    env:{...process.env,PORT:String(port),ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',OPENAI_API_KEY:''},
    stdio:['ignore','pipe','pipe'],
  });
  // A foreign healthy listener is never accepted as this child's readiness.
  await new Promise<void>((resolve,reject)=>{
    let output='',errors='';
    const timeout=setTimeout(()=>finish(Error(`Server readiness timeout: ${errors}`)),10000);
    function finish(error?:Error){clearTimeout(timeout);error?reject(error):resolve();}
    server.on('error',finish);
    server.once('exit',code=>finish(Error(`Server exited ${code}: ${errors}`)));
    server.stderr!.on('data',chunk=>errors+=String(chunk));
    server.stdout!.on('data',chunk=>{output+=String(chunk);if(output.includes(`listening on ${port}`))finish();});
  });
});
test.afterAll(async()=>{
  if(server&&server.exitCode===null&&server.signalCode===null){const exited=once(server,'exit');server.kill();await exited;}
});

type Client={ws:WebSocket;id:string;messages:any[]};
const latest=(client:Client,type:string)=>client.messages.filter(m=>m.type===type).at(-1);
const send=(client:Client,message:object)=>client.ws.send(JSON.stringify(message));
const clients:Client[]=[];
test.afterEach(()=>{for(const client of clients.splice(0))client.ws.terminate();});
async function seat(count:number){
  const room=`sqa-${randomUUID().slice(0,12)}`;
  const seats=chairs.filter(c=>c.tableId==='meja-1');
  for(let i=0;i<count;i++){
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const client:Client={ws,id:'',messages:[]};clients.push(client);
    ws.on('message',raw=>{const m=JSON.parse(String(raw));client.messages.push(m);if(m.type==='welcome')client.id=m.id;});
    await Promise.race([once(ws,'open'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Socket did not open')),5000).unref())]);
    send(client,{type:'join',room,guest:true,name:`Player ${i}`});
    await expect.poll(()=>client.id).not.toBe('');
    send(client,{type:'state',x:seats[i].x,z:seats[i].z});
    send(client,{type:'chair-sit',chairId:seats[i].id});
    await expect.poll(()=>latest(client,'players')?.players.find((p:any)=>p.id===client.id)?.chairId).toBe(seats[i].id);
  }
  return [...clients];
}
async function readyPair(pair:Client[],game:string){
  for(const client of pair)send(client,{type:'lobby-join',game});
  await expect.poll(()=>latest(pair[0],'lobby-state')?.lobby?.members.length).toBe(2);
  for(const client of pair)send(client,{type:'lobby-ready',ready:true});
  await expect.poll(()=>latest(pair[0],'lobby-state')?.lobby?.phase,{timeout:8000}).toBe('playing');
}

for(const game of ['poker','lukis']){
  test(`${game}: a seated bystander who never joins or readies is not dealt into the match`,async()=>{
    const [host,friend,bystander]=await seat(3);
    await readyPair([host,friend],game);
    await expect.poll(()=>latest(host,`${game}-state`)?.game).toBeTruthy();
    const state=latest(host,`${game}-state`).game;
    const roster=(game==='poker'?state.players:state.scores).map((p:any)=>p.id);
    expect(roster,'The two ready lobby members are the match roster').toEqual(expect.arrayContaining([host.id,friend.id]));
    expect(roster,'Sitting nearby does not consent to playing').not.toContain(bystander.id);
    expect(roster).toHaveLength(2);
  });
}

test('Lukis started through SEDIA offers the advertised three-word choice',async()=>{
  const pair=await seat(2);
  await readyPair(pair,'lukis');
  await expect.poll(()=>latest(pair[0],'lukis-state')?.game).toBeTruthy();
  const state=latest(pair[0],'lukis-state').game;
  const drawer=pair.find(client=>client.id===state.drawer)!;
  const privateState=latest(drawer,'lukis-state').game;
  // The player's Cara main promises three choices and a 12-second decision window.
  expect(privateState.phase).toBe('choosing');
  expect(privateState.choices).toHaveLength(3);
});
