import{test,expect}from'@playwright/test';

test('exit requires confirmation and cancel keeps the player in game',async({page})=>{
 await page.route('**/exit-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><button id="logout">Log out</button>'}));
 await page.goto('/exit-harness');
 await page.evaluate(async()=>{const{setupExitConfirmation}=await import('/src/exit-confirm.ts');(window as any).exits=0;const confirm=setupExitConfirmation(()=>{(window as any).exits++;});document.querySelector<HTMLButtonElement>('#logout')!.onclick=()=>confirm.open();});
 await page.getByRole('button',{name:'Log out'}).click();await expect(page.locator('#exit-confirm')).toBeVisible();expect(await page.evaluate(()=>(window as any).exits)).toBe(0);
 await page.getByRole('button',{name:'Cancel'}).click();await expect(page.locator('#exit-confirm')).toBeHidden();expect(await page.evaluate(()=>(window as any).exits)).toBe(0);
 await page.getByRole('button',{name:'Log out'}).click();await page.getByRole('button',{name:'Keluar game'}).click();await expect(page.locator('#exit-confirm')).toBeHidden();expect(await page.evaluate(()=>(window as any).exits)).toBe(1);
});
