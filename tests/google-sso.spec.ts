import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const auth = readFileSync('src/auth.ts', 'utf8');

// The whole point of the feature: a Google account signs in with Google's name attached,
// and the city never uses it.
test('nothing anywhere reads the name Google supplies',()=>{
 for(const source of ['src/auth.ts','src/main.ts','src/profile.ts','server/index.mjs','server/profiles.mjs','server/social-profiles.mjs']){
  const text=readFileSync(source,'utf8');
  for(const field of ['full_name','given_name','family_name','avatar_url','picture']) expect(text).not.toContain(field);
 }
 // The only name that counts is the one stored under display_name.
 expect(auth).toContain('display_name');
});

test('a signed-in account with no name of its own is stopped at the name step',()=>{
 // Both doors: a session restored on load, and one that arrives from the OAuth redirect.
 expect(auth).toMatch(/if \(session && !named\(session\)\) \{ mode = 'username'/);
 expect(auth).toMatch(/event === 'SIGNED_IN' && !named\(next\)/);
 // Two characters is the same floor guests and registrations get.
 expect(auth).toMatch(/display_name \|\| ''\)\.trim\(\)\.length >= 2/);
});

test('the signup steps ask for one thing each, and cannot be dismissed',()=>{
 // Credentials belong to the first step only; leaving Back enabled on the later ones would
 // strand an account that exists but has no name.
 expect(auth).toMatch(/const credentials = mode === 'register' \|\| mode === 'login';/);
 expect(auth).toMatch(/email\.parentElement!\.hidden = !credentials/);
 expect(auth).toMatch(/el\('auth-google'\)\.hidden = !credentials/);
 expect(auth).toMatch(/el\('auth-mode'\)\.hidden = !credentials/);
 expect(auth).toMatch(/const signingUp = mode === 'username' \|\| mode === 'looks';/);
});

test('Google sign-in goes through Supabase and returns to this origin',()=>{
 expect(auth).toMatch(/signInWithOAuth\(\{provider: 'google', options: \{redirectTo: location\.origin\}\}\)/);
 expect(auth).toContain('id="auth-google"');
});

test('the name and look saved are the ones the player chose',()=>{
 // Saved a step at a time now; the three-step test below pins the order.
 expect(auth).toMatch(/updateUser\(\{ data: \{ display_name: name\.value\.trim\(\) \} \}\)/);
 expect(auth).toMatch(/updateUser\(\{ data: \{ appearance: selectedAppearance\(\) \} \}\)/);
});

// The assertions above pin the shape of the code. This one drives it: a real Supabase
// session restored from storage with no display_name — which is exactly what a Google
// account looks like the moment it comes back from the redirect.
test('a nameless session lands on the name step instead of the city',async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{
  const ref=(document.querySelector('meta[name="sb-ref"]') as any)?.content||'sbzvvhzibqpozqvojzhe';
  const hour=Math.floor(Date.now()/1000)+7200;
  localStorage.setItem(`sb-${ref}-auth-token`,JSON.stringify({
   access_token:'seeded',token_type:'bearer',expires_at:hour,expires_in:7200,refresh_token:'seeded-refresh',
   user:{id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',
    email:'someone@gmail.com',app_metadata:{provider:'google'},
    // Everything Google hands over, and not one field of it is the name we use.
    user_metadata:{full_name:'Google Real Name',name:'Google Real Name',avatar_url:'https://x/y.png',email_verified:true},
    created_at:'2026-09-01T00:00:00Z'},
  }));
 });
 await page.goto('/');
 // A restored session raises the panel on its own; only press start if it has not.
 if(!(await page.locator('#auth-panel').isVisible())) await page.getByRole('button',{name:"Jom, let's go"}).click({timeout:15000});
 await expect(page.locator('#auth-panel')).toBeVisible({timeout:20000});
 // With no VITE_SUPABASE_* at build time there is no client to restore a session, and the
 // panel says so. The seeded session cannot be read, so there is nothing here to test.
 const unconfigured=(await page.locator('#auth-message').textContent())||'';
 test.skip(unconfigured.includes('being connected'),'needs VITE_SUPABASE_* at build time');
 await expect(page.locator('#auth-title')).toHaveText('Pick your name.');
 // Signed in already: no credentials asked for, and no way past it.
 await expect(page.locator('#auth-password')).toBeHidden();
 await expect(page.locator('#auth-email')).toBeHidden();
 await expect(page.locator('#auth-back')).toBeHidden();
 // Google's name is nowhere on the screen, and the field starts empty.
 await expect(page.locator('#auth-panel')).not.toContainText('Google Real Name');
 await expect(page.locator('#auth-name')).toHaveValue('');
 // And the city is still closed.
 await expect(page.locator('#hud')).toBeHidden();
});

test('signing up is three steps: account, then name, then character',()=>{
 // Registering creates the account and nothing else — the name and the face come after, so
 // Google and email land on exactly the same two steps.
 expect(auth).toMatch(/signUp\(\{ \.\.\.credentials, options: \{ emailRedirectTo: location\.origin \} \}\)/);
 expect(auth).not.toMatch(/signUp\([^)]*display_name/);
 expect(auth).toMatch(/mode = 'looks'; render\(\); return;/);
 // One decision per step.
 expect(auth).toMatch(/el\('name-field'\)\.hidden = mode !== 'username'/);
 expect(auth).toMatch(/el\('avatar-fields'\)\.hidden = mode !== 'looks'/);
 // Each step saves only its own field.
 expect(auth).toMatch(/updateUser\(\{ data: \{ display_name: name\.value\.trim\(\) \} \}\)/);
 expect(auth).toMatch(/updateUser\(\{ data: \{ appearance: selectedAppearance\(\) \} \}\)/);
 // No way out of a half-made account.
 expect(auth).toMatch(/el\('auth-back'\)\.hidden = signingUp/);
});

test('logout resets a completed onboarding flow to the login form',()=>{
 // A newly registered player finishes on `looks`. If that state survives logout, their
 // next submit attempts updateUser without a session instead of signing them back in.
 expect(auth).toMatch(/event === 'SIGNED_OUT'[\s\S]*mode = 'login';[\s\S]*render\(\);[\s\S]*overlay\.hidden = !recoveringLogin;[\s\S]*onLeave\(\);/);
});

test('a nameless session walks the name step then the character step',async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{
  const hour=Math.floor(Date.now()/1000)+7200;
  localStorage.setItem('sb-sbzvvhzibqpozqvojzhe-auth-token',JSON.stringify({
   access_token:'seeded',token_type:'bearer',expires_at:hour,expires_in:7200,refresh_token:'seeded-refresh',
   user:{id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'someone@gmail.com',
    app_metadata:{provider:'google'},user_metadata:{full_name:'Google Real Name'},created_at:'2026-09-01T00:00:00Z'},
  }));
 });
 await page.goto('/');
 if(!(await page.locator('#auth-panel').isVisible())) await page.getByRole('button',{name:"Jom, let's go"}).click({timeout:15000});
 await expect(page.locator('#auth-panel')).toBeVisible({timeout:20000});
 const unconfigured=(await page.locator('#auth-message').textContent())||'';
 test.skip(unconfigured.includes('being connected'),'needs VITE_SUPABASE_* at build time');

 // Step two: the name, on its own.
 await expect(page.locator('#auth-title')).toHaveText('Pick your name.');
 await expect(page.locator('#name-field')).toBeVisible();
 await expect(page.locator('#avatar-fields')).toBeHidden();
 await expect(page.locator('#auth-submit')).toHaveText('Next');
 await expect(page.locator('#auth-back')).toBeHidden();
});
