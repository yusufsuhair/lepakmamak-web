// Native WebSocket pongs keep working even when a browser throttles background JS.
// A lost TCP connection must not reserve a city seat forever.
export function createSocketHeartbeat(now=Date.now) {
 const deadlines=new WeakMap();
 return {
  track(ws){deadlines.set(ws,now()+60000);ws.on('pong',()=>deadlines.set(ws,now()+60000));},
  tick(sockets){const at=now();for(const ws of sockets){if(ws.readyState!==1)continue;if(at>=(deadlines.get(ws)??at+60000)){ws.terminate();continue;}ws.ping();}},
 };
}
