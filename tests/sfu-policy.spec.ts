import{test,expect}from'@playwright/test';
import{createSfu,voiceAudience}from'../server/sfu.mjs';
import vm from'node:vm';import{readFileSync}from'node:fs';

test('voice permissions enforce proximity, both Party scopes, death and live-game privacy',()=>{
 const ps=new Map();const a:any={id:'a',x:0,z:0,mic:true,ws:{readyState:1}},b:any={id:'b',x:2,z:0,speaker:true,ws:{readyState:1}};
 let together=false,dead=false,live=false;const policy={party:{shares:()=>together},werewolf:{silenced:()=>dead,live:()=>live},lukis:{live:()=>false}};
 expect(voiceAudience(ps,a,b,policy)).toBe(true);b.x=15;expect(voiceAudience(ps,a,b,policy)).toBe(false);
 a.micScope='party';together=true;expect(voiceAudience(ps,a,b,policy)).toBe(true);live=true;expect(voiceAudience(ps,a,b,policy)).toBe(false);
 live=false;a.micScope='all';b.x=1;b.speakerScope='party';together=false;expect(voiceAudience(ps,a,b,policy)).toBe(false);
 together=true;dead=true;expect(voiceAudience(ps,a,b,policy)).toBe(false);dead=false;a.muted=true;expect(voiceAudience(ps,a,b,policy)).toBe(false);
});

test('silent capture is suppressed but speech flushes pre-roll and a trailing hangover',()=>{
 let Capture:any;const sent:any[]=[];vm.runInNewContext(readFileSync('public/voice-capture.js','utf8'),{AudioWorkletProcessor:class{port={postMessage:(m:any)=>sent.push(m)}},sampleRate:16000,currentTime:1,Int16Array,registerProcessor:(_n:string,c:any)=>Capture=c});
 const capture=new Capture();for(let i=0;i<250;i++)capture.process([[new Float32Array(640)]]);expect(sent).toHaveLength(0);
 capture.process([[new Float32Array(640).fill(.1)]]);expect(sent).toHaveLength(3);
 for(let i=0;i<30;i++)capture.process([[new Float32Array(640)]]);expect(sent.length).toBe(8);
});

test('WebRTC gate preserves speech and eventually produces digital silence for Opus DTX',()=>{
 let Gate:any;vm.runInNewContext(readFileSync('public/voice-gate.js','utf8'),{AudioWorkletProcessor:class{},sampleRate:16000,Float32Array,registerProcessor:(_n:string,c:any)=>Gate=c});
 const gate=new Gate();let energy=0;
 for(let i=0;i<50;i++){const out=new Float32Array(128);gate.process([[new Float32Array(128).fill(.1)]],[[out]]);energy+=out.reduce((sum,v)=>sum+v*v,0);}expect(energy).toBeGreaterThan(1);
 let last!:Float32Array;for(let i=0;i<80;i++){last=new Float32Array(128);gate.process([[new Float32Array(128)]],[[last]]);}expect(last.every(v=>v===0)).toBe(true);
});

test('SFU rejects caller-selected targets and revokes subscriptions at the provider',async()=>{
 const calls:any[]=[];const replies:any[]=[];let permitted=true,session=0;
 const service=createSfu({env:{CF_SFU_APP_ID:'test',CF_SFU_APP_SECRET:'test'},send:(_ws:any,m:any)=>replies.push(m),allowed:()=>permitted,request:async(url:string,options:any)=>{const body=JSON.parse(options.body);calls.push({url,body});return{ok:true,json:async()=>url.endsWith('/sessions/new')?{sessionId:String(++session),sessionDescription:{type:'answer',sdp:'test'}}:url.endsWith('/tracks/new')?{tracks:body.tracks.map((t:any)=>({...t,mid:'1'}))}:{}};}});
 const p:any={id:'a',mic:true,ws:{readyState:1}},q:any={id:'b',speaker:true,ws:{readyState:1}};const ps=new Map([[p.id,p],[q.id,q]]);let id=0;
 const call=async(player:any,m:any)=>{await new Promise(r=>setTimeout(r,85));await service.handle(ps,player,{type:'voice-rpc',requestId:++id,...m});};
 const offer={type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};
 await call(p,{op:'init',kind:'pub',description:offer});await call(p,{op:'publish',description:offer,mid:'0'});await call(q,{op:'init',kind:'sub',description:offer});await call(q,{op:'subscribe',targets:['stranger']});
 expect(replies.at(-1).result.peers[0].id).toBe('a');
 permitted=false;service.tick(ps);await new Promise(r=>setTimeout(r,0));expect(calls.some(c=>c.url.endsWith('/tracks/close')&&c.body.force===true)).toBe(true);
 await call(q,{op:'subscribe'});expect(replies.at(-1).result.peers).toBeUndefined();service.remove(p);service.remove(q);
});

test('SFU nearest-speaker cap revokes the displaced track and tolerates already-closed sessions',async()=>{
 const calls:any[]=[];const replies:any[]=[];let session=0,mid=0;
 const service=createSfu({env:{CF_SFU_APP_ID:'test',CF_SFU_APP_SECRET:'test'},send:(_ws:any,m:any)=>replies.push(m),allowed:(_ps:any,p:any,q:any)=>p!==q&&p.mic&&q.speaker,request:async(url:string,options:any)=>{const body=JSON.parse(options.body);calls.push({url,body});if(url.endsWith('/tracks/close'))return{ok:false,status:410,json:async()=>({errorCode:'sessionClosed'})};return{ok:true,status:200,json:async()=>url.endsWith('/sessions/new')?{sessionId:String(++session),sessionDescription:{type:'answer',sdp:'test'}}:url.endsWith('/tracks/new')?{tracks:body.tracks.map((t:any)=>({...t,mid:String(++mid)}))}:{}};}});
 const speakers=Array.from({length:17},(_,i)=>({id:String(i),name:String(i),x:i+1,z:0,mic:true,ws:{readyState:1}}));const listener={id:'listener',x:0,z:0,speaker:true,ws:{readyState:1}};const ps=new Map<string,any>([...speakers,listener].map(p=>[p.id,p]));let id=0;
 const call=async(p:any,m:any)=>{await new Promise(r=>setTimeout(r,85));await service.handle(ps,p,{type:'voice-rpc',requestId:++id,...m});};const offer={type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};
 for(const p of speakers){await call(p,{op:'init',kind:'pub',description:offer});await call(p,{op:'publish',description:offer,mid:'0'});}
 await call(listener,{op:'init',kind:'sub',description:offer});await call(listener,{op:'subscribe'});expect(replies.at(-1).result.peers).toHaveLength(16);
 speakers[16].x=0;await call(listener,{op:'subscribe'});expect(replies.at(-1).error).toBeUndefined();expect(replies.at(-1).result.peers.map((p:any)=>p.id)).toEqual(['16']);expect(calls.filter(c=>c.url.endsWith('/tracks/close')).at(-1).body.tracks).toHaveLength(1);
 for(const p of ps.values())service.remove(p);
});
