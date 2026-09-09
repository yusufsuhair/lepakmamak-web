import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {parseWeather,createWeather} from '../server/weather.mjs';
import {isKlNight} from '../src/weather';
test('rain haze and stale observations are distinguished; KL solar day and night',async()=>{
 const row={icaoId:'WMSA',obsTime:Date.now()/1000,cover:'FEW'};
 expect(parseWeather({...row,wxString:'RA'}).condition).toBe('rain');
 expect(parseWeather({...row,wxString:'HZ'}).condition).toBe('haze');
 expect(parseWeather({...row,wxString:'BR'}).condition).toBe('fog');
 expect(()=>parseWeather({...row,obsTime:0})).toThrow();
 expect(isKlNight(new Date('2026-09-09T04:00:00Z'))).toBe(false);
 expect(isKlNight(new Date('2026-09-09T16:00:00Z'))).toBe(true);
 let calls=0;const weather=createWeather(async()=>{calls++;return {ok:true,json:async()=>[row]};});await Promise.all([weather(),weather()]);expect(calls).toBe(1);
 expect((await createWeather(async()=>{throw Error();})()).available).toBe(false);
});
test('original map uses live weather and requires account entry',async({page})=>{
 await page.route('**/weather',r=>r.fulfill({json:{available:true,condition:'haze',observedAt:Date.now(),serverTime:Date.now(),source:'Test station'}}));
 await page.goto('/');await expect(page.locator('#weather-label')).toContainText('haze');await expect(page.locator('#weather-label')).toContainText('MYT');
 await page.getByRole('button',{name:"Jom, let's go"}).click();await expect(page.locator('#auth-email')).toBeVisible();
 // Guest entry is a development convenience, so it is always on the dev server this suite
 // runs against. What production has to keep is the gate itself.
 expect(readFileSync('src/auth.ts','utf8')).toContain('const guestEnabled = import.meta.env.DEV;');
});
