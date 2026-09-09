import{test,expect}from'@playwright/test';
test('resolves landmarks before their surrounding district',async({page})=>{
 await page.goto('/');const locations=await page.evaluate(async()=>{const{locationAt}=await import('/src/location-arrival.ts');return[locationAt(-32,45),locationAt(150,140),locationAt(0,-120)];});
 expect(locations[0]).toMatchObject({name:'Mamak Maju',subtitle:'Hangout'});
 expect(locations[1]).toMatchObject({name:'Kampung Maju',subtitle:'District'});
 expect(locations[2]).toMatchObject({name:'KLCC',subtitle:'Hangout'});
});

test('new locations show once and fade away',async({page})=>{
 await page.route('**/arrival-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css">'}));await page.goto('/arrival-harness');
 await page.evaluate(async()=>{const{setupLocationArrival}=await import('/src/location-arrival.ts');(window as any).arrival=setupLocationArrival();(window as any).arrival.update(-32,45);});
 await expect(page.locator('#location-arrival')).toHaveClass('visible');await expect(page.locator('#location-arrival strong')).toHaveText('Mamak Maju');
 await expect(page.locator('#location-arrival')).not.toHaveClass('visible',{timeout:5000});
 await page.evaluate(()=>(window as any).arrival.update(-32,45));await expect(page.locator('#location-arrival')).not.toHaveClass('visible');
 await page.evaluate(()=>(window as any).arrival.update(0,-120));await expect(page.locator('#location-arrival strong')).toHaveText('KLCC');await expect(page.locator('#location-arrival')).toHaveClass('visible');
});
