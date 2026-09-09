import{test,expect}from'@playwright/test';
test('the open map hides the touch controls',async({page})=>{
 await page.route('**/map-focus-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="hud"><div id="touch-controls"><div id="move-stick"></div><div class="touch-actions"><button>BRAKE</button></div></div></div>'}));
 await page.goto('/map-focus-harness');
 const display=()=>page.locator('#touch-controls').evaluate(element=>getComputedStyle(element).display);
 expect(await display()).not.toBe('none');
 await page.evaluate(()=>document.body.classList.add('map-open'));
 expect(await display()).toBe('none');
});
