import {test,expect} from '@playwright/test';
import {createTableSocial} from '../server/tables.mjs';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import tables from '../shared/tables.json' with {type:'json'};
test('table host permissions, rounds, cooldown and receipts are authoritative',()=>{
 const messages:any[]=[];const social=createTableSocial((ws:any,m:any)=>messages.push({id:ws.id,...m}));
 const a={id:'a',ws:{id:'a'},name:'Alice',chairId:'chair-0',x:-38,z:46.65};const b={id:'b',ws:{id:'b'},name:'Bob',chairId:'chair-1',x:-36,z:44};const outside={id:'c',ws:{id:'c'},name:'Carol',chairId:null,x:80,z:80};const players=new Map([['a',a],['b',b],['c',outside]]);
 social.join(a);social.join(b);social.join(outside);social.sync(players,true);
 const latest=()=>messages.filter(m=>m.type==='tables').at(-1).tables[0];
 expect(latest().hostId).toBe('a');
 social.handle(players,b,{type:'table-name',name:'Stolen'});expect(latest().name).toBe('Meja 1');
 social.handle(players,a,{type:'table-name',name:'Geng Balik Lambat'});expect(latest().name).toBe('Geng Balik Lambat');
 social.handle(players,outside,{type:'table-round',tableId:'meja-1'});expect(latest().occupants.every((p:any)=>!p.hasCup)).toBe(true);
 social.handle(players,a,{type:'table-round'});expect(latest().occupants.every((p:any)=>p.hasCup)).toBe(true);expect(latest().cheersUntil).toBeGreaterThan(Date.now());
 social.handle(players,a,{type:'table-round'});social.recall(a);social.handle(players,a,{type:'receipt',drinksGiven:9999});
 const receipt=messages.find(m=>m.type==='receipt');expect(receipt).toMatchObject({id:'a',receipt:{drinksGiven:1,drinksReceived:1,recalls:1,tableName:'Geng Balik Lambat'}});
 expect(messages.filter(m=>m.type==='receipt')).toHaveLength(1);expect(messages.filter(m=>m.type==='table-round').some(m=>m.id==='c')).toBe(false);
 players.delete('a');social.sync(players);expect(latest().hostId).toBe('b');expect(latest().occupants).toHaveLength(1);
});
test('invitation joins the requested room at its table and receives table state',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8089',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});let ws:WebSocket|undefined;
 try{await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8089/health')).ok;}catch{return false;}}).toBe(true);
 ws=new WebSocket('ws://127.0.0.1:8089/ws');const received:any[]=[];ws.on('message',r=>received.push(JSON.parse(String(r))));ws.on('open',()=>ws!.send(JSON.stringify({type:'join',room:'geng-test',tableId:'meja-4',guest:true,name:'New Friend'})));
 await expect.poll(()=>received.some(m=>m.type==='tables')).toBe(true);const welcome=received.find(m=>m.type==='welcome');expect(welcome.room).toBe('geng-test');const self=welcome.players.find((p:any)=>p.id===welcome.id);expect(self).toMatchObject({x:tables[3].arrivalX,z:tables[3].arrivalZ});
 }finally{ws?.close();server.kill();}
});
for(const width of [390,1280])test(`table UI exports a receipt at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.route('**/table-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div><link rel="stylesheet" href="/src/style.css">'}));await page.goto('/table-harness');
 await page.evaluate(async()=>{const {setupTableSocial}=await import('/src/table-social.ts');const ui=setupTableSocial(m=>{if((m as any).type==='receipt')ui.receipt({name:'Yusuf',tableName:'Geng Balik Lambat',tableId:'meja-1',minutes:47,drinksGiven:6,drinksReceived:2,recalls:83,issuedAt:'2026-09-08T14:00:00Z'});return true;},'geng',()=>{});ui.state([{id:'meja-1',name:'Geng Balik Lambat',hostId:'self',capacity:3,cheersUntil:0,occupants:[{id:'self',name:'Yusuf',chairId:'chair-0',hasCup:true}]}],'self',true);ui.open();});
 await expect(page.locator('#table-link')).toHaveValue(/room=geng&table=meja-1/);await expect(page.locator('#table-name-form')).toBeVisible();
 await page.locator('#get-receipt').click();await expect(page.locator('#receipt-view')).toBeVisible();const download=page.waitForEvent('download');await page.locator('#download-receipt').click();expect((await download).suggestedFilename()).toBe('resit-lepak.png');
 await page.screenshot({path:`test-results/table-receipt-${width}.png`});
});

test('legacy mamak order messages are ignored while table games remain available',()=>{
 const messages:any[]=[];const social=createTableSocial((_ws:any,m:any)=>messages.push(m));
 const a={id:'a',ws:{},name:'Alice',chairId:'chair-0',x:-38,z:46};const b={id:'b',ws:{},name:'Bob',chairId:'chair-1',x:-38,z:46};const guest={id:'g',ws:{},name:'Guest',chairId:null,x:0,z:0};const players=new Map([['a',a],['b',b],['g',guest]]);social.sync(players,true);
 expect(social.handle(players,a,{type:'table-order',itemId:'roti-canai'})).toBe(false);
 expect(social.handle(players,a,{type:'table-consume'})).toBe(false);
 expect(messages.at(-1).tables[0].occupants[0]).not.toHaveProperty('order');
 social.handle(players,a,{type:'table-round'});expect(messages.at(-1).type).toBe('tables');
});

test('mobile table panel stays focused on games without a mamak order menu',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.route('**/food-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css">'}));await page.goto('/food-harness');
 await page.evaluate(async()=>{const {setupTableSocial}=await import('/src/table-social.ts');const table={id:'meja-1',name:'Meja 1',hostId:'self',capacity:3,cheersUntil:0,occupants:[{id:'self',name:'Diner',chairId:'chair-0',hasCup:false}]};const ui=setupTableSocial(()=>true,'food',()=>{});ui.state([table],'self',true);ui.open();});
 await expect(page.locator('.lukis')).toBeVisible();await expect(page.locator('.mamak-menu')).toHaveCount(0);await expect(page.getByText('Order at the mamak')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
