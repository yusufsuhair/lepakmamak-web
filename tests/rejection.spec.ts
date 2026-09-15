import {test,expect} from '@playwright/test';

// Enter the city without the real auth panel, the same way the Cilok browser test does.
const AUTH_STUB=`export let session={access_token:'test',user:{id:'a',user_metadata:{display_name:'Driver'}}};export const auth={auth:{getSession:async()=>({data:{session}}),refreshSession:async()=>{window.sessionRefreshes=(window.sessionRefreshes||0)+1;session={...session,access_token:'fresh'};return{data:{session}}}}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Driver';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`;

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

test('an expired session refreshes its token and reconnects without restarting the page',async({page})=>{
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:AUTH_STUB}));
 let joins=0;const tokens:string[]=[];
 await page.routeWebSocket('**/ws',ws=>{
  ws.onMessage((raw:any)=>{
   const message=JSON.parse(String(raw));if(message.type!=='join')return;tokens.push(message.accessToken);
   if(++joins===1)ws.close({code:4001,reason:'Session expired'});
   else ws.send(JSON.stringify({type:'welcome',id:'renewed',players:[{id:'renewed',name:'Driver',x:0,z:0,yaw:0,riding:false}]}));
  });
 });
 await page.goto('/');
 await expect(status(page)).toHaveText('CITY ONLINE',{timeout:10000});
 expect(joins).toBe(2);
 expect(tokens).toEqual(['test','fresh']);
 expect(await page.evaluate(()=>(window as any).sessionRefreshes)).toBe(1);
});

test('a transport drop shows recovery while the next socket retries',async({page})=>{
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:AUTH_STUB}));
 let joins=0;
 await page.routeWebSocket('**/ws',ws=>{
  const attempt=++joins;
  ws.onMessage((raw:any)=>{
   if(JSON.parse(String(raw)).type!=='join')return;
   if(attempt>1)return;
   ws.send(JSON.stringify({type:'welcome',id:`drop-${attempt}`,players:[{id:`drop-${attempt}`,name:'Driver',x:0,z:0,yaw:0,riding:false}]}));
   if(attempt===1)setTimeout(()=>void ws.close({code:1012,reason:'Network dropped'}),100);
  });
 });
 await page.goto('/');
 await expect(status(page)).toHaveText('CITY ONLINE',{timeout:10000});
 await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 await expect(page.locator('#force-refresh')).toBeVisible({timeout:10000});
 await expect(page.locator('#refresh-line')).toHaveText('Connection lost');
 await expect(page.locator('#refresh-now')).toHaveText('Restart');
 await expect(page.locator('#net-status')).toHaveAttribute('data-grade','none');
});
