type Peer={id:string;name:string;volume:number};
type Reply={requestId:number;result?:any;error?:string};
export function createSfuVoice(send:(m:any)=>boolean,activity:(id:string,name:string,level:number)=>void,warn:(text:string)=>void){
 let enabled=false,online=false,listening=false,generation=0,volume=1;
 let microphoneStream:MediaStream|undefined,micEpoch=0,listenEpoch=0,pubBusy=false;
 let pub:RTCPeerConnection|undefined,sub:RTCPeerConnection|undefined;
 let ctx:AudioContext|undefined,source:MediaStreamAudioSourceNode|undefined,gate:AudioWorkletNode|undefined,destination:MediaStreamAudioDestinationNode|undefined;
 let nextId=0,lastRpc=0,busy=false,retryAt=0;
 const pending=new Map<number,{resolve:(x:any)=>void;reject:(e:Error)=>void;timer:number}>();
 const peers=new Map<string,Peer>(), mids=new Map<string,string>();
 const tracks=new Map<string,{source:MediaStreamAudioSourceNode;gain:GainNode;analyser:AnalyserNode;track:MediaStreamTrack;keepAlive:HTMLAudioElement}>();
 let rpcQueue:Promise<unknown>=Promise.resolve();
 function rpc(op:string,extra:any={}){const epoch=generation;const task=rpcQueue.then(()=>{if(epoch!==generation)throw new Error('Voice disconnected.');return requestRpc(op,extra);});rpcQueue=task.catch(()=>{});return task;}
 async function requestRpc(op:string,extra:any={}){
  const epoch=generation;
  const delay=Math.max(0,100-(performance.now()-lastRpc));if(delay)await new Promise(r=>setTimeout(r,delay));
  if(epoch!==generation||!online)throw new Error('Voice disconnected.');lastRpc=performance.now();
  const requestId=++nextId;
  return await new Promise<any>((resolve,reject)=>{
   const timer=window.setTimeout(()=>{pending.delete(requestId);reject(new Error('Voice connection timed out.'));},10000);
   pending.set(requestId,{resolve,reject,timer});
   if(!send({type:'voice-rpc',requestId,op,...extra})){clearTimeout(timer);pending.delete(requestId);reject(new Error('Voice signalling is offline.'));}
  });
 }
 function pc(){
  const value=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}],bundlePolicy:'max-bundle'});let disconnectedTimer=0;
  const recover=()=>{if(value!==pub&&value!==sub)return;warn('Voice reconnecting…');retryAt=performance.now()+2000;if(value===sub)clearListening();if(value===pub){pub.close();pub=undefined;}};
  value.onconnectionstatechange=()=>{clearTimeout(disconnectedTimer);if(value.connectionState==='failed')recover();else if(value.connectionState==='disconnected')disconnectedTimer=window.setTimeout(()=>{if(value.connectionState==='disconnected')recover();},5000);};return value;
 }

 function opus(transceiver:RTCRtpTransceiver){const codecs=RTCRtpSender.getCapabilities('audio')?.codecs.filter(c=>c.mimeType.toLowerCase()==='audio/opus');if(codecs?.length)transceiver.setCodecPreferences(codecs);}
 async function offer(value:RTCPeerConnection){const o=await value.createOffer();o.sdp=o.sdp?.replace(/a=fmtp:(\d+) ([^\r\n]+)/g,(line,pt,params)=>line.includes('useinbandfec')?`a=fmtp:${pt} ${params};usedtx=1;maxaveragebitrate=24000`:line);await value.setLocalDescription(o);return value.localDescription!.toJSON();}
 async function initialize(value:RTCPeerConnection,kind:'pub'|'sub'){const result=await rpc('init',{kind,description:await offer(value)});await value.setRemoteDescription(result.sessionDescription);}
 async function audio(){ctx??=new AudioContext({latencyHint:'interactive'});await ctx.resume();return ctx;}
 function clearListening(){listenEpoch++;sub?.close();sub=undefined;for(const v of tracks.values()){v.source.disconnect();v.gain.disconnect();v.analyser.disconnect();v.keepAlive.srcObject=null;v.keepAlive.remove();}tracks.clear();mids.clear();}
 function attach(mid:string,track:MediaStreamTrack){
  const id=mids.get(mid);if(!id||!ctx||tracks.has(mid))return;
  const stream=new MediaStream([track]);const input=ctx.createMediaStreamSource(stream),gain=ctx.createGain(),analyser=ctx.createAnalyser();analyser.fftSize=256;
  input.connect(analyser);analyser.connect(gain);gain.connect(ctx.destination);gain.gain.value=(peers.get(id)?.volume||0)*volume*.8;
  // Chromium requires an attached media element to keep remote audio streams flowing into WebAudio.
  const element=document.createElement('audio');element.autoplay=true;element.muted=true;element.srcObject=stream;element.hidden=true;document.body.append(element);void element.play().catch(()=>{});
  tracks.set(mid,{source:input,gain,analyser,track,keepAlive:element});
 }
 let nextSync=0;
 async function synchronize(){
  if(!enabled||!online||!listening||busy||performance.now()<Math.max(retryAt,nextSync))return;
  nextSync=performance.now()+1000;
  // Retire spent m-lines before repeated proximity changes make SDP grow without bound.
  if(sub&&sub.getTransceivers().length>24)clearListening();
  busy=true;const epoch=generation,subscriptionEpoch=listenEpoch;
  try{
   if(!sub){await audio();const p=pc();sub=p;const transceiver=p.addTransceiver('audio',{direction:'recvonly'});opus(transceiver);p.ontrack=e=>{if(epoch===generation)attach(e.transceiver.mid!,e.track);};await initialize(p,'sub');}
   if(epoch!==generation||subscriptionEpoch!==listenEpoch||!listening)return;
   const result=await rpc('subscribe');
   if(epoch!==generation||subscriptionEpoch!==listenEpoch||!listening)return;
   for(const peer of result.peers||[])mids.set(peer.mid,peer.id);
   if(result.sessionDescription){await sub!.setRemoteDescription(result.sessionDescription);const answer=await sub!.createAnswer();await sub!.setLocalDescription(answer);await rpc('answer',{description:sub!.localDescription!.toJSON()});}
   for(const t of sub!.getTransceivers())if(t.mid&&t.receiver.track)attach(t.mid,t.receiver.track);
  }catch{if(epoch===generation){clearListening();retryAt=performance.now()+2500;warn('Voice reconnecting… Gameplay stays connected.');}}finally{busy=false;}
 }
 window.setInterval(()=>{
  if(!enabled||!online)return;
  void synchronize();
  if(microphoneStream&&!pub&&!pubBusy&&performance.now()>=retryAt){pubBusy=true;void service.microphone(microphoneStream).catch(()=>{retryAt=performance.now()+3000;warn('Microphone reconnecting…');}).finally(()=>pubBusy=false);}
  for(const [mid,item]of tracks){const peer=peers.get(mids.get(mid)!);item.gain.gain.value=listening&&peer?peer.volume*volume*.8:0;if(peer&&listening){const samples=new Float32Array(item.analyser.fftSize);item.analyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((n,v)=>n+v*v,0)/samples.length);activity(peer.id,peer.name,Math.max(0,Math.min(1,(rms-.004)/.1)));}}
 },250);
 const service = {
  get enabled(){return enabled;},
  configure(value:boolean){enabled=value;},
  connected(value:boolean){online=value;if(!value){generation++;micEpoch++;microphoneStream=undefined;pub?.close();pub=undefined;clearListening();source?.disconnect();gate?.disconnect();destination?.disconnect();source=undefined;gate=undefined;destination=undefined;listening=false;peers.clear();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Voice disconnected.'));}pending.clear();}},
  receive(message:Reply){const p=pending.get(message.requestId);if(!p)return;pending.delete(message.requestId);clearTimeout(p.timer);message.error?p.reject(new Error(message.error)):p.resolve(message.result);},
  peers(values:Peer[]){peers.clear();for(const p of values)peers.set(p.id,p);for(const [mid,item]of tracks)if(!peers.has(mids.get(mid)!)){item.gain.gain.value=0;item.source.disconnect();item.analyser.disconnect();item.gain.disconnect();item.keepAlive.srcObject=null;item.keepAlive.remove();tracks.delete(mid);mids.delete(mid);}},
  volume(v:number){volume=v;},
  async microphone(stream:MediaStream){
   const attempt=++micEpoch;microphoneStream=stream;const epoch=generation;pubBusy=true;try{const context=await audio();await context.audioWorklet.addModule('/voice-gate.js');if(epoch!==generation||attempt!==micEpoch)throw new Error('Voice disconnected.');
   source?.disconnect();gate?.disconnect();destination?.disconnect();
   source=context.createMediaStreamSource(stream);gate=new AudioWorkletNode(context,'voice-gate');destination=context.createMediaStreamDestination();source.connect(gate);gate.connect(destination);
   const p=pc();pub=p;const t=p.addTransceiver(destination.stream.getAudioTracks()[0],{direction:'sendonly'});opus(t);
   await initialize(p,'pub');if(epoch!==generation||attempt!==micEpoch){p.close();throw new Error('Voice disconnected.');}
   const result=await rpc('publish',{description:await offer(p),mid:t.mid});if(attempt!==micEpoch||epoch!==generation){p.close();throw new Error('Voice disconnected.');}await p.setRemoteDescription(result.sessionDescription);
   const parameters=t.sender.getParameters();if(parameters.encodings?.length){parameters.encodings[0].maxBitrate=24000;await t.sender.setParameters(parameters);}
   }catch(error){if(attempt===micEpoch){pub?.close();pub=undefined;}throw error;}finally{pubBusy=false;}
  },
  stopMic(){micEpoch++;microphoneStream=undefined;pub?.close();pub=undefined;source?.disconnect();gate?.disconnect();destination?.disconnect();source=undefined;gate=undefined;destination=undefined;if(online)void rpc('stop',{kind:'pub'}).catch(()=>{});},
  async speakers(value:boolean){listening=value;if(!value){clearListening();if(online)void rpc('stop',{kind:'sub'}).catch(()=>{});}else{await audio();void synchronize();}},
  async stats(){const result={voiceJitterMs:0,voicePacketsLost:0,voicePacketsReceived:0,publishState:pub?.connectionState,subscribeState:sub?.connectionState};if(sub)for(const stat of Array.from((await sub.getStats()) as any) .map((entry:any)=>entry[1]) as any[])if(stat.type==='inbound-rtp'&&stat.kind==='audio'){result.voiceJitterMs=Math.max(result.voiceJitterMs,Math.round((stat.jitter||0)*1000));result.voicePacketsLost+=Math.max(0,stat.packetsLost||0);result.voicePacketsReceived+=stat.packetsReceived||0;}return result;},
 };
 return service;
}
