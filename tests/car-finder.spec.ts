import {test,expect} from '@playwright/test';

for(const width of [1280,390])test(`find owner cars follows live fleet in the 2D map (${width}px)`,async({page})=>{
 await page.setViewportSize({width,height:844});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/auth.ts*',r=>r.fulfill({contentType:'application/javascript',body:`export const session={access_token:'test',user:{id:'a',user_metadata:{display_name:'Tester'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Tester';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`}));
 let send:(m:object)=>void=()=>{};let disconnect:()=>void=()=>{};const teleports:object[]=[];
 await page.routeWebSocket('**/ws',ws=>{send=m=>ws.send(JSON.stringify(m));disconnect=()=>ws.close();ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='join'){send({type:'welcome',id:'a',players:[{id:'a',name:'Tester',x:0,z:0,yaw:0,riding:false},{id:'driver',name:'Ali',x:50,z:60,yaw:0,riding:false}]});}if(m.type==='teleport')teleports.push(m);});});
 await page.goto('/');await expect.poll(()=>page.evaluate(()=>(window as any).__lepak?.started)).toBe(true);
 await page.evaluate(()=>document.querySelector<HTMLDialogElement>('#city-map')!.showModal());
 await page.getByRole('button',{name:'1 Mamak Maju',exact:true}).click();await expect(page.locator('#map-teleport')).toBeEnabled();
 await page.locator('#car-finder summary').click();
 await page.getByRole('button',{name:'Yusuf Suhair Porsche Taycan',exact:true}).click();
 await expect(page.locator('.car-finder-status')).toContainText('Waiting');await expect(page.locator('#map-teleport')).toBeDisabled();
 send({type:'fleet',cars:[{id:'parked-taycan',x:50,z:60,yaw:0,owner:'driver',npc:false},{id:'parked-gt3-rs',x:-100,z:110,yaw:0,owner:null,npc:false}]});
 await expect(page.locator('.car-finder-status')).toContainText('Driver: Ali');await expect(page.locator('.car-finder-status')).toContainText('(50, 60)');
 send({type:'fleet',cars:[{id:'parked-taycan',x:75,z:80,yaw:0,owner:null,npc:false},{id:'parked-gt3-rs',x:-100,z:110,yaw:0,owner:null,npc:false}]});
 await expect(page.locator('.car-finder-status')).toContainText('Parked · Available');await expect(page.locator('.car-finder-status')).toContainText('(75, 80)');
 await page.getByRole('button',{name:'Daddy Fizal Porsche 911 GT3 RS',exact:true}).click();await expect(page.locator('.car-finder-status')).toContainText('(-100, 110)');
 await expect(page.getByRole('button',{name:'Daddy Fizal Porsche 911 GT3 RS',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.locator('#car-finder').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/car-finder-${width}.png`});
 await expect(page.locator('#expanded-map')).toHaveAttribute('data-mode','2d');await expect(page.locator('.map-view-controls')).toHaveCount(0);
 await expect(page.locator('.car-finder-status')).toContainText('Daddy Fizal');
 await page.getByRole('button',{name:'Daddy Fizal Porsche 911 GT3 RS',exact:true}).click();
 await expect(page.getByRole('button',{name:'Daddy Fizal Porsche 911 GT3 RS',exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.car-finder-status')).toHaveText('Choose a car to show its live map pin.');
 disconnect();await expect(page.locator('.car-finder-status')).toContainText('City offline');expect(teleports).toEqual([]);expect(errors).toEqual([]);
});
