import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';

export async function listen(handle: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>) {
  const server = createServer((request, response) => {
    void handle(request, response).then(handled => { if (!handled) { response.writeHead(404); response.end('{}'); } });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address() as {port: number};
  const call = async (token: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}), ...headers},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    return {status: response.status, body: await response.json().catch(() => null)};
  };
  return {call, close: () => new Promise<void>(resolve => server.close(() => resolve()))};
}
