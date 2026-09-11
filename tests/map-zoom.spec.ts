import {test,expect} from '@playwright/test';

test('city map opens zoomed out and supports controls, wheel, and both views',async({page})=>{
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
 await page.getByRole('button',{name:'3D',exact:true}).click();
 await page.getByRole('button',{name:'Zoom in'}).click();
 await expect(map).toHaveAttribute('data-zoom','1');
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
 const before=await map.evaluate(element=>({x:element.getAttribute('data-pan-x'),z:element.getAttribute('data-pan-z')}));
 await page.mouse.move(bounds!.x+bounds!.width*.82,bounds!.y+bounds!.height*.3);
 await page.mouse.wheel(0,-100);
 await expect(map).toHaveAttribute('data-zoom','1');
 const afterWheel=await map.evaluate(element=>({x:element.getAttribute('data-pan-x'),z:element.getAttribute('data-pan-z')}));
 expect(afterWheel).not.toEqual(before);
 const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:7}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+48,y:cy+26,id:7}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const afterDrag=await map.evaluate(element=>({x:element.getAttribute('data-pan-x'),z:element.getAttribute('data-pan-z')}));
 expect(afterDrag).not.toEqual(afterWheel);

 await page.getByRole('button',{name:'2D',exact:true}).click();await page.getByRole('button',{name:'Reset map zoom'}).click();
 const before2d=await map.evaluate(element=>({x:element.getAttribute('data-pan-x'),z:element.getAttribute('data-pan-z')}));
 await page.mouse.move(bounds!.x+bounds!.width*.76,bounds!.y+bounds!.height*.3);await page.mouse.wheel(0,-100);
 await page.mouse.wheel(0,-100);await expect(map).toHaveAttribute('data-zoom','1.2');
 const after2d=await map.evaluate(element=>({x:element.getAttribute('data-pan-x'),z:element.getAttribute('data-pan-z')}));
 expect(after2d).not.toEqual(before2d);

 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-70,y:cy,id:1},{x:cx+70,y:cy,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-130,y:cy+28,id:1},{x:cx+130,y:cy+28,id:2}]});
 await expect.poll(async()=>Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(1);
 const afterPinch=await map.evaluate(element=>({x:element.getAttribute('data-pan-x'),z:element.getAttribute('data-pan-z')}));
 expect(afterPinch).not.toEqual(after2d);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await context.close();
});
