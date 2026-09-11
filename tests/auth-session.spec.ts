import { expect, test } from '@playwright/test';
import type { Session, User } from '@supabase/supabase-js';
import { verifyRestoredSession } from '../src/auth-session';

const user = { id: 'member-1', user_metadata: { display_name: 'Yusuf' } } as User;
const stored = { access_token: 'old-token', user: { ...user, user_metadata: { display_name: 'Old name' } } } as Session;

test('does not call Supabase when no login is stored', async () => {
  let calls = 0;
  expect(await verifyRestoredSession(null, async () => { calls += 1; return {}; })).toEqual({ state: 'missing' });
  expect(calls).toBe(0);
});

test('accepts only a server-verified session and refreshes its user', async () => {
  const result = await verifyRestoredSession(stored, async token => {
    expect(token).toBe('old-token');
    return { data: { user }, error: null };
  });
  expect(result.state).toBe('valid');
  if (result.state === 'valid') expect(result.session.user).toBe(user);
});

test('rejects an expired or unknown token', async () => {
  await expect(verifyRestoredSession(stored, async () => ({ data: { user: null }, error: { status: 401 } })))
    .resolves.toEqual({ state: 'invalid' });
});

test('keeps a session recoverable during a temporary auth outage', async () => {
  await expect(verifyRestoredSession(stored, async () => ({ data: { user: null }, error: { status: 503 } })))
    .resolves.toEqual({ state: 'unavailable' });
  await expect(verifyRestoredSession(stored, async () => { throw Error('offline'); }))
    .resolves.toEqual({ state: 'unavailable' });
});
