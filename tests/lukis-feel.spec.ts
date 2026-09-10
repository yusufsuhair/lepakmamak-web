import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('Lukis animates the moments drawing does not cover',()=>{
 const css=readFileSync('src/lukis.css','utf8');
 // A correct guess, the word revealed, the round results, a score that moved.
 expect(css).toMatch(/\.lukis-feedback\[data-kind=correct\]\{animation:game-burst/);
 expect(css).toMatch(/\.lukis\[data-phase=reveal\] \.lukis-word/);
 expect(css).toMatch(/\.lukis-results:not\(\[hidden\]\)\{animation:game-deal/);
 expect(css).toMatch(/\.lukis-score \.scored\{animation:game-burst/);
 // All of it off for someone who asked for less motion.
 const quiet=css.slice(css.lastIndexOf('prefers-reduced-motion'));
 for(const hook of ['lukis-feedback','lukis-results','scored','lukis-word']) expect(quiet).toContain(hook);
 // It uses the shared vocabulary rather than inventing keyframes of its own.
 expect(css).not.toContain('@keyframes');
 expect(readFileSync('src/lukis.ts','utf8')).toContain("import './motion.css'");
});

test('only a score that changed reacts',async({page})=>{
 await page.route('**/lukis-score-harness',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="table-social"></div>'}));
 await page.goto('/lukis-score-harness');
 await page.evaluate(async()=>{
  const {setupLukis}=await import('/src/lukis.ts');
  const held=window as any;
  held.lukis=setupLukis(()=>true);
  document.getElementById('table-social')!.append(held.lukis.root);
 });
 const round=(state:object)=>page.evaluate((s:any)=>(window as any).lukis.state(s),{
  id:'g1',revision:1,phase:'drawing',self:'me',drawer:'a',word:'',hint:'',ends:0,serverTime:Date.now(),
  solved:[],strokes:[],choices:[],round:1,rounds:3,
  scores:[{id:'me',name:'Me',score:0,roundPoints:0},{id:'a',name:'Ali',score:0,roundPoints:0}],...state});

 await round({});
 await expect(page.locator('.lukis-score .scored')).toHaveCount(0);
 // Nothing moved, so nothing reacts.
 await round({});
 await expect(page.locator('.lukis-score .scored')).toHaveCount(0);
 // One player scores: one card reacts, not the whole board.
 await round({scores:[{id:'me',name:'Me',score:120,roundPoints:120},{id:'a',name:'Ali',score:0,roundPoints:0}]});
 await expect(page.locator('.lukis-score .scored')).toHaveCount(1);
 await expect(page.locator('.lukis-score .scored')).toContainText('Me');
});
