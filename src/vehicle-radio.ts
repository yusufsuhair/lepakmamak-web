/** Original procedural instrumental, composed for LepakMamak; no sampled recordings. */
export function setupVehicleRadio(){
 let context:AudioContext|undefined,gain:GainNode|undefined,source:AudioBufferSourceNode|undefined,active=false,timer:ReturnType<typeof setTimeout>|undefined;
 const notice=document.createElement('div');notice.id='vehicle-radio';notice.setAttribute('role','status');notice.innerHTML='<small>LEPAK FM · NOW PLAYING</small><strong>Jalan Malam</strong><span>LepakMamak Original · Instrumental</span>';document.body.append(notice);
 function init(){
  if(context)return;
  context=new AudioContext();gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);
  const rate=context.sampleRate,beat=60/96,duration=32*beat,buffer=context.createBuffer(1,Math.ceil(duration*rate),rate),data=buffer.getChannelData(0);
  const note=(at:number,length:number,midi:number,volume:number)=>{const f=440*2**((midi-69)/12);for(let i=0,n=Math.floor(length*rate);i<n;i++){const index=Math.floor(at*rate)+i;if(index>=data.length)break;const t=i/rate,envelope=Math.min(1,t/.012)*Math.exp(-t/(length*.32))*Math.min(1,(length-t)/.06);data[index]+=volume*envelope*(Math.sin(2*Math.PI*f*t)+.2*Math.sin(4*Math.PI*f*t));}};
  const chords=[[45,48,52],[41,45,48],[48,52,55],[43,47,50]];
  for(let b=0;b<32;b++){
   const chord=chords[Math.floor(b/4)%4];note(b*beat,beat*.8,chord[0]-12,.12);
   if(b%2===0)for(const pitch of chord)note(b*beat,beat*1.8,pitch+12,.035);
   note((b+.5)*beat,beat*.42,chord[(b*2+1)%3]+24,.038);
   for(let i=0;i<rate*.13;i++){const index=Math.floor(b*beat*rate)+i,t=i/rate;if(index<data.length)data[index]+=.14*Math.sin(2*Math.PI*(48*t+3*(1-Math.exp(-t*35))))*Math.exp(-t*34);}
   for(const offset of [.0,.5])for(let i=0;i<rate*.035;i++){const index=Math.floor((b+offset)*beat*rate)+i;if(index<data.length)data[index]+=(Math.random()*2-1)*.018*Math.exp(-i/rate*130);}
  }
  source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(gain);source.start();
  if(active)gain.gain.setTargetAtTime(.32,context.currentTime,.35);
 }
 const unlock=()=>{try{init();void context?.resume().catch(()=>{});}catch{/* Browser audio unavailable. */}};
 document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 return{update(playing:boolean){
  if(playing===active)return;active=playing;
  if(gain&&context){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setTargetAtTime(playing?.32:0,context.currentTime,.35);}
  clearTimeout(timer);notice.classList.remove('visible');
  if(playing&&context?.state==='running'){notice.classList.add('visible');timer=setTimeout(()=>notice.classList.remove('visible'),4500);}
 }};
}
