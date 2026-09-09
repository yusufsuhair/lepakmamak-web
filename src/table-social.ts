import {setupUno} from './uno';
import {setupLukis} from './lukis';
import {setupWerewolf} from './werewolf';
import {setupPoker} from './poker';
import {createTableAlert,unoAlert,pokerAlert,lukisAlert,werewolfAlert} from './table-alert';
import './table-lobby.css';
import locations from '../shared/tables.json';
export type TableState={id:string;name:string;capacity:number;occupants:{id:string;name:string;chairId:string}[]};
export function setupTableSocial(send:(message:object)=>boolean,_room:string,releaseInput:()=>void,toast:(title:string,body:string)=>void){
 const dialog=document.createElement('dialog');dialog.id='table-social';dialog.setAttribute('aria-labelledby','table-name');
 dialog.innerHTML='<header><div><small>PERMAINAN MEJA</small><h2 id="table-name">Meja</h2></div><button id="close-table-social" type="button" aria-label="Close Meja Kita">×</button></header><p id="table-seats" role="status"></p><section id="table-detail" hidden><div class="table-game-menu"><h3>Jom main, geng.</h3><p>Pilih permainan untuk meja anda.</p><div class="table-game-grid"><button type="button" data-select="lukis"><span class="game-art draw-art" aria-hidden="true">✎<i>?</i></span><strong>Lukis Lah!</strong><small>Lukis, teka & ketawa bersama</small><b>2+ pemain · Pilih →</b></button><button type="button" data-select="poker"><span class="game-art card-art" aria-hidden="true">♠<i>♥</i></span><strong>Poker Kampung</strong><small>Uji strategi, baca gerak member</small><b>2+ pemain · Pilih →</b></button><button type="button" data-select="werewolf"><span class="game-art wolf-art" aria-hidden="true">☾<i>✦</i></span><strong>Werewolf</strong><small>Rahsiakan peranan, cari serigala</small><b>7–9 pemain · Pilih →</b></button><button type="button" data-select="uno"><span class="game-art uno-art" aria-hidden="true">7<i>+4</i></span><strong>UNO Lepak</strong><small>Padan warna, habiskan kad</small><b>2+ pemain · Pilih →</b></button></div></div><button type="button" class="table-back" hidden>← Semua permainan</button><div class="table-game-stage"></div></section>';
 document.body.append(dialog);let tables:TableState[]=[],selfId='',online=false,selected=locations[0].id,current='';
 const own=()=>online?tables.find(t=>t.occupants.some(p=>p.id===selfId)):undefined;
 const gameSend=(message:object)=>!!own()&&send(message);
 const lukis=setupLukis(gameSend),poker=setupPoker(gameSend),werewolf=setupWerewolf(gameSend),uno=setupUno(gameSend);
 const alerts=createTableAlert(toast),onScreen=()=>dialog.open;dialog.querySelector('.table-game-stage')!.append(lukis.root,poker.root,werewolf.root,uno.root);
 function selectGame(value:string){lukis.root.hidden=value!=='lukis';poker.root.hidden=value!=='poker';werewolf.root.hidden=value!=='werewolf';uno.root.hidden=value!=='uno';(dialog.querySelector('.table-game-menu') as HTMLElement).hidden=!!value;(dialog.querySelector('.table-back') as HTMLElement).hidden=!value;dialog.classList.toggle('playing-drawing',value==='lukis');dialog.classList.toggle('playing-uno',value==='uno');if(value)alerts.ask();if(value)send({type:value==='lukis'?'lukis-open':value==='werewolf'?'werewolf-open':value==='uno'?'uno-open':'poker-open'});}
 selectGame('');
 dialog.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(button=>button.onclick=()=>selectGame(button.dataset.select!));
 dialog.querySelector<HTMLButtonElement>('.table-back')!.onclick=()=>selectGame('');
 function render(){const seated=own(),id=seated?.id||selected,name=locations.find(t=>t.id===id)?.name||'Meja';
  dialog.querySelector('#table-name')!.textContent=name;
  dialog.querySelector('#table-seats')!.textContent=seated?`Anda duduk di ${name} · ${seated.occupants.length}/${seated.capacity} pemain`:online?'Duduk di kerusi meja ini untuk bermain.':'Sambung ke city online untuk bermain.';
  (dialog.querySelector('#table-detail') as HTMLElement).hidden=!seated;
  const next=seated?.id||'';if(current!==next){current=next;alerts.clear();selectGame('');lukis.state(null,selfId);poker.state(null,selfId);werewolf.state(null);uno.state(null);if(next)send({type:'lukis-open'});}
  poker.context(id,!!seated,selfId);lukis.context(!!seated,seated?.occupants.length||0);
 }
 function close(){dialog.close();}
 dialog.querySelector<HTMLButtonElement>('#close-table-social')!.onclick=close;
 dialog.addEventListener('keydown',event=>event.stopPropagation());
 return {open(tableId?:string){selected=tableId||own()?.id||selected;releaseInput();render();if(!dialog.open)dialog.showModal();dialog.querySelector<HTMLButtonElement>('#close-table-social')!.focus();},close,
  get opened(){return dialog.open;},state(value:TableState[],id:string,connected:boolean){tables=value;selfId=id;online=connected;render();},
  uno(value:any){if(!value||value.tableId===own()?.id){uno.state(value);alerts.fire('uno',unoAlert(value),onScreen());}},werewolf(value:any){werewolf.state(value);alerts.fire('werewolf',werewolfAlert(value),onScreen());},game(value:any){if(!value||value.tableId===own()?.id){lukis.state(value,selfId);alerts.fire('lukis',lukisAlert(value),onScreen());}},gameFeedback(kind:string,message:string){lukis.feedback(kind,message);},gameCorrect(name:string,points:number,event?:any){lukis.correct(name,points,event);},gameInk(message:any){if(own())lukis.ink(message);},gameLine(value:any){if(own())lukis.line(value);},poker(value:any){if(!value||value.tableId===own()?.id){poker.state(value,selfId);alerts.fire('poker',pokerAlert(value,selfId),onScreen());}},
  offline(){online=false;tables=[];alerts.clear();lukis.state(null,selfId);poker.state(null,selfId);werewolf.state(null);uno.state(null);render();}};
}
