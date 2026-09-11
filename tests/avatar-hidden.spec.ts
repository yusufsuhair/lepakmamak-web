import {test, expect} from '@playwright/test';

test.use({deviceScaleFactor:3, viewport:{width:390,height:844}});
test('hidden login preview keeps a bounded canvas on Retina displays',async({page})=>{
  await page.route('**/avatar-harness',route=>route.fulfill({contentType:'text/html',body:'<section hidden><canvas width="180" height="200"></canvas></section>'}));
  await page.goto('/avatar-harness');
  const result=await page.evaluate(async()=>{
    const {createAvatarPreview}=await import('/src/avatar-preview.ts');
    const canvas=document.querySelector('canvas')!;
    const preview=createAvatarPreview(canvas);
    preview.start();
    // Stop early so the regression itself cannot exhaust GPU memory.
    for(let i=0;i<3;i++) await new Promise(requestAnimationFrame);
    preview.stop();
    const hidden={width:canvas.width,height:canvas.height};
    canvas.parentElement!.hidden=false;
    canvas.style.width='180px';canvas.style.height='200px';
    preview.start();
    await new Promise(requestAnimationFrame);
    preview.stop();
    const visible={width:canvas.width,height:canvas.height};
    preview.dispose();
    return {hidden,visible};
  });
  expect(result.hidden.width).toBeLessThanOrEqual(360);
  expect(result.hidden.height).toBeLessThanOrEqual(400);
  expect(result.visible).toEqual({width:360,height:400});
});
