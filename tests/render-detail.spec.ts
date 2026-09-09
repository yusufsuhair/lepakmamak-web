import {test,expect} from '@playwright/test';

// A hundred players used to be drawn in full articulation whatever their distance, about 33
// draw calls each. Only the nearest earn that now. These assert the shape of the saving
// rather than absolute counts, which move whenever the city itself gains scenery.
const AUTH_STUB=`export const session={access_token:'test',user:{id:'a',user_metadata:{display_name:'Driver'}}};export const auth={auth:{getSession:async()=>({data:{session}})}};export let guestName='';export function clearGuest(){}export const displayName=()=> 'Driver';export async function setupAuth(onEnter){const panel=document.createElement('div');panel.id='auth-panel';panel.hidden=true;document.body.append(panel);return onEnter;}`;

const person=(i:number,x:number,z:number)=>({id:'p'+i,name:'Player'+i,x,z,yaw:0,riding:false,vehicle:'bike',speed:0,jumpHeight:0,seated:false,mic:false,speaker:false,appearance:{gender:'male',hairstyle:'short',hair:'#202c2b',skin:'#b98157',shirt:'#ef734c',trousers:'#c7be9c'},accessories:[],color:'#dafa8e'});
// A fixed spiral, so a rerun measures the same city rather than a new random one.
const ring=(i:number,spread:number)=>{const a=i*2.39996,r=spread*Math.sqrt(i/100);return [Math.cos(a)*r,Math.sin(a)*r] as const;};

async function drawCalls(page:any,count:number,spread:number){
 await page.route('**/src/auth.ts*',(r:any)=>r.fulfill({contentType:'application/javascript',body:AUTH_STUB}));
 await page.routeWebSocket('**/ws',(ws:any)=>{
  ws.onMessage((raw:any)=>{
   if(JSON.parse(String(raw)).type!=='join')return;
   const self:any=person(0,0,0);self.id='a';
   const others=Array.from({length:count-1},(_,i)=>{const [x,z]=ring(i+1,spread);return person(i+1,x,z);});
   ws.send(JSON.stringify({type:'welcome',id:'a',players:[self,...others]}));
   ws.send(JSON.stringify({type:'players',players:[self,...others]}));
  });
 });
 await page.goto('/');
 await page.waitForFunction(()=>(window as any).__lepak?.started===true,{timeout:20000});
 await page.waitForTimeout(2000);
 return await page.evaluate(()=>(window as any).__lepak.drawCalls as number);
}

test('a hundred players spread across the city cost little more than ten',async({page})=>{
 const ten=await drawCalls(page,10,25);
 const hundred=await drawCalls(page,100,140);
 console.log(`RENDER ten=${ten} hundredSpread=${hundred}`);
 // Distant players stop being drawn, so filling the city barely moves the cost.
 expect(hundred).toBeLessThan(ten*1.2);
});

test('a hundred players in one place stay within a bounded cost',async({page})=>{
 const ten=await drawCalls(page,10,25);
 const crowd=await drawCalls(page,100,10);
 console.log(`RENDER ten=${ten} hundredCrowded=${crowd} ratio=${(crowd/ten).toFixed(2)}`);
 // Before the detail budget this ratio was about 2.4; the ceiling keeps it well under that
 // however tightly a hundred people pack together.
 expect(crowd/ten).toBeLessThan(2);
});
