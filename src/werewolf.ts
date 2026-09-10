import './motion.css';
import './werewolf.css';
import {createGameAudio} from './game-audio';
const roles:Record<string,[string,string,string]>={
 werewolf:['Werewolf','☾','Pilih mangsa bersama serigala lain pada waktu malam. Menang apabila jumlah serigala menyamai penduduk.'],
 alpha:['Alpha Wolf','☾','Ketua serigala. Anda kelihatan baik kepada Seer. Pilih mangsa pada waktu malam.'],
 villager:['Villager','⌂','Bincang, perhatikan, dan undi. Singkirkan semua serigala untuk menang.'],
 doctor:['Doctor','✚','Pilih seorang pemain untuk dilindungi setiap malam. Anda boleh melindungi diri sendiri.'],
 seer:['Seer','◉','Periksa seorang pemain setiap malam. Keputusan hanya untuk anda; Alpha kelihatan baik.'],
 knight:['Knight','♜','Anda terselamat daripada satu serangan malam.'],
 princess:['Princess','♕','Anda terselamat daripada satu hukuman siang, tetapi peranan anda akan terdedah.'],
 hunter:['Hunter','➶','Jika terkorban pada waktu malam, peluang 75% untuk menewaskan satu serigala rawak.'],
 mayor:['Mayor','⚑','Undi tuduhan anda dikira dua kali.']};
const phases:Record<string,string>={lobby:'Kumpul geng',night:'Malam',discussion:'Perbincangan',vote:'Tuduh',defense:'Pembelaan',judgment:'Keputusan',finished:'Tamat'};
export function setupWerewolf(send:(message:object)=>boolean){
 const root=document.createElement('section');root.className='werewolf';root.innerHTML=`<header><div><small>RAHSIA DI SEBALIK SENYUMAN</small><h3>Werewolf</h3></div><span class="ww-moon" aria-hidden="true">☾</span></header><div class="ww-phase"><strong></strong><time></time></div><p class="ww-hint" role="status"></p><div class="ww-lobby"></div><section class="ww-role" hidden><button type="button" class="ww-reveal">Lihat peranan saya</button><div class="ww-secret" hidden></div></section><div class="ww-inspection"></div><div class="ww-players"></div><div class="ww-judgment"></div><section class="ww-verdict" hidden><small>KAMPUNG MAJU</small><strong></strong><div class="ww-roles"></div></section><section class="ww-history"><h4>Berita kampung</h4><ol></ol></section><section class="ww-chat"><h4>Sembang permainan</h4><div class="ww-messages" role="log" aria-live="polite"></div><form><input aria-label="Werewolf message" maxlength="240" placeholder="Cakap dengan geng…" autocomplete="off"><button type="submit">Hantar</button></form><small class="ww-chat-status" role="status"></small></section><details><summary>Cara main & peranan</summary><p>Semua meja di bandar ini berkongsi satu lobi Werewolf. Sertai dahulu; hos mula apabila cukup 5 hingga 9 pemain. Kekal duduk semasa bermain.</p><p>5-6 pemain: 1 Werewolf, 1 Doctor, 1 Seer, selebihnya Villager. 7-8 pemain: 2 Werewolf, 1 Doctor, 1 Seer, selebihnya Villager. 9 pemain: tambah Alpha Wolf dan dua peranan rawak daripada Knight, Princess, Hunter, Mayor; 2 Villager kekal.</p><p>Undian dikira secara terbuka semasa fasa Tuduh: semua orang nampak berapa undi pada setiap suspek, tetapi bukan siapa yang mengundi. Undi Mayor dikira dua kali hanya pada keputusan akhir.</p><p>Malam 35s → bincang 60s → tuduh 25s → pembelaan 20s → keputusan 20s. Tuduhan terbanyak memilih tertuduh; seri bermakna tiada hukuman. Hanya penuduh membuat keputusan akhir; lebih separuh mesti memilih Singkir.</p><p>Penduduk menang jika tiada serigala. Serigala menang jika bilangan mereka menyamai penduduk. Serigala perlu sepakat tentang mangsa; jika berbeza, satu pilihan dipilih rawak. Tiada tindakan malam bermakna tiada serangan.</p><p>Sembang malam hanya untuk serigala. Pemain tersingkir mempunyai sembang berasingan. Gunakan sembang permainan untuk menyimpan rahsia; suara dan sembang bandar tetap boleh didengar seperti biasa. Jika terputus sambungan atau berdiri selama 60s, anda tersingkir.</p></details>`;
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
 function clock(){if(!game)return;const seconds=game.ends?Math.max(0,Math.ceil((game.ends-Date.now()-offset)/1000)):null;el('time').textContent=seconds!==null?`${seconds}s`:`${game.players.length}/${game.size} pemain`;const phaseKey=`${game.id}:${game.phase}`;if(phaseKey!==`${lastCountdownGame}:${lastCountdownPhase}`){lastCountdownGame=game.id;lastCountdownPhase=game.phase;lastCountdown=-1;}if(seconds!==null&&game.phase!=='finished'&&seconds<=5){if(seconds===0&&lastCountdown!==0){audio.sample('countdownFinal');lastCountdown=0;}else if(seconds>0&&seconds!==lastCountdown){audio.sample('countdownTick');lastCountdown=seconds;}}}
 function render(){if(!game)return;const me=game.players.find((p:any)=>p.id===game.self),host=game.host===game.self,waiting=game.phase==='lobby',finished=game.phase==='finished',wolf=['werewolf','alpha'].includes(game.role);root.dataset.phase=game.phase;el('.ww-phase strong').textContent=`${phases[game.phase]}${game.day?' · Hari '+game.day:''}`;clock();
  el('.ww-hint').textContent=waiting?'Sertai dari mana-mana meja. Peranan kekal rahsia.':finished?game.winner==='good'?'Penduduk menang!':'Serigala menang!':!me?'Permainan sedang berlangsung. Anda menonton.':!me.alive?'Anda tersingkir. Sembang anda hanya untuk pemain tersingkir.':game.phase==='night'?wolf?'Sepakat dengan serigala lain. Pilih mangsa.':game.role==='doctor'?'Pilih seorang untuk dilindungi.':game.role==='seer'?'Pilih seorang untuk diperiksa.':'Tunggu sehingga matahari terbit.':game.phase==='defense'?`${game.players.find((p:any)=>p.id===game.accused)?.name} sedang membela diri.`:game.phase==='judgment'?'Penuduh: tentukan nasib tertuduh. Tidak mengundi dikira bebas.':game.phase==='vote'?'Pilih seorang suspek atau langkau.':'Bincang dengan geng. Siapa yang mencurigakan?';
  const lobby=el('.ww-lobby');lobby.replaceChildren();if(waiting){lobby.append(button(me?'Tinggalkan lobi':'Sertai permainan',()=>send({type:me?'werewolf-leave':'werewolf-join'}),!me&&game.players.length>=game.size));if(host){for(const size of (game.sizes||[7,9]) as number[]){const b=button(`${size} pemain`,()=>send({type:'werewolf-size',size}),game.players.length>size);b.setAttribute('aria-pressed',String(size===game.size));lobby.append(b);}lobby.append(button('Mula permainan',()=>send({type:'werewolf-start'}),game.players.length!==game.size));}}else if(finished){lobby.append(button('Lobi baharu',()=>send({type:'werewolf-rematch'}),!host&&game.players.some((p:any)=>p.id===game.host&&p.online)));}
  el('.ww-role').hidden=!game.role||waiting;el('.ww-secret').hidden=!reveal;el('.ww-reveal').textContent=reveal?'Sembunyikan peranan':'Lihat peranan saya';const secret=el('.ww-secret');secret.replaceChildren();if(game.role){const [name,icon,description]=roles[game.role]||[game.role,'?',''];const title=document.createElement('h4'),body=document.createElement('p');title.textContent=`${icon} ${name}`;body.textContent=description;secret.append(title,body);}const book=el('.ww-inspection');book.replaceChildren();if(reveal&&game.inspections?.length)for(const r of game.inspections){const row=document.createElement('p');row.dataset.team=r.team;row.textContent=`Malam ${r.day}: ${r.name} — ${r.team==='evil'?'Jahat':'Baik'}`;book.append(row);}
  const players=el('.ww-players');players.replaceChildren();for(const p of game.players){const legal=me?.alive&&p.alive&&(game.phase==='vote'&&p.id!==me.id||game.phase==='night'&&(wolf&&!['werewolf','alpha'].includes(p.role)||game.role==='doctor'||game.role==='seer'&&p.id!==me.id));const card=button('',()=>action(p.id),!legal),initial=document.createElement('span'),name=document.createElement('strong'),meta=document.createElement('small');card.className='ww-player';card.classList.toggle('ww-dead',!p.alive);card.setAttribute('aria-pressed',String(game.selected===p.id));initial.textContent=p.alive?p.name.slice(0,1).toUpperCase():'×';name.textContent=p.name;meta.textContent=waiting?'Sedia':p.role&&(p.id!==game.self||reveal||finished)?roles[p.role]?.[0]||p.role:!p.online?'Menyambung semula…':'Peranan rahsia';card.append(initial,name,meta);const votes=game.phase==='vote'?game.tally?.[p.id]||0:0;if(votes){const badge=document.createElement('em');badge.className='ww-tally';badge.textContent=String(votes);badge.setAttribute('aria-label',`${votes} undi`);card.append(badge);}players.append(card);}if(waiting)for(let i=game.players.length;i<game.size;i++){const slot=document.createElement('div');slot.className='ww-empty';slot.textContent='Menunggu member';players.append(slot);}
  const judge=el('.ww-judgment');judge.replaceChildren();if(me?.alive&&game.phase==='vote'){const skips=game.tally?.skip||0;judge.append(button(`${game.selected==='skip'?'✓ Langkau':'Langkau undian'}${skips?` · ${skips}`:''}`,()=>action('skip')));}if(game.phase==='judgment'&&game.canJudge){for(const [label,target] of [['Singkir','kill'],['Bebaskan','spare']]){const n=game.tally?.[target]||0;const b=button(`${label}${n?` · ${n}`:''}`,()=>action(target));b.setAttribute('aria-pressed',String(game.selected===target));judge.append(b);}}
  // The ending is the game in a deduction round, so it gets a moment rather than a line.
  // Roles, not accusations: who was a wolf, never who was wrong about whom.
  const verdict=el('.ww-verdict');verdict.hidden=!finished;
  if(finished){
   verdict.dataset.side=game.winner==='good'?'good':'evil';
   el('.ww-verdict strong').textContent=game.winner==='good'?'Penduduk menang!':'Serigala menang!';
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
  const canChat=me&&(waiting||finished||!me.alive||game.phase==='night'&&wolf||['discussion','vote','judgment'].includes(game.phase)||game.phase==='defense'&&game.accused===me.id);el<HTMLInputElement>('.ww-chat input').disabled=!canChat;el<HTMLButtonElement>('.ww-chat form button').disabled=!canChat;el('.ww-chat-status').textContent=canChat?game.phase==='night'&&me.alive?'Sembang rahsia serigala':!me.alive&&!finished?'Hanya pemain tersingkir':'Sembang pemain': 'Sembang tidak tersedia dalam fasa ini.';
 }
 el('.ww-reveal').onclick=()=>{reveal=!reveal;render();};el('form').onsubmit=e=>{e.preventDefault();const input=el<HTMLInputElement>('input');if(input.value.trim()&&send({type:'werewolf-chat',text:input.value.trim()}))input.value='';};setInterval(()=>{if(root.isConnected&&!root.hidden)clock();},250);
 return {root,state(value:any){if(!value){game=null;audio.stopSamples();root.querySelectorAll<HTMLElement>('.ww-secret,.ww-role').forEach(e=>e.hidden=true);return;}const previous=game;const playerDied=value.id===lastGame&&previous?.players?.some((old:any)=>old.alive&&value.players?.some((next:any)=>next.id===old.id&&!next.alive));if(value.id!==lastGame){lastGame=value.id;reveal=false;shownPhase='';}game=value;offset=game.serverTime-Date.now();render();if(playerDied){audio.sample('death');if(value.phase==='night')audio.sample('growl');}}};
}
