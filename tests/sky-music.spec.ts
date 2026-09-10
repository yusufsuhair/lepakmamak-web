import {test, expect} from '@playwright/test';
import {createSkyMusic} from '../src/sky-music';

test('rooftop music gates playback, ducks for games and resumes without a backlog', () => {
  const targets:number[]=[];
  let notes=0;
  const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(value:number){targets.push(value);}});
  const context={currentTime:10,state:'running',destination:{},
    createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),
    createOscillator:()=>({frequency:parameter(),connect(){},disconnect(){},start(){notes++;},stop(){}})};
  const music=createSkyMusic(context as unknown as AudioContext);
  music.update(false,false);expect(notes).toBe(0);expect(targets.at(-1)).toBe(0);
  music.update(true,false);expect(notes).toBeGreaterThan(0);expect(targets.at(-1)).toBe(.12);
  music.update(true,true);expect(targets.at(-1)).toBe(.015);
  music.update(false,false);expect(targets.at(-1)).toBe(0);
  const before=notes;context.currentTime=1000;music.update(true,false);expect(notes-before).toBeLessThan(10);
  context.state='suspended';const suspended=notes;music.update(true,false);expect(notes).toBe(suspended);
});
