import {test,expect} from '@playwright/test';
import names from '../shared/guest-names.json' with {type:'json'};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ?play-now is how a dev build shows what production shows with VITE_ALLOW_GUESTS=true: one
// tap from the title into the city. Without it dev keeps the typed-name guest dialog that
// the rest of the suite enters through.
test('one tap from the title puts a new visitor in the city as a named guest',async({page})=>{
 let join:any;const events:string[]=[];
 await page.routeWebSocket('**/ws',ws=>ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join'){join=m;ws.send(JSON.stringify({type:'welcome',id:'me',players:[{id:'me',name:m.name,color:'#72c8ba',x:-34.5,z:45,yaw:Math.PI,riding:false,speed:0,guest:true}]}));}if(m.type==='ping')ws.send(JSON.stringify({type:'pong',t:m.t}));}));
 page.on('request',request=>{if(new URL(request.url()).pathname==='/event')events.push(JSON.parse(request.postData()||'{}').event);});
 await page.goto('/?play-now');
 await expect(page.locator('#login')).toBeVisible();
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await expect(page.locator('#hud')).toBeVisible();
 await expect(page.locator('#auth-panel')).toBeHidden();
 await expect.poll(()=>join?.guest).toBe(true);
 expect(names).toContain(join.name.replace(/ \d{2}$/,''));expect(join.name).toMatch(/ \d{2}$/);
 expect(join.device).toMatch(UUID);
 await expect.poll(()=>events).toEqual(['page_load','play_tapped']);
 // The same device comes back as the same device: that is what day-1 retention counts.
 const device=join.device;join=undefined;await page.reload();
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await expect.poll(()=>join?.device).toBe(device);
});

test('a guest is always one tap from an account, and the title still has a way to log in',async({page})=>{
 await page.routeWebSocket('**/ws',ws=>ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join')ws.send(JSON.stringify({type:'welcome',id:'me',players:[{id:'me',name:m.name,color:'#72c8ba',x:-34.5,z:45,yaw:Math.PI,riding:false,speed:0,guest:true}]}));if(m.type==='ping')ws.send(JSON.stringify({type:'pong',t:m.t}));}));
 await page.goto('/?play-now');
 await page.locator('#login').click();
 await expect(page.locator('#auth-panel')).toBeVisible();
 await expect(page.locator('#auth-guest')).toBeHidden();
 await page.locator('#auth-back').click();
 await expect(page.locator('#auth-panel')).toBeHidden();
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 const upgrade=page.locator('#guest-upgrade');await expect(upgrade).toBeVisible();
 await upgrade.click();
 await expect(page.locator('#auth-panel')).toBeVisible();
 await expect(page.locator('#hud')).toBeHidden();
});

test('without the switch, dev still enters through the typed-name dialog',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#login')).toBeHidden();
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await expect(page.locator('#auth-guest')).toBeVisible();
});
