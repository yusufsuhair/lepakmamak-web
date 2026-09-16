import {test,expect} from '@playwright/test';

test('a nearby player offers the same profile actions as a player press',async({page})=>{
 await page.routeWebSocket('**/ws',ws=>{ws.onMessage(raw=>{const message=JSON.parse(String(raw));
  if(message.type==='join')ws.send(JSON.stringify({type:'welcome',id:'self',players:[
   {id:'self',name:'Tester',color:'#72c8ba',x:-18,z:52,yaw:Math.PI,riding:false,speed:0},
   {id:'geng',name:'Geng',color:'#72c8ba',x:-18,z:50.5,yaw:0,riding:false,speed:0},
  ]}));
  if(message.type==='ping')ws.send(JSON.stringify({type:'pong',t:message.t}));
 });});
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#interaction')).toHaveText('Interact · Geng',{timeout:15000});
 await page.locator('#interaction').click();
 await expect(page.locator('#player-options')).toBeVisible();
 await expect(page.getByRole('menuitem',{name:'View profile'})).toBeVisible();
});
