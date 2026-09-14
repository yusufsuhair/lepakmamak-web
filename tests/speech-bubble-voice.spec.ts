import {test,expect} from '@playwright/test';

// The mic/speaker controls float over your own head; the Game Master nameplate is taller, which
// lifted them into your own speech bubble and hid what you said.
for(const [device,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]] as const)test(`your own speech bubble never sits under your floating voice controls (${device})`,async({browser})=>{
 const context=await browser.newContext({viewport,hasTouch:device==='phone',isMobile:device==='phone'});const page=await context.newPage();await page.addInitScript(()=>localStorage.setItem('lepakmamak-onboarded','1'));
 let send=(m:unknown)=>{};
 await page.routeWebSocket('**/ws',ws=>{send=m=>ws.send(JSON.stringify(m));ws.onMessage(raw=>{if(JSON.parse(String(raw)).type==='join')send({type:'welcome',id:'gm',players:[{id:'gm',name:'Yusuf Suhair',color:'#72c8ba',x:0,z:20,yaw:Math.PI/2,riding:false,speed:0,guest:true,gameMaster:true}]});});});
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Yusuf Suhair');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 const panel=page.locator('#voice-panel');await expect(panel).toBeVisible();
 const bubble=page.locator('.speech-bubble');
 for(const zoom of [0,4]){
  if(zoom&&device==='desktop')for(let i=0;i<zoom;i++)await page.mouse.wheel(0,-400);
  send({type:'chat',id:'gm',name:'Yusuf Suhair',text:'Jom semua, event mula sekarang',sentAt:Date.now(),gameMaster:true});
  await expect(bubble).toBeVisible();await page.waitForTimeout(400);
  const [b,p]=await Promise.all([bubble.boundingBox(),panel.boundingBox()]);
  const overlap=!!b&&!!p&&b.x<p.x+p.width&&b.x+b.width>p.x&&b.y<p.y+p.height&&b.y+b.height>p.y;
  if(process.env.SHOTS)await page.screenshot({path:`${process.env.SHOTS}/bubble-${device}-${zoom}.jpg`,type:'jpeg',quality:70});
  expect(overlap,`zoom ${zoom}: bubble ${JSON.stringify(b)} panel ${JSON.stringify(p)}`).toBe(false);
 }
 await context.close();
});
