import places from '../shared/places.json';

const kinds:Record<string,string>={mercu:'Landmark',zoo:'City attraction',kedai:'Shop',bank:'Bank',hotel:'Hotel',civic:'Community',lepak:'Hangout',gerai:'Street food',minyak:'Petrol station',ibadah:'Place of worship',sukan:'Sports'};

export function locationAt(x:number,z:number){
 const nearby=places.map(place=>({place,distance:Math.hypot(x-place.x,z-place.z)})).filter(item=>item.distance<=16).sort((a,b)=>a.distance-b.distance)[0]?.place;
 if(nearby)return{key:`place:${nearby.id}`,name:nearby.name,subtitle:kinds[nearby.kind]||'Landmark'};
 const name=z < -74?'KLCC Park':z < 9?'Jalan Lepak':'Kampung Maju';
 return{key:`district:${name}`,name,subtitle:'District'};
}

const VISITED_KEY='lepak-visited';

// Rising three-note sting; own context so arrivals work before the world audio graph exists.
function createArrivalSting(){
 let context:AudioContext|undefined;
 const unlock=()=>{try{context??=new AudioContext();void context.resume().catch(()=>{});}catch{}};
 document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 return()=>{
  if(context?.state!=='running')return;const now=context.currentTime;
  [523.25,784,1046.5].forEach((frequency,index)=>{
   const at=now+index*.1,oscillator=context!.createOscillator(),gain=context!.createGain();
   oscillator.type='triangle';oscillator.frequency.value=frequency;
   gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(.055,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.42);
   oscillator.connect(gain);gain.connect(context!.destination);oscillator.start(at);oscillator.stop(at+.44);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  });
 };
}

export function setupLocationArrival(suppressInitial=false){
 const banner=document.createElement('div');banner.id='location-arrival';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.innerHTML='<small></small><strong></strong><i></i>';document.body.append(banner);
 let visited:Set<string>;try{visited=new Set<string>(JSON.parse(localStorage.getItem(VISITED_KEY)||'[]'));}catch{visited=new Set<string>();}
 const sting=createArrivalSting();
 let current='',timer:ReturnType<typeof setTimeout>|undefined,suppressNext=suppressInitial;
 return{
  update(x:number,z:number,enabled=true,soundEnabled=true){
   if(!enabled)return;
   const location=locationAt(x,z);if(location.key===current)return;current=location.key;
   if(suppressNext){suppressNext=false;return;}
   const first=!visited.has(location.key);
   if(first){visited.add(location.key);try{localStorage.setItem(VISITED_KEY,JSON.stringify([...visited]));}catch{}}
   banner.querySelector('small')!.textContent=first?`Discovered · ${location.subtitle}`:location.subtitle;
   banner.querySelector('strong')!.textContent=location.name;
   banner.classList.toggle('known',!first);
   banner.classList.remove('visible');void banner.offsetWidth;banner.classList.add('visible');
   if(first){if(soundEnabled)sting();try{navigator.vibrate?.([14,44,24]);}catch{}}
   clearTimeout(timer);timer=setTimeout(()=>banner.classList.remove('visible'),first?3600:1800);
  },
  reset(){current='';suppressNext=suppressInitial;clearTimeout(timer);banner.classList.remove('visible');}
 };
}
