import {test,expect} from '@playwright/test';

test('Legoland map uses the park layout without online player markers',async({page})=>{
 await page.route('**/legoland-map-harness',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('/legoland-map-harness');
 const result=await page.evaluate(async()=>{
  const {drawLegolandMap,isInLegoland}=await import('/src/legoland-map.ts');
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;document.body.append(canvas);
  drawLegolandMap(canvas,{x:-198,z:0,yaw:0},true,.8);
  return {
   scope:canvas.dataset.scope,
   mapScope:canvas.dataset.mapScope,
   attractions:Number(canvas.dataset.attractionCount),
   park:isInLegoland(-198),
   city:isInLegoland(-170),
   rendered:canvas.toDataURL().length>1000,
  };
 });
 expect(result.scope).toBe('legoland');expect(result.mapScope).toBe('legoland');
 expect(result.attractions).toBeGreaterThan(0);
 expect(result.park).toBe(true);expect(result.city).toBe(false);expect(result.rendered).toBe(true);
});
