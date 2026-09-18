import {test,expect} from '@playwright/test';

test('KLCC lift can return from the rooftop and shows the travel countdown',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.routeWebSocket('**/ws',ws=>{
    ws.onMessage(raw=>{
      const message=JSON.parse(String(raw));
      if(message.type!=='join')return;
      ws.send(JSON.stringify({type:'welcome',id:'lift-player',players:[{id:'lift-player',name:'Lift Player',color:'#72c8ba',x:-22,z:-107.8,yaw:0,riding:false,speed:0,jumpHeight:0,seated:false,vehicle:'bike'}]}));
    });
  });
  await page.goto('/');
  await page.getByRole('button',{name:"Jom, let's go"}).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Lift Player');
  await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await expect(page.locator('#interaction')).toHaveText('Naik lif KLCC');
  await page.locator('#interaction').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.klccLift?.phase)).toBe('top');
  // The cabin's meshes must ride up with it; if the city batch swallows them, the rider floats in an empty shaft.
  await expect.poll(()=>page.evaluate(()=>{
    const cabin=(window as any).__lepak.scene.getObjectByName('klcc-west-lift-cabin');
    return cabin.children.length?Math.min(...cabin.children.map((mesh:any)=>mesh.matrixWorld.elements[13])):null;
  })).toBeGreaterThan(70);
  await expect(page.locator('#klcc-lift-status')).toContainText('STOP');
  await expect(page.locator('#klcc-lift-status button')).toBeVisible();
  await page.locator('#klcc-lift-status button').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.klccLift?.direction)).toBe('down');
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.klccLift?.y)).toBeLessThan(76.5);
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.klccLift)).toBeNull();
  await expect(page.locator('#klcc-lift-status')).toBeHidden();
});
