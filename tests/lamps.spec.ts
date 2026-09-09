import {test,expect} from '@playwright/test';
import {createLamps} from '../server/lamps.mjs';

const room = () => {
  const sent: any[] = [], players = new Map();
  const lamps = createLamps((_ws: any, message: any) => sent.push(['direct', message]), (_players: any, message: any) => sent.push(['all', message]), () => clock);
  return {sent, players, lamps};
};
let clock = 0;

test('a fresh room follows the clock until somebody flips the switch', () => {
  clock = 0; const {sent, players, lamps} = room();
  lamps.sync(players, {});
  expect(sent).toEqual([['direct', {type: 'lamps', on: null}]]);

  const ali = {name: 'Ali'};
  expect(lamps.handle(players, ali, {type: 'move'})).toBe(false);
  expect(lamps.handle(players, ali, {type: 'lamps', on: false})).toBe(true);
  expect(sent.at(-1)).toEqual(['all', {type: 'lamps', on: false, name: 'Ali'}]);

  // Whoever walks in afterwards is told the city is dark, not left on the clock.
  sent.length = 0; lamps.sync(players, {});
  expect(sent).toEqual([['direct', {type: 'lamps', on: false}]]);
});

test('one flip a second per player, so nobody can strobe the city', () => {
  clock = 10000; const {sent, players, lamps} = room();
  const mei = {name: 'Mei'};
  lamps.handle(players, mei, {type: 'lamps', on: true});
  lamps.handle(players, mei, {type: 'lamps', on: false});
  expect(sent).toHaveLength(1);
  clock += 1000;
  lamps.handle(players, mei, {type: 'lamps', on: false});
  expect(sent).toHaveLength(2);
  // Somebody else is never blocked by your cooldown.
  lamps.handle(players, {name: 'Ravi'}, {type: 'lamps', on: true});
  expect(sent).toHaveLength(3);
});

test('rubbish is dropped rather than broadcast', () => {
  clock = 50000; const {sent, players, lamps} = room();
  for (const on of ['yes', 1, undefined]) expect(lamps.handle(players, {name: 'X'}, {type: 'lamps', on})).toBe(true);
  expect(sent).toHaveLength(0);
  // Explicit null hands the room back to the KL clock.
  lamps.handle(players, {name: 'X'}, {type: 'lamps', on: true});
  clock += 1000;
  lamps.handle(players, {name: 'X'}, {type: 'lamps', on: null});
  sent.length = 0; lamps.sync(players, {});
  expect(sent).toEqual([['direct', {type: 'lamps', on: null}]]);
});
