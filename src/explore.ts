import {Vector3, type Camera} from 'three';
import {SKY} from '../shared/sky-dining.mjs';
import './explore.css';

export const EXPLORE_PLACES = [
  {id:'wet-deck',name:'Wet Deck',tag:'ABOVE THE CITY',description:'A rooftop pool, skyline views and table games with your geng.',image:'wet-deck',action:'Visit entrance',hint:'Walk to the entrance, then tap Naik Wet Deck to reach the rooftop.',target:{...SKY.entry,y:1},marker:'Rooftop entrance'},
  {id:'15',name:'KLCC',tag:'A DIFFERENT PERSPECTIVE',description:'Take the lift up and see Kuala Lumpur from above.',image:'klcc',action:'Visit KLCC',hint:'Follow the marker to the lift, then tap Naik lif KLCC.',target:{x:-22,y:1,z:-107.8},marker:'KLCC lift'},
  {id:'pantai-senja',name:'Pantai Senja',tag:'TAKE IT SLOW',description:'Sea breeze, sunbeds and a little time to do nothing.',image:'beach',action:'Visit beach',hint:'Follow the marker onto the sand. Find a sunbed or hammock to relax.',target:{x:108,y:1,z:139},marker:'Beach'},
  {id:'21',name:'Pickleball Lepak',tag:'ONE MORE RALLY',description:'Pick up a paddle and play a casual rally near the beach.',image:'pickleball',action:'Visit court',hint:'Walk onto the court, then tap Serve / Pukul to play online.',target:{x:96,y:1,z:115},marker:'Pickleball court'},
  {id:'17',name:'Masjid Kampung Maju',tag:'A MOMENT OF PEACE',description:'Slow down and listen to Quran recitation by the mosque.',image:'mosque',action:'Visit mosque',hint:'Walk towards the mosque. Recitation plays nearby with city sounds enabled.',target:{x:54,y:1,z:117},marker:'Mosque grounds'},
] as const;
export const EXPLORE_TUTORIALS = [
  {id:'afk',number:'01',signal:'AFK',image:'/tutorial/afk.jpg',alt:'Settings panel with an AFK note ready to set',title:'Leave an AFK note',description:'Let the city know you stepped away without disappearing.',steps:['Open Settings with Esc or the gear button.','Write a short message under Note.','Choose Set note. Clear it when you are back.']},
  {id:'dance',number:'02',signal:'10s',image:'/tutorial/dance.jpg',alt:'Player menu showing the Dance for 10 seconds action',title:'Start a dance',description:'Drop a ten-second dance wherever the mood finds you.',steps:['Right-click your own character.','On mobile, press and hold your character.','Choose Dance · 10s. Open the menu again to stop.']},
  {id:'friend',number:'03',signal:'+1',image:'/tutorial/friend.jpg',alt:'Nearby player menu showing the Add friend action',title:'Add someone as a friend',description:'Keep the people you meet around for the next lepak.',steps:['Stand near a player and tap their player action.','Choose Add friend from the menu.','You can also open their profile and add them there.']},
  {id:'clothes',number:'04',signal:'LOOK',image:'/tutorial/clothes.jpg',alt:'Character screen showing clothing colour choices',title:'Change your clothes',description:'Build a look and see every change on your character instantly.',steps:['Open Character with the hanger at the top right.','Choose Body, Hair, Tops, Bottoms or Tudung.','Tap a style or colour. Your look saves automatically.']},
] as const;
type Place = typeof EXPLORE_PLACES[number];
const HINT_KEY='lepak-explore-hint-v1', VISITED_KEY='lepak-experienced-v1';
const read=(key:string)=>{try{return localStorage.getItem(key);}catch{return null;}};
const write=(key:string,value:string)=>{try{localStorage.setItem(key,value);}catch{/* Optional on private browsers. */}};

export function createExplore(options:{releaseInput:()=>void;canOpen:()=>boolean;visit:(id:string)=>string|null;map:()=>void;enableSound:()=>void}) {
  const button=document.createElement('button');button.id='open-explore';button.type='button';button.setAttribute('aria-haspopup','dialog');button.innerHTML='<span aria-hidden="true">✧</span> Explore <small>Jom jalan ↗</small>';
  document.querySelector('#minimap-wrap')!.append(button);
  const teaser=document.createElement('aside');teaser.id='explore-teaser';teaser.hidden=true;teaser.innerHTML='<button type="button" aria-label="Dismiss exploration hint">×</button><strong>Ada lagi!</strong><p>Discover rooftop pools, KLCC views and beach hangouts.</p><button type="button" class="explore-teaser-go">Jom explore ↗</button>';button.after(teaser);
  const dialog=document.createElement('dialog');dialog.id='explore-city';dialog.setAttribute('aria-labelledby','explore-title');
  dialog.innerHTML=`<header><div><small>YOUR CITY, A LITTLE CLOSER</small><h2 id="explore-title">Jom jalan.</h2><p id="explore-subtitle">Find your next favourite spot.</p></div><button type="button" id="close-explore" aria-label="Close Explore">×</button></header>
    <nav class="explore-tabs" role="tablist" aria-label="Explore sections"><button type="button" role="tab" aria-selected="true" aria-controls="explore-places" data-explore-tab="places">Places <span>${String(EXPLORE_PLACES.length).padStart(2,'0')}</span></button><button type="button" role="tab" aria-selected="false" aria-controls="explore-tutorial" data-explore-tab="tutorial">Tutorial <span>${String(EXPLORE_TUTORIALS.length).padStart(2,'0')}</span></button></nav>
    <section id="explore-places" role="tabpanel" data-explore-panel="places"><p id="explore-error" role="status" hidden></p><div class="explore-grid">${EXPLORE_PLACES.map((p,i)=>`<article class="explore-card" data-place="${p.id}"><div class="explore-photo"><img src="/explore/${p.image}.jpg" alt="${p.name} in Lepak Mamak" width="1440" height="960" loading="lazy"><span class="explore-number">0${i+1}</span><span class="explore-visited" hidden>Experienced ✓</span></div><div class="explore-copy"><small>${p.tag}</small><h3>${p.name}</h3><p>${p.description}</p><button type="button" data-visit="${p.id}">${p.action} <span aria-hidden="true">↗</span></button></div></article>`).join('')}</div><footer><span>More corners of the city are waiting.</span><button type="button" id="explore-map">Open full city map ↗</button></footer></section>
    <section id="explore-tutorial" class="explore-tutorial" role="tabpanel" data-explore-panel="tutorial" hidden><div class="tutorial-intro"><div><small>QUICK START · BUILT FOR THE CITY</small><h3>Know the little moves.</h3></div><p>Four useful things you can do right now. We will keep adding guides as the city grows.</p></div><div class="tutorial-grid">${EXPLORE_TUTORIALS.map(t=>`<article class="tutorial-card" data-tutorial="${t.id}"><div class="tutorial-card-top"><span>${t.number}</span><strong aria-hidden="true">${t.signal}</strong></div><figure class="tutorial-shot"><img src="${t.image}" alt="${t.alt}" width="1280" height="800" loading="lazy"></figure><h3>${t.title}</h3><p>${t.description}</p><ol>${t.steps.map(step=>`<li>${step}</li>`).join('')}</ol></article>`).join('')}</div><div class="tutorial-more"><span aria-hidden="true">＋</span><div><strong>More guides coming later.</strong><p>New activities will join this list as LepakMamak grows.</p></div></div></section>`;
  document.body.append(dialog);
  const guide=document.createElement('section');guide.id='explore-guide';guide.hidden=true;guide.innerHTML='<div role="status"><small>JOM JALAN · NEXT STEP</small><strong></strong><p></p></div><button type="button" data-dismiss aria-label="Dismiss destination guide">×</button><button type="button" data-sound hidden>Enable city sounds</button>';document.body.append(guide);
  const marker=document.createElement('div');marker.id='explore-marker';marker.hidden=true;marker.setAttribute('aria-hidden','true');document.body.append(marker);
  const sound=guide.querySelector<HTMLButtonElement>('[data-sound]')!;
  sound.onclick=options.enableSound;
  guide.addEventListener('keydown',event=>event.stopPropagation());
  teaser.addEventListener('keydown',event=>event.stopPropagation());
  let active:Place|undefined,shown=false;
  const title=dialog.querySelector<HTMLElement>('#explore-title')!,subtitle=dialog.querySelector<HTMLElement>('#explore-subtitle')!;
  const showTab=(name:'places'|'tutorial')=>{
    for(const tab of dialog.querySelectorAll<HTMLButtonElement>('[data-explore-tab]'))tab.setAttribute('aria-selected',String(tab.dataset.exploreTab===name));
    for(const panel of dialog.querySelectorAll<HTMLElement>('[data-explore-panel]'))panel.hidden=panel.dataset.explorePanel!==name;
    title.textContent=name==='places'?'Jom jalan.':'Learn the city.';
    subtitle.textContent=name==='places'?'Find your next favourite spot.':'Small moves that make the city yours.';
  };
  for(const tab of dialog.querySelectorAll<HTMLButtonElement>('[data-explore-tab]'))tab.onclick=()=>showTab(tab.dataset.exploreTab as 'places'|'tutorial');
  let visited:string[]=[];try{const value=JSON.parse(read(VISITED_KEY)||'[]');if(Array.isArray(value))visited=value.filter(id=>EXPLORE_PLACES.some(p=>p.id===id));}catch{}
  const refresh=()=>{for(const card of dialog.querySelectorAll<HTMLElement>('.explore-card'))card.querySelector<HTMLElement>('.explore-visited')!.hidden=!visited.includes(card.dataset.place!);};refresh();
  // Aggregate only, on this device; no player identity or location history is collected.
  const record=(step:'open'|'visit'|'experience',id='')=>{const key=`lepak-explore-count:${step}:${id}`,count=Number(read(key));write(key,String((Number.isFinite(count)?count:0)+1));window.dispatchEvent(new CustomEvent('lepak:explore',{detail:{step,id}}));};
  const dismissHint=()=>{teaser.hidden=true;write(HINT_KEY,'1');};
  const close=()=>dialog.close();
  const open=()=>{if(!options.canOpen()||dialog.open)return;options.releaseInput();dismissHint();refresh();dialog.querySelector<HTMLElement>('#explore-error')!.hidden=true;dialog.showModal();document.body.classList.add('explore-open');dialog.querySelector<HTMLButtonElement>('#close-explore')!.focus();record('open');};
  button.onclick=open;
  button.addEventListener('keydown',event=>event.stopPropagation());
  teaser.querySelector('button')!.onclick=dismissHint;teaser.querySelector<HTMLButtonElement>('.explore-teaser-go')!.onclick=open;
  dialog.querySelector<HTMLButtonElement>('#close-explore')!.onclick=close;
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(event.key!=='Tab')return;
    const buttons=[...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b=>b.getClientRects().length);
    const first=buttons[0],last=buttons.at(-1)!;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  dialog.addEventListener('close',()=>{document.body.classList.remove('explore-open');options.releaseInput();button.focus();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  for(const visit of dialog.querySelectorAll<HTMLButtonElement>('[data-visit]'))visit.onclick=()=>{const error=options.visit(visit.dataset.visit!);if(error===null){record('visit',visit.dataset.visit);close();}else{const message=dialog.querySelector<HTMLElement>('#explore-error')!;message.textContent=error;message.hidden=false;message.scrollIntoView({block:'nearest'});}};
  dialog.querySelector<HTMLButtonElement>('#explore-map')!.onclick=()=>{close();options.map();};
  const interaction=document.querySelector('#interaction');
  const clear=()=>{active=undefined;guide.hidden=marker.hidden=true;interaction?.classList.remove('explore-target');};
  guide.querySelector<HTMLButtonElement>('[data-dismiss]')!.onclick=clear;
  const projected=new Vector3();
  return {
    get opened(){return dialog.open;},
    showHint(){if(!shown&&!read(HINT_KEY)&&options.canOpen()){shown=true;teaser.hidden=false;}},
    reset(){clear();close();teaser.hidden=true;},
    arrive(id:string){clear();active=EXPLORE_PLACES.find(p=>p.id===id);if(!active)return;guide.querySelector('strong')!.textContent=active.name;guide.querySelector('p')!.textContent=active.hint;},
    update(state:{visible:boolean;position:{x:number;z:number};camera:Camera;experienced:readonly string[];audioEnabled:boolean;online:boolean}) {
      for(const id of state.experienced){if(!visited.includes(id)){visited.push(id);write(VISITED_KEY,JSON.stringify(visited));record('experience',id);}if(active?.id===id)clear();}
      guide.hidden=marker.hidden=!active||!state.visible;
      interaction?.classList.toggle('explore-target',!!active&&state.visible&&(active.id==='wet-deck'||active.id==='15')&&Math.hypot(state.position.x-active.target.x,state.position.z-active.target.z)<3);
      if(!active||!state.visible)return;
      sound.hidden=active.id!=='17'||state.audioEnabled;
      guide.querySelector('p')!.textContent=active.id==='21'&&!state.online?'Reconnect to the city to play pickleball online.':active.hint;
      marker.hidden=Math.hypot(state.position.x-active.target.x,state.position.z-active.target.z)<3;
      projected.set(active.target.x,active.target.y+2,active.target.z).project(state.camera);
      const behind=projected.z>1;
      const x=behind?(projected.x>0?24:innerWidth-24):(projected.x*.5+.5)*innerWidth;
      const y=behind?innerHeight*.45:(-projected.y*.5+.5)*innerHeight;
      marker.style.left=`${Math.max(85,Math.min(innerWidth-85,x))}px`;marker.style.top=`${Math.max(100,Math.min(innerHeight-210,y))}px`;
      marker.textContent=`${behind?'↶':'◆'} ${active.marker} · ${Math.round(Math.hypot(state.position.x-active.target.x,state.position.z-active.target.z))} m`;
    },
  };
}
