import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { filterChat } from '../server/chat-filter.mjs';

test('chat masks profanity and common evasions without censoring ordinary words', () => {
 for (const text of ['fuck', 'you BODOH!', 'b4b1', 'f.u.c.k', 'f u c k', 'shiiit', 'ＦＵＣＫ', 'fu\u200bck', 'pukimak', 'hello bitch']) expect(filterChat(text)).toBe('***');
 for (const text of ['Jom lepak mamak!', 'class assistant Scunthorpe', 'assalamualaikum', 'I love this city', '***']) expect(filterChat(text)).toBe(text);
});

test('server sends only the censored message to sender and peers', async () => {
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8095',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 const clients:WebSocket[]=[], received:string[][]=[[],[]]; const timestamps:string[][]=[[],[]];
 try {
  await expect.poll(async()=>{try{return (await fetch('http://127.0.0.1:8095/health')).ok;}catch{return false;}}).toBe(true);
  for(let i=0;i<2;i++){
   const ws=new WebSocket('ws://127.0.0.1:8095/ws');clients.push(ws);
   await new Promise<void>((resolve,reject)=>{ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'filter-test'})));ws.on('message',raw=>{const message=JSON.parse(String(raw));if(message.type==='welcome')resolve();if(message.type==='chat'){received[i].push(message.text);timestamps[i].push(message.sentAt);}});});
  }
  clients[0].send(JSON.stringify({type:'chat',text:'you BODOH!',sentAt:'2000-01-01T00:00:00.000Z'}));
  await expect.poll(()=>received).toEqual([['***'],['***']]);
  expect(timestamps[0][0]).toBe(timestamps[1][0]); expect(Math.abs(Date.now()-Date.parse(timestamps[0][0]))).toBeLessThan(5000);
  clients[1].send(JSON.stringify({type:'chat',text:'Jom mamak'}));
  await expect.poll(()=>received).toEqual([['***','Jom mamak'],['***','Jom mamak']]);
 } finally {clients.forEach(ws=>ws.close());server.kill();}
});
