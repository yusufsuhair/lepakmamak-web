import {test,expect} from '@playwright/test';

test('booth voice fades smoothly away from the nearest stall',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {STALL_VOICE_FULL,STALL_VOICE_REACH,nearestStallDistance,stallVoiceSpots,stallVoiceVolume}=await import('/src/stalls.ts');
    return {full:STALL_VOICE_FULL,reach:STALL_VOICE_REACH,near:nearestStallDistance(stallVoiceSpots[0]),spots:stallVoiceSpots,volumes:Array.from({length:25},(_,distance)=>stallVoiceVolume(distance))};
  });
  expect(result.spots.map(spot=>spot.name)).toEqual(['Air Balang Pak Din','Pisang Goreng Mak Cik']);
  expect(result.near).toBe(0);expect(result.full).toBe(1.5);expect(result.reach).toBe(5);expect(result.volumes[0]).toBe(.44);expect(result.volumes[result.reach]).toBe(0);
  for(let distance=2;distance<=result.reach;distance++)expect(result.volumes[distance]).toBeLessThan(result.volumes[distance-1]);
});

test('booth voice loads only at the counter and obeys City sounds',async({page})=>{
  await page.routeWebSocket('**/ws',ws=>ws.onMessage(raw=>{if(JSON.parse(String(raw)).type==='join')ws.send(JSON.stringify({type:'welcome',id:'stall-player',players:[{id:'stall-player',name:'Tester',color:'#72c8ba',x:-12,z:60,yaw:Math.PI,riding:false,speed:0,guest:true}]}));}));
  await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  const state=()=>page.evaluate(()=>(window as any).__lepak.stallVoice);
  await expect.poll(async()=>(await state()).playing).toBe(true);
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('City sounds',{exact:true}).uncheck();
  expect((await state()).playing).toBe(false);expect((await state()).gain).toBe(0);
  await page.getByLabel('City sounds',{exact:true}).check();await expect.poll(async()=>(await state()).playing).toBe(true);
});
