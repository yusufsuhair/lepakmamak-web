import {test, expect} from '@playwright/test';
import {createModeration} from '../server/moderation.mjs';

const reportDb = () => {
  const inserted: any[] = [];
  return {inserted, db: {from: (table: string) => ({insert: async (row: any) => { inserted.push({table, row}); return {error: null}; }})}};
};

test('a report stores its evidence exactly as written, and older reports send no evidence key', async () => {
  const {db, inserted} = reportDb();
  const moderation = createModeration({db});
  const base = {reporterUserId: 'a', reporterName: 'Alya', reportedUserId: 'b', reportedName: 'Badrul', room: 'kampung', reason: 'harassment'};
  await moderation.report({...base, surface: 'dm', evidence: [{from: 'b', body: 'kau bodoh', sentAt: '2026-09-13T01:00:00.000Z'}]});
  await moderation.report({...base, surface: 'chat'});
  expect(inserted[0].row.evidence).toEqual([{from: 'b', body: 'kau bodoh', sentAt: '2026-09-13T01:00:00.000Z'}]);
  expect(inserted[0].row.surface).toBe('dm');
  expect('evidence' in inserted[1].row).toBe(false);
});
