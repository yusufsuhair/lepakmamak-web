import './lukis.css';
export function setupLukis(send:(m:object)=>boolean){
 const root=document.createElement('section');root.className='lukis';root.innerHTML=`<h3>🎨 Lukis Lah!</h3><p>Seorang lukis, geng teka. Duduk semeja dengan 2+ pemain.</p><button type="button" class="lukis-start">Mula / Main lagi</button><button type="button" class="lukis-open">Lihat permainan</button><div class="lukis-play" hidden><strong class="lukis-word"></strong><p class="lukis-time"></p><canvas width="640" height="400" aria-label="Papan Lukis Lah"></canvas><div class="lukis-tools"></div><form><input maxlength="60" placeholder="Teka perkataan…" aria-label="Jawapan Lukis Lah" required><button>Teka!</button></form><p class="lukis-score"></p></div>`;
 const canvas=root.querySelector('canvas')!,ctx=canvas.getContext('2d')!,form=root.querySelector('form')!,tools=root.querySelector<HTMLElement>('.lukis-tools')!;
 let game:any=null,self='',color='#20382e',size=7,prev:number[]|null=null,pointer:number|null=null,last=0;
 const drawing=()=>game?.phase==='drawing'&&game.drawer===self;
 function line(a:any){ctx.strokeStyle=a[4];ctx.lineWidth=a[5];ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a[0]*640,a[1]*400);ctx.lineTo(a[2]*640,a[3]*400);ctx.stroke();}
 function paint(){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,640,400);for(const a of game?.lines||[])line(a);}
 function render(){root.querySelector<HTMLElement>('.lukis-play')!.hidden=!game;if(!game)return;root.querySelector<HTMLElement>('.lukis-word')!.textContent=game.phase==='finished'?'Tamat! Jom satu lagi?':`${drawing()?'Lukis: ':game.phase==='reveal'?'Jawapan: ':'Teka: '}${game.word}`;tools.hidden=!drawing();form.hidden=!game||game.phase!=='drawing'||drawing()||game.solved.includes(self);canvas.style.touchAction=drawing()?'none':'auto';root.querySelector<HTMLElement>('.lukis-score')!.textContent=game.scores.map((s:any)=>`${s.name}${s.id===game.drawer?' ✏️':''}: ${s.score}`).join(' · ');paint();}
 for(const c of ['#20382e','#e34b4b','#327bd1','#2caa68','#e9b52c','#ffffff']){const b=document.createElement('button');b.type='button';b.style.background=c;b.title=c==='#ffffff'?'Pemadam':c;b.setAttribute('aria-label',b.title);b.onclick=()=>color=c;tools.append(b);}
 for(const n of [3,7,14]){const b=document.createElement('button');b.type='button';b.textContent=String(n);b.onclick=()=>size=n;tools.append(b);}const clear=document.createElement('button');clear.type='button';clear.textContent='Padam semua';clear.onclick=()=>send({type:'lukis-clear'});tools.append(clear);
 root.querySelector<HTMLButtonElement>('.lukis-start')!.onclick=()=>send({type:'lukis-start'});root.querySelector<HTMLButtonElement>('.lukis-open')!.onclick=()=>send({type:'lukis-open'});
 form.onsubmit=e=>{e.preventDefault();const input=form.querySelector('input')!;send({type:'lukis-guess',text:input.value});input.value='';};
 const point=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();return[Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];};
 canvas.onpointerdown=e=>{if(!drawing()||pointer!==null)return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);prev=point(e);last=0;};
 canvas.onpointermove=e=>{if(!drawing()||pointer!==e.pointerId||!prev||performance.now()-last<25)return;e.preventDefault();last=performance.now();const p=point(e);send({type:'lukis-line',line:[...prev,...p,color,size]});prev=p;};
 const end=()=>{prev=null;pointer=null;};canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=end;
 setInterval(()=>{if(game)root.querySelector<HTMLElement>('.lukis-time')!.textContent=`Giliran ${Math.min(game.round,game.total)}/${game.total} · ${game.phase==='finished'?'Selesai':Math.max(0,Math.ceil((game.ends-Date.now())/1000))+'s'}`;},250);
 return {root,state(value:any,id:string){game=value;self=id;end();render();},line(a:any){if(game){game.lines.push(a);line(a);}}};
}
