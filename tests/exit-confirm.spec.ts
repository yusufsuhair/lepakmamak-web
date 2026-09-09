import{test,expect}from'@playwright/test';

test('exit requires confirmation and cancel keeps the player in game',async({page})=>{
 await page.route('**/exit-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><button id="logout">Log out</button>'}));
 await page.goto('/exit-harness');
 await page.evaluate(async()=>{const{setupExitConfirmation}=await import('/src/exit-confirm.ts');(window as any).exits=0;const confirm=setupExitConfirmation(()=>{(window as any).exits++;});document.querySelector<HTMLButtonElement>('#logout')!.onclick=()=>confirm.open();});
 await page.getByRole('button',{name:'Log out'}).click();await expect(page.locator('#exit-confirm')).toBeVisible();expect(await page.evaluate(()=>(window as any).exits)).toBe(0);
 await page.getByRole('button',{name:'Cancel'}).click();await expect(page.locator('#exit-confirm')).toBeHidden();expect(await page.evaluate(()=>(window as any).exits)).toBe(0);
 await page.getByRole('button',{name:'Log out'}).click();await page.getByRole('button',{name:'Keluar game'}).click();await expect(page.locator('#exit-confirm')).toBeHidden();expect(await page.evaluate(()=>(window as any).exits)).toBe(1);
});

test('refresh and back warn during play; staying keeps the page active',async({page})=>{
 await page.route('**/exit-harness',route=>route.fulfill({contentType:'text/html',body:'<button>Play</button>'}));
 await page.goto('/');await page.goto('/exit-harness');
 await page.evaluate(async()=>{const{setupPageExitWarning}=await import('/src/exit-confirm.ts');(window as any).playing=true;setupPageExitWarning(()=>(window as any).playing);(window as any).hiddenCount=0;window.addEventListener('pagehide',()=>{(window as any).hiddenCount++;});});
 await page.getByRole('button',{name:'Play'}).click();
 for(const action of ['refresh','back']){
  const dialogPromise=page.waitForEvent('dialog');
  await page.evaluate(action=>{setTimeout(()=>{if(action==='refresh')location.reload();else history.back();},0);},action);
  const dialog=await dialogPromise;expect(dialog.type()).toBe('beforeunload');await dialog.dismiss();
  expect(await page.evaluate(()=>(window as any).hiddenCount)).toBe(0);await expect(page).toHaveURL(/exit-harness$/);
 }
 await page.evaluate(()=>{(window as any).playing=false;});
 await page.reload();await expect(page.getByRole('button',{name:'Play'})).toBeVisible();
});
