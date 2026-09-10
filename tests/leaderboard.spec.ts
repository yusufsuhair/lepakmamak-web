import {test,expect} from '@playwright/test';
import {createLeaderboard,weekStart,BOARDS} from '../server/leaderboard.mjs';

const MYT = (text: string) => Date.parse(`${text}+08:00`);

test('the week turns at midnight Monday in KL, and a write either side lands in its own week',()=>{
 // Sunday night and Monday morning MYT are a minute apart and a week apart.
 expect(weekStart(MYT('2026-09-13T23:59:59'))).toBe('2026-09-07');
 expect(weekStart(MYT('2026-09-14T00:00:00'))).toBe('2026-09-14');
 expect(weekStart(MYT('2026-09-14T00:00:01'))).toBe('2026-09-14');
 // Monday itself is the start of its own week, not the end of the last one.
 expect(weekStart(MYT('2026-09-14T12:00:00'))).toBe('2026-09-14');
 expect(weekStart(MYT('2026-09-20T23:59:59'))).toBe('2026-09-14');
 // KL runs eight hours ahead, so Sunday evening UTC is already Monday here and belongs to
 // the new week. Reading the clock in UTC would file it under the old one.
 expect(weekStart(Date.parse('2026-09-13T17:00:00Z'))).toBe('2026-09-14');
 expect(weekStart(Date.parse('2026-09-13T15:59:59Z'))).toBe('2026-09-07');
 // Every answer is a Monday, whatever day goes in.
 for (const day of ['2026-09-14','2026-09-15','2026-09-17','2026-09-20'])
  expect(new Date(`${weekStart(MYT(`${day}T09:00:00`))}T00:00:00Z`).getUTCDay()).toBe(1);
});

// A fake table that behaves like the one write path the recorder uses.
const store = () => {
 const rows: any[] = [];
 const db: any = {from: () => {
  const query: any = {filters: {} as Record<string, unknown>, field: null, ascending: false, cap: 50};
  query.select = () => query;
  query.eq = (column: string, value: unknown) => { query.filters[column] = value; return query; };
  query.gt = (field: string) => { query.field = field; return query; };
  query.order = (field: string) => { query.field = field; return query; };
  query.limit = (value: number) => { query.cap = value; return Promise.resolve({data: rows
    .filter(row => row.week_start === query.filters.week_start && Number(row[query.field] || 0) > 0)
    .sort((a, b) => Number(b[query.field]) - Number(a[query.field])).slice(0, value)}); };
  query.maybeSingle = () => Promise.resolve({data: rows.find(row => row.user_id === query.filters.user_id && row.week_start === query.filters.week_start) || null});
  query.insert = (row: any) => { rows.push({tables_sat: 0, basketball_points: 0, ...row}); return Promise.resolve({}); };
  query.update = (values: any) => { const target = {...query.filters}; return {eq: (c: string, v: unknown) => { (target as any)[c] = v; return {eq: (c2: string, v2: unknown) => { (target as any)[c2] = v2; Object.assign(rows.find(row => row.user_id === (target as any).user_id && row.week_start === (target as any).week_start), values); return Promise.resolve({}); }}; }}; };
  return query;
 }};
 return {rows, db};
};

test('points banked before the reset stay in last week, not this one',async()=>{
 const {rows, db} = store();
 let clock = MYT('2026-09-13T22:00:00');            // Sunday night
 const board = createLeaderboard({db, now: () => clock});

 await board.record('u-1', 'Ali', {basketball_points: 4, tables_sat: 1});
 await board.record('u-1', 'Ali', {basketball_points: 3});
 expect(rows).toEqual([{user_id: 'u-1', week_start: '2026-09-07', display_name: 'Ali', tables_sat: 1, basketball_points: 7}]);

 clock = MYT('2026-09-14T00:30:00');                // half an hour past the reset
 await board.record('u-1', 'Ali', {basketball_points: 2});
 expect(rows).toHaveLength(2);
 expect(rows[1]).toMatchObject({week_start: '2026-09-14', basketball_points: 2, tables_sat: 0});
 // Last week is untouched by this week's points.
 expect(rows[0].basketball_points).toBe(7);
});

test('only the two counters that survive being public are ever written',async()=>{
 const {rows, db} = store();
 const board = createLeaderboard({db, now: () => MYT('2026-09-15T10:00:00')});
 await board.record('u-2', 'Mei', {punches: 40, recalls: 90, dances: 12, sessions: 5, tables_sat: 2});
 expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['tables_sat', 'basketball_points']));
 for (const farmable of ['punches', 'recalls', 'dances', 'sessions']) expect(rows[0][farmable]).toBeUndefined();
 expect(BOARDS).toEqual(['basketball_points', 'tables_sat']);

 // A flush that moved none of the two boards writes no row at all.
 await board.record('u-3', 'Ravi', {punches: 10});
 expect(rows).toHaveLength(1);
});

test('the board answers the top five of the current week over HTTP',async()=>{
 const {rows, db} = store();
 const clock = MYT('2026-09-15T10:00:00');
 const board = createLeaderboard({db, now: () => clock});
 for (const [name, points] of [['A', 9], ['B', 3], ['C', 7], ['D', 1], ['E', 5], ['F', 11]] as const)
  await board.record(`u-${name}`, name, {basketball_points: points});
 rows.push({user_id: 'old', week_start: '2026-09-07', display_name: 'LastWeek', basketball_points: 99, tables_sat: 0});

 let status = 0, body: any = null;
 const response: any = {setHeader() {}, writeHead(code: number) { status = code; }, end(text: string) { body = JSON.parse(text); }};
 expect(await board.handle({url: '/leaderboard', headers: {}}, response)).toBe(true);
 expect(status).toBe(200);
 expect(body.weekStart).toBe('2026-09-14');
 expect(body.boards.basketball_points.map((row: any) => row.name)).toEqual(['F', 'A', 'C', 'E', 'B']);
 // Last week's leader does not haunt this week's board.
 expect(body.boards.basketball_points.some((row: any) => row.name === 'LastWeek')).toBe(false);

 expect(await board.handle({url: '/wall/posts', headers: {}}, response)).toBe(false);
});
