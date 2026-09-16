import {test,expect} from '@playwright/test';

test('Legoland map renders online people without a numeric map count',async({page})=>{
 await page.route('**/legoland-map-harness',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('/legoland-map-harness');
 const result=await page.evaluate(async()=>{
  const {drawLegolandMap,isInLegoland}=await import('/src/legoland-map.ts');
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;document.body.append(canvas);
  drawLegolandMap(canvas,{x:-198,z:0,yaw:0},[
   {x:-250,z:-80,name:'Park Friend',party:false},
   {x:-120,z:20,name:'City Friend',party:false},
  ],true,.8);
  const {data}=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height);
  let peoplePixels=0;
  for(let i=0;i<data.length;i+=4) if(data[i]===73&&data[i+1]===207&&data[i+2]===255) peoplePixels++;
  return {
   scope:canvas.dataset.scope,
   mapScope:canvas.dataset.mapScope,
   attractions:Number(canvas.dataset.attractionCount),
   peoplePixels,
   mapCount:canvas.dataset.onlineCount||canvas.dataset.peerCount||'',
   park:isInLegoland(-198),
   city:isInLegoland(-170),
   rendered:canvas.toDataURL().length>1000,
  };
 });
 expect(result.scope).toBe('legoland');expect(result.mapScope).toBe('legoland');
 expect(result.attractions).toBeGreaterThan(0);expect(result.peoplePixels).toBeGreaterThan(0);expect(result.mapCount).toBe('');
 expect(result.park).toBe(true);expect(result.city).toBe(false);expect(result.rendered).toBe(true);
});
