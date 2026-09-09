import {test,expect} from '@playwright/test';
import changelog from '../shared/changelog.json' with {type:'json'};
import pkg from '../package.json' with {type:'json'};

test('the shipped version has release notes to go with it',()=>{
 // The guard behind "every change gets a version and a note": ship one without the other
 // and this fails rather than quietly leaving players looking at a stale list.
 expect(changelog[0].version).toBe(pkg.version);
});

test('every entry is dated, titled and says something a player would understand',()=>{
 for(const entry of changelog){
  expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Number.isFinite(Date.parse(entry.date))).toBe(true);
  expect(entry.title.length).toBeGreaterThan(0);
  expect(entry.notes.length).toBeGreaterThan(0);
  for(const note of entry.notes){
   expect(note.length).toBeGreaterThan(20);
   // Release notes are for players, not a commit log.
   expect(note).not.toMatch(/\b(refactor|commit|typecheck|const |server\/|src\/|\.ts\b|\.mjs\b)/i);
  }
 }
});

test('entries run newest first, so the top of the list is the current release',()=>{
 const dates=changelog.map(entry=>Date.parse(entry.date));
 expect([...dates].sort((a,b)=>b-a)).toEqual(dates);
 const versions=changelog.map(entry=>entry.version.split('.').map(Number));
 for(let i=1;i<versions.length;i++){
  const [a,b]=[versions[i-1],versions[i]];
  const newer=a[0]!==b[0]?a[0]>b[0]:a[1]!==b[1]?a[1]>b[1]:a[2]>=b[2];
  expect(newer).toBe(true);
 }
});

test('settings shows the version, when it last changed, and what changed',async({page})=>{
 await page.route('**/changelog-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/changelog-harness');
 await page.evaluate(async()=>{
  const {createWhatsNew}=await import('/src/changelog.ts');
  createWhatsNew(document.getElementById('hud')!);
 });

 await expect(page.locator('#whats-new-version')).toContainText(changelog[0].version);
 await expect(page.locator('#whats-new-date')).toContainText('2026');
 // The newest release is open, so progress is visible without a click.
 await expect(page.locator('.release').first()).toContainText(changelog[0].title);
 await expect(page.locator('.release').first()).toContainText(changelog[0].notes[0].slice(0,30));
 // Only the newest few are on screen: this panel is a phone-height column, and a list
 // that grows with every release pushes the buttons under it out of reach.
 await expect(page.locator('.release')).toHaveCount(3);
 // The whole story is still one click away.
 await page.getByRole('button',{name:/kemas kini lama/}).click();
 await expect(page.locator('.release')).toHaveCount(changelog.length);
 await expect(page.getByRole('button',{name:/kemas kini lama/})).toHaveCount(0);
 await expect(page.locator('.release').last()).toContainText(changelog.at(-1)!.title);
});

test('an older release stays collapsed until you ask for it',async({page})=>{
 await page.route('**/collapse-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="hud"></div>'}));
 await page.goto('/collapse-harness');
 await page.evaluate(async()=>{
  const {createWhatsNew}=await import('/src/changelog.ts');
  createWhatsNew(document.getElementById('hud')!);
 });
 const older=page.locator('.release').nth(1);
 await expect(older.locator('li').first()).toBeHidden();
 await older.locator('summary').click();
 await expect(older.locator('li').first()).toBeVisible();
});
