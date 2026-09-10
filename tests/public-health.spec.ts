import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';

test('public health endpoint exposes useful status without internal metrics',async()=>{
 const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'8272',ALLOW_GUESTS:'true',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:'ignore'});
 try{
  await expect.poll(async()=>{try{return(await fetch('http://127.0.0.1:8272/health/public')).ok}catch{return false}}).toBe(true);
  const response=await fetch('http://127.0.0.1:8272/health/public'),data=await response.json();
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  expect(data).toMatchObject({status:'operational',service:'lepak-city-realtime',players:0,rooms:0});
  expect(data.version).toBeTruthy();expect(data.updatedAt).toBeTruthy();
  for(const privateField of ['residentMegabytes','bytesInPerSecond','bytesOutPerSecond','sockets'])expect(data).not.toHaveProperty(privateField);
 }finally{server.kill()}
});

test('status page renders a healthy response and formats uptime',async({page})=>{
 await page.route('**/health/public',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({status:'operational',version:'1.38.3',uptimeSeconds:90061,players:7,rooms:2})}));
 await page.goto('/health/index.html');
 await expect(page.getByRole('heading',{name:'All systems operational'})).toBeVisible();
 await expect(page.locator('#uptime')).toHaveText('1d 1h');
 await expect(page.locator('#players')).toHaveText('7');
 await expect(page.locator('#version')).toHaveText('v1.38.3');
 await expect(page.locator('#service-state')).toHaveText('OPERATIONAL');
 await page.screenshot({path:'test-results/health-page.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:'test-results/health-page-mobile.png',fullPage:true});
});
