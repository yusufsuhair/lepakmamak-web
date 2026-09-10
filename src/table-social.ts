import {setupUno} from './uno';
import {setupLukis} from './lukis';
import {setupWerewolf} from './werewolf';
import {setupPoker} from './poker';
import {createTableAlert,unoAlert,pokerAlert,lukisAlert,werewolfAlert} from './table-alert';
import './table-lobby.css';
import {createTableShell} from './table-shell';
import locations from '../shared/tables.json';
import {createPlayerFace} from './player-face';
type TablePerson={id:string;name:string;chairId?:string;appearance?:Record<string,string>};
export type TableGameState={game:string;phase:string;members:TablePerson[]};
export type TableState={id:string;name:string;capacity:number;occupants:TablePerson[];activeGame?:TableGameState|null};
const GAME_TITLES:Record<string,string>={lukis:'Lukis Lah!',poker:'Poker Kampung',uno:'UNO Lepak',werewolf:'Werewolf'};
const GAME_PHASES:Record<string,string>={lobby:'lobi',countdown:'mula sebentar lagi',playing:'sedang dimainkan'};
export function setupTableSocial(send:(message:object)=>boolean,_room:string,releaseInput:()=>void,toast:(title:string,body:string)=>void){
 const dialog=document.createElement('dialog');dialog.id='table-social';dialog.setAttribute('aria-labelledby','table-name');
 dialog.innerHTML='<header><div><small>PERMAINAN MEJA</small><h2 id="table-name">Meja</h2></div><button id="close-table-social" type="button" aria-label="Close Meja Kita">×</button></header><p id="table-seats" role="status"></p><div id="table-rosters"></div><section id="table-detail" hidden><div class="table-game-menu"><h3>Jom main, geng.</h3><p>Pilih permainan untuk meja anda.</p><div class="table-game-grid"><button type="button" data-select="lukis"><span class="game-art draw-art" aria-hidden="true">✎<i>?</i></span><strong>Lukis Lah!</strong><small>Lukis, teka & ketawa bersama</small><b>2+ pemain · Pilih →</b></button><button type="button" data-select="poker"><span class="game-art card-art" aria-hidden="true">♠<i>♥</i></span><strong>Poker Kampung</strong><small>Uji strategi, baca gerak member</small><b>2+ pemain · Pilih →</b></button><button type="button" data-select="werewolf"><span class="game-art wolf-art" aria-hidden="true">☾<i>✦</i></span><strong>Werewolf</strong><small>Rahsiakan peranan, cari serigala</small><b>7–9 pemain · Pilih →</b></button><button type="button" data-select="uno"><span class="game-art uno-art" aria-hidden="true">7<i>+4</i></span><strong>UNO Lepak</strong><small>Padan warna, habiskan kad</small><b>2+ pemain · Pilih →</b></button></div></div><button type="button" class="table-back" hidden>← Semua permainan</button><div class="table-game-stage"></div></section>';
 document.body.append(dialog);let tables:TableState[]=[],selfId='',online=false,selected=locations[0].id,current='',playingGame='';
 const own=()=>online?tables.find(t=>t.occupants.some(p=>p.id===selfId)):undefined;
 const gameSend=(message:object)=>!!own()&&send(message);
 const lukis=setupLukis(gameSend),poker=setupPoker(gameSend),werewolf=setupWerewolf(gameSend),uno=setupUno(gameSend);
 const alerts=createTableAlert(toast),onScreen=()=>dialog.open;
 const shell=createTableShell(gameSend);
 dialog.querySelector('.table-game-stage')!.append(shell.root);
 shell.stage.append(lukis.root,poker.root,werewolf.root,uno.root);
 // A game's own board only appears once the lobby has actually started it.
 function showBoards(){const on=shell.playing?playingGame:'';lukis.root.hidden=on!=='lukis';poker.root.hidden=on!=='poker';werewolf.root.hidden=on!=='werewolf';uno.root.hidden=on!=='uno';}
 window.setInterval(()=>{if(dialog.open)shell.tick();},250);
 function selectGame(value:string){
  playingGame=value;
  (dialog.querySelector('.table-game-menu') as HTMLElement).hidden=!!value;
  (dialog.querySelector('.table-back') as HTMLElement).hidden=!value;
  dialog.classList.toggle('playing-drawing',value==='lukis');dialog.classList.toggle('playing-uno',value==='uno');
  if(value){alerts.ask();send({type:'lobby-join',game:value});}else{shell.state(null,selfId);send({type:'lobby-leave'});}
  showBoards();
 }
 selectGame('');
 dialog.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(button=>button.onclick=()=>selectGame(button.dataset.select!));
 dialog.querySelector<HTMLButtonElement>('.table-back')!.onclick=()=>selectGame('');
 function rosterRow(label:string,people:TablePerson[],kind:string){
  if(!people.length)return null;const row=document.createElement('section');row.className=`table-roster ${kind}`;
  const title=document.createElement('strong');title.textContent=label;const faces=document.createElement('div');faces.className='table-roster-faces';
  for(const person of people){const item=document.createElement('span');item.className='table-roster-person';item.title=person.name;item.append(createPlayerFace(person));const name=document.createElement('small');name.textContent=person.name;item.append(name);faces.append(item);}
  row.append(title,faces);return row;
 }
 function renderRosters(occupants:TablePerson[],activeGame:TableGameState|null){const root=dialog.querySelector('#table-rosters')!;root.replaceChildren();
  const joined=new Set(activeGame?.members.map(person=>person.id)||[]),waiting=occupants.filter(person=>!joined.has(person.id));
  if(activeGame){const playing=activeGame.phase==='playing';const row=rosterRow(playing?`DALAM GAME · ${GAME_TITLES[activeGame.game]||activeGame.game}`:`LOBI · ${GAME_TITLES[activeGame.game]||activeGame.game}`,activeGame.members,playing?'playing':'lobby');if(row)root.append(row);}
  const seated=rosterRow(activeGame?'DUDUK · BELUM SERTAI':'LOBI MEJA',activeGame?waiting:occupants,'seated');if(seated)root.append(seated);
 }
 function render(){const seated=own(),id=seated?.id||selected,name=locations.find(t=>t.id===id)?.name||'Meja',snapshot=tables.find(t=>t.id===id),occupants=snapshot?.occupants||[],activeGame=snapshot?.activeGame||null;
  dialog.querySelector('#table-name')!.textContent=name;
  const game=activeGame?`${GAME_TITLES[activeGame.game]||activeGame.game} · ${GAME_PHASES[activeGame.phase]||activeGame.phase}`:online?'Belum ada game':'Sambung ke city online';
  const seats=snapshot?`${occupants.length}/${snapshot.capacity} pemain`:'Status pemain belum tersedia';
  dialog.querySelector('#table-seats')!.textContent=seated?`Anda duduk di ${name} · ${seats} · ${game}`:`${seats} · ${game}`;renderRosters(occupants,activeGame);
  (dialog.querySelector('#table-detail') as HTMLElement).hidden=!seated;
  const next=seated?.id||'';if(current!==next){current=next;alerts.clear();selectGame('');lukis.state(null,selfId);poker.state(null,selfId);werewolf.state(null);uno.state(null);}
  poker.context(id,!!seated,selfId);lukis.context(!!seated,seated?.occupants.length||0);
 }
 // A modal <dialog> puts itself in the top layer and makes the rest of the document inert,
 // so the chat panel in #hud is not merely covered — the platform switches it off. Moving
 // the same node into the dialog puts it in the top layer too. It is the same element, so
 // its threads, unread counts, scroll position and listeners all come with it.
 const chatHome=()=>document.getElementById('hud');
 const chatPanel=()=>document.getElementById('city-chat');
 const speakingPanel=()=>document.getElementById('speaking');
 function holdChat(){const panel=chatPanel(),speaking=speakingPanel();if(panel&&panel.parentElement!==dialog)dialog.append(panel);if(speaking&&speaking.parentElement!==dialog)dialog.append(speaking);}
 function releaseChat(){const panel=chatPanel(),speaking=speakingPanel(),home=chatHome();if(panel&&home&&panel.parentElement!==home)home.append(panel);if(speaking&&home&&speaking.parentElement!==home)home.append(speaking);}
 // Esc closes a modal natively and never reaches close(), and the dialog can be torn down
 // for other reasons. Listening to 'close' itself is the only place that catches them all.
 dialog.addEventListener('close',releaseChat);
 function close(){dialog.close();releaseChat();}
 dialog.querySelector<HTMLButtonElement>('#close-table-social')!.onclick=close;
 dialog.addEventListener('keydown',event=>event.stopPropagation());
 return {open(tableId?:string){selected=tableId||own()?.id||selected;releaseInput();render();if(!dialog.open)dialog.showModal();holdChat();dialog.querySelector<HTMLButtonElement>('#close-table-social')!.focus();},close,
  get opened(){return dialog.open;},get playing(){return dialog.open&&!!playingGame;},state(value:TableState[],id:string,connected:boolean){tables=value;selfId=id;online=connected;render();},
  uno(value:any){if(!value||value.tableId===own()?.id){uno.state(value);alerts.fire('uno',unoAlert(value),onScreen());}},werewolf(value:any){werewolf.state(value);alerts.fire('werewolf',werewolfAlert(value),onScreen());},game(value:any){if(!value||value.tableId===own()?.id){lukis.state(value,selfId);alerts.fire('lukis',lukisAlert(value),onScreen());}},lobby(value:any){shell.state(value,selfId);showBoards();},party(size:number){shell.party(size);},react(value:any){shell.react(value);},gameFeedback(kind:string,message:string){lukis.feedback(kind,message);},gameCorrect(name:string,points:number,event?:any){lukis.correct(name,points,event);},gameInk(message:any){if(own())lukis.ink(message);},gameLine(value:any){if(own())lukis.line(value);},poker(value:any){if(!value||value.tableId===own()?.id){poker.state(value,selfId);alerts.fire('poker',pokerAlert(value,selfId),onScreen());}},
  offline(){releaseChat();online=false;tables=[];alerts.clear();shell.state(null,selfId);lukis.state(null,selfId);poker.state(null,selfId);werewolf.state(null);uno.state(null);render();}};
}
