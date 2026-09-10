import {test,expect} from '@playwright/test';
import {createLamps,MAX_LAMPS} from '../server/lamps.mjs';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

let clock = 0;
const room = () => {
  const sent: any[] = [], players = new Map();
  const lamps = createLamps((_ws: any, message: any) => sent.push(['direct', message]), (_players: any, message: any) => sent.push(['all', message]), () => clock);
  return {sent, players, lamps};
};

test('a lamp somebody flipped is what the next arrival is told about',()=>{
 clock = 0; const {sent, players, lamps} = room();
 lamps.sync(players, {});
 expect(sent).toEqual([['direct', {type: 'lamps', lamps: {}}]]);

 const ali = {name: 'Ali'};
 expect(lamps.handle(players, ali, {type: 'move'})).toBe(false);
 expect(lamps.handle(players, ali, {type: 'lamp', index: 12, on: false})).toBe(true);
 expect(sent.at(-1)).toEqual(['all', {type: 'lamp', index: 12, on: false, name: 'Ali'}]);

 clock += 400;
 lamps.handle(players, ali, {type: 'lamp', index: 40, on: true});
 sent.length = 0; lamps.sync(players, {});
 // Only the lamps somebody touched are carried; the rest still follow the clock.
 expect(sent).toEqual([['direct', {type: 'lamps', lamps: {12: false, 40: true}}]]);
});

test('one lamp at a time, so nobody can run down the street strobing them',()=>{
 clock = 10000; const {sent, players, lamps} = room();
 const mei = {name: 'Mei'};
 lamps.handle(players, mei, {type: 'lamp', index: 1, on: true});
 lamps.handle(players, mei, {type: 'lamp', index: 2, on: true});
 expect(sent).toHaveLength(1);
 clock += 400;
 lamps.handle(players, mei, {type: 'lamp', index: 2, on: true});
 expect(sent).toHaveLength(2);
 // Somebody else is never blocked by your cooldown.
 lamps.handle(players, {name: 'Ravi'}, {type: 'lamp', index: 3, on: false});
 expect(sent).toHaveLength(3);
});

test('a lamp that does not exist is dropped rather than broadcast',()=>{
 clock = 50000; const {sent, players, lamps} = room();
 for (const message of [
   {type: 'lamp', index: -1, on: true},
   {type: 'lamp', index: MAX_LAMPS, on: true},
   {type: 'lamp', index: 1.5, on: true},
   {type: 'lamp', index: '4', on: true},
   {type: 'lamp', index: 4, on: 'yes'},
   {type: 'lamp', index: 4},
 ]) expect(lamps.handle(players, {name: 'X'}, message)).toBe(true);
 expect(sent).toHaveLength(0);
});

test('two rooms keep their own street',()=>{
 clock = 90000; const {sent, lamps} = room();
 const kampung = new Map(), bandar = new Map();
 lamps.handle(kampung, {name: 'A'}, {type: 'lamp', index: 7, on: false});
 clock += 400;
 lamps.handle(bandar, {name: 'B'}, {type: 'lamp', index: 9, on: true});
 sent.length = 0;
 lamps.sync(kampung, {}); lamps.sync(bandar, {});
 expect(sent).toEqual([['direct', {type: 'lamps', lamps: {7: false}}], ['direct', {type: 'lamps', lamps: {9: true}}]]);
});

// The wiring in index.mjs is two lines, but they carry message names: a typo there is
// silent, so a real server and two real sockets are worth the twenty seconds.
test('a lamp flipped by one player reaches the other, and the next to arrive',async()=>{
 const PORT='8127';
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT,ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 const sockets:WebSocket[]=[];
 try{
  await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${PORT}/health`)).ok;}catch{return false;}},{timeout:30000}).toBe(true);
  const join=(name:string)=>new Promise<{ws:WebSocket;lamp:any[];lamps:any[]}>((resolve,reject)=>{
   const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`); sockets.push(ws);
   const client={ws,lamp:[] as any[],lamps:[] as any[]};
   ws.on('error',reject);
   ws.on('open',()=>ws.send(JSON.stringify({type:'join',room:'lamp-test',guest:true,name})));
   ws.on('message',raw=>{const m=JSON.parse(String(raw));
    if(m.type==='lamps')client.lamps.push(m.lamps);
    if(m.type==='lamp')client.lamp.push(m);
    if(m.type==='welcome')resolve(client);});
  });
  const ali=await join('Ali'), mei=await join('Mei');
  // A fresh street is on the clock, with nothing carried.
  await expect.poll(()=>ali.lamps.length).toBe(1);
  expect(ali.lamps[0]).toEqual({});

  ali.ws.send(JSON.stringify({type:'lamp',index:17,on:false}));
  await expect.poll(()=>mei.lamp.length,{timeout:5000}).toBe(1);
  expect(mei.lamp[0]).toMatchObject({type:'lamp',index:17,on:false,name:'Ali'});
  // The person who flipped it is told too, so nobody has to guess locally.
  expect(ali.lamp[0]).toMatchObject({index:17,on:false});

  const ravi=await join('Ravi');
  await expect.poll(()=>ravi.lamps.length).toBe(1);
  expect(ravi.lamps[0]).toEqual({17:false});
 } finally {
  for(const ws of sockets) ws.close();
  server.kill();
 }
});
