import {test,expect} from '@playwright/test';

test('a restored signed-in session enters the city without pressing start',async({page})=>{
  await page.route('**/src/auth.ts*',route=>route.fulfill({
    contentType:'application/javascript',
    body:`
      export const session={access_token:'restored-token',user:{id:'returning-user',user_metadata:{display_name:'Aina'}}};
      export const auth={auth:{getSession:async()=>({data:{session}})}};
      export let guestName='';
      export function clearGuest(){guestName='';}
      export const displayName=()=>session.user.user_metadata.display_name;
      export async function setupAuth(onEnter){return()=>onEnter();}
    `,
  }));
  await page.goto('/');
  await expect(page.locator('#intro')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).__lepak.started)).toBe(true);
  await expect(page.locator('#auth-panel')).toHaveCount(0);
});
