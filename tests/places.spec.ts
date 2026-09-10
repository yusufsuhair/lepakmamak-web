import {test,expect} from '@playwright/test';
import places from '../shared/places.json' with {type:'json'};
import chairs from '../shared/chairs.json' with {type:'json'};
import tables from '../shared/tables.json' with {type:'json'};
import pickleball from '../shared/pickleball.json' with {type:'json'};
import basketball from '../shared/basketball.json' with {type:'json'};
import {masjidSpots} from '../src/masjid';
test('new hangouts have three distinct seats and matching map locations',()=>{for(const id of ['meja-5','meja-6']){const t=tables.find(t=>t.id===id)!;expect(chairs.filter(c=>c.tableId===id)).toHaveLength(3);expect(places.some(p=>p.x===t.x&&p.z===t.z)).toBe(true);}expect(new Set(chairs.map(c=>c.id)).size).toBe(chairs.length);});
test('the PETRONAS pin sits on the forecourt, not beside it',()=>{
 // The station stands at (-31, 112) in world.ts; a pin anywhere else sends people to grass.
 expect(places).toContainEqual(expect.objectContaining({id:'16',name:'PETRONAS · Kedai Mesra',kind:'minyak',x:-31,z:112}));
});
test('Busking Santai sits in front of PETRONAS',()=>{
 const petronas=places.find(place=>place.id==='16')!;
 const busking=places.find(place=>place.id==='14')!;
 expect(busking).toMatchObject({name:'Busking Santai',kind:'lepak',x:-31,z:86});
 expect(busking.z).toBeLessThan(petronas.z);
 expect(petronas.z-busking.z).toBeGreaterThan(20);
});
test('the mosque pin follows the mosque itself, wherever it stands',()=>{
 // masjidSpots drives the call to prayer, so the pin has to agree with it or the map and
 // the audio disagree about where the mosque is.
 const mosque=places.find(place=>place.id==='17')!;
 expect(mosque).toMatchObject({name:'Masjid Kampung Maju',kind:'ibadah',x:masjidSpots[0].x,z:masjidSpots[0].z});
});
test('the sports courts now occupy the land behind Pantai Senja',()=>{
 expect(places).toContainEqual(expect.objectContaining({id:'21',name:'Pickleball Lepak',x:pickleball.x,z:pickleball.z}));
 expect(places).toContainEqual(expect.objectContaining({id:'22',name:'Basket Lepak',x:basketball.x,z:basketball.z}));
 expect(pickleball.z).toBeLessThan(131);expect(basketball.z).toBeLessThan(131);
 expect(masjidSpots[0].x).toBe(54);expect(masjidSpots[0].z).toBe(129);
});
test('Watsons Malaysia is listed on the city map',()=>{expect(places).toContainEqual(expect.objectContaining({id:'18',name:'Watsons Malaysia',kind:'kedai',x:-56,z:-40}));});
test('FamilyMart Malaysia is listed on the city map',()=>{expect(places).toContainEqual(expect.objectContaining({id:'19',name:'FamilyMart Malaysia',kind:'kedai',x:49,z:34}));});
test('7-Eleven Malaysia is listed on the city map',()=>{expect(places).toContainEqual(expect.objectContaining({id:'20',name:'7-Eleven Malaysia',kind:'kedai',x:-59,z:32}));});
test('the second mosque is now a church and only Kampung Maju calls to prayer',()=>{
 expect(masjidSpots).toHaveLength(1);
 expect(places).toContainEqual(expect.objectContaining({name:'Gereja Harapan',kind:'ibadah',x:117,z:-37}));
});
for(const width of [390,1280])test(`map directory finds shops and hangouts at ${width}px`,async({page})=>{await page.setViewportSize({width,height:844});await page.goto('/');await page.getByRole('button',{name:"Jom, let's go"}).click();await page.locator('#auth-guest').click();await page.locator('#guest-name').fill('Tester');await page.getByRole('button',{name:'Enter as guest',exact:true}).click();await page.keyboard.press('m');await expect(page.locator('#city-map')).toBeVisible();await expect(page.locator('#city-map select')).toHaveCount(0);await page.locator('#city-directory').getByRole('button',{name:'6 Kedai Aceh',exact:true}).click();await expect(page.locator('#map-place-info')).toContainText('Kedai Aceh');await expect(page.locator('#map-place-info')).toContainText('m away');await page.locator('#city-directory').getByRole('button',{name:'10 Dataran Santai',exact:true}).click();await expect(page.locator('#map-place-info')).toContainText('Dataran Santai');await page.screenshot({path:`test-results/map-places-${width}.png`});});
test('map directory search filters shops and selects the first result with Enter',async({page})=>{await page.goto('/');await page.evaluate(()=>document.querySelector<HTMLDialogElement>('#city-map')!.showModal());const search=page.getByRole('searchbox',{name:'Search shops and places'});await search.fill('family');await expect(page.locator('#city-directory button:not([hidden])')).toHaveCount(1);await expect(page.getByRole('button',{name:'19 FamilyMart Malaysia',exact:true})).toBeVisible();await search.press('Enter');await expect(page.getByRole('button',{name:'Teleport to FamilyMart Malaysia',exact:true})).toBeEnabled();await search.fill('kedai');await expect(page.locator('#city-directory button:not([hidden])')).toHaveCount(2);await search.fill('does not exist');await expect(page.getByText('No places found',{exact:true})).toBeVisible();});
