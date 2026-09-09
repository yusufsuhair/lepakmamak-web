import{test,expect}from'@playwright/test';
test('vehicle radio shows a short banner and stops on exit or music off',async({page})=>{
 await page.route('**/radio-harness',r=>r.fulfill({contentType:'text/html',body:'<button>Play</button>'}));await page.goto('/radio-harness');
 await page.evaluate(async()=>{const{setupVehicleRadio}=await import('/src/vehicle-radio.ts');(window as any).radio=setupVehicleRadio();});
 await page.getByRole('button',{name:'Play'}).click();await page.waitForTimeout(100);
 await page.evaluate(()=>(window as any).radio.update(true));await expect(page.locator('#vehicle-radio')).toHaveClass('visible');
 await expect(page.locator('#vehicle-radio')).not.toHaveClass('visible',{timeout:6000});
 await page.evaluate(()=>{(window as any).radio.update(false);(window as any).radio.update(true);});await expect(page.locator('#vehicle-radio')).toHaveClass('visible');
 await page.evaluate(()=>(window as any).radio.update(false));await expect(page.locator('#vehicle-radio')).not.toHaveClass('visible');
});
