import {test,expect} from '@playwright/test';

const mount=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {createTableShell}=await import('/src/table-shell.ts');
  (window as any).sent=[];
  const shell=createTableShell((m:any)=>{(window as any).sent.push(m);return true;});
  (window as any).shell=shell;
  document.getElementById('hud')!.append(shell.root);
 });
};
const lobby=(over:Record<string,unknown>={})=>({
 key:'meja-1',game:'lukis',scope:'table',phase:'lobby',ends:0,serverTime:0,min:2,max:3,
 members:[{id:'a',name:'Ali',ready:false},{id:'b',name:'Mei',ready:false}],...over});

test('the ring shows who is here, who is ready and how many seats are still open',async({page})=>{
 await mount(page,'shell-harness');
 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby());
 await expect(page.locator('.table-seat')).toHaveCount(3);
 await expect(page.locator('.table-seat.filled')).toHaveCount(2);
 await expect(page.locator('.table-seat.empty')).toHaveCount(1);
 await expect(page.locator('.table-seat').first()).toContainText('Ali');

 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby({members:[{id:'a',name:'Ali',ready:true},{id:'b',name:'Mei',ready:false}]}));
 await expect(page.locator('.table-seat.filled').first()).toHaveClass(/ready/);
 await expect(page.locator('.table-seat.filled').nth(1)).not.toHaveClass(/ready/);
});

test('sedia toggles, and the countdown replaces it once everyone is in',async({page})=>{
 await mount(page,'ready-harness');
 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby());
 await page.getByRole('button',{name:/READY/}).click();
 expect(await page.evaluate(()=>(window as any).sent)).toEqual([{type:'lobby-ready',ready:true}]);

 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby({members:[{id:'a',name:'Ali',ready:true},{id:'b',name:'Mei',ready:false}]}));
 await page.getByRole('button',{name:/READY/}).click();
 expect(await page.evaluate(()=>(window as any).sent)).toContainEqual({type:'lobby-ready',ready:false});

 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby({phase:'countdown',ends:3000,serverTime:0,members:[{id:'a',name:'Ali',ready:true},{id:'b',name:'Mei',ready:true}]}));
 await expect(page.locator('#table-countdown')).toBeVisible();
 await expect(page.getByRole('button',{name:/READY/})).toBeHidden();
});

test('the lobby steps aside while a game is running and comes back to run it again',async({page})=>{
 await mount(page,'playing-harness');
 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby({phase:'playing',members:[{id:'a',name:'Ali',ready:true},{id:'b',name:'Mei',ready:true}]}));
 expect(await page.evaluate(()=>(window as any).shell.playing)).toBe(true);
 await expect(page.locator('#table-ring')).toBeHidden();

 await page.getByRole('button',{name:'Play again'}).click();
 expect(await page.evaluate(()=>(window as any).sent)).toContainEqual({type:'lobby-rematch'});
});

test('a reaction fires to the table and shows up on screen',async({page})=>{
 await mount(page,'react-harness');
 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby());
 await page.getByRole('button',{name:'React 🔥'}).click();
 expect(await page.evaluate(()=>(window as any).sent)).toContainEqual({type:'lobby-react',emoji:'🔥'});

 await page.evaluate(()=>(window as any).shell.react({emoji:'😂',name:'Mei',id:'b'}));
 await expect(page.locator('.table-reaction')).toContainText('😂');
});

test('a city lobby says so, instead of pretending to be this table',async({page})=>{
 await mount(page,'city-harness');
 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby({game:'werewolf',scope:'city',min:7,max:9,key:'city'}));
 await expect(page.locator('#table-scope')).toContainText('City lobby');
 // Nine seats, not the three at this table.
 await expect(page.locator('.table-seat')).toHaveCount(9);
});

test('an empty seat pulls your geng in, and says so when you have none',async({page})=>{
 await mount(page,'invite-harness');
 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby());

 // No party yet: the seat must not pretend it can do anything.
 const idle=page.locator('.table-seat.empty button');
 await expect(idle).toBeDisabled();
 await expect(idle).toHaveAttribute('title',/Join a party first/);

 await page.evaluate(()=>(window as any).shell.party(2));
 await page.evaluate(l=>(window as any).shell.state(l,'a'),lobby());
 const invite=page.locator('.table-seat.empty button');
 await expect(invite).toBeEnabled();
 await invite.click();

 // It rides the party chat channel that already exists, so no new server message.
 const sent=await page.evaluate(()=>(window as any).sent);
 expect(sent.at(-1)).toMatchObject({type:'chat',channel:'party'});
 expect(sent.at(-1).text).toContain('Lukis Lah!');
 await expect(page.locator('.table-seat.empty button')).toContainText('Invited');
});
