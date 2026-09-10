import {districtFor} from '../shared/districts.mjs';
import './car-finder.css';

// Display ownership is separate from the fleet's `owner` (the current driver id).
export const ownerCars=[
 {id:'parked-taycan',owner:'Yusuf Suhair',model:'Porsche Taycan',pin:'Taycan'},
 {id:'parked-gt3-rs',owner:'Daddy Fizal',model:'Porsche 911 GT3 RS',pin:'911 GT3 RS'},
] as const;
export type FleetLocation={id:string;x:number;z:number;owner:string|null};
export type CarPin={x:number;z:number;label:string};

export function drawCarPin(ctx:CanvasRenderingContext2D,p:CarPin,you:{x:number;z:number},size=7){
 ctx.save();ctx.strokeStyle='#ffdf70';ctx.lineWidth=size/5;ctx.setLineDash([size,size*.7]);ctx.beginPath();ctx.moveTo(you.x,you.z);ctx.lineTo(p.x,p.z);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#ffdf70';ctx.strokeStyle='#173c32';ctx.lineWidth=size/4;ctx.beginPath();ctx.moveTo(p.x,p.z-size);ctx.lineTo(p.x+size,p.z);ctx.lineTo(p.x,p.z+size);ctx.lineTo(p.x-size,p.z);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.font=`bold ${size*1.2}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineWidth=size*.55;ctx.strokeText(p.label,p.x,p.z-size*1.5);ctx.fillText(p.label,p.x,p.z-size*1.5);ctx.restore();
}

export function createCarFinder(root:HTMLElement,onSelect:()=>void){
 const panel=document.createElement('details');panel.id='car-finder';
 const summary=document.createElement('summary');summary.textContent='Find car';panel.append(summary);
 const hint=document.createElement('p');hint.textContent='Live location · this room only';panel.append(hint);
 const buttons=new Map<string,HTMLButtonElement>();let selected='';let snapshot=new Map<string,FleetLocation>();
 for(const car of ownerCars){const button=document.createElement('button');button.type='button';button.dataset.carId=car.id;button.setAttribute('aria-pressed','false');
  const name=document.createElement('strong'),model=document.createElement('span');name.textContent=car.owner;model.textContent=car.model;button.append(name,model);
  button.onclick=()=>{selected=car.id;for(const [id,b] of buttons)b.setAttribute('aria-pressed',String(id===selected));onSelect();};buttons.set(car.id,button);panel.append(button);
 }
 const status=document.createElement('p');status.className='car-finder-status';status.textContent='Choose a car to show its live map pin.';panel.append(status);root.append(panel);
 return{
  receive(cars:FleetLocation[]){snapshot=new Map(cars.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.z)).map(c=>[c.id,{...c}]));},
  clear(){snapshot.clear();},
  deselect(){selected='';for(const b of buttons.values())b.setAttribute('aria-pressed','false');},
  update(online:boolean,you:{x:number;z:number},players:{id:string;name?:string}[]):CarPin|undefined{
   const car=ownerCars.find(c=>c.id===selected),state=snapshot.get(selected);let text='Choose a car to show its live map pin.';
   if(!online)text='City offline — live car location unavailable.';
   else if(car&&!state)text='Waiting for this room’s live car location…';
   else if(car&&state){const driver=players.find(p=>p.id===state.owner)?.name;const use=state.owner?`In use${driver?` · Driver: ${driver}`:''}`:'Parked · Available';text=`${car.owner} · ${car.model} — ${use} · ${Math.round(Math.hypot(you.x-state.x,you.z-state.z))} m away · ${districtFor(state.z,state.x)} · (${Math.round(state.x)}, ${Math.round(state.z)})`;}
   if(status.textContent!==text)status.textContent=text;
   return online&&car&&state?{x:state.x,z:state.z,label:car.pin}:undefined;
  }
 };
}
