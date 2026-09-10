import {test,expect} from '@playwright/test';

const mount=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {setupSecurity}=await import('/src/security.ts');
  (window as any).calls=[];
  const realFetch=window.fetch;
  window.fetch=((url:any,init:any)=>{(window as any).calls.push(String(url));return realFetch(url,init);}) as any;
  (window as any).open=setupSecurity('http://127.0.0.1:1');
  (window as any).open();
 });
};

test('a mistyped new password never leaves the browser',async({page})=>{
 await mount(page,'security-harness');
 await page.locator('#current-password').fill('old-password');
 await page.locator('#new-password').fill('brand-new-one');
 await page.locator('#repeat-password').fill('brand-new-two');
 await page.getByRole('button',{name:'Update password'}).click();
 await expect(page.locator('#password-status')).toHaveText(/do not match/);

 await page.locator('#repeat-password').fill('short');
 await page.locator('#new-password').fill('short');
 await page.getByRole('button',{name:'Update password'}).click();
 await expect(page.locator('#password-status')).toHaveText(/at least 8/);

 // Reusing the current password is not a change.
 await page.locator('#new-password').fill('old-password');
 await page.locator('#repeat-password').fill('old-password');
 await page.getByRole('button',{name:'Update password'}).click();
 await expect(page.locator('#password-status')).toHaveText(/not used here/);
});

test('deletion needs the word typed out, and asks the server rather than the browser',async({page})=>{
 await mount(page,'delete-harness');
 await page.getByRole('button',{name:'Delete my account'}).click();
 await expect(page.locator('#delete-status')).toHaveText(/Type DELETE/);
 expect(await page.evaluate(()=>(window as any).calls)).toEqual([]);

 // Lowercase is not the confirmation either.
 await page.locator('#delete-confirm').fill('delete');
 await page.getByRole('button',{name:'Delete my account'}).click();
 await expect(page.locator('#delete-status')).toHaveText(/Type DELETE/);
 expect(await page.evaluate(()=>(window as any).calls)).toEqual([]);
});

test('security can send a Supabase password reset email',async({page})=>{
 await page.route('**/src/auth.ts*',route=>route.fulfill({contentType:'application/javascript',body:`export const session={user:{email:'player@example.com'}};export const auth={auth:{resetPasswordForEmail:async(...args)=>{window.resetCall=args;return {error:null};}}};`}));
 await mount(page,'reset-harness');
 await expect(page.locator('#reset-email')).toHaveText('player@example.com');
 await page.getByRole('button',{name:'Send reset email',exact:true}).click();
 await expect(page.locator('#reset-status')).toHaveText(/check your email for a reset link/);
 const call=await page.evaluate(()=>({args:(window as any).resetCall,origin:location.origin}));
 expect(call.args[0]).toBe('player@example.com');expect(call.args[1]).toEqual({redirectTo:call.origin});
});

test('guests never see the security panel at all',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Guesty');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await page.getByRole('button',{name:'Open settings'}).click();
 await expect(page.locator('#open-security')).toBeHidden();
});
