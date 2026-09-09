import places from '../shared/places.json';

const kinds:Record<string,string>={mercu:'Landmark',kedai:'Shop',bank:'Bank',hotel:'Hotel',civic:'Community',lepak:'Hangout',gerai:'Street food',minyak:'Petrol station',ibadah:'Place of worship',sukan:'Sports'};

export function locationAt(x:number,z:number){
 const nearby=places.map(place=>({place,distance:Math.hypot(x-place.x,z-place.z)})).filter(item=>item.distance<=16).sort((a,b)=>a.distance-b.distance)[0]?.place;
 if(nearby)return{key:`place:${nearby.id}`,name:nearby.name,subtitle:kinds[nearby.kind]||'Landmark'};
 const name=z < -74?'KLCC Park':z < 9?'Jalan Lepak':'Kampung Maju';
 return{key:`district:${name}`,name,subtitle:'District'};
}

export function setupLocationArrival(){
 const banner=document.createElement('div');banner.id='location-arrival';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.innerHTML='<small></small><strong></strong><i></i>';document.body.append(banner);
 let current='',timer:ReturnType<typeof setTimeout>|undefined;
 return{
  update(x:number,z:number,enabled=true){
   if(!enabled)return;
   const location=locationAt(x,z);if(location.key===current)return;current=location.key;
   banner.querySelector('small')!.textContent=location.subtitle;banner.querySelector('strong')!.textContent=location.name;
   banner.classList.remove('visible');void banner.offsetWidth;banner.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>banner.classList.remove('visible'),3600);
  },
  reset(){current='';clearTimeout(timer);banner.classList.remove('visible');}
 };
}
