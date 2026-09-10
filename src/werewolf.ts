import './motion.css';
import './werewolf.css';
import {createGameAudio} from './game-audio';
const roles:Record<string,[string,string,string]>={
 werewolf:['Werewolf','☾','Choose a victim with the other wolves at night. You win when the wolves match the villagers.'],
 alpha:['Alpha Wolf','☾','The wolf leader. You appear good to the Seer. Choose a victim at night.'],
 villager:['Villager','⌂','Discuss, observe and vote. Eliminate every wolf to win.'],
 doctor:['Doctor','✚','Choose one player to protect each night. You may protect yourself.'],
 seer:['Seer','◉','Inspect one player each night. The result is private; the Alpha appears good.'],
 knight:['Knight','♜','You survive one night attack.'],
 princess:['Princess','♕','You survive one daytime judgment, but your role is revealed.'],
 hunter:['Hunter','➶','If killed at night, you have a 75% chance to take down one random wolf.'],
 mayor:['Mayor','⚑','Your accusation vote counts twice.']};
const phases:Record<string,string>={lobby:'Gather players',night:'Night',discussion:'Discussion',vote:'Vote',defense:'Defense',judgment:'Judgment',finished:'Finished'};
export function setupWerewolf(send:(message:object)=>boolean){
 const root=document.createElement('section');root.className='werewolf';root.innerHTML=`<header><div><small>THE SECRET BEHIND THE SMILE</small><h3>Werewolf</h3></div><span class="ww-moon" aria-hidden="true">☾</span></header><div class="ww-phase"><strong></strong><time></time></div><p class="ww-hint" role="status"></p><div class="ww-lobby"></div><section class="ww-role" hidden><button type="button" class="ww-reveal">Reveal my role</button><div class="ww-secret" hidden></div></section><div class="ww-inspection"></div><div class="ww-players"></div><div class="ww-judgment"></div><section class="ww-verdict" hidden><small>KAMPUNG MAJU</small><strong></strong><div class="ww-roles"></div></section><section class="ww-history"><h4>Village news</h4><ol></ol></section><section class="ww-chat"><h4>Game chat</h4><div class="ww-messages" role="log" aria-live="polite"></div><form><input aria-label="Werewolf message" maxlength="240" placeholder="Talk with the village…" autocomplete="off"><button type="submit">Send</button></form><small class="ww-chat-status" role="status"></small></section><details><summary>How to play & roles</summary><p>Every table in the city shares one Werewolf lobby. Join first; the host starts when 5 to 9 players are ready. Stay seated while playing.</p><p>5–6 players: 1 Werewolf, 1 Doctor, 1 Seer, and the remaining players are Villagers. 7–8 players: 2 Werewolves, 1 Doctor, 1 Seer, and the remaining players are Villagers. 9 players: add an Alpha Wolf and two random roles from Knight, Princess, Hunter and Mayor; 2 Villagers remain.</p><p>Votes are shown live during the Vote phase: everyone sees how many votes each suspect has, but not who voted. The Mayor’s vote is counted twice only in the final judgment.</p><p>Night 35s → discussion 60s → vote 25s → defense 20s → judgment 20s. The leading vote picks the accused; a tie means no judgment. Only accusers make the final judgment; more than half must choose Eliminate.</p><p>The villagers win when no wolves remain. The wolves win when they equal the villagers. Wolves must agree on a victim; if they disagree, one choice is selected at random. No night action means no attack.</p><p>Night chat is for wolves only. Eliminated players have a separate ghost chat. Use game chat for secrets; city voice and chat remain available as usual. If you disconnect or stand for 60 seconds, you are eliminated.</p></details>`;
 const el=<T extends HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
 let game:any=null,reveal=false,lastGame='',offset=0,shownPhase='';
 const audio=createGameAudio('werewolf',{
  // Night falls: two low notes, the second lower.
  night:({note,now})=>{note(196,now,.5);note(147,now+.18,.7);},
  // Day breaks: the same shape, climbing.
  day:({note,now})=>[262,330,392].forEach((f,i)=>note(f,now+i*.09,.3)),
  // A verdict being read out.
  judgment:({note,now})=>{note(233,now,.3);note(233,now+.22,.45);},
  // The village survives.
  good:({note,now})=>[392,523,659,784].forEach((f,i)=>note(f,now+i*.11,.3)),
  // The wolves take it.
  evil:({note,now})=>[330,262,196,147].forEach((f,i)=>note(f,now+i*.13,.42)),
 },{
  night:{src:'/audio/werewolf/night-forest-loop.mp3',volume:.28,loop:true},
  sleep:{src:'/audio/werewolf/sleep-breathing-loop.mp3',volume:.2,loop:true},
  howl:{src:'/audio/werewolf/werewolf-howling.mp3',volume:.65},
  growl:{src:'/audio/werewolf/werewolf-growl.mp3',volume:.55},
  death:{src:'/audio/werewolf/player-death-scream.mp3',volume:.45},
  nextTurn:{src:'/audio/werewolf/next-turn.wav',volume:.55},
  countdownTick:{src:'/audio/werewolf/countdown-tick.wav',volume:.5},
  countdownFinal:{src:'/audio/werewolf/countdown-final.wav',volume:.72},
 });
 let lastCountdownGame='',lastCountdownPhase='',lastCountdown=-1;
 root.addEventListener('pointerdown',()=>audio.unlock());

 // Night and day are the two beats worth a sweep across the whole panel.
 function sweep(to:'night'|'day'){
  const wash=document.createElement('div');wash.className='ww-sweep';wash.dataset.to=to;
  root.append(wash);setTimeout(()=>wash.remove(),1000);
 }
 function button(text:string,fn:()=>void,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=disabled;b.onclick=fn;return b;}
 function action(target:string){send({type:'werewolf-action',target,gameId:game.id,revision:game.revision});}
 function clock(){if(!game)return;const seconds=game.ends?Math.max(0,Math.ceil((game.ends-Date.now()-offset)/1000)):null;el('time').textContent=seconds!==null?String(seconds)+'s':game.players.length+'/'+game.size+' players';const phaseKey=game.id+':'+game.phase;if(phaseKey!==lastCountdownGame+':'+lastCountdownPhase){lastCountdownGame=game.id;lastCountdownPhase=game.phase;lastCountdown=-1;}if(seconds!==null&&game.phase!=='finished'&&seconds<=5){if(seconds===0&&lastCountdown!==0){audio.sample('countdownFinal');lastCountdown=0;}else if(seconds>0&&seconds!==lastCountdown){audio.sample('countdownTick');lastCountdown=seconds;}}}
 function render(){if(!game)return;const me=game.players.find((p:any)=>p.id===game.self),host=game.host===game.self,waiting=game.phase==='lobby',finished=game.phase==='finished',wolf=['werewolf','alpha'].includes(game.role);root.dataset.phase=game.phase;el('.ww-phase strong').textContent=phases[game.phase]+(game.day?' · Day '+game.day:'');clock();
  const accusedName=game.players.find((p:any)=>p.id===game.accused)?.name||'The accused';el('.ww-hint').textContent=waiting?'Join from any table. Roles stay secret.':finished?game.winner==='good'?'The villagers win!':'The wolves win!':!me?'The game is in progress. You are watching.':!me.alive?'You have been eliminated. Your chat is only for eliminated players.':game.phase==='night'?wolf?'Agree with the other wolves. Choose a victim.':game.role==='doctor'?'Choose someone to protect.':game.role==='seer'?'Choose someone to inspect.':'Wait for sunrise.':game.phase==='defense'?accusedName+' is defending themselves.':game.phase==='judgment'?'Accusers: decide the accused player’s fate. No vote means spare.':game.phase==='vote'?'Choose a suspect or skip.':'Discuss with the village. Who looks suspicious?';
  const lobby=el('.ww-lobby');lobby.replaceChildren();if(waiting){lobby.append(button(me?'Leave lobby':'Join game',()=>send({type:me?'werewolf-leave':'werewolf-join'}),!me&&game.players.length>=game.size));if(host){for(const size of (game.sizes||[7,9]) as number[]){const b=button(size+' players',()=>send({type:'werewolf-size',size}),game.players.length>size);b.setAttribute('aria-pressed',String(size===game.size));lobby.append(b);}lobby.append(button('Start game',()=>send({type:'werewolf-start'}),game.players.length!==game.size));}}else if(finished){lobby.append(button('New lobby',()=>send({type:'werewolf-rematch'}),!host&&game.players.some((p:any)=>p.id===game.host&&p.online)));}
  el('.ww-role').hidden=!game.role||waiting;el('.ww-secret').hidden=!reveal;el('.ww-reveal').textContent=reveal?'Hide my role':'Reveal my role';const secret=el('.ww-secret');secret.replaceChildren();if(game.role){const [name,icon,description]=roles[game.role]||[game.role,'?',''];const title=document.createElement('h4'),body=document.createElement('p');title.textContent=icon+' '+name;body.textContent=description;secret.append(title,body);}const book=el('.ww-inspection');book.replaceChildren();if(reveal&&game.inspections?.length)for(const r of game.inspections){const row=document.createElement('p');row.dataset.team=r.team;row.textContent='Night '+r.day+': '+r.name+' — '+(r.team==='evil'?'Evil':'Good');book.append(row);}
  const players=el('.ww-players');players.replaceChildren();for(const p of game.players){const legal=me?.alive&&p.alive&&(game.phase==='vote'&&p.id!==me.id||game.phase==='night'&&(wolf&&!['werewolf','alpha'].includes(p.role)||game.role==='doctor'||game.role==='seer'&&p.id!==me.id));const card=button('',()=>action(p.id),!legal),initial=document.createElement('span'),name=document.createElement('strong'),meta=document.createElement('small');card.className='ww-player';card.classList.toggle('ww-dead',!p.alive);card.setAttribute('aria-pressed',String(game.selected===p.id));initial.textContent=p.alive?p.name.slice(0,1).toUpperCase():'×';name.textContent=p.name;meta.textContent=waiting?'Ready':p.role&&(p.id!==game.self||reveal||finished)?roles[p.role]?.[0]||p.role:!p.online?'Reconnecting…':'Secret role';card.append(initial,name,meta);const votes=game.phase==='vote'?game.tally?.[p.id]||0:0;if(votes){const badge=document.createElement('em');badge.className='ww-tally';badge.textContent=String(votes);badge.setAttribute('aria-label',votes+' votes');card.append(badge);}players.append(card);}if(waiting)for(let i=game.players.length;i<game.size;i++){const slot=document.createElement('div');slot.className='ww-empty';slot.textContent='Waiting for player';players.append(slot);}
  const judge=el('.ww-judgment');judge.replaceChildren();if(me?.alive&&game.phase==='vote'){const skips=game.tally?.skip||0;judge.append(button((game.selected==='skip'?'✓ Skip vote':'Skip vote')+(skips?' · '+skips:''),()=>action('skip')));}if(game.phase==='judgment'&&game.canJudge){for(const [label,target] of [['Eliminate','kill'],['Spare','spare']]){const n=game.tally?.[target]||0;const b=button(label+(n?' · '+n:''),()=>action(target));b.setAttribute('aria-pressed',String(game.selected===target));judge.append(b);}}
  // The ending is the game in a deduction round, so it gets a moment rather than a line.
  // Roles, not accusations: who was a wolf, never who was wrong about whom.
  const verdict=el('.ww-verdict');verdict.hidden=!finished;
  if(finished){
   verdict.dataset.side=game.winner==='good'?'good':'evil';
   el('.ww-verdict strong').textContent=game.winner==='good'?'The villagers win!':'The wolves win!';
   const roleList=el('.ww-roles');roleList.replaceChildren();
   for(const p of game.players){
    const tag=document.createElement('span');
    const role=roles[p.role]?.[0]||p.role||'?';
    tag.dataset.wolf=String(['werewolf','alpha'].includes(p.role));
    tag.textContent=`${p.name} · ${role}`;roleList.append(tag);
   }
  }
  // One sound and one sweep per change of phase, however many renders it takes.
  if(game.phase!==shownPhase){
   if(shownPhase==='night'&&game.phase!=='night'){audio.stopSample('night');audio.stopSample('sleep');}
   if(shownPhase&&game.phase!=='finished')audio.sample('nextTurn');
   if(game.phase==='night'){sweep('night');audio.sound('night');audio.sample('night');audio.sample('sleep');audio.sample('howl');}
   else if(game.phase==='discussion'&&shownPhase==='night'){sweep('day');audio.sound('day');}
   else if(game.phase==='judgment')audio.sound('judgment');
   else if(finished){audio.stopSamples();verdict.classList.add('game-burst');audio.sound(game.winner==='good'?'good':'evil');}
   shownPhase=game.phase;
  }
  const history=el('.ww-history ol');history.replaceChildren();for(const message of game.log.slice(-6)){const item=document.createElement('li');item.textContent=message;history.append(item);}
  const messages=el('.ww-messages'),bottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<30;messages.replaceChildren();for(const m of game.chat){const row=document.createElement('p'),name=document.createElement('b');name.textContent=`${m.channel==='wolves'?'☾ ':m.channel==='ghosts'?'† ':''}${m.name}: `;row.append(name,document.createTextNode(m.text));messages.append(row);}if(bottom)messages.scrollTop=messages.scrollHeight;
  const canChat=me&&(waiting||finished||!me.alive||game.phase==='night'&&wolf||['discussion','vote','judgment'].includes(game.phase)||game.phase==='defense'&&game.accused===me.id);el<HTMLInputElement>('.ww-chat input').disabled=!canChat;el<HTMLButtonElement>('.ww-chat form button').disabled=!canChat;el('.ww-chat-status').textContent=canChat?game.phase==='night'&&me.alive?'Private wolf chat':!me.alive&&!finished?'Eliminated players chat':'Player chat':'Chat is unavailable during this phase.';
 }
 el('.ww-reveal').onclick=()=>{reveal=!reveal;render();};el('form').onsubmit=e=>{e.preventDefault();const input=el<HTMLInputElement>('input');if(input.value.trim()&&send({type:'werewolf-chat',text:input.value.trim()}))input.value='';};setInterval(()=>{if(root.isConnected&&!root.hidden)clock();},250);
 return {root,state(value:any){if(!value){game=null;audio.stopSamples();root.querySelectorAll<HTMLElement>('.ww-secret,.ww-role').forEach(e=>e.hidden=true);return;}const previous=game;const playerDied=value.id===lastGame&&previous?.players?.some((old:any)=>old.alive&&value.players?.some((next:any)=>next.id===old.id&&!next.alive));if(value.id!==lastGame){lastGame=value.id;reveal=false;shownPhase='';}game=value;offset=game.serverTime-Date.now();render();if(playerDied){audio.sample('death');if(value.phase==='night')audio.sample('growl');}}};
}
