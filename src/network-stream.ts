export class PlayerStateStream<T extends {id:string}> {
  private rows = new Map<string,T>();
  private revision = -1;
  full(players:T[], revision = -1) { this.rows = new Map(players.map(p=>[p.id,p])); this.revision=revision; return players; }
  delta(message:{base:number;revision:number;changes:Partial<T>[];removed:string[]}):T[]|null {
    if(message.base!==this.revision || message.revision<=this.revision)return null;
    const next=new Map(this.rows);
    for(const patch of message.changes){if(!patch.id)return null;next.set(patch.id,{...next.get(patch.id),...patch} as T);}
    for(const id of message.removed)next.delete(id);
    this.rows=next;this.revision=message.revision;return [...next.values()];
  }
}

// Incoming binary frames may contain reliable game events as well as snapshots. Never
// drop them indiscriminately. Bound the entire decode queue and reconnect if it overruns.
export function createFrameQueue<T>(decode:(value:T)=>Promise<string>, consume:(text:string)=>void, overflow:()=>void) {
  const queue:{value:T;at:number}[]=[];let running=false,closed=false;
  let maxAge=0,maxDepth=0;
  async function drain(){if(running||closed)return;running=true;try{while(queue.length&&!closed){const item=queue.shift()!;maxAge=Math.max(maxAge,performance.now()-item.at);const text=await decode(item.value);if(!closed)consume(text);}}catch{if(!closed){closed=true;queue.length=0;overflow();}}finally{running=false;}}
  return {
    push(value:T){if(closed)return;if(queue.length>=32 || (queue[0]&&performance.now()-queue[0].at>2000)){closed=true;queue.length=0;overflow();return;}queue.push({value,at:performance.now()});maxDepth=Math.max(maxDepth,queue.length);void drain();},
    close(){closed=true;queue.length=0;},
    stats(){const result={decodeQueueMax:maxDepth,decodeQueueAgeMs:Math.round(maxAge)};maxDepth=0;maxAge=0;return result;},
  };
}

export function createHeartbeat(now=()=>performance.now()){
 let lastReply=now(), lastTick=now();const pending=new Map<number,number>();let sequence=0;const samples:number[]=[];
 return {
  tick(hidden=false){const at=now();if(hidden||at-lastTick>8000){lastReply=at;pending.clear();}lastTick=at;return at-lastReply>15000;},
  probe(){const id=++sequence;pending.set(id,now());while(pending.size>16)pending.delete(pending.keys().next().value!);return id;},
  reply(id:number){const sent=pending.get(id);if(sent===undefined)return null;pending.delete(id);const rtt=now()-sent;lastReply=now();samples.push(rtt);if(samples.length>120)samples.shift();return rtt;},
  stats(){const sorted=[...samples].sort((a,b)=>a-b);return {rttP50Ms:Math.round(sorted[Math.floor(sorted.length*.5)]||0),rttP95Ms:Math.round(sorted[Math.floor(sorted.length*.95)]||0),rttSamples:sorted.length};},
 };
}
