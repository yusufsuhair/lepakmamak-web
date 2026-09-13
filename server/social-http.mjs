import {origins} from '../shared/origins.mjs';

// The door handles and messages share, copied from server/friends.mjs: CORS for our own
// origins, a bearer token, and no anonymous users.

export class HttpError extends Error {
  constructor(status, message, data = {}) { super(message); this.status = status; this.data = data; }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function readJson(request, limit = 16384) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
  catch { throw new HttpError(400, 'Send JSON.'); }
}

export function serveJson({store, methods, unavailable, failure}) {
  return async function serve(request, response, route) {
    const origin = request.headers.origin;
    const reply = (status, data) => {
      response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      response.end(JSON.stringify(data));
    };
    if (origin && origins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); response.setHeader('Access-Control-Allow-Methods', methods);
    }
    if (request.method === 'OPTIONS') { response.writeHead(origins.has(origin) ? 204 : 403); response.end(); return; }
    if (origin && !origins.has(origin)) { reply(403, {error: 'Origin not allowed'}); return; }
    if (!store) { reply(503, {error: unavailable}); return; }
    try {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token || token.length > 3500) throw new HttpError(401, 'Please log in again.');
      const user = await store.userForToken(token);
      if (!user) throw new HttpError(401, 'Please log in again.');
      reply(200, await route(user));
    } catch (error) {
      if (error instanceof HttpError) { reply(error.status, {error: error.message, ...error.data}); return; }
      reply(500, {error: failure});
    }
  };
}
