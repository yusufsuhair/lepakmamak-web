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
