import {setupLukis} from './lukis';
import {setupWerewolf} from './werewolf';
import {setupPoker} from './poker';
import './table-lobby.css';
import locations from '../shared/tables.json';
export type TableState={id:string;name:string;capacity:number;occupants:{id:string;name:string;chairId:string}[]};
export function setupTableSocial(send:(message:object)=>boolean,_room:string,releaseInput:()=>void){
 const dialog=document.createElement('dialog');dialog.id='table-social';dialog.setAttribute('aria-labelledby','table-name');
 dialog.innerHTML='<header><div><small>PERMAINAN MEJA</small><h2 id="table-name">Meja</h2></div><button id="close-table-social" type="button" aria-label="Close Meja Kita">×</button></header><p id="table-seats" role="status"></p><section id="table-detail" hidden><div class="table-game-menu"><h3>Jom main, geng.</h3><p>Pilih permainan untuk meja anda.</p><div class="table-game-grid"><button type="button" data-select="lukis"><span class="game-art draw-art" aria-hidden="true">✎<i>?</i></span><strong>Lukis Lah!</strong><small>Lukis, teka & ketawa bersama</small><b>2+ pemain · Pilih →</b></button><button type="button" data-select="poker"><span class="game-art card-art" aria-hidden="true">♠<i>♥</i></span><strong>Poker Kampung</strong><small>Uji strategi, baca gerak member</small><b>2+ pemain · Pilih →</b></button><button type="button" data-select="werewolf"><span class="game-art wolf-art" aria-hidden="true">☾<i>✦</i></span><strong>Werewolf</strong><small>Rahsiakan peranan, cari serigala</small><b>7–9 pemain · Pilih →</b></button></div></div><button type="button" class="table-back" hidden>← Semua permainan</button><div class="table-game-stage"></div></section>';
 document.body.append(dialog);let tables:TableState[]=[],selfId='',online=false,selected=locations[0].id,current='';
 const own=()=>online?tables.find(t=>t.occupants.some(p=>p.id===selfId)):undefined;
 const gameSend=(message:object)=>!!own()&&send(message);
 const lukis=setupLukis(gameSend),poker=setupPoker(gameSend),werewolf=setupWerewolf(gameSend);dialog.querySelector('.table-game-stage')!.append(lukis.root,poker.root,werewolf.root);
 function selectGame(value:string){lukis.root.hidden=value!=='lukis';poker.root.hidden=value!=='poker';werewolf.root.hidden=value!=='werewolf';(dialog.querySelector('.table-game-menu') as HTMLElement).hidden=!!value;(dialog.querySelector('.table-back') as HTMLElement).hidden=!value;dialog.classList.toggle('playing-drawing',value==='lukis');if(value)send({type:value==='lukis'?'lukis-open':value==='werewolf'?'werewolf-open':'poker-open'});}
 selectGame('');
 dialog.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(button=>button.onclick=()=>selectGame(button.dataset.select!));
 dialog.querySelector<HTMLButtonElement>('.table-back')!.onclick=()=>selectGame('');
 function render(){const seated=own(),id=seated?.id||selected,name=locations.find(t=>t.id===id)?.name||'Meja';
  dialog.querySelector('#table-name')!.textContent=name;
  dialog.querySelector('#table-seats')!.textContent=seated?`Anda duduk di ${name} · ${seated.occupants.length}/${seated.capacity} pemain`:online?'Duduk di kerusi meja ini untuk bermain.':'Sambung ke city online untuk bermain.';
  (dialog.querySelector('#table-detail') as HTMLElement).hidden=!seated;
  const next=seated?.id||'';if(current!==next){current=next;selectGame('');lukis.state(null,selfId);poker.state(null,selfId);werewolf.state(null);if(next)send({type:'lukis-open'});}
  poker.context(id,!!seated,selfId);
 }
 function close(){dialog.close();}
 dialog.querySelector<HTMLButtonElement>('#close-table-social')!.onclick=close;
 dialog.addEventListener('keydown',event=>event.stopPropagation());
 return {open(tableId?:string){selected=tableId||own()?.id||selected;releaseInput();render();if(!dialog.open)dialog.showModal();dialog.querySelector<HTMLButtonElement>('#close-table-social')!.focus();},close,
  get opened(){return dialog.open;},state(value:TableState[],id:string,connected:boolean){const before=own()?.id;tables=value;selfId=id;online=connected;render();if(own()&&!before){releaseInput();if(!dialog.open)dialog.showModal();}},
  werewolf(value:any){werewolf.state(value);},game(value:any){if(!value||value.tableId===own()?.id)lukis.state(value,selfId);},gameFeedback(kind:string,message:string){lukis.feedback(kind,message);},gameCorrect(name:string,points:number){lukis.correct(name,points);},gameLine(value:any){if(own())lukis.line(value);},poker(value:any){if(!value||value.tableId===own()?.id)poker.state(value,selfId);},
  offline(){online=false;tables=[];lukis.state(null,selfId);poker.state(null,selfId);werewolf.state(null);render();}};
}
