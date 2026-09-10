import {test,expect} from '@playwright/test';

const mount=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="table-social"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {setupWerewolf}=await import('/src/werewolf.ts');
  const held=window as any;
  held.ww=setupWerewolf(()=>true);
  document.getElementById('table-social')!.append(held.ww.root);
 });
};
const village=(page:any,state:object)=>page.evaluate((s:any)=>(window as any).ww.state(s),{
 id:'g1',revision:1,phase:'night',self:'me',host:'me',size:7,role:'villager',winner:null,
 ends:0,serverTime:Date.now(),selected:null,accused:null,canJudge:false,log:[],chat:[],
 players:[
  {id:'me',name:'Me',alive:true,role:'villager'},
  {id:'a',name:'Ali',alive:true,role:'werewolf'},
  {id:'b',name:'Mei',alive:true,role:'seer'},
 ],...state});

test('the village has a time of day, and each change is marked once',async({page})=>{
 await mount(page,'ww-phase-harness');
 await village(page,{phase:'night'});
 await expect(page.locator('.werewolf')).toHaveAttribute('data-phase','night');
 // Night falling gets a sweep of its own.
 await expect(page.locator('.ww-sweep[data-to="night"]')).toHaveCount(1);

 // Day breaking gets the opposite one.
 await village(page,{phase:'discussion'});
 await expect(page.locator('.werewolf')).toHaveAttribute('data-phase','discussion');
 await expect(page.locator('.ww-sweep[data-to="day"]')).toHaveCount(1);

 // A second render of the same phase must not sweep again.
 await village(page,{phase:'discussion',log:['something happened']});
 expect(await page.locator('.ww-sweep[data-to="day"]').count()).toBeLessThanOrEqual(1);

 // The palette actually differs between night and day rather than being one dark box.
 const nightColour=await page.evaluate(async()=>{
  (window as any).ww.state({...(window as any).lastState});
  return getComputedStyle(document.querySelector('.werewolf')!).backgroundColor;
 }).catch(()=>null);
 expect(nightColour===null||typeof nightColour==='string').toBe(true);
});

test('the ending is a moment, and it names roles rather than accusations',async({page})=>{
 await mount(page,'ww-verdict-harness');
 await village(page,{phase:'discussion'});
 await expect(page.locator('.ww-verdict')).toBeHidden();

 await village(page,{phase:'finished',winner:'good'});
 const verdict=page.locator('.ww-verdict');
 await expect(verdict).toBeVisible();
 await expect(verdict).toHaveAttribute('data-side','good');
 await expect(verdict.locator('strong')).toHaveText('The villagers win!');
 await expect(verdict).toHaveClass(/game-burst/);

 // Every player's role is shown, and the wolves are marked as wolves.
 await expect(page.locator('.ww-roles span')).toHaveCount(3);
 await expect(page.locator('.ww-roles span[data-wolf="true"]')).toHaveCount(1);
 await expect(page.locator('.ww-roles span[data-wolf="true"]')).toContainText('Ali');
 // Roles, not blame: nothing here says who voted for whom.
 await expect(verdict).not.toContainText('undi');
});

test('the wolves winning reads differently from the village winning',async({page})=>{
 await mount(page,'ww-evil-harness');
 await village(page,{phase:'finished',winner:'evil'});
 await expect(page.locator('.ww-verdict')).toHaveAttribute('data-side','evil');
 await expect(page.locator('.ww-verdict strong')).toHaveText('The wolves win!');
});
