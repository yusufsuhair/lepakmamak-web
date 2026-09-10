import {test,expect} from '@playwright/test';

const mount=async(page:any,route:string,reduced=false)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><main id="stage" style="height:400px"><button id="real">Press me</button><input id="field"><div id="empty" style="height:200px"></div></main>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async(isReduced:boolean)=>{
  const {createRipples}=await import('/src/ripple.ts');
  (window as any).ripples=createRipples(document.body,{reducedMotion:isReduced});
 },reduced);
};
const press=(page:any,selector:string)=>page.locator(selector).dispatchEvent('pointerdown',{clientX:120,clientY:150,bubbles:true});

test('pressing nothing leaves a ring, pressing something does not',async({page})=>{
 await mount(page,'ripple-harness');
 await press(page,'#empty');
 await expect(page.locator('.tap-ripple')).toHaveCount(1);
 // A control has its own feedback; a ring on top of it would be noise.
 await press(page,'#real');
 await press(page,'#field');
 await expect(page.locator('.tap-ripple')).toHaveCount(1);
 // It lands where the finger did.
 const ring=page.locator('.tap-ripple').first();
 expect(await ring.evaluate(el=>(el as HTMLElement).style.left)).toBe('120px');
 // And it clears itself up.
 await expect(page.locator('.tap-ripple')).toHaveCount(0,{timeout:4000});
});

test('the layer never swallows a press meant for something underneath',async({page})=>{
 await mount(page,'ripple-pointer-harness');
 expect(await page.locator('#tap-ripples').evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
 let clicked=0;
 await page.exposeFunction('countClick',()=>{clicked++;});
 await page.evaluate(()=>document.getElementById('real')!.addEventListener('click',()=>(window as any).countClick()));
 await page.locator('#real').click();
 expect(clicked).toBe(1);
});

test('rapid tapping cannot pile rings up without bound',async({page})=>{
 await mount(page,'ripple-flood-harness');
 for(let i=0;i<20;i++) await press(page,'#empty');
 expect(await page.locator('.tap-ripple').count()).toBeLessThanOrEqual(6);
});

test('someone who asked for less motion gets none',async({page})=>{
 await mount(page,'ripple-still-harness',true);
 await press(page,'#empty');
 await expect(page.locator('.tap-ripple')).toHaveCount(0);
});
