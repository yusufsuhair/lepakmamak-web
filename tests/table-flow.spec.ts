import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import chairs from '../shared/chairs.json' with {type:'json'};
test('seated players open the game-only table and play poker',async({page})=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8088',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5180','--strictPort'],{env:{...process.env,VITE_MULTIPLAYER_URL:'ws://127.0.0.1:8088',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});let friend:WebSocket|undefined;let peers:any[]=[];let sharedTables:any[]=[];const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8088/health')).ok&&(await fetch('http://127.0.0.1:5180')).ok;}catch{return false;}}).toBe(true);
 await page.goto('http://127.0.0.1:5180/?room=table-flow&table=meja-1');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Host Friend');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#multiplayer-status-text')).toHaveText('CITY ONLINE');
 await page.keyboard.down('a');await page.waitForTimeout(220);await page.keyboard.up('a');await expect(page.locator('#interaction')).toHaveText('Sit');await page.locator('#interaction').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.seated)).toBe(true);
 friend=new WebSocket('ws://127.0.0.1:8088/ws');let friendId='';friend.on('message',raw=>{const m=JSON.parse(String(raw));if(m.players)peers=m.players;if(m.type==='tables')sharedTables=m.tables;if(m.type==='welcome')friendId=m.id;});friend.on('open',()=>friend!.send(JSON.stringify({type:'join',room:'table-flow',guest:true,name:'Kawan'})));await expect.poll(()=>friendId).not.toBe('');
 const free=chairs.find(c=>c.tableId==='meja-1'&&!peers.some(p=>p.chairId===c.id))!;friend.send(JSON.stringify({type:'state',x:free.x,z:free.z}));await expect.poll(()=>peers.find(p=>p.id===friendId)?.x).toBe(free.x);friend.send(JSON.stringify({type:'chair-sit',chairId:free.id}));await expect.poll(()=>peers.find(p=>p.id===friendId)?.seated).toBe(true);
 await expect(page.locator('#open-tables')).toHaveCount(0);await page.getByRole('button',{name:/Open Meja Kita at Meja 1/}).click();await expect(page.locator('#table-name')).toHaveText('Meja 1');await expect(page.locator('#table-seats')).toContainText('2/3');
 let pokerGame:any;friend.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='poker-state')pokerGame=m.game;});
 await page.locator('[data-select="poker"]').click();await page.locator('.poker [data-start]').click();await expect(page.locator('.poker [data-game]')).toBeVisible();await expect.poll(()=>pokerGame?.hand).toBeTruthy();
 expect(pokerGame.players.find((p:any)=>p.id!==friendId).cards).toEqual([]);
 if(pokerGame.turnId===friendId)friend.send(JSON.stringify({type:'poker-action',hand:pokerGame.hand,revision:pokerGame.revision,action:'fold'}));else await page.locator('.poker [data-action="fold"]').click();
 await expect(page.locator('.poker [data-phase]')).toHaveText('Pusingan tamat');await expect(page.locator('.poker [data-turn]')).toContainText('menang');
 await page.locator('#close-table-social').click();await page.screenshot({path:'test-results/table-flow-world.png'});expect(errors).toEqual([]);
 }finally{friend?.close();vite.kill();server.kill();}
});
