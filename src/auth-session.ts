import type { Session, User } from '@supabase/supabase-js';

export type SessionCheck =
  | { state: 'missing' }
  | { state: 'valid'; session: Session }
  | { state: 'invalid' }
  | { state: 'unavailable' };

type UserResult = {
  data?: { user?: User | null };
  error?: { status?: number } | null;
};

// Supabase restores local storage before it proves the access token still belongs to a
// real session. Validate it before opening the city so an expired mobile session cannot
// briefly enter, get rejected by realtime, and appear to refresh back to the title.
export async function verifyRestoredSession(
  candidate: Session | null,
  getUser: (accessToken: string) => Promise<UserResult>,
): Promise<SessionCheck> {
  if (!candidate) return { state: 'missing' };
  try {
    const result = await getUser(candidate.access_token);
    if (result.data?.user && !result.error) {
      return { state: 'valid', session: { ...candidate, user: result.data.user } };
    }
    const status = Number(result.error?.status || 0);
    return status >= 500 || status === 0 ? { state: 'unavailable' } : { state: 'invalid' };
  } catch {
    return { state: 'unavailable' };
  }
}
