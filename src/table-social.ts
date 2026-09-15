import {setupUno} from './uno';
import {setupLukis} from './lukis';
import {setupWerewolf} from './werewolf';
import {setupPoker} from './poker';
import {createTableAlert,unoAlert,pokerAlert,lukisAlert,werewolfAlert} from './table-alert';
import './table-lobby.css';
import {createTableShell} from './table-shell';
import locations from '../shared/tables.json';
import {createPlayerFace} from './player-face';
import casualCatalog from '../shared/casual-games.json';
import type {CasualState} from './casual-games';
type TablePerson={id:string;name:string;chairId?:string;appearance?:Record<string,string>};
export type TableGameState={game:string;phase:string;members:TablePerson[]};
export type TableState={id:string;name:string;capacity:number;occupants:TablePerson[];activeGames?:TableGameState[];activeGame?:TableGameState|null};
export type TableInvite={id:string;game:string;tableId:string;tableName:string;scope:'table'|'city';phase:string;lobbyId:string;min:number;max:number;occupied:number;capacity:number;available:number;expiresAt:number;inviter:{id:string;name:string}};
const GAME_TITLES:Record<string,string>={lukis:'Lukis Lah!',poker:'Poker Kampung',uno:'UNO Lepak',werewolf:'Werewolf'};
for(const [id,game] of Object.entries(casualCatalog))GAME_TITLES[id]=game.title;
const GAME_PHASES:Record<string,string>={lobby:'lobby',countdown:'starting soon',playing:'in progress'};
export function setupTableSocial(send:(message:object)=>boolean,_room:string,releaseInput:()=>void,toast:(title:string,body:string)=>void,goToTable:(tableId:string)=>boolean=()=>false,getVoicePanel:()=>HTMLElement|null=()=>null){
 const dialog=document.createElement('dialog');dialog.id='table-social';dialog.setAttribute('aria-labelledby','table-name');
 dialog.innerHTML='<header><div><small>TABLE GAMES</small><h2 id="table-name">Table</h2></div><div class="table-modal-actions"><button id="close-table-social" type="button" aria-label="Close table games">×</button></div></header><p id="table-seats" role="status"></p><section id="table-invite-destination" class="table-invite-destination" hidden><small>TABLE INVITATION</small><p id="table-invite-copy"></p><button type="button" id="table-invite-go">Go to table</button></section><div id="table-rosters"></div><section id="table-detail" hidden><div class="table-game-menu"><h3>Let’s play.</h3><p>Choose a game for your table.</p><div class="table-game-grid"><button type="button" data-select="lukis"><span class="game-art draw-art" aria-hidden="true">✎<i>?</i></span><strong>Lukis Lah!</strong><small>Draw, guess and laugh together</small><b>2+ players · Select →</b></button><button type="button" data-select="poker"><span class="game-art card-art" aria-hidden="true">♠<i>♥</i></span><strong>Poker Kampung</strong><small>Read the table and play your hand</small><b>2+ players · Select →</b></button><button type="button" data-select="werewolf"><span class="game-art wolf-art" aria-hidden="true">☾<i>✦</i></span><strong>Werewolf</strong><small>Hide your role and find the wolves</small><b>5–9 players · Select →</b></button><button type="button" data-select="uno"><span class="game-art uno-art" aria-hidden="true">7<i>+4</i></span><strong>UNO Lepak</strong><small>Match colours and empty your hand</small><b>2+ players · Select →</b></button></div></div><button type="button" class="table-back" hidden>← All games</button><div class="table-game-stage"></div></section>';
 document.body.append(dialog);let tables:TableState[]=[],selfId='',online=false,selected=locations[0].id,current='',playingGame='';let destination:TableInvite|null=null;
 const own=()=>online?tables.find(t=>t.occupants.some(p=>p.id===selfId)):undefined;
 const gameSend=(message:object)=>!!own()&&send(message);
 for(const [id,game] of Object.entries(casualCatalog)){
  const button=document.createElement('button');button.type='button';button.dataset.select=id;
  const art=document.createElement('span');art.className='game-art card-art';art.textContent=game.icon;art.setAttribute('aria-hidden','true');
  const title=document.createElement('strong');title.textContent=game.title;
  const description=document.createElement('small');description.textContent=game.description;
  const count=document.createElement('b');count.textContent=`${game.min===game.max?game.min:`${game.min}–${game.max}`} players · Select →`;
  button.append(art,title,description,count);dialog.querySelector('.table-game-grid')!.append(button);
 }
 const lukis=setupLukis(gameSend),poker=setupPoker(gameSend),werewolf=setupWerewolf(gameSend),uno=setupUno(message => gameSend((message as {type:string}).type === 'uno-rematch' ? {type:'lobby-rematch'} : message));
 const alerts=createTableAlert(toast),onScreen=()=>dialog.open;
 const shell=createTableShell(gameSend,request=>{const tableId=own()?.id||selected;return send({type:'table-invite',game:request.game,tableId});});
 dialog.querySelector('.table-game-stage')!.append(shell.root);
 shell.stage.append(lukis.root,poker.root,werewolf.root,uno.root);
 let casual:ReturnType<typeof import('./casual-games').setupCasualGames>|undefined,loadingCasual=false,casualState:CasualState|null=null;
 const loadStatus=document.createElement('div');loadStatus.className='casual-load-status';loadStatus.hidden=true;loadStatus.setAttribute('role','status');shell.stage.append(loadStatus);
 async function loadCasual(){
  if(casual||loadingCasual)return;loadingCasual=true;loadStatus.textContent='Memuatkan game…';
  try{const {setupCasualGames}=await import('./casual-games');casual=setupCasualGames(gameSend);shell.stage.append(casual.root);casual.state(casualState);}
  catch{loadStatus.textContent='Game belum dapat dimuatkan. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Cuba lagi';retry.onclick=()=>void loadCasual();loadStatus.append(retry);}
  finally{loadingCasual=false;showBoards();}
 }
 // A game's own board only appears once the lobby has actually started it.
 function showBoards(){const on=shell.playing?playingGame:'';lukis.root.hidden=on!=='lukis';poker.root.hidden=on!=='poker';werewolf.root.hidden=on!=='werewolf';uno.root.hidden=on!=='uno';casual?.show(on);loadStatus.hidden=!Object.hasOwn(casualCatalog,on)||!!casual;}
 window.setInterval(()=>{if(dialog.open)shell.tick();},250);
 function selectGame(value:string){
  if(value!==playingGame){casualState=null;casual?.state(null);}
  playingGame=value;
  if(Object.hasOwn(casualCatalog,value))void loadCasual();
  (dialog.querySelector('.table-game-menu') as HTMLElement).hidden=!!value;
  (dialog.querySelector('.table-back') as HTMLElement).hidden=!value;
  dialog.classList.toggle('playing-drawing',value==='lukis');dialog.classList.toggle('playing-uno',value==='uno');
  if(value){alerts.ask();send({type:'lobby-join',game:value});}else{shell.state(null,selfId);send({type:'lobby-leave'});}
  showBoards();
 }
 selectGame('');
 dialog.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(button=>button.onclick=()=>selectGame(button.dataset.select!));
 dialog.querySelector<HTMLButtonElement>('.table-back')!.onclick=()=>selectGame('');
 function rosterRow(label:string,people:TablePerson[],kind:string,showEmpty=false){
  if(!people.length&&!showEmpty)return null;const row=document.createElement('section');row.className=`table-roster ${kind}`;
  const title=document.createElement('strong');title.textContent=label;const faces=document.createElement('div');faces.className='table-roster-faces';
  for(const person of people){const item=document.createElement('span');item.className='table-roster-person';item.title=person.name;item.append(createPlayerFace(person));const name=document.createElement('small');name.textContent=person.name;item.append(name);faces.append(item);}
  if(!people.length){const empty=document.createElement('small');empty.className='table-roster-empty';empty.textContent='No players yet';faces.append(empty);}
  row.append(title,faces);return row;
 }
 function renderRosters(occupants:TablePerson[],activeGames:TableGameState[]){const root=dialog.querySelector('#table-rosters')!;root.replaceChildren();
  const joined=new Set(activeGames.flatMap(game=>game.members.map(person=>person.id))),unjoined=occupants.filter(person=>!joined.has(person.id));
  // The neutral table lobby always owns the top row. These users are seated, but have not
  // joined any game yet, so they must never look like members of the game rows below.
  const lobby=rosterRow('TABLE LOBBY · NOT IN A GAME',unjoined,'seated neutral',true);if(lobby)root.append(lobby);
  for(const button of dialog.querySelectorAll<HTMLButtonElement>('[data-select]')){
   button.querySelector('.game-members')?.remove();const game=activeGames.find(entry=>entry.game===button.dataset.select);
   const members=document.createElement('span');members.className=`game-members ${game?.phase==='playing'?'playing':'waiting'}`;
   const status=document.createElement('em');status.textContent=game?.phase==='playing'?'IN GAME':game?'WAITING':'NO PLAYERS YET';members.append(status);
   const faces=document.createElement('span');faces.className='game-member-faces';
   for(const person of game?.members||[]){const item=document.createElement('span');item.className='game-member';item.title=person.name;item.append(createPlayerFace(person));const label=document.createElement('small');label.textContent=person.name;item.append(label);faces.append(item);}
   members.append(faces);button.append(members);
  }
 }
 function render(){const seated=own(),id=seated?.id||selected,name=locations.find(t=>t.id===id)?.name||destination?.tableName||'Meja',snapshot=tables.find(t=>t.id===id),occupants=snapshot?.occupants||[],activeGames=snapshot?.activeGames||(snapshot?.activeGame?[snapshot.activeGame]:[]),activeGame=activeGames.find(game=>game.phase==='playing')||activeGames[0]||null;
  dialog.querySelector('#table-name')!.textContent=name;
  const game=activeGame?`${GAME_TITLES[activeGame.game]||activeGame.game} · ${GAME_PHASES[activeGame.phase]||activeGame.phase}`:online?'No game yet':'Connect to the city to see the table';
  const seats=snapshot?`${occupants.length}/${snapshot.capacity} players`:'Player status unavailable';
  dialog.querySelector('#table-seats')!.textContent=seated?`You are sitting at ${name} · ${seats} · ${game}`:`${seats} · ${game}`;renderRosters(occupants,activeGames);
  const destinationPanel=dialog.querySelector<HTMLElement>('#table-invite-destination')!;
  destinationPanel.hidden=!destination;
  if(destination){
   dialog.querySelector('#table-invite-copy')!.textContent=`${destination.inviter.name} invited you to ${GAME_TITLES[destination.game]||destination.game} at ${destination.tableName}. ${destination.available} space${destination.available===1?'':'s'} available. Choose the game and READY yourself after you arrive.`;
   dialog.querySelector<HTMLButtonElement>('#table-invite-go')!.textContent=`Go to ${destination.tableName}`;
  }
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
 function holdChat(){const panel=chatPanel(),speaking=speakingPanel(),voice=getVoicePanel();if(panel&&panel.parentElement!==dialog)dialog.append(panel);if(speaking&&speaking.parentElement!==dialog)dialog.append(speaking);if(voice&&voice.parentElement!==dialog)dialog.append(voice);}
 function releaseChat(){const panel=chatPanel(),speaking=speakingPanel(),voice=getVoicePanel(),home=chatHome();if(panel&&home&&panel.parentElement!==home)home.append(panel);if(speaking&&home&&speaking.parentElement!==home)home.append(speaking);if(voice&&home&&voice.parentElement!==home)home.append(voice);}
 // Esc closes a modal natively and never reaches close(), and the dialog can be torn down
 // for other reasons. Listening to 'close' itself is the only place that catches them all.
 dialog.addEventListener('close',releaseChat);
 function close(){dialog.close();releaseChat();}
 dialog.querySelector<HTMLButtonElement>('#close-table-social')!.onclick=close;
  dialog.addEventListener('keydown',event=>event.stopPropagation());
 const goButton=dialog.querySelector<HTMLButtonElement>('#table-invite-go')!;
 goButton.onclick=()=>{if(!destination)return;if(goToTable(destination.tableId)){destination=null;close();}else toast('Table unavailable','Move to the table from the city and try again.');};
 return {open(tableId?:string){destination=null;selected=tableId||own()?.id||selected;releaseInput();render();if(!dialog.open)dialog.showModal();holdChat();dialog.querySelector<HTMLButtonElement>('#close-table-social')!.focus();},openInvite(value:TableInvite){destination=value;selected=value.tableId;releaseInput();render();if(!dialog.open)dialog.showModal();holdChat();goButton.focus();},close,
  get opened(){return dialog.open;},get playing(){return dialog.open&&!!playingGame;},state(value:TableState[],id:string,connected:boolean){tables=value;selfId=id;online=connected;render();},
  get boardOpen(){return dialog.open&&Object.hasOwn(casualCatalog,playingGame);},
  casual(value:CasualState){if(value.kind!==playingGame||value.tableId!==own()?.id)return;casualState=value;casual?.state(value);const mine=value.kind==='quiz'?value.phase==='playing'&&value.answer==null:value.turn===value.self&&value.phase==='playing';alerts.fire(value.kind,mine&&!value.paused?{key:`${value.id}:${value.kind==='quiz'?value.round:value.ends}`,title:GAME_TITLES[value.kind],body:value.kind==='quiz'?'Soalan baru — jom jawab.':'Giliran anda.'}:{key:'',title:'',body:''},onScreen());},
  uno(value:any){if(!value||value.tableId===own()?.id){uno.state(value);alerts.fire('uno',unoAlert(value),onScreen());}},werewolf(value:any){werewolf.state(value);alerts.fire('werewolf',werewolfAlert(value),onScreen());},game(value:any){if(!value||value.tableId===own()?.id){lukis.state(value,selfId);alerts.fire('lukis',lukisAlert(value),onScreen());}},lobby(value:any){shell.state(value,selfId);showBoards();},geng(size:number,leader:boolean){shell.geng(size,leader);},party(size:number){shell.party(size);},react(value:any){shell.react(value);},gameFeedback(kind:string,message:string){lukis.feedback(kind,message);},gameCorrect(name:string,points:number,event?:any){lukis.correct(name,points,event);},gameInk(message:any){if(own())lukis.ink(message);},gameLine(value:any){if(own())lukis.line(value);},poker(value:any){if(!value||value.tableId===own()?.id){poker.state(value,selfId);alerts.fire('poker',pokerAlert(value,selfId),onScreen());}},
  offline(){releaseChat();online=false;tables=[];alerts.clear();shell.state(null,selfId);lukis.state(null,selfId);poker.state(null,selfId);werewolf.state(null);uno.state(null);render();}};
}
