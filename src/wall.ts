import {guestName,session} from './auth';
import {renderProfile,type PlayerProfile} from './profile';

export type WallPost={id:string;userId:string;author:string;text:string;mediaType:'image'|'audio'|null;mediaUrl:string|null;mimeType:string|null;createdAt:string;gameMaster:boolean;likeCount:number;likedByMe:boolean;replyCount:number};
export type WallReply={id:string;postId:string;userId:string;author:string;text:string;gameMaster:boolean;createdAt:string};
const MAX_IMAGE=4*1024*1024,MAX_VOICE=1536*1024;
function apiBase(endpoint:string){return endpoint.replace(/^ws/i,'http').replace(/\/ws\/?$/,'').replace(/\/$/,'');}
function dataUrl(file:Blob){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('Could not read this file.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.readAsDataURL(file);});}
function timeLabel(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?'Just now':new Intl.DateTimeFormat('en-MY',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kuala_Lumpur'}).format(date);}

export function setupWall(endpoint:string,releaseInput:()=>void){
 const base=apiBase(endpoint),dialog=document.createElement('dialog');dialog.id='social-wall';dialog.setAttribute('aria-labelledby','wall-title');
 dialog.innerHTML=`<div class="wall-shell"><header><div><span class="wall-kicker">LEPAKMAMAK SOCIAL</span><h2 id="wall-title">The Lepak Wall.</h2><p>What is happening around the city?</p></div><button id="wall-close" type="button" aria-label="Close wall">Close ×</button></header><section id="wall-composer"><label for="wall-text">Share with the city</label><textarea id="wall-text" maxlength="500" placeholder="Cerita sikit…"></textarea><div id="wall-media-preview" hidden></div><div class="wall-compose-actions"><label class="wall-attach">📷 Photo<input id="wall-image" type="file" accept="image/jpeg,image/png,image/webp" /></label><button id="wall-record" type="button">🎙 Voice note</button><button id="wall-post" type="button">Post</button></div><small id="wall-compose-status" role="status">Text, photo up to 4 MB, or a 30-second voice note.</small></section><section id="wall-board" aria-labelledby="wall-board-title"><h3 id="wall-board-title">Papan minggu ini</h3><p id="wall-board-week"></p><div id="wall-board-lists"></div></section><section class="wall-feed-head"><h3>City feed</h3><button id="wall-refresh" type="button">Refresh</button></section><div id="wall-feed" aria-live="polite"></div></div>`;
 const profile=document.createElement('dialog');profile.id='wall-profile';profile.setAttribute('aria-labelledby','wall-profile-name');profile.innerHTML='<h2 id="wall-profile-name">Player profile</h2><div id="wall-profile-details"></div><button id="wall-profile-close" type="button">Close</button>';
 document.body.append(dialog,profile);
 const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
 const feed=el('wall-feed'),composer=el('wall-composer'),status=el('wall-compose-status'),text=el<HTMLTextAreaElement>('wall-text'),image=el<HTMLInputElement>('wall-image'),preview=el('wall-media-preview'),record=el<HTMLButtonElement>('wall-record'),postButton=el<HTMLButtonElement>('wall-post');
 let posts:WallPost[]=[],busy=false,unread=0,imageFile:File|null=null,voiceBlob:Blob|null=null,recorder:MediaRecorder|null=null,stream:MediaStream|null=null,recordTimer:number|null=null,recordStarted=0,previewUrl='';
 const expandedReplies=new Set<string>(),replyCache=new Map<string,WallReply[]>(),pendingLikes=new Set<string>();
 const badge=el('wall-unread');
 function token(){return !guestName&&session?.access_token||'';}
 async function request<T>(path:string,options:RequestInit={}){if(!base)throw Error('Wall is unavailable in solo mode.');const headers=new Headers(options.headers);headers.set('Content-Type','application/json');const access=token();if(access)headers.set('Authorization',`Bearer ${access}`);const response=await fetch(`${base}${path}`,{...options,headers});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Could not reach the Wall.');return data as T;}
 function setPreview(blob:Blob|null,kind:'image'|'audio'|null){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';preview.replaceChildren();preview.hidden=!blob;if(!blob||!kind)return;previewUrl=URL.createObjectURL(blob);if(kind==='image'){const img=document.createElement('img');img.src=previewUrl;img.alt='Selected photo preview';preview.append(img);}else{const audio=document.createElement('audio');audio.controls=true;audio.src=previewUrl;preview.append(audio);}const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>{imageFile=null;voiceBlob=null;image.value='';setPreview(null,null);};preview.append(remove);}
 function renderGmBadge(small=false){const badge=document.createElement('span');badge.className=small?'wall-gm-badge wall-gm-badge-small':'wall-gm-badge';badge.textContent='✦ GM ✦';return badge;}
 function renderReplies(item:WallPost,card:HTMLElement,registered:boolean){
  if(!expandedReplies.has(item.id))return;
  const thread=document.createElement('div');thread.className='wall-reply-thread';
  const list=replyCache.get(item.id);
  if(!list){thread.innerHTML='<p class="wall-reply-loading">Loading replies…</p>';card.append(thread);return;}
  if(!list.length){const empty=document.createElement('p');empty.className='wall-reply-empty';empty.textContent='No replies yet.';thread.append(empty);}
  for(const entry of list){const row=document.createElement('div');row.className='wall-reply';const head=document.createElement('span');head.className='wall-reply-author';head.textContent=entry.author;if(entry.gameMaster)head.append(renderGmBadge(true));const text=document.createElement('span');text.className='wall-reply-text';text.textContent=entry.text;row.append(head,text);thread.append(row);}
  if(registered){const composer=document.createElement('form');composer.className='wall-reply-composer';const input=document.createElement('input');input.type='text';input.maxLength=500;input.placeholder='Reply…';const send=document.createElement('button');send.type='submit';send.textContent='Reply';composer.append(input,send);composer.onsubmit=event=>{event.preventDefault();void postReply(item,input,send);};thread.append(composer);}
  card.append(thread);
 }
 function render(){
  feed.replaceChildren();
  if(!posts.length){const empty=document.createElement('div');empty.className='wall-empty';empty.innerHTML='<strong>Belum ada cerita.</strong><span>Be the first person to post on the Wall.</span>';feed.append(empty);return;}
  const registered=!!session&&!guestName;
  for(const item of posts){
   const card=document.createElement('article');card.className='wall-post';card.dataset.id=item.id;
   const head=document.createElement('header');const nameRow=document.createElement('div');nameRow.className='wall-author-row';
   const author=document.createElement('button');author.type='button';author.className='wall-author';author.textContent=item.author;author.onclick=()=>void openProfile(item);
   nameRow.append(author);if(item.gameMaster)nameRow.append(renderGmBadge());
   const time=document.createElement('time');time.dateTime=item.createdAt;time.textContent=timeLabel(item.createdAt);
   head.append(nameRow,time);card.append(head);
   if(item.text){const body=document.createElement('p');body.textContent=item.text;card.append(body);}
   if(item.mediaType==='image'&&item.mediaUrl){const media=document.createElement('img');media.className='wall-photo';media.src=item.mediaUrl;media.alt=`Photo posted by ${item.author}`;media.loading='lazy';card.append(media);}
   if(item.mediaType==='audio'&&item.mediaUrl){const voice=document.createElement('div');voice.className='wall-voice';voice.innerHTML='<span>🎙 Voice note</span>';const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=item.mediaUrl;voice.append(audio);card.append(voice);}
   const actions=document.createElement('div');actions.className='wall-actions';
   const like=document.createElement('button');like.type='button';like.className='wall-like';like.classList.toggle('liked',item.likedByMe);like.disabled=!registered||pendingLikes.has(item.id);like.innerHTML=`<span>${item.likedByMe?'❤':'🤍'}</span> ${item.likeCount}`;like.onclick=()=>void toggleLike(item);
   const replyToggle=document.createElement('button');replyToggle.type='button';replyToggle.className='wall-reply-toggle';replyToggle.textContent=`💬 ${item.replyCount} ${item.replyCount===1?'reply':'replies'}`;replyToggle.onclick=()=>void toggleReplies(item);
   actions.append(like,replyToggle);card.append(actions);
   renderReplies(item,card,registered);
   if(item.userId===session?.user.id&&!guestName){const remove=document.createElement('button');remove.type='button';remove.className='wall-delete';remove.textContent='Delete';remove.onclick=()=>void removePost(item,remove);card.append(remove);}
   feed.append(card);
  }
 }
 async function toggleLike(item:WallPost){
  if(!session||guestName||pendingLikes.has(item.id))return;
  pendingLikes.add(item.id);render();
  try{const result=await request<{liked:boolean;likeCount:number}>(`/wall/posts/${item.id}/like`,{method:'POST'});item.likedByMe=result.liked;item.likeCount=result.likeCount;}
  catch(error){status.textContent=error instanceof Error?error.message:'Could not update like.';}
  finally{pendingLikes.delete(item.id);render();}
 }
 async function toggleReplies(item:WallPost){
  if(expandedReplies.has(item.id)){expandedReplies.delete(item.id);render();return;}
  expandedReplies.add(item.id);render();
  if(replyCache.has(item.id))return;
  try{const result=await request<{replies:WallReply[]}>(`/wall/posts/${item.id}/replies`);replyCache.set(item.id,result.replies);}
  catch{replyCache.set(item.id,[]);}
  render();
 }
 async function postReply(item:WallPost,input:HTMLInputElement,button:HTMLButtonElement){
  const text=input.value.trim();if(!text||button.disabled)return;
  button.disabled=true;input.disabled=true;
  try{const result=await request<{reply:WallReply}>(`/wall/posts/${item.id}/replies`,{method:'POST',body:JSON.stringify({text})});const list=replyCache.get(item.id)||[];list.push(result.reply);replyCache.set(item.id,list);item.replyCount++;render();}
  catch(error){status.textContent=error instanceof Error?error.message:'Could not reply.';button.disabled=false;input.disabled=false;}
 }
 async function openProfile(item:WallPost){el('wall-profile-name').textContent=item.author;el('wall-profile-details').textContent='Loading profile…';profile.showModal();try{const result=await request<{profile:PlayerProfile}>(`/wall/profile/${item.userId}`);renderProfile(el('wall-profile-details'),result.profile);}catch(error){el('wall-profile-details').textContent=error instanceof Error?error.message:'Could not load profile.';}}
 async function removePost(item:WallPost,button:HTMLButtonElement){button.disabled=true;try{await request(`/wall/posts/${item.id}`,{method:'DELETE'});posts=posts.filter(value=>value.id!==item.id);render();}catch(error){status.textContent=error instanceof Error?error.message:'Could not delete post.';button.disabled=false;}}
 async function refresh(){feed.setAttribute('aria-busy','true');if(!posts.length)feed.innerHTML='<div class="wall-empty"><strong>Loading the city feed…</strong></div>';try{const result=await request<{posts:WallPost[]}>('/wall/posts');posts=result.posts;render();}catch(error){feed.innerHTML='';const empty=document.createElement('div');empty.className='wall-empty';empty.textContent=error instanceof Error?error.message:'Could not load the Wall.';feed.append(empty);}finally{feed.removeAttribute('aria-busy');}}
 function stopRecording(){if(recordTimer!==null){clearTimeout(recordTimer);recordTimer=null;}if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());stream=null;record.textContent='🎙 Voice note';record.classList.remove('recording');}
 async function toggleRecording(){if(recorder?.state==='recording'){stopRecording();return;}if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){status.textContent='Voice notes are not supported in this browser.';return;}try{imageFile=null;image.value='';setPreview(null,null);stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(value=>MediaRecorder.isTypeSupported(value));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);const chunks:Blob[]=[];recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.onstop=()=>{const blob=new Blob(chunks,{type:(recorder?.mimeType||'audio/webm').split(';')[0]});if(blob.size>MAX_VOICE){voiceBlob=null;status.textContent='Voice note is too large. Keep it under 30 seconds.';}else{voiceBlob=blob;setPreview(blob,'audio');status.textContent='Voice note ready to post.';}record.textContent='🎙 Voice note';record.classList.remove('recording');};recorder.start(250);recordStarted=Date.now();record.classList.add('recording');const tick=()=>{if(recorder?.state!=='recording')return;record.textContent=`■ Stop · ${Math.min(30,Math.floor((Date.now()-recordStarted)/1000))}s`;recordTimer=window.setTimeout(tick,500);};tick();window.setTimeout(()=>{if(recorder?.state==='recording')stopRecording();},30000);}catch{stream?.getTracks().forEach(track=>track.stop());stream=null;status.textContent='Microphone permission is needed to record a voice note.';}}
 image.onchange=()=>{const file=image.files?.[0]||null;if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>MAX_IMAGE){image.value='';status.textContent='Choose a JPG, PNG or WebP image up to 4 MB.';return;}stopRecording();voiceBlob=null;imageFile=file;setPreview(file,'image');status.textContent='Photo ready to post.';};record.onclick=()=>void toggleRecording();
 postButton.onclick=async()=>{if(busy)return;const body=text.value.trim();const media=imageFile||voiceBlob;if(!body&&!media){status.textContent='Write something or attach media first.';return;}busy=true;postButton.disabled=true;status.textContent='Posting…';try{const payload:{text:string;mimeType?:string;data?:string}={text:body};if(media){payload.mimeType=(media.type||'audio/webm').split(';')[0];payload.data=await dataUrl(media);}const result=await request<{post:WallPost}>('/wall/posts',{method:'POST',body:JSON.stringify(payload)});posts=[result.post,...posts.filter(item=>item.id!==result.post.id)].slice(0,30);text.value='';imageFile=null;voiceBlob=null;image.value='';setPreview(null,null);status.textContent='Posted to the city.';render();}catch(error){status.textContent=error instanceof Error?error.message:'Could not post.';}finally{busy=false;postButton.disabled=false;}};
 function account(){const registered=!!session&&!guestName;composer.classList.toggle('wall-guest',!registered);for(const control of composer.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLButtonElement>('textarea,input,button'))control.disabled=!registered;status.textContent=registered?'Text, photo up to 4 MB, or a 30-second voice note.':'Sign in with an account to post. Guests can read the Wall.';}
 function updateBadge(){badge.textContent=unread>9?'9+':String(unread);badge.hidden=!unread;}
 function close(){stopRecording();if(dialog.open)dialog.close();}
 el('wall-close').onclick=close;el('wall-refresh').onclick=()=>void refresh();el('wall-profile-close').onclick=()=>profile.close();dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('keydown',event=>event.stopPropagation());profile.addEventListener('keydown',event=>event.stopPropagation());
 // The weekly board is read when the Wall is opened, never pushed: a number nobody is
 // looking at does not need to be live, and per-frame broadcast is what costs bandwidth.
 // Only two counters are ranked. Punches are player-versus-player and a public ranking of
 // them rewards what it counts; recalls, dances and sessions are farmable alone in a corner.
 const BOARD_TITLES:Record<string,string>={basketball_points:'Basketball',tables_sat:'Lepak di meja'};
 async function loadBoard(){
  const lists=el('wall-board-lists'),when=el('wall-board-week');
  try{
   const data=await request<{weekStart:string;boards:Record<string,{name:string;value:number}[]>}>('/leaderboard');
   when.textContent=`Bermula Isnin ${new Intl.DateTimeFormat('en-MY',{dateStyle:'medium',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(`${data.weekStart}T00:00:00+08:00`))} · reset setiap Isnin`;
   lists.replaceChildren();
   for(const [field,title] of Object.entries(BOARD_TITLES)){
    const column=document.createElement('div');column.className='wall-board-column';
    const heading=document.createElement('h4');heading.textContent=title;column.append(heading);
    const rows=data.boards?.[field]||[];
    if(!rows.length){const empty=document.createElement('p');empty.className='wall-board-empty';empty.textContent='Belum ada sesiapa minggu ini.';column.append(empty);}
    else{
     const list=document.createElement('ol');
     for(const row of rows){const entry=document.createElement('li');const who=document.createElement('b');who.textContent=row.name;const score=document.createElement('span');score.textContent=String(row.value);entry.append(who,score);list.append(entry);}
     column.append(list);
    }
    lists.append(column);
   }
  }catch{when.textContent='Papan tidak dapat dimuatkan sekarang.';}
 }
 return{get opened(){return dialog.open||profile.open;},close,account,open(){releaseInput();account();unread=0;updateBadge();if(!dialog.open)dialog.showModal();void refresh();void loadBoard();},receive(item:WallPost){posts=[item,...posts.filter(value=>value.id!==item.id)].slice(0,30);if(dialog.open)render();else{unread++;updateBadge();}}};
}
