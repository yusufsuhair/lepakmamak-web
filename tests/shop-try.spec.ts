import {test,expect,type Page} from '@playwright/test';
import {enterAt} from './city';

// Shop against a stand-in shop, with a stand-in city socket open beside it. Everything that
// could carry a try anywhere is recorded (shop requests, socket frames, storage writes and what
// the city character is told to wear) so a try can be shown to send none of it.
const look={gender:'female',hairstyle:'bob',hair:'#202c2b',skin:'#b98157',shirt:'#628fbb',trousers:'#c7be9c',tudung:'long'};
async function mount(page:Page,width:number,signedIn=true){
 await page.setViewportSize({width,height:844});
 const frames:string[]=[],requests:string[]=[];
 let items=[{sku:'spectacles',equipped:true}];
 await page.routeWebSocket('ws://city.test/ws',ws=>ws.onMessage(message=>{frames.push(String(message));}));
 await page.route('**/src/auth.ts*',route=>route.fulfill({contentType:'application/javascript',body:`export const session=${signedIn?'{access_token:"test"}':'null'};`}));
 await page.route('http://shop.test/shop/**',route=>{
  const request=route.request(),path=new URL(request.url()).pathname,cors={'Access-Control-Allow-Origin':'*'};
  requests.push(`${request.method()} ${path} ${request.postData()||''}`.trim());
  if(path==='/shop/buy'){items=[...items,{sku:JSON.parse(request.postData()!).sku,equipped:false}];return route.fulfill({json:{purchased:true,balance:350,items},headers:cors});}
  return route.fulfill({json:path==='/shop/catalog'?{available:true,paymentsAvailable:true,items:[]}:{balance:500,dailyAvailable:false,nextDailyAt:null,items},headers:cors});
 });
 await page.route('**/try-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/ui-polish.css"><main></main>'}));
 await page.goto('/try-harness');
 await page.evaluate(async look=>{
  const w=window as any;w.worn=[];w.stored=[];
  const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(this:Storage,key:string,value:string){w.stored.push(key);return setItem.call(this,key,value);};
  w.city=new WebSocket('ws://city.test/ws');await new Promise(resolve=>w.city.onopen=resolve);
  const {setupShop}=await import('/src/shop.ts');
  w.shop=setupShop((items:string[])=>w.worn.push(items),'http://shop.test',()=>look);
  w.shop.open();
 },look);
 // The wallet has answered once the owned spectacles stop offering Try.
 await expect(page.locator('.shop-try-toggle')).toHaveCount(signedIn?3:4);
 return {frames,requests};
}
const painted=(page:Page)=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

for(const width of [1280,390])test(`Try dresses a private copy of your character and sends nothing at ${width}px`,async({page})=>{
 const {frames,requests}=await mount(page,width);
 const settled=requests.length,panel=page.locator('.shop-try'),canvas=panel.locator('canvas'),cap=page.getByRole('button',{name:'Try Lepak Cap'});
 await expect(panel).toBeHidden();
 await expect(page.locator('#shop-items article',{hasText:'Lepak Cap'}).getByRole('button')).toHaveText(['Try','Buy · 🪙 150']);
 await page.locator('#shop-items').screenshot({path:`test-results/shop-try-cards-${width}.png`});

 await cap.click();
 await expect(panel).toBeVisible();await expect(panel).toBeInViewport();
 await expect(panel.getByRole('heading')).toHaveText('Lepak Cap');
 await expect(cap).toHaveAttribute('aria-pressed','true');
 // It starts from what the character has on, owned spectacles included, and adds the cap.
 await expect(canvas).toHaveAttribute('data-accessories','spectacles,cap');
 await expect(canvas).toHaveAttribute('data-shirt',look.shirt);
 await expect(canvas).toHaveAttribute('data-tudung',look.tudung);
 await painted(page);await page.screenshot({path:`test-results/shop-try-${width}.png`});

 // Another item replaces the one being tried, and a skin replaces any skin.
 await page.getByRole('button',{name:'Try Night Batik Skin'}).click();
 await expect(canvas).toHaveAttribute('data-accessories','spectacles,batik');
 await expect(cap).toHaveAttribute('aria-pressed','false');
 await page.getByRole('button',{name:'Try Malayan Tiger Skin'}).click();
 await expect(canvas).toHaveAttribute('data-accessories','spectacles,harimau');
 await painted(page);await page.screenshot({path:`test-results/shop-try-harimau-${width}.png`});

 // None of it left the page, was stored, or reached the character in the city.
 expect(requests.slice(settled)).toEqual([]);
 expect(frames).toEqual([]);
 expect(await page.evaluate(()=>(window as any).stored)).toEqual([]);
 expect(await page.evaluate(()=>(window as any).worn)).toEqual([['spectacles']]);

 await page.getByRole('button',{name:'End preview'}).click();
 await expect(panel).toBeHidden();
 await cap.click();await expect(panel).toBeVisible();
 await cap.click();await expect(panel).toBeHidden();

 // Closing the Shop mid-try, by the button or by Escape, leaves nothing behind for next time.
 for(const close of [()=>page.getByRole('button',{name:'Close shop'}).click(),()=>page.keyboard.press('Escape')]){
  await cap.click();await expect(panel).toBeVisible();
  await close();await expect(page.locator('#item-shop')).toBeHidden();
  await page.evaluate(()=>(window as any).shop.open());
  await expect(page.locator('#item-shop')).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(page.locator('#shop-items [aria-pressed=true]')).toHaveCount(0);
 }
 expect((await page.evaluate(()=>(window as any).worn)).every((items:string[])=>items.join()==='spectacles')).toBe(true);
 expect(requests.filter(line=>line.startsWith('POST'))).toEqual([]);
 expect(frames).toEqual([]);
});

test('Buy after Try is the same purchase as before, and ends the preview',async({page})=>{
 const {requests,frames}=await mount(page,390);
 await page.getByRole('button',{name:'Try Lepak Cap'}).click();
 const panelBuy=page.locator('.shop-try').getByRole('button',{name:'Buy · 🪙 150'});
 await expect(panelBuy).toBeEnabled();
 await panelBuy.click();
 await expect(page.locator('#shop-message')).toHaveText('Lepak Cap is now yours.');
 expect(requests.filter(line=>line.startsWith('POST'))).toEqual(['POST /shop/buy {"sku":"cap"}']);
 // Bought is not worn: the cap waits on its card for Equip, exactly as before Try existed.
 await expect(page.locator('.shop-try')).toBeHidden();
 await expect(page.locator('#shop-items article',{hasText:'Lepak Cap'}).getByRole('button')).toHaveText(['Equip']);
 expect(await page.evaluate(()=>(window as any).worn.at(-1))).toEqual(['spectacles']);
 // The card's own Buy, untried, still buys directly.
 await page.locator('#shop-items article',{hasText:'Malayan Tiger Skin'}).getByRole('button',{name:'Buy · 🪙 260'}).click();
 await expect(page.locator('#shop-message')).toHaveText('Malayan Tiger Skin is now yours.');
 expect(requests.filter(line=>line.startsWith('POST'))).toEqual(['POST /shop/buy {"sku":"cap"}','POST /shop/buy {"sku":"harimau"}']);
 expect(frames).toEqual([]);
});

test('signed out, Try still works while Buy waits for an account',async({page})=>{
 const {requests,frames}=await mount(page,390,false);
 await expect(page.getByRole('button',{name:'Buy · 🪙 150'})).toBeDisabled();
 await page.getByRole('button',{name:'Try Lepak Cap'}).click();
 await expect(page.locator('.shop-try canvas')).toHaveAttribute('data-accessories','cap');
 await expect(page.locator('.shop-try').getByRole('button',{name:'Buy · 🪙 150'})).toBeDisabled();
 expect(requests).toEqual(['GET /shop/catalog']);
 expect(frames).toEqual([]);
});

// The shop harness above already proves a session-less Shop renders Try. What it cannot see is
// the city's own gate: the HUD used to hide #open-shop from guests outright, so the try-on existed
// and no guest could reach it. A guest still cannot buy — every Buy stays disabled without a session.
test('a guest reaches the Shop and its try-on from the city',async({page})=>{
 await enterAt(page,-18,52);
 const shop=page.locator('#open-shop');
 await expect(shop).toBeVisible();
 await shop.click();
 await expect(page.locator('#item-shop')).toBeVisible();
 await expect(page.locator('.shop-wallet')).toBeHidden();
 await expect(page.locator('.coin-topup')).toBeHidden();
});
