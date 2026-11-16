import {test, expect} from '@playwright/test';
import {FrameBudget, graphicsPixelRatio, initialGraphicsQuality} from '../src/graphics-quality';

const feed = (budget: FrameBudget, frames: number, seconds: number, active = true) =>
  Array.from({length: frames}, () => budget.observe(seconds, active)).filter(Boolean).length;

test('phone startup preserves saved low settings and requires a current-session High opt-in', () => {
  expect(initialGraphicsQuality(true, null, false)).toBe('lowest');
  expect(initialGraphicsQuality(true, 'high', false)).toBe('lowest');
  expect(initialGraphicsQuality(true, 'low', false)).toBe('low');
  expect(initialGraphicsQuality(true, 'high', true)).toBe('high');
  expect(initialGraphicsQuality(false, null, false)).toBe('high');
  expect(initialGraphicsQuality(false, 'smooth', false)).toBe('low');
  expect(initialGraphicsQuality(false, 'detailed', false)).toBe('high');
});

test('phones bound GPU pixel work independently of their physical display density', () => {
  for (const dpr of [1, 2, 3, 4]) {
    expect(graphicsPixelRatio('lowest', true, dpr)).toBe(.75);
    expect(graphicsPixelRatio('low', true, dpr)).toBe(.75);
    expect(graphicsPixelRatio('high', true, dpr)).toBe(1);
  }
  expect(graphicsPixelRatio('high', false, 2)).toBe(1.6);
  expect(graphicsPixelRatio('low', false, 2)).toBe(1);
  expect(graphicsPixelRatio('lowest', false, .5)).toBe(.5);
});

test('sustained 40 FPS triggers phone adaptation before desktop adaptation', () => {
  expect(feed(new FrameBudget(true), 125, .025)).toBe(1);
  expect(feed(new FrameBudget(false), 125, .025)).toBe(0);
  expect(feed(new FrameBudget(false), 80, .04)).toBe(1);
});

test('smooth frames, brief stalls and background time do not ratchet quality down', () => {
  const budget = new FrameBudget(true);
  expect(feed(budget, 600, 1 / 60)).toBe(0);
  expect(feed(budget, 45, 1 / 30)).toBe(0);
  expect(feed(budget, 120, 1 / 60)).toBe(0);
  expect(feed(budget, 45, 1 / 30)).toBe(0);
  expect(budget.observe(1, true)).toBe(false);
  expect(feed(budget, 45, 1 / 30)).toBe(0);
  expect(feed(budget, 300, 1 / 30, false)).toBe(0);
  expect(feed(budget, 45, 1 / 30)).toBe(0);
  budget.reset();
  expect(feed(budget, 45, 1 / 30)).toBe(0);
});
