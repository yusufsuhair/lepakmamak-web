// Explicit-image gate for Wall uploads. Fails closed: an unconfigured, unreachable or
// unreadable moderator rejects the upload rather than letting unchecked media reach the
// public bucket. Callers distinguish 'explicit' (the user's photo) from every other
// reason (our outage, or a key we never set) so they can word the response correctly.
const ENDPOINT='https://api.openai.com/v1/moderations',MODEL='omni-moderation-latest',TIMEOUT=10000;
// ponytail: one calibrated flag plus one score floor. Lower SEXUAL_SCORE if explicit
// uploads slip through; per-category tuning only if a single number stops being enough.
const SEXUAL_SCORE=0.5;

export function createImageModerator(options={}){
 const apiKey=options.apiKey??process.env.OPENAI_API_KEY,call=options.fetch||fetch;
 async function check(bytes,mime){
  if(!apiKey)return{safe:false,reason:'unconfigured'};
  let response;
  try{
   response=await call(ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
    body:JSON.stringify({model:MODEL,input:[{type:'image_url',image_url:{url:`data:${mime};base64,${bytes.toString('base64')}`}}]}),
    signal:AbortSignal.timeout(TIMEOUT),
   });
  }catch{return{safe:false,reason:'unreachable'};}
  if(!response.ok)return{safe:false,reason:'unavailable'};
  let payload;
  try{payload=await response.json();}catch{return{safe:false,reason:'unreadable'};}
  const result=payload?.results?.[0];
  if(!result)return{safe:false,reason:'unreadable'};
  const explicit=!!result.categories?.sexual||Number(result.category_scores?.sexual||0)>=SEXUAL_SCORE;
  return explicit?{safe:false,reason:'explicit'}:{safe:true};
 }
 return{check};
}
