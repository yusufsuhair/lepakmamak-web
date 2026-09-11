import {expect,type Page} from '@playwright/test';

// Enters as a guest at (x,z) against a stand-in city. The returned function moves the player: a
// later welcome restores a spot the same way a reconnect does, so specs can arrive and leave
// without walking. The stand-in answers the heartbeat; otherwise the client drops it as stale
// after ~13 s, which mutes ambience and would pass for a "pause".
export async function enterAt(page:Page,x:number,z:number){
 let city:any,spot=[x,z];const welcome=([x,z]:number[])=>JSON.stringify({type:'welcome',id:'loop-player',players:[{id:'loop-player',name:'Tester',color:'#72c8ba',x,z,yaw:Math.PI,riding:false,speed:0,guest:true}]});
 await page.routeWebSocket('**/ws',ws=>{city=ws;ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join')ws.send(welcome(spot));if(m.type==='ping')ws.send(JSON.stringify({type:'pong',t:m.t}));});});
 await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.position.z)).toBe(z);
 return (x:number,z:number)=>{spot=[x,z];city.send(welcome(spot));};
}
