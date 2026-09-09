import {test,expect} from '@playwright/test';
import {createWeatherControls} from '../server/weather-controls.mjs';
test('only verified GM can override, rooms stay isolated and newcomers receive current state',()=>{
 const messages:any[]=[];const broadcasts:any[]=[];
 const controls=createWeatherControls((ws:any,m:any)=>messages.push(m),(room:any,m:any)=>broadcasts.push(m));
 const room=new Map(),other=new Map();const player={ws:{},gameMaster:false};
 controls.handle(room,player,{type:'weather-set',condition:'rain',daylight:'night',gameMaster:true});expect(broadcasts).toHaveLength(0);
 player.gameMaster=true;controls.handle(room,player,{type:'weather-set',condition:'rain',daylight:'night'});
 expect(broadcasts[0].override).toEqual({condition:'rain',daylight:'night'});
 controls.sync(room,{});expect(messages.at(-1).override).toEqual({condition:'rain',daylight:'night'});
 controls.sync(other,{});expect(messages.at(-1).override).toEqual({condition:'live',daylight:'live'});
 controls.handle(room,player,{type:'weather-set',condition:'invalid',daylight:'day'});expect(broadcasts).toHaveLength(1);
 controls.handle(room,player,{type:'weather-set',condition:'live',daylight:'live'});expect(broadcasts.at(-1).override).toEqual({condition:'live',daylight:'live'});
});
