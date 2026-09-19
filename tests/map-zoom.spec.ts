import {test,expect} from '@playwright/test';

test('city map opens zoomed out in 2D and supports controls and wheel',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>document.querySelector<HTMLDialogElement>('#city-map')!.showModal());
 const map=page.locator('#expanded-map');
 await expect(map).toHaveAttribute('data-zoom','0.8');
 await expect(page.getByRole('button',{name:'Reset map zoom'})).toHaveText('80%');
 await page.getByRole('button',{name:'Zoom in'}).click();
 await expect(map).toHaveAttribute('data-zoom','1');
 await page.getByRole('button',{name:'Zoom out'}).click();
 await expect(map).toHaveAttribute('data-zoom','0.8');
 await map.hover();await page.mouse.wheel(0,100);
 await expect(map).toHaveAttribute('data-zoom','0.6');
 await page.getByRole('button',{name:'Reset map zoom'}).click();
 await expect(map).toHaveAttribute('data-zoom','0.8');
 const controls=await page.getByRole('group',{name:'Map zoom'}).boundingBox();
 expect(controls).not.toBeNull();expect(controls!.y+controls!.height).toBeLessThanOrEqual(844);
 // The map is 2D only since the 3D overview was removed; nothing may offer it again by accident.
 await expect(map).toHaveAttribute('data-mode','2d');
 await expect(page.getByRole('button',{name:'3D',exact:true})).toHaveCount(0);
});

test('city map keeps teleport controls above the 2D drawing',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>document.querySelector<HTMLDialogElement>('#city-map')!.showModal());
 const [teleport,map]=await Promise.all([
  page.locator('#map-teleport').boundingBox(),
  page.locator('#expanded-map').boundingBox(),
 ]);
 expect(teleport).not.toBeNull();expect(map).not.toBeNull();
 expect(teleport!.y+teleport!.height).toBeLessThanOrEqual(map!.y);
});

test('map zoom controls remain reachable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.evaluate(()=>document.querySelector<HTMLDialogElement>('#city-map')!.showModal());
 const controls=page.getByRole('group',{name:'Map zoom'}),bounds=await controls.boundingBox();
 await expect(controls).toBeVisible();expect(bounds).not.toBeNull();expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
 await page.getByRole('button',{name:'Zoom out'}).click();await expect(page.locator('#expanded-map')).toHaveAttribute('data-zoom','0.6');
});

test('wheel, drag and pinch keep the map focused on the area being explored',async({browser})=>{
 const context=await browser.newContext({viewport:{width:900,height:700},isMobile:true,hasTouch:true});
 const page=await context.newPage();await page.goto('/');
 await page.evaluate(()=>document.querySelector<HTMLDialogElement>('#city-map')!.showModal());
 const map=page.locator('#expanded-map');
 const bounds=await map.boundingBox();expect(bounds).not.toBeNull();
 const cx=bounds!.x+bounds!.width/2,cy=bounds!.y+bounds!.height/2;
 const pan=()=>map.evaluate(element=>({x:element.getAttribute('data-pan-x'),z:element.getAttribute('data-pan-z')}));
 const before=await pan();
 // Zooming towards the upper right keeps that corner under the pointer, so the view pans to it.
 await page.mouse.move(bounds!.x+bounds!.width*.76,bounds!.y+bounds!.height*.3);await page.mouse.wheel(0,-100);
 await page.mouse.wheel(0,-100);await expect(map).toHaveAttribute('data-zoom','1.2');
 const afterWheel=await pan();
 expect(afterWheel).not.toEqual(before);

 // One finger drags back towards the middle: away from the edge the pan is clamped to.
 const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:7}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+48,y:cy-26,id:7}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const afterDrag=await pan();
 expect(afterDrag).not.toEqual(afterWheel);

 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-70,y:cy,id:1},{x:cx+70,y:cy,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-130,y:cy+28,id:1},{x:cx+130,y:cy+28,id:2}]});
 await expect.poll(async()=>Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(1.2);
 const afterPinch=await pan();
 expect(afterPinch).not.toEqual(afterDrag);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await context.close();
});
