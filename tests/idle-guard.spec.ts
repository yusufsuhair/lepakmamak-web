import {test, expect} from '@playwright/test';
test('idle seats warn, activity resets the timer, and leaving happens once', async ({page}) => {
 await page.route('**/idle-harness', r => r.fulfill({contentType:'text/html',body:'<body></body>'}));
 await page.goto('/idle-harness');
 const result = await page.evaluate(async () => {
  const {createIdleGuard} = await import('/src/idle.ts');
  let time=0, active=true, exits=0;
  const guard=createIdleGuard(()=>active,()=>{exits++;active=false;},()=>time);
  const warning=()=>!document.querySelector<HTMLElement>('#idle-warning')!.hidden;
  guard.tick();time=270000;guard.tick();const warned=warning();
  guard.activity();guard.tick();const reset=!warning();
  time=569000;guard.tick();const before=exits;
  time=570000;guard.tick();guard.tick();
  return {warned,reset,before,exits,hidden:!warning()};
 });
 expect(result).toEqual({warned:true,reset:true,before:0,exits:1,hidden:true});
});
