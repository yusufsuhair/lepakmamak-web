import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// Vite inlines the stylesheet, so the rules themselves are read from source. What the
// browser is asked for here is the part that has to survive the cascade.
const css=readFileSync('src/style.css','utf8');

test('every scrolling surface is given the game rail, not the browser default',()=>{
 for(const rule of ['::-webkit-scrollbar','::-webkit-scrollbar-track','::-webkit-scrollbar-thumb','::-webkit-scrollbar-thumb:hover'])
  expect(css).toContain(rule);
 // Firefox and mobile Safari never see the webkit pseudo-elements, so the standard
 // properties have to carry the same look on their own.
 expect(css).toMatch(/\*\s*\{[^}]*scrollbar-width:\s*thin/);
 expect(css).toMatch(/\*\s*\{[^}]*scrollbar-color:/);
 // Cream panels would look wrong behind a dark rail.
 expect(css).toMatch(/\.pause-panel[^{]*\{\s*scrollbar-color:/);
 // Touch gets a slimmer rail rather than the desktop one.
 expect(css).toMatch(/@media \(pointer: coarse\) \{ ::-webkit-scrollbar \{ width: 6px/);
});

for(const [label,width] of [['desktop',1280],['mobile',390]] as const)
test(`the rail reaches the chat log and the settings panel on ${label}`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.goto('/');
 await page.getByRole('button',{name:"Jom, let's go"}).click();
 await page.locator('#auth-guest').click();
 await page.locator('#guest-name').fill('Roller');
 await page.getByRole('button',{name:'Enter as guest',exact:true}).click();
 await expect(page.locator('#hud')).toBeVisible();

 const log=await page.locator('#chat-messages').evaluate(el=>getComputedStyle(el).scrollbarColor);
 expect(log).not.toBe('auto');

 await page.getByRole('button',{name:'Open settings'}).click();
 const panel=await page.locator('.pause-panel').evaluate(el=>getComputedStyle(el).scrollbarColor);
 expect(panel).not.toBe('auto');
 // The cream panel must not inherit the dark rail meant for the HUD.
 expect(panel).not.toBe(log);
});
