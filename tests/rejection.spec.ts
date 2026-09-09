import {test,expect} from '@playwright/test';

// Enter the city without the real auth panel, the same way the Cilok browser test does.
const AUTH_STUB=`export const session={access_token:'test',user:{id:'a',user_metadata:{display_name:'Driver'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Driver';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`;

const status=(page:any)=>page.locator('#multiplayer-status-text');

test('a full city says so instead of reconnecting forever',async({page})=>{
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:AUTH_STUB}));
 await page.routeWebSocket('**/ws',ws=>{
  ws.onMessage((raw:any)=>{
   if(JSON.parse(String(raw)).type!=='join')return;
   // The server explains itself and then closes, which is what used to bury the reason.
   ws.send(JSON.stringify({type:'error',code:'ROOM_FULL',message:'This room is full. Try again in a moment.'}));
   ws.close({code:1008,reason:'Room full'});
  });
 });
 await page.goto('/');
 await expect(status(page)).toHaveText('CITY FULL');
 // Still true a moment later: the close must not overwrite it on the next attempt either.
 await page.waitForTimeout(3000);
 await expect(status(page)).not.toHaveText('RECONNECTING…');
});

test('an expired session asks for a login instead of reconnecting forever',async({page})=>{
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:AUTH_STUB}));
 await page.routeWebSocket('**/ws',ws=>{
  ws.onMessage((raw:any)=>{
   if(JSON.parse(String(raw)).type!=='join')return;
   ws.close({code:4001,reason:'Session expired'});
  });
 });
 await page.goto('/');
 await expect(status(page)).toHaveText('LOGIN REQUIRED');
});
