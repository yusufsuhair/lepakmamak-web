import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {readFileSync} from 'node:fs';
import city from '../shared/city.json' with {type:'json'};

const PORT='8128';

test('the city holds a hundred people',()=>{
 expect(city.maxPlayers).toBe(100);
});

test('the HUD counts against the shared limit rather than a literal of its own',()=>{
 // Checked against the file, not the served bundle: Vite folds the JSON import into a
 // literal, so the transformed source cannot tell a shared constant from a hardcoded one.
 const source=readFileSync('src/main.ts','utf8');
 expect(source).toContain('${count} / ${city.maxPlayers}');
 // A hardcoded denominator is how the HUD came to read "/ 24" while the server allowed more.
 expect(source).not.toMatch(/player-count'\)\.textContent\s*=\s*`\$\{count\} \/ \d+`/);
});

test('the server turns away the player past the limit and lets one in again after somebody leaves',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const open:WebSocket[]=[];
 const join=(name:string)=>new Promise<{ws:WebSocket;ok:boolean}>(resolve=>{
  const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  let settled=false;
  const done=(ok:boolean)=>{if(!settled){settled=true;resolve({ws,ok});}};
  ws.on('error',()=>done(false));
  ws.on('close',()=>done(false));
  ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'full-house',guest:true,name})));
  ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='welcome')done(true);if(m.type==='error')done(false);});
 });
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);

  for(let i=0;i<city.maxPlayers;i++){
   const {ws,ok}=await join(`Player ${i}`);
   open.push(ws);
   expect(ok).toBe(true);
  }
  await expect.poll(async()=>(await (await fetch(`http://127.0.0.1:${PORT}/health`)).json()).players,{timeout:15000}).toBe(city.maxPlayers);

  // Forty-one is one too many.
  const extra=await join('One too many');
  expect(extra.ok).toBe(false);
  extra.ws.close();

  // A seat freed is a seat available.
  open.pop()!.close();
  await expect.poll(async()=>(await (await fetch(`http://127.0.0.1:${PORT}/health`)).json()).players,{timeout:15000}).toBe(city.maxPlayers-1);
  const replacement=await join('Latecomer');
  open.push(replacement.ws);
  expect(replacement.ok).toBe(true);
 } finally { open.forEach(ws=>ws.close()); server.kill(); }
});
