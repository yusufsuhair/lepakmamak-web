// Unauthenticated traffic amplifies into Supabase: every WebSocket join spends an
// /auth/v1/user lookup and every Wall profile view spends an admin read, both before
// the caller has proved anything. The edge is capped here so a stranger cannot spend
// our auth quota, or our file descriptors, faster than our own players can.

// Railway terminates TLS and appends the client to X-Forwarded-For, so the leftmost
// entry is the caller. Deliberately leftmost rather than rightmost: a client can forge
// it, but forging only costs an attacker the per-key cap and leaves the total cap
// standing. Reading the rightmost entry would be unforgeable yet would collapse every
// player onto one key the moment the proxy chain gained a hop, taking the city down at
// the per-key limit. Cheap to bypass beats easy to self-inflict; the total is the
// backstop that no header can talk its way past.
export function clientKey(request) {
  const forwarded = request.headers['x-forwarded-for'];
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  return first || request.socket?.remoteAddress || 'unknown';
}

// ponytail: fixed windows held in this process. A shared store only matters if the
// realtime service ever runs more than one instance.
//
// Counters are dropped a whole generation at a time rather than swept per key. Sweeping
// meant an O(n) scan on every call once the map filled, which handed an attacker a
// cheaper CPU attack than the one being prevented; rotating is O(1) and bounds memory at
// one window's keys. The cost is that a caller can spend up to twice the limit across a
// rotation, which abuse control tolerates. Past maxKeys new callers stop being tracked,
// so an address flood degrades to untracked (allowed), never to locked out.
export function createRateLimiter({ limit, windowMs, maxKeys = 20000 }) {
  let counts = new Map();
  let startedAt = Date.now();
  return function allow(key) {
    const now = Date.now();
    if (now - startedAt >= windowMs) { counts = new Map(); startedAt = now; }
    // A key already being counted stays counted; a new one is only taken on while there
    // is room, so a flood of forged addresses cannot grow this map past maxKeys.
    if (!counts.has(key) && counts.size >= maxKeys) return true;
    const count = counts.get(key) + 1 || 1;
    counts.set(key, count);
    return count <= limit;
  };
}

// Concurrent sockets, not a rate: a held-open connection costs memory for as long as it
// lives. take() returns the release function, or null when the caller is over a cap.
export function createConnectionCap({ perKey, total }) {
  const counts = new Map();
  let live = 0;
  return {
    take(key) {
      if (live >= total) return null;
      const current = counts.get(key) || 0;
      if (current >= perKey) return null;
      counts.set(key, current + 1); live += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true; live -= 1;
        const next = (counts.get(key) || 1) - 1;
        if (next > 0) counts.set(key, next); else counts.delete(key);
      };
    },
    get live() { return live; },
  };
}
