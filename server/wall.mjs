import {createClient} from '@supabase/supabase-js';
import crypto from 'node:crypto';
import {filterChat} from './chat-filter.mjs';
import {cleanProfile} from './profiles.mjs';
import {isGameMaster} from './roles.mjs';
import {createImageModerator} from './image-moderation.mjs';
import {clientKey,createRateLimiter} from './limits.mjs';
import {createModeration} from './moderation.mjs';

const BUCKET='social-wall', LIMIT=30, POST_WINDOW=10000;
const MIME={
  'image/jpeg':{type:'image',ext:'jpg',max:4*1024*1024},'image/png':{type:'image',ext:'png',max:4*1024*1024},'image/webp':{type:'image',ext:'webp',max:4*1024*1024},
  'audio/webm':{type:'audio',ext:'webm',max:1536*1024},'audio/ogg':{type:'audio',ext:'ogg',max:1536*1024},'audio/mpeg':{type:'audio',ext:'mp3',max:1536*1024},'audio/mp4':{type:'audio',ext:'m4a',max:1536*1024},
};
function matchesMime(bytes,mime){
 if(mime==='image/png')return bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
 if(mime==='image/jpeg')return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(mime==='image/webp')return bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(mime==='audio/webm')return bytes.length>=4&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
 if(mime==='audio/ogg')return bytes.length>=4&&bytes.toString('ascii',0,4)==='OggS';
 if(mime==='audio/mpeg')return bytes.length>=3&&(bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0));
 if(mime==='audio/mp4')return bytes.length>=12&&bytes.toString('ascii',4,8)==='ftyp';
 return false;
}
import {origins} from '../shared/origins.mjs';
export function cleanWallText(value){const text=typeof value==='string'?value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,500):'';return text?filterChat(text):'';}

export function createWall(services={}){
 const db=services.db||(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY?createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null);
 const onPost=services.onPost||(()=>{}),lastPost=new Map();
 // Anyone may read a profile, but each read spends a Supabase admin call, so the
 // unauthenticated path is capped per caller.
 const profileLimit=services.profileLimit||createRateLimiter({limit:30,windowMs:60000});
 // Sweeping on write keeps the poster clock from growing without bound; entries older
 // than the window cannot deny anyone a post.
 const notePost=(userId,now)=>{if(lastPost.size>5000)for(const [id,at] of lastPost)if(now-at>=POST_WINDOW)lastPost.delete(id);lastPost.set(userId,now);};
 const moderation=services.moderation||createModeration({db});
 const moderateImage=services.moderateImage||createImageModerator().check;
 const publicUrl=path=>path?db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl:null;
 const format=(row,counts={})=>({id:row.id,userId:row.user_id,author:row.author_name,text:row.body,mediaType:row.media_type,mediaUrl:publicUrl(row.media_path),mimeType:row.media_mime,createdAt:row.created_at,gameMaster:!!row.game_master,likeCount:counts.likeCount||0,likedByMe:!!counts.likedByMe,replyCount:counts.replyCount||0});
 const formatReply=row=>({id:row.id,postId:row.post_id,userId:row.user_id,author:row.author_name,text:row.body,gameMaster:!!row.game_master,createdAt:row.created_at});
 const tally=(rows,key)=>{const map=new Map();for(const row of rows)map.set(row[key],(map.get(row[key])||0)+1);return map;};
 async function readBody(request){const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>6*1024*1024)throw Error('POST_TOO_LARGE');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
 async function user(request){const token=request.headers.authorization?.replace(/^Bearer /,'');if(!token) return null;const {data,error}=await db.auth.getUser(token);return error||!data.user||data.user.is_anonymous?null:data.user;}
 function reply(response,status,data){response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(data));}
 async function handle(request,response){
  const url=new URL(request.url,'http://localhost');if(!url.pathname.startsWith('/wall/'))return false;
  const origin=request.headers.origin;if(origin&&origins.has(origin)){response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');response.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');response.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');}
  if(request.method==='OPTIONS'){response.writeHead(origins.has(origin)?204:403);response.end();return true;}if(origin&&!origins.has(origin)){reply(response,403,{error:'Origin not allowed'});return true;}if(!db){reply(response,503,{error:'Wall is not available yet.'});return true;}
  try{
   if(url.pathname==='/wall/posts'&&request.method==='GET'){
    const {data,error}=await db.from('social_posts').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(LIMIT);if(error)throw error;
    const ids=data.map(row=>row.id),viewer=await user(request).catch(()=>null);
    const {data:likeRows}=ids.length?await db.from('social_post_likes').select('post_id,user_id').in('post_id',ids):{data:[]};
    const {data:replyRows}=ids.length?await db.from('social_post_replies').select('post_id').in('post_id',ids):{data:[]};
    const likeCounts=tally(likeRows||[],'post_id'),replyCounts=tally(replyRows||[],'post_id');
    const likedSet=new Set(viewer?(likeRows||[]).filter(row=>row.user_id===viewer.id).map(row=>row.post_id):[]);
    reply(response,200,{posts:data.map(row=>format(row,{likeCount:likeCounts.get(row.id)||0,likedByMe:likedSet.has(row.id),replyCount:replyCounts.get(row.id)||0}))});return true;
   }
   const profileMatch=url.pathname.match(/^\/wall\/profile\/([0-9a-f-]{36})$/i);
   if(profileMatch&&request.method==='GET'){if(!profileLimit(clientKey(request))){reply(response,429,{error:'Too many profile requests. Try again shortly.'});return true;}const {data,error}=await db.auth.admin.getUserById(profileMatch[1]);if(error||!data.user){reply(response,404,{error:'Profile not found.'});return true;}reply(response,200,{profile:{id:data.user.id,name:String(data.user.user_metadata?.display_name||'Player').slice(0,18),registered:true,gameMaster:isGameMaster(data.user),details:cleanProfile(data.user.user_metadata?.profile)}});return true;}
   const repliesMatch=url.pathname.match(/^\/wall\/posts\/([0-9a-f-]{36})\/replies$/i);
   if(repliesMatch&&request.method==='GET'){const {data,error}=await db.from('social_post_replies').select('*').eq('post_id',repliesMatch[1]).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(50);if(error)throw error;reply(response,200,{replies:data.map(formatReply)});return true;}
   const account=await user(request);if(!account){reply(response,401,{error:'Sign in with an account to post.'});return true;}
   // The Wall is the one live surface that never touches the socket, so the socket's mute
   // gate cannot see it. Anything that puts a player's own words or media in front of
   // others is checked here; liking is not content, so it is left alone. Account moderation
   // still fails closed because it is an authorization decision, independent of image review.
   if(request.method==='POST'&&!/\/like$/.test(url.pathname)){
    let penalty;
    try{penalty=await moderation.status(account.id);}catch{reply(response,503,{error:'Could not check your account right now. Please try again in a moment.'});return true;}
    if(penalty.banned){reply(response,403,{error:'Your account is suspended from LepakMamak.'});return true;}
    if(penalty.muted){reply(response,403,{error:'You are muted, so this did not post.'});return true;}
   }
   if(url.pathname==='/wall/posts'&&request.method==='POST'){
    const now=Date.now();if(now-(lastPost.get(account.id)||0)<POST_WINDOW){reply(response,429,{error:'Wait a moment before posting again.'});return true;}
    const input=await readBody(request),body=cleanWallText(input.text);let mediaPath=null,mediaType=null,mediaMime=null;
    if(input.data||input.mimeType){const spec=MIME[input.mimeType];if(!spec||typeof input.data!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)){reply(response,400,{error:'Unsupported media.'});return true;}const bytes=Buffer.from(input.data,'base64');if(!bytes.length||bytes.length>spec.max){reply(response,413,{error:spec.type==='image'?'Image must be 4 MB or smaller.':'Voice note must be 1.5 MB or smaller.'});return true;}if(!matchesMime(bytes,input.mimeType)){reply(response,400,{error:'The file content does not match its media type.'});return true;}
     // A successful explicit verdict is the only image moderation result that blocks a post.
     // OpenAI outages must not make the Wall unusable: missing credentials, billing/403
     // responses, timeouts, malformed payloads and thrown provider errors all fall through
     // to the normal upload path. The moderator itself still reports those failures so they
     // remain observable and can be fixed without changing this user-facing fallback.
     if(spec.type==='image'){
      let verdict;
      try{verdict=await moderateImage(bytes,input.mimeType);}catch{verdict={safe:false,reason:'provider-error'};}
      if(verdict?.reason==='explicit'){reply(response,422,{error:'That photo looks explicit. Keep the Wall family friendly.'});return true;}
     }
     mediaType=spec.type;mediaMime=input.mimeType;mediaPath=`${account.id}/${now}-${crypto.randomUUID()}.${spec.ext}`;const uploaded=await db.storage.from(BUCKET).upload(mediaPath,bytes,{contentType:mediaMime,cacheControl:'31536000',upsert:false});if(uploaded.error)throw uploaded.error;}
    if(!body&&!mediaPath){reply(response,400,{error:'Write something or attach media.'});return true;}
    const author=String(account.user_metadata?.display_name||'Player').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,18)||'Player';
    const inserted=await db.from('social_posts').insert({user_id:account.id,author_name:author,body,media_path:mediaPath,media_type:mediaType,media_mime:mediaMime,game_master:isGameMaster(account)}).select('*').single();if(inserted.error){if(mediaPath)await db.storage.from(BUCKET).remove([mediaPath]);throw inserted.error;}notePost(account.id,now);const post=format(inserted.data);onPost(post);reply(response,201,{post});return true;
   }
   const likeMatch=url.pathname.match(/^\/wall\/posts\/([0-9a-f-]{36})\/like$/i);
   if(likeMatch&&request.method==='POST'){
    const postId=likeMatch[1],existing=await db.from('social_post_likes').select('post_id').eq('post_id',postId).eq('user_id',account.id).single();
    let liked;
    if(!existing.error&&existing.data){const removed=await db.from('social_post_likes').delete().eq('post_id',postId).eq('user_id',account.id);if(removed.error)throw removed.error;liked=false;}
    else{const inserted=await db.from('social_post_likes').insert({post_id:postId,user_id:account.id});if(inserted.error){reply(response,404,{error:'Post not found.'});return true;}liked=true;}
    const counted=await db.from('social_post_likes').select('post_id').eq('post_id',postId);if(counted.error)throw counted.error;
    reply(response,200,{liked,likeCount:(counted.data||[]).length});return true;
   }
   if(repliesMatch&&request.method==='POST'){
    const postId=repliesMatch[1],now=Date.now();if(now-(lastPost.get(account.id)||0)<POST_WINDOW){reply(response,429,{error:'Wait a moment before posting again.'});return true;}
    const input=await readBody(request),body=cleanWallText(input.text);if(!body){reply(response,400,{error:'Write a reply first.'});return true;}
    const author=String(account.user_metadata?.display_name||'Player').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,18)||'Player';
    const inserted=await db.from('social_post_replies').insert({post_id:postId,user_id:account.id,author_name:author,body,game_master:isGameMaster(account)}).select('*').single();if(inserted.error){reply(response,404,{error:'Post not found.'});return true;}
    notePost(account.id,now);reply(response,201,{reply:formatReply(inserted.data)});return true;
   }
   const postMatch=url.pathname.match(/^\/wall\/posts\/([0-9a-f-]{36})$/i);
   if(postMatch&&request.method==='DELETE'){const found=await db.from('social_posts').select('user_id,media_path').eq('id',postMatch[1]).single();if(found.error){reply(response,404,{error:'Post not found.'});return true;}if(found.data.user_id!==account.id){reply(response,403,{error:'You can only delete your own post.'});return true;}const removed=await db.from('social_posts').delete().eq('id',postMatch[1]);if(removed.error)throw removed.error;if(found.data.media_path)await db.storage.from(BUCKET).remove([found.data.media_path]);reply(response,200,{deleted:true,id:postMatch[1]});return true;}
   reply(response,405,{error:'Method not allowed'});
  }catch(error){reply(response,error?.message==='POST_TOO_LARGE'?413:500,{error:error?.message==='POST_TOO_LARGE'?'Upload is too large.':'Could not complete this wall request.'});return true;}
 }
 return{handle};
}
