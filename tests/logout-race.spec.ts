import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const auth=readFileSync('src/auth.ts','utf8');
const main=readFileSync('src/main.ts','utf8');

test('a fast mobile tap cannot auto-enter while logout is settling',()=>{
  expect(auth).toContain('let logoutBarrier: Promise<void> | null = null;');
  expect(auth).toContain('if (logoutBarrier) await logoutBarrier;');
  expect(auth).toMatch(/event === 'SIGNED_OUT'[\s\S]*completeLogout\(\);/);
  expect(main).toMatch(/authLifecycle\.beginLogout\?\.\(\);[\s\S]*auth\.auth\.signOut\(\{scope:'local'\}\)/);
  expect(main).toMatch(/catch\(error\)\{[\s\S]*authLifecycle\.cancelLogout\?\.\(\);/);
});
