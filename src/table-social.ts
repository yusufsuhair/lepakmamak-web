import {setupLukis} from './lukis';
import {setupPoker} from './poker';
import locations from '../shared/tables.json';
export type TableState={id:string;name:string;capacity:number;occupants:{id:string;name:string;chairId:string}[]};
export function setupTableSocial(send:(message:object)=>boolean,_room:string,releaseInput:()=>void){
 const dialog=document.createElement('dialog');dialog.id='table-social';dialog.setAttribute('aria-labelledby','table-name');
 dialog.innerHTML='<header><div><small>PERMAINAN MEJA</small><h2 id="table-name">Meja</h2></div><button id="close-table-social" type="button" aria-label="Close Meja Kita">×</button></header><p id="table-seats" role="status"></p><section id="table-detail" hidden></section>';
 document.body.append(dialog);let tables:TableState[]=[],selfId='',online=false,selected=locations[0].id,current='';
 const own=()=>online?tables.find(t=>t.occupants.some(p=>p.id===selfId)):undefined;
 const gameSend=(message:object)=>!!own()&&send(message);
 const lukis=setupLukis(gameSend),poker=setupPoker(gameSend);dialog.querySelector('#table-detail')!.append(lukis.root,poker.root);
 function render(){const seated=own(),id=seated?.id||selected,name=locations.find(t=>t.id===id)?.name||'Meja';
  dialog.querySelector('#table-name')!.textContent=name;
  dialog.querySelector('#table-seats')!.textContent=seated?`Anda duduk di ${name} · ${seated.occupants.length}/${seated.capacity} pemain`:online?'Duduk di kerusi meja ini untuk bermain.':'Sambung ke city online untuk bermain.';
  (dialog.querySelector('#table-detail') as HTMLElement).hidden=!seated;
  const next=seated?.id||'';if(current!==next){current=next;lukis.state(null,selfId);poker.state(null,selfId);if(next)send({type:'lukis-open'});}
  poker.context(id,!!seated,selfId);
 }
 function close(){dialog.close();}
 dialog.querySelector<HTMLButtonElement>('#close-table-social')!.onclick=close;
 dialog.addEventListener('keydown',event=>event.stopPropagation());
 return {open(tableId?:string){selected=tableId||own()?.id||selected;releaseInput();render();if(!dialog.open)dialog.showModal();dialog.querySelector<HTMLButtonElement>('#close-table-social')!.focus();},close,
  get opened(){return dialog.open;},state(value:TableState[],id:string,connected:boolean){tables=value;selfId=id;online=connected;render();},
  game(value:any){if(!value||value.tableId===own()?.id)lukis.state(value,selfId);},gameLine(value:any){if(own())lukis.line(value);},poker(value:any){if(!value||value.tableId===own()?.id)poker.state(value,selfId);},
  offline(){online=false;tables=[];lukis.state(null,selfId);poker.state(null,selfId);render();}};
}
