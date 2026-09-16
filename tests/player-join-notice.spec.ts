import {test,expect} from '@playwright/test';

test('a new player gets a notice above the speedometer',async({page})=>{
 let socket:any;
 const own={id:'join-player',name:'Join tester',color:'#72c8ba',x:0,z:0,yaw:0,riding:false,speed:0,guest:true};
 await page.routeWebSocket('**/ws',ws=>{
  socket=ws;
  ws.onMessage(raw=>{
   if(JSON.parse(String(raw)).type==='join') ws.send(JSON.stringify({type:'welcome',id:own.id,players:[own]}));
  });
 });
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Join tester');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();
 await expect.poll(()=>!!socket).toBe(true);
 const joined={...own,id:'new-player',name:'Alya',x:2,z:2};
 socket.send(JSON.stringify({type:'players',players:[own,joined]}));
 const notice=page.locator('#player-join-notice');
 await expect(notice).toHaveText('Alya just joined the game');
 await expect(notice).toBeVisible();
 const noticeBox=await notice.boundingBox();
 const speedBox=await page.locator('#speed').boundingBox();
 expect(noticeBox!.y+noticeBox!.height).toBeLessThanOrEqual(speedBox!.y);
});
