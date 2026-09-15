import {test,expect} from '@playwright/test';
import {spawn,type ChildProcess} from 'node:child_process';
import catalog from '../shared/casual-games.json' with {type:'json'};
import chairs from '../shared/chairs.json' with {type:'json'};

let server:ChildProcess;
const port=18865;
test.beforeAll(async()=>{
 server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',CF_SFU_APP_ID:'',CF_SFU_APP_SECRET:''},stdio:['ignore','pipe','pipe']});
 server.stderr?.on('data',data=>console.log('server',String(data)));
 await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${port}/health`)).ok;}catch{return false;}}).toBe(true);
});
test.afterAll(()=>server?.kill());

for(const kind of Object.keys(catalog))test(`${kind}: two live clients play from the table menu on mobile and desktop`,async({context},testInfo)=>{
 await context.grantPermissions(['local-network-access']);
 const pages=[await context.newPage(),await context.newPage()];const errors:string[]=[];
 try{
  for(let i=0;i<2;i++){
   const page=pages[i];page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')console.log('browser',msg.text());});await page.setViewportSize({width:i===0?390:1280,height:844});
   await page.route('**/casual-live',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><div id="hud"><div id="city-chat">City chat stays here.</div></div>'}));
   await page.goto('/casual-live');
   await page.evaluate(async({port,room,chair,i})=>{
    const {setupTableSocial}=await import('/src/table-social.ts');
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),w=window as any;let id='';
    const send=(m:object)=>{if(ws.readyState!==1)return false;ws.send(JSON.stringify(m));return true;};
    const ui=setupTableSocial(send,room,()=>{},()=>{});w.ui=ui;w.ws=ws;w.messages=[];
    ws.onopen=()=>send({type:'join',room,guest:true,name:`Gamer ${i}`,resume:{x:chair.x,z:chair.z,yaw:0}});
    ws.onmessage=event=>{
     const m=JSON.parse(event.data);w.messages.push(m);
     if(m.type==='welcome'){id=m.id;send({type:'chair-sit',chairId:chair.id});}
     if(m.type==='tables')ui.state(m.tables,id,true);
     if(m.type==='lobby-state')ui.lobby(m.lobby);
     if(m.type==='casual-state'){w.game=m.game;ui.casual(m.game);}
    };
   },{port,room:`casual-ui-${kind}`,chair:chairs.filter(c=>c.tableId==='meja-1')[i],i});
   await expect.poll(()=>page.evaluate((i:number)=>(window as any).messages.some((m:any)=>m.type==='tables'&&m.tables.some((t:any)=>t.occupants.some((p:any)=>p.name===`Gamer ${i}`))),i)).toBe(true);
   await page.evaluate(()=>(window as any).ui.open('meja-1'));
   await expect(page.locator('[data-select]')).toHaveCount(9);
   await page.locator(`[data-select="${kind}"]`).click();
  }
  for(const page of pages)await page.locator('#table-ready').click();
  for(const page of pages)await expect(page.locator('.casual-game')).toBeVisible();
  await expect(pages[0].locator('#table-social > #city-chat')).toBeVisible();
  if(kind==='four'){
   for(const [i,col] of [[0,0],[1,1],[0,0],[1,1],[0,0],[1,1],[0,0]])await pages[i].locator('.four-controls button').nth(col).click();
   await expect(pages[0].locator('.casual-status')).toContainText('Menang: Gamer 0');
   await expect(pages[1].locator('.casual-status')).toContainText('Menang: Gamer 0');
   const old=await pages[0].evaluate(()=>(window as any).game.id);
   await pages[0].locator('#table-rematch').click();for(const page of pages)await page.locator('#table-ready').click();
   await expect.poll(()=>pages[0].evaluate(()=>(window as any).game.id)).not.toBe(old);
  }else if(kind==='congkak'){
   await pages[0].locator('.congkak-pit:enabled').first().click();
   await expect.poll(()=>pages[1].evaluate(()=>(window as any).game.revision)).toBeGreaterThan(0);
  }else if(kind==='ludo'){
   await pages[0].getByRole('button',{name:'Baling dadu',exact:true}).click();
   await expect(pages[1].locator('.casual-feedback')).toContainText('baling');
   const piece=pages[0].locator('.casual-actions button:enabled');if(await piece.count())await piece.first().click();
  }else if(kind==='bluff'){
   await pages[0].locator('.bluff-card').first().click();await pages[0].getByRole('button',{name:/Letak 1 kad/}).click();
   await pages[1].getByRole('button',{name:'Tipu!',exact:true}).click();
   await expect(pages[0].locator('.casual-feedback')).toContainText('ambil longgokan');
  }else{
   await pages[0].locator('.quiz-option').first().click();await pages[1].locator('.quiz-option').nth(1).click();
   await expect(pages[0].locator('.quiz-option.correct')).toHaveCount(1);
   await expect(pages[0].locator('.quiz-option.correct')).toHaveCSS('background-color','rgb(204, 227, 182)');
  }
  for(let i=0;i<2;i++){
   expect(await pages[i].evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const board=pages[i].locator('.casual-board');const box=await board.boundingBox();expect(box!.width).toBeLessThanOrEqual(i===0?390:1280);
   if(kind==='four'){expect(box!.width).toBeLessThanOrEqual(360);await board.scrollIntoViewIfNeeded();}
   await pages[i].screenshot({path:testInfo.outputPath(`${kind}-${i===0?'mobile':'desktop'}.png`)});
  }
  await pages[0].getByText('← All games',{exact:true}).click();
  await expect(pages[1].locator('.casual-status')).toContainText('Menang');
  expect(errors).toEqual([]);
 }catch(error){for(const page of pages)console.log('casual diagnostic',await page.evaluate(()=>({socket:(window as any).ws?.readyState,messages:(window as any).messages?.slice(0,8)})).catch(()=>null));throw error;}
 finally{for(const page of pages)await page.close();}
});
