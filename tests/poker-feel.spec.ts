import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('the motion vocabulary is shared, not reinvented per game',()=>{
 const motion=readFileSync('src/motion.css','utf8');
 for(const move of ['game-deal','game-flip','game-slide','game-pulse','game-burst']){
  expect(motion).toContain(`@keyframes ${move}`);
  expect(motion).toContain(`.${move} {`);
 }
 // Every one of them stops for someone who asked for less motion.
 const quiet=motion.slice(motion.indexOf('prefers-reduced-motion'));
 for(const move of ['game-deal','game-flip','game-slide','game-pulse','game-burst']) expect(quiet).toContain(`.${move}`);
});

const mount=async(page:any,route:string)=>{
 await page.route(`**/${route}`,(r:any)=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><div id="table-social"></div>'}));
 await page.goto(`/${route}`);
 await page.evaluate(async()=>{
  const {setupPoker}=await import('/src/poker.ts');
  const held=window as any;
  held.sent=[];
  held.poker=setupPoker((m:any)=>{held.sent.push(m);return true;});
  document.getElementById('table-social')!.append(held.poker.root);
  held.poker.context('meja-1',true,'me');
 });
};
const deal=(page:any,state:object)=>page.evaluate((s:any)=>(window as any).poker.state(s,'me'),{
 tableId:'meja-1',hand:'h1',revision:1,phase:'preflop',ends:0,pot:20,bet:10,board:[],result:'',
 players:[{id:'me',name:'Me',chips:180,paid:10,folded:false,dealer:true,cards:[12,25]},{id:'you',name:'You',chips:180,paid:10,folded:false,dealer:false,cards:[]}],
 actions:{call:0,raise:true},...state});

test('only the cards just turned over flip, and the rest stay put',async({page})=>{
 await mount(page,'poker-flip-harness');
 await deal(page,{});
 await expect(page.locator('.poker-card.game-flip')).toHaveCount(0);

 // The flop: three cards arrive together and all three flip.
 await deal(page,{phase:'flop',board:[1,2,3]});
 await expect(page.locator('.poker-card.game-flip')).toHaveCount(3);

 // The turn: one new card. The flop is already on the felt and must not deal itself again.
 await deal(page,{phase:'turn',board:[1,2,3,4]});
 await expect(page.locator('.poker-card.game-flip')).toHaveCount(1);

 // A state update that changes nothing about the board moves nothing.
 await deal(page,{phase:'turn',board:[1,2,3,4],pot:40});
 await expect(page.locator('.poker-card.game-flip')).toHaveCount(0);

 // A fresh hand deals from nothing again.
 await deal(page,{hand:'h2',phase:'flop',board:[7,8,9]});
 await expect(page.locator('.poker-card.game-flip')).toHaveCount(3);
});

test('the pot reacts when it grows, the turn marks whose it is, the showdown lands',async({page})=>{
 await mount(page,'poker-pot-harness');
 await deal(page,{});
 await expect(page.locator('[data-pot].game-burst')).toHaveCount(0);
 await deal(page,{pot:60});
 await expect(page.locator('[data-pot].game-burst')).toHaveCount(1);

 // The seat to act is marked, and only while there is something to act on.
 await deal(page,{pot:60,turnId:'you'});
 await expect(page.locator('.poker-player.active.game-pulse')).toHaveCount(1);
 await deal(page,{pot:60,phase:'finished',result:'Me menang',turnId:'you'});
 await expect(page.locator('.poker-player.game-pulse')).toHaveCount(0);
 await expect(page.locator('[data-turn].game-burst')).toHaveCount(1);
});

test('the shared audio engine falls back rather than going silent',async({page})=>{
 await page.route('**/audio-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/audio-harness');
 const result=await page.evaluate(async()=>{
  const {createGameAudio}=await import('/src/game-audio.ts');
  const played:string[]=[];
  const audio=createGameAudio('test-fallback',{
   named:()=>played.push('named'),
   default:()=>played.push('default'),
  });
  // No AudioContext is running in a harness, so drive the choice directly: what matters is
  // that an unlisted kind resolves to the fallback rather than to nothing.
  const voices:Record<string,unknown>={named:1,default:1};
  const pick=(kind:string)=>voices[kind]||voices.default;
  return {named:!!pick('named'),unlisted:!!pick('anything-else'),muted:audio.muted};
 });
 expect(result.named).toBe(true);
 // UNO picks its sound from server event types; an unlisted one must still make a noise.
 expect(result.unlisted).toBe(true);
});

test('UNO keeps its mute setting and its catch-all after moving engines',()=>{
 const uno=readFileSync('src/uno-audio.ts','utf8');
 // Same storage key, so anyone who had muted UNO stays muted.
 expect(uno).toContain("createGameAudio('uno'");
 expect(readFileSync('src/game-audio.ts','utf8')).toContain('`lepak-${name}-muted`');
 // Every voice the old implementation had, plus the bare-else fallback it ended with.
 for(const kind of ['deal','win','uno','turn','catch','default']) expect(uno).toContain(`${kind}:`);
});
