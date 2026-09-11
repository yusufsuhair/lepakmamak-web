import {randomUUID} from 'node:crypto';

export function voiceAudience(players, publisher, listener, {party, werewolf, lukis, radius=15}) {
  if (publisher===listener || !publisher.mic || !listener.speaker || publisher.muted || publisher.ws.readyState!==1 || listener.ws.readyState!==1) return false;
  if(werewolf.silenced(players,publisher))return false;
  if(publisher.micScope==='party' && (werewolf.live(players,publisher)||lukis.live(players,publisher)))return false;
  const together=party.shares(publisher,listener);
  if(publisher.micScope==='party' ? !together : Math.hypot(publisher.x-listener.x,publisher.z-listener.z)>=radius)return false;
  return listener.speakerScope!=='party'||together;
}

export function createSfu({send,allowed,env=process.env,request=fetch}){
 const enabled=!!(env.CF_SFU_APP_ID&&env.CF_SFU_APP_SECRET);
 const states=new Map();
 const base=`https://rtc.live.cloudflare.com/v1/apps/${env.CF_SFU_APP_ID}`;
 async function api(path,body,method='POST'){
  const r=await request(base+path,{method,headers:{Authorization:`Bearer ${env.CF_SFU_APP_SECRET}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  const j=await r.json();if((r.status===404||r.status===410)&&path.endsWith('/tracks/close'))return {};if(!r.ok||j.errorCode){console.error('SFU provider error',r.status,j.errorCode);throw new Error('Voice provider could not complete the connection. Try again.');}return j;
 }
 function state(p){let s=states.get(p);if(!s){s={busy:false,lastRequest:0,pub:null,sub:null,subscriptions:new Map(),trackVersions:new Map(),signature:'',audienceSignature:'',initTimes:[],noticeAt:0,retryAt:0,disposed:false};states.set(p,s);}return s;}
 const validDescription=(d,type)=>d&&d.type===type&&typeof d.sdp==='string'&&d.sdp.length<=48000&&!/m=(video|application) /.test(d.sdp);
 function desired(players,p){return [...players.values()].filter(q=>states.get(q)?.pub?.trackName&&allowed(players,q,p)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).slice(0,16);}
 async function close(session,mids){if(!session||!mids.length)return;const r=await api(`/sessions/${session}/tracks/close`,{tracks:mids.map(mid=>({mid})),force:true},'PUT');if(r.tracks?.some(t=>t.errorCode))throw new Error('Voice track closure failed');}
 async function revoke(players,p,s){
  const selected=new Set(desired(players,p));
  const forbidden=[...s.subscriptions].filter(([mid,q])=>!selected.has(q)||states.get(q)?.pub?.trackName!==s.trackVersions.get(mid));
  if(forbidden.length){await close(s.sub?.id,forbidden.map(([mid])=>mid));for(const [mid]of forbidden){s.subscriptions.delete(mid);s.trackVersions.delete(mid);}}
 }
 return {
  enabled,
  async handle(players,p,m){
   if(m.type!=='voice-rpc')return false;
   const reply=(value)=>send(p.ws,{type:'voice-rpc-result',requestId:m.requestId,...value});
   if(!enabled){reply({error:'Voice service is unavailable.'});return true;}
   const s=state(p);
   if(!Number.isSafeInteger(m.requestId)||s.busy||Date.now()-s.lastRequest<80){reply({error:'Voice is reconnecting. Please retry.'});return true;}
   s.busy=true;s.lastRequest=Date.now();
   try{
    let result={};const kind=m.kind==='pub'?'pub':'sub';
    if(m.op==='init'){
     s.initTimes=s.initTimes.filter(at=>Date.now()-at<30000);if(s.initTimes.length>=10)throw new Error('Too many voice reconnects. Try again shortly.');s.initTimes.push(Date.now());
     if(!validDescription(m.description,'offer'))throw new Error('Invalid voice offer.');
     if(kind==='pub'&&!p.mic || kind==='sub'&&!p.speaker)throw new Error('Enable your microphone or speakers first.');
     const previous=s[kind];
     if(previous){await close(previous.id,kind==='pub'?[previous.mid].filter(Boolean):[...s.subscriptions.keys()]);s[kind]=null;if(kind==='sub'){s.subscriptions.clear();s.trackVersions.clear();}}
     result=await api('/sessions/new',{sessionDescription:m.description});
     if(s.disposed)throw new Error('You have left the city.');
     s[kind]={id:result.sessionId};
     // Session identity is owned here; browser never chooses a provider session to mutate.
     result={sessionDescription:result.sessionDescription};
    }else if(m.op==='publish'){
     if(!s.pub||!p.mic||!validDescription(m.description,'offer')||!/^\d{1,4}$/.test(m.mid))throw new Error('Microphone connection is not ready.');
     const trackName=randomUUID();
     result=await api(`/sessions/${s.pub.id}/tracks/new`,{sessionDescription:m.description,tracks:[{location:'local',mid:m.mid,trackName}]});
     if(result.tracks?.some(t=>t.errorCode))throw new Error('Could not publish microphone.');
     s.pub.mid=m.mid;s.pub.trackName=trackName;
    }else if(m.op==='subscribe'){
     if(!s.sub||!p.speaker)throw new Error('Speakers are off.');
     await revoke(players,p,s);
     const existing=new Set(s.subscriptions.values());const targets=desired(players,p).filter(q=>!existing.has(q));
     if(targets.length){
      result=await api(`/sessions/${s.sub.id}/tracks/new`,{tracks:targets.map(q=>({location:'remote',sessionId:states.get(q).pub.id,trackName:states.get(q).pub.trackName}))});
      result.peers=[];
      for(const track of result.tracks||[]){const q=targets.find(q=>states.get(q)?.pub?.trackName===track.trackName);if(q&&!track.errorCode&&track.mid){s.subscriptions.set(track.mid,q);s.trackVersions.set(track.mid,track.trackName);result.peers.push({mid:track.mid,id:q.id,name:q.name});}}
      // Recheck after the provider await: a player can move or change scope meanwhile.
      await revoke(players,p,s);
     }
    }else if(m.op==='answer'){
     if(!s.sub||!validDescription(m.description,'answer'))throw new Error('Invalid voice answer.');
     result=await api(`/sessions/${s.sub.id}/renegotiate`,{sessionDescription:m.description},'PUT');
    }else if(m.op==='stop'){
     const old=s[kind];if(old)await close(old.id,kind==='pub'?[old.mid].filter(Boolean):[...s.subscriptions.keys()]);s[kind]=null;if(kind==='sub'){s.subscriptions.clear();s.trackVersions.clear();}
    }else throw new Error('Unknown voice operation.');
    if(s.disposed)throw new Error('You have left the city.');
    reply({result});
   }catch(error){reply({error:error.message});}finally{s.busy=false;}
   return true;
  },
  tick(players){if(!enabled)return;const selections=new Map([...players.values()].filter(p=>states.has(p)).map(p=>[p,desired(players,p)]));for(const p of players.values()){
   const s=states.get(p);if(!s)continue;
   const peers=(selections.get(p)||[]).map(q=>({id:q.id,name:q.name,volume:q.micScope==='party'?1:Math.max(0,Math.min(1,(15-Math.hypot(q.x-p.x,q.z-p.z))/10))}));
   if(p.mic){const listeners=[...players.values()].filter(q=>states.get(q)?.sub&&selections.get(q)?.includes(p));const value=JSON.stringify(listeners.map(q=>q.name));if(value!==s.audienceSignature){s.audienceSignature=value;send(p.ws,{type:'voice-audience',count:listeners.length,names:listeners.slice(0,3).map(q=>q.name)});}}
   const signature=JSON.stringify(peers);if(signature!==s.signature){s.signature=signature;send(p.ws,{type:'voice-peers',peers});}
   if(s.busy||Date.now()<s.retryAt)continue;s.busy=true;
   void (async()=>{
    await revoke(players,p,s);
    // Stop a forbidden publisher at the SFU, even if their browser ignores its mic UI.
    if(s.pub?.trackName&&(!p.mic||p.muted||![...players.values()].some(q=>allowed(players,p,q)))){
     // With no listeners, retain the track for quick proximity joins. Subscription
     // revocation above is authoritative; mic-off explicitly closes publication.
     if(!p.mic||p.muted){await close(s.pub.id,[s.pub.mid]);s.pub=null;}
    }
   })().catch(()=>{s.retryAt=Date.now()+2000;if(Date.now()-s.noticeAt>10000){s.noticeAt=Date.now();send(p.ws,{type:'voice-warning',message:'Voice connection is recovering.'});}}).finally(()=>s.busy=false);
  }},
  remove(p){const s=states.get(p);if(!s)return;s.disposed=true;states.delete(p);void Promise.allSettled([close(s.pub?.id,s.pub?.mid?[s.pub.mid]:[]),close(s.sub?.id,[...s.subscriptions.keys()])]);},
 };
}
