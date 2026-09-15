import places from '../shared/places.json';
import './city-directory.css';
const categories:Record<string,string>={lrt:'LRT stations',mercu:'Landmarks',zoo:'Attractions',kedai:'Shops',bank:'Banks',hotel:'Hotels',civic:'Community',lepak:'Hangouts',gerai:'Food stalls',minyak:'Petrol station',ibadah:'Place of worship',sukan:'Sports'};
type Label={id:string;x:number;y:number;w:number;h:number;lines:string[];place:typeof places[number]};
export function mapLabels(ctx:CanvasRenderingContext2D){
 ctx.font='600 5px sans-serif';const result:Label[]=[];
 for(const place of places){const words=(`${place.id} · ${place.name}`).split(' '),lines:string[]=[''];for(const word of words){const i=lines.length-1;if(ctx.measureText(`${lines[i]} ${word}`).width>53&&lines[i])lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}
  const w=Math.max(...lines.map(l=>ctx.measureText(l).width))+5,h=lines.length*6+4;let candidate:{x:number;y:number}|undefined;
  for(const radius of [12,22,34,48,64,82,106,132]){for(const angle of [-Math.PI/2,Math.PI/2,0,Math.PI, -Math.PI/4,Math.PI/4,3*Math.PI/4,-3*Math.PI/4]){const x=Math.max(-535,Math.min(167-w,place.x+Math.cos(angle)*radius-w/2)),y=Math.max(-300,Math.min(190-h,place.z+Math.sin(angle)*radius-h/2));if(!result.some(b=>x<b.x+b.w+2&&x+w+2>b.x&&y<b.y+b.h+2&&y+h+2>b.y)){candidate={x,y};break;}}if(candidate)break;}
  const at=candidate||{x:place.x-w/2,y:place.z+8};result.push({id:place.id,...at,w,h,lines,place});
 }return result;
}
export function drawPlaceLabels(ctx:CanvasRenderingContext2D,labels:Label[],selected:string){
 ctx.save();ctx.font='600 5px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
 for(const b of labels){const chosen=b.id===selected;ctx.strokeStyle=chosen?'#ffe09a':'#b7cabb';ctx.lineWidth=chosen?.7:.35;ctx.beginPath();ctx.moveTo(b.place.x,b.place.z);ctx.lineTo(b.x+b.w/2,b.y+b.h/2);ctx.stroke();ctx.fillStyle=chosen?'#ffe09a':'#f4f0df';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle='#193f35';b.lines.forEach((line,i)=>ctx.fillText(line,b.x+2.5,b.y+2+i*6));}
 ctx.restore();
}
export function setupCityDirectory(root:HTMLElement,canvas:HTMLCanvasElement,select:(id:string)=>void){
 root.closest('dialog')?.classList.add('city-directory-map');
 const buttons=new Map<string,HTMLButtonElement>();const labels=mapLabels(canvas.getContext('2d')!);
 const searchWrap=document.createElement('div');searchWrap.className='city-directory-search';
 const search=document.createElement('input');search.type='search';search.placeholder='Search shops & places';search.setAttribute('aria-label','Search shops and places');search.autocomplete='off';search.spellcheck=false;
 const empty=document.createElement('p');empty.className='city-directory-empty';empty.textContent='No places found';empty.hidden=true;searchWrap.append(search);root.append(searchWrap);
 const sections:HTMLElement[]=[];
 for(const [kind,title] of Object.entries(categories)){const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent=title;section.dataset.search=title.toLowerCase();section.append(heading);for(const p of places.filter(p=>p.kind===kind)){const button=document.createElement('button');button.type='button';button.dataset.search=`${p.id} ${p.name} ${title}`.toLowerCase();button.setAttribute('aria-pressed','false');const number=document.createElement('span');number.textContent=p.id;const name=document.createElement('span');name.textContent=p.name;button.append(number,name);button.onclick=()=>select(p.id);buttons.set(p.id,button);section.append(button);}sections.push(section);root.append(section);}root.append(empty);
 const filter=()=>{const query=search.value.trim().toLocaleLowerCase();let matches=0;for(const section of sections){let sectionMatches=0;for(const button of section.querySelectorAll<HTMLButtonElement>('button')){const visible=!query||button.dataset.search!.includes(query);button.hidden=!visible;if(visible)sectionMatches++;}section.hidden=sectionMatches===0;matches+=sectionMatches;}empty.hidden=matches!==0;};
 search.addEventListener('input',filter);search.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'){const first=root.querySelector<HTMLButtonElement>('section:not([hidden]) button:not([hidden])');if(first){event.preventDefault();first.click();}}});
 canvas.addEventListener('click',event=>{if(canvas.dataset.scope==='legoland'||canvas.dataset.gesture)return;const rect=canvas.getBoundingClientRect(),scale=Number(canvas.dataset.worldScale)||(canvas.width/340),centerX=Number(canvas.dataset.centerX)||0,centerZ=Number(canvas.dataset.centerZ)||0,panX=Number(canvas.dataset.panX)||0,panZ=Number(canvas.dataset.panZ)||0,x=((event.clientX-rect.left)/rect.width*canvas.width-canvas.width/2)/scale+centerX-panX,y=((event.clientY-rect.top)/rect.height*canvas.height-canvas.height/2)/scale+centerZ-panZ;const label=labels.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);const place=label?.place||places.find(p=>Math.hypot(x-p.x,y-p.z)<7);if(place)select(place.id);});
 return {labels,selected(id:string){for(const [key,button] of buttons)button.setAttribute('aria-pressed',String(key===id));}};
}
