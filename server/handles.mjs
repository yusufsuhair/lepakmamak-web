import crypto from 'node:crypto';

export const HANDLE = /^[a-z0-9_]{3,18}$/;
const RESERVED = new Set(['mod', 'moderator', 'gm', 'support', 'system']);
// Refused as prefixes as well: these are the names worth impersonating.
const RESERVED_PREFIXES = ['admin', 'staff', 'official', 'lepakmamak'];

export const cleanHandle = value => typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';

export function handleProblem(handle) {
  if (typeof handle !== 'string') return 'invalid';
  if (RESERVED.has(handle) || RESERVED_PREFIXES.some(prefix => handle.startsWith(prefix))) return 'reserved';
  if (!HANDLE.test(handle)) return 'invalid';
  return null;
}

// A reserved prefix cannot be rescued by a suffix, so those names start again from "player".
export function handleBase(name) {
  const base = String(name || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18);
  return base && !RESERVED_PREFIXES.some(prefix => base.startsWith(prefix)) ? base : 'player';
}

export function suggestHandle(name, taken = new Set()) {
  const base = handleBase(name);
  if (!handleProblem(base) && !taken.has(base)) return base;
  for (let n = 2; n < 100000; n++) {
    const suffix = String(n);
    const candidate = base.slice(0, 18 - suffix.length) + suffix;
    if (!handleProblem(candidate) && !taken.has(candidate)) return candidate;
  }
  return `player${crypto.randomInt(100000, 999999999)}`;
}
