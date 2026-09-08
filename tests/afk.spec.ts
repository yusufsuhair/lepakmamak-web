import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
test('AFK note persists above the player until cleared', async ({page}) => {
 await page.goto('/'); await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#menu').click(); await page.locator('#afk-note').fill('berak jap'); await page.locator('#save-afk').click();
 await page.locator('#resume').click(); await expect(page.locator('.afk-bubble')).toContainText('berak jap');
 await page.waitForTimeout(7000); await expect(page.locator('.afk-bubble')).toBeVisible();
 await page.locator('#menu').click(); await page.locator('#clear-afk').click(); await expect(page.locator('.afk-bubble')).toHaveCount(0);
});
test('server shares, filters and clears AFK notes for current and new peers',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8091',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'}); const clients:WebSocket[]=[];
 function next(ws:WebSocket,type:string, note?:string){return new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No '+type)),5000);const receive=(raw:any)=>{const m=JSON.parse(String(raw));if(m.type===type && (note === undefined || m.players?.some((p:any)=>p.afkNote===note))){clearTimeout(timer);ws.off('message',receive);resolve(m);}};ws.on('message',receive);});}
 async function join(name:string){const ws=new WebSocket('ws://127.0.0.1:8091/ws');clients.push(ws); const welcome=next(ws,'welcome');ws.on('open',()=>ws.send(JSON.stringify({type:'join',name,guest:true,room:'afk'})));return {ws,message:await welcome};}
 try { await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8091/health')).ok;}catch{return false;}}).toBe(true);
 const a=await join('Friend One');let update=next(a.ws,'players','berak jap');a.ws.send(JSON.stringify({type:'afk-note',text:'berak jap'}));expect((await update).players.find((p:any)=>p.id===a.message.id).afkNote).toBe('berak jap');
 const b=await join('Friend Two');expect(b.message.players.find((p:any)=>p.id===a.message.id).afkNote).toBe('berak jap');
 update=next(b.ws,'players','***');a.ws.send(JSON.stringify({type:'afk-note',text:'bodoh'}));expect((await update).players.find((p:any)=>p.id===a.message.id).afkNote).toBe('***');
 update=next(b.ws,'players','');a.ws.send(JSON.stringify({type:'afk-note',text:''}));expect((await update).players.find((p:any)=>p.id===a.message.id).afkNote).toBe('');
 }finally{clients.forEach(ws=>ws.close());server.kill();}
});
