import {test,expect} from '@playwright/test';
import chairs from '../shared/chairs.json' with {type:'json'};
import {createLukis} from '../server/lukis.mjs';
import {createPoker} from '../server/poker.mjs';
import {createUno} from '../server/uno.mjs';
import {createWerewolf} from '../server/werewolf.mjs';
test('mosque seats cannot open any table game',()=>{
 const quiet=chairs.filter(c=>c.games===false);expect(quiet).toHaveLength(12);
 for(const chair of quiet){
  const messages:any[]=[];const send=(_ws:any,m:any)=>messages.push(m);const player={id:'quiet',ws:{},name:'Friend',chairId:chair.id};const players=new Map([[player.id,player]]);
  for(const [factory,type] of [[createLukis,'lukis-open'],[createPoker,'poker-open'],[createUno,'uno-open'],[createWerewolf,'werewolf-open']] as const){factory(send).handle(players,player,{type});}
  expect(messages.some(m=>m.type.endsWith('-state')&&m.game)).toBe(false);
 }
});
test('mosque chairs are in clear outdoor space',async({page})=>{
 await page.goto('/');const blocked=await page.evaluate(async()=>{const {createWorld}=await import('/src/world.ts');const world=createWorld({add(){}} as any);return world.chairs.filter(c=>c.id.startsWith('masjid-')).filter(c=>world.solids.some(s=>Math.abs(c.x-s.x)<s.hx+.3&&Math.abs(c.z-s.z)<s.hz+.3)).map(c=>c.id);});expect(blocked).toEqual([]);
});
