import {test,expect} from '@playwright/test';

async function enterSettings(page:any,reset=true){
  await page.goto('/');
  if(reset)await page.evaluate(()=>{
    localStorage.removeItem('lepakmamak-volume-sfx');
    localStorage.removeItem('lepakmamak-volume-music');
    localStorage.removeItem('lepakmamak-volume-voice');
  });
  if(reset)await page.reload();
  await page.getByRole('button',{name:"Jom, let's go"}).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill('Audio mixer');
  await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
  await page.locator('#menu').click();
}

test('settings provide persistent SFX, music and voice chat volume sliders',async({page})=>{
  await enterSettings(page);
  for(const [label,key,value] of [
    ['Sound effects volume','sfx','0.25'],
    ['Background music volume','music','0.4'],
    ['Voice chat volume','voice','0.65'],
  ] as const){
    const slider=page.getByLabel(label,{exact:true});
    await expect(slider).toHaveValue('1');
    await slider.fill(value);await slider.dispatchEvent('input');
    await expect(page.locator(`#${key}-volume-value`)).toHaveText(`${Math.round(Number(value)*100)}%`);
    await expect.poll(()=>page.evaluate(storageKey=>localStorage.getItem(storageKey),`lepakmamak-volume-${key}`)).toBe(value);
  }
  await enterSettings(page,false);
  await expect(page.getByLabel('Sound effects volume',{exact:true})).toHaveValue('0.25');
  await expect(page.getByLabel('Background music volume',{exact:true})).toHaveValue('0.4');
  await expect(page.getByLabel('Voice chat volume',{exact:true})).toHaveValue('0.65');
});

test('sound range lives in developer options, not ordinary audio settings',async({page})=>{
  await enterSettings(page);
  await expect(page.locator('#developer-options').getByLabel('Sound range',{exact:true})).toBeVisible();
  await expect(page.locator('.settings').getByLabel('Sound range',{exact:true})).toHaveCount(0);
});
