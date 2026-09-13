import {test, expect} from '@playwright/test';
import {cleanHandle, handleProblem, suggestHandle} from '../server/handles.mjs';

test('handles are 3 to 18 lowercase letters, digits or underscores', () => {
  expect(handleProblem('abc')).toBeNull();
  expect(handleProblem('a_1_b')).toBeNull();
  expect(handleProblem('abcdefghijklmnopqr')).toBeNull();
  expect(handleProblem('ab')).toBe('invalid');
  expect(handleProblem('abcdefghijklmnopqrs')).toBe('invalid');
  expect(handleProblem('Abc')).toBe('invalid');
  expect(handleProblem('ab-c')).toBe('invalid');
  expect(handleProblem('abç')).toBe('invalid');
  expect(cleanHandle('  @Yusuf ')).toBe('yusuf');
});

test('reserved names are refused exactly, and the impersonation ones as prefixes too', () => {
  for (const name of ['mod', 'moderator', 'gm', 'support', 'system']) expect(handleProblem(name)).toBe('reserved');
  for (const name of ['admin', 'admin_yusuf', 'staff1', 'official_x', 'lepakmamakhq']) expect(handleProblem(name)).toBe('reserved');
  for (const name of ['modi', 'gmail', 'supporter', 'systems', 'myadmin']) expect(handleProblem(name)).toBeNull();
});

test('a suggestion comes from the display name, with the lowest free suffix from 2', () => {
  expect(suggestHandle('Yusuf', new Set())).toBe('yusuf');
  expect(suggestHandle('Yusuf', new Set(['yusuf']))).toBe('yusuf2');
  expect(suggestHandle('Yusuf', new Set(['yusuf', 'yusuf2', 'yusuf4']))).toBe('yusuf3');
  expect(suggestHandle('Yusuf Suhair!', new Set())).toBe('yusufsuhair');
  expect(suggestHandle('José', new Set())).toBe('jose');
  expect(suggestHandle('Yu', new Set())).toBe('yu2');
  expect(suggestHandle('Mod', new Set())).toBe('mod2');
  expect(suggestHandle('Admin Yusuf', new Set())).toBe('player');
  expect(suggestHandle('李', new Set(['player']))).toBe('player2');
  expect(suggestHandle('abcdefghijklmnopqr', new Set(['abcdefghijklmnopqr']))).toBe('abcdefghijklmnopq2');
});
