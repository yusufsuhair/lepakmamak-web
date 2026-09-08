import {setupLukis} from './lukis';
import {setupPoker} from './poker';
import locations from '../shared/tables.json';
export type TableState = { id: string; name: string; hostId: string | null; capacity: number; cheersUntil: number; occupants: {id:string; name:string; chairId:string; hasCup:boolean}[] };
export type Receipt = {name:string; tableId:string|null; tableName:string; minutes:number; drinksGiven:number; drinksReceived:number; recalls:number; issuedAt:string};
export function inviteUrl(room: string, tableId?: string | null) {
  const url = new URL(location.origin); url.searchParams.set('room', room); if (tableId) url.searchParams.set('table', tableId); return url.href;
}
export function drawReceipt(canvas: HTMLCanvasElement, receipt: Receipt, link: string) {
  canvas.width = 720; canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle='#efe8d7';ctx.fillRect(0,0,720,1080);
  ctx.fillStyle='#fffaf0';ctx.beginPath();ctx.moveTo(40,30);ctx.lineTo(680,30);ctx.lineTo(680,1040);for(let x=680;x>=40;x-=16)ctx.lineTo(x,1040+(Math.floor((680-x)/16)%2?12:0));ctx.closePath();ctx.fill();
  ctx.fillStyle='#214939';ctx.textAlign='center';ctx.font='bold 54px monospace';ctx.fillText('LEPAKMAMAK',360,112);
  ctx.font='22px monospace';ctx.fillText('RESIT LEPAK ANDA',360,154);
  ctx.font='18px monospace';ctx.fillText(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}).format(new Date(receipt.issuedAt))+' MYT',360,196);
  ctx.strokeStyle='#b2b29d';ctx.setLineDash([6,7]);ctx.beginPath();ctx.moveTo(82,226);ctx.lineTo(638,226);ctx.stroke();
  const fit=(text:string,max:number)=>{let size=26;do{ctx.font=`${size--}px monospace`;}while(ctx.measureText(text).width>max&&size>13);};
  ctx.textAlign='left';ctx.font='18px monospace';ctx.fillText('NAMA',82,275);fit(receipt.name,550);ctx.fillText(receipt.name,82,314);
  ctx.font='18px monospace';ctx.fillText('MEJA KITA',82,365);fit(receipt.tableName,550);ctx.fillText(receipt.tableName,82,405);
  const rows=[['Masa lepak',`${receipt.minutes} minit`],['Belanja member',`${receipt.drinksGiven} cawan`],['Minum teh tarik',`${receipt.drinksReceived} cawan`],['Recall spam',`${receipt.recalls} kali`]];
  rows.forEach(([label,value],i)=>{ctx.font='23px monospace';ctx.textAlign='left';ctx.fillText(label,82,490+i*56);ctx.textAlign='right';ctx.fillText(value,638,490+i*56);});
  ctx.beginPath();ctx.moveTo(82,718);ctx.lineTo(638,718);ctx.stroke();ctx.textAlign='center';ctx.font='bold 28px monospace';ctx.fillText('JUMLAH: ESOK KERJA WEH.',360,778);
  ctx.font='20px monospace';ctx.fillText('Jom mamak. Send link je.',360,832);
  ctx.font='bold 24px monospace';ctx.fillText('lepakmamak.my',360,890);
  fit(link.replace(/^https?:\/\//,''),560);ctx.fillText(link.replace(/^https?:\/\//,''),360,940,560);
  ctx.font='16px monospace';ctx.fillText('Kenangan sesi ini. Bukan bil bayaran.',360,1000);
}
export function setupTableSocial(send:(message:object)=>boolean, room:string, releaseInput:()=>void) {
  const dialog=document.createElement('dialog');dialog.id='table-social';dialog.setAttribute('aria-labelledby','table-social-title');
  dialog.innerHTML=`<header><div><small>JOM MAMAK</small><h2 id="table-social-title">Meja Kita</h2></div><button id="close-table-social" aria-label="Close Meja Kita">×</button></header><p id="table-social-help">Sit with your geng. Play a game. Make a memory.</p><div id="table-list"></div><section id="table-detail" hidden><h3 id="table-name"></h3><p id="table-seats"></p><ul id="table-occupants"></ul><form id="table-name-form"><label for="table-name-input">Your table’s name</label><div><input id="table-name-input" maxlength="28" placeholder="Geng Balik Lambat" required /><button>Save</button></div></form><p id="table-host-hint"></p><button id="table-round">Cheers satu meja · Free</button><small>Two or more friends? Jom main together!</small><label for="table-link">Invite friends to this table</label><div class="table-link-row"><input id="table-link" readonly /><button id="copy-table-link">Copy link</button></div></section><button id="get-receipt">Resit Lepak ↗</button><p id="table-feedback" role="status"></p><section id="receipt-view" hidden><canvas id="receipt-canvas" aria-label="Your LepakMamak session receipt"></canvas><div><button id="download-receipt">Download PNG</button><button id="share-receipt">Share receipt</button></div><small>Only your own session stats. Chat and voice are never included. Counters reset when you reconnect.</small></section>`;
  document.body.append(dialog);
  const lukis=setupLukis(send);dialog.querySelector('#table-detail')!.append(lukis.root);
  const poker=setupPoker(send);dialog.querySelector('#table-detail')!.append(poker.root);
  const el=<T extends HTMLElement>(id:string)=>dialog.querySelector<T>(`#${id}`)!;
  let tables:TableState[]=[], selfId='', online=false, selected=locations[0].id, receipt:Receipt|null=null, roundPending=false;
  let lastView='';
  const feedback=(text:string)=>el('table-feedback').textContent=text;
  function render(force=false){
    if(!dialog.open&&!force)return;
    const key=JSON.stringify([tables,selfId,online,selected]);if(key===lastView&&!force)return;lastView=key;
    const list=el('table-list');list.replaceChildren();
    for(const place of locations){const table=tables.find(t=>t.id===place.id);const button=document.createElement('button');button.type='button';button.textContent=`${table?.name||place.name} · ${table?.occupants.length||0}/${table?.capacity|| (place.id==='meja-2'?2:3)}`;button.setAttribute('aria-pressed',String(selected===place.id));button.onclick=()=>{selected=place.id;render(true);};list.append(button);}
    const table=tables.find(t=>t.id===selected);el('table-detail').hidden=!table;
    el('table-social-help').textContent=online?'Sit at a table to play with your geng. Invite friends with its link.':'Connect to the city to use tables and games.';
    el<HTMLButtonElement>('get-receipt').disabled=!online;
    poker.context(selected,!!table?.occupants.some(p=>p.id===selfId)&&online,selfId);
    if(!table)return;
    const seated=table.occupants.some(p=>p.id===selfId),host=table.hostId===selfId;
    el('table-name').textContent=table.name;el('table-seats').textContent=`${table.occupants.length} / ${table.capacity} seats · ${table.capacity-table.occupants.length} available`;
    const occupants=el('table-occupants');occupants.replaceChildren();for(const p of table.occupants){const li=document.createElement('li');li.textContent=`${p.name}${p.id===selfId?' (You)':''}${p.id===table.hostId?' · Host':''}${p.hasCup?' · ☕':''}`;occupants.append(li);}
    el('table-name-form').hidden=!host;
    if(document.activeElement!==el('table-name-input'))el<HTMLInputElement>('table-name-input').value=table.name;
    el('table-host-hint').textContent=host?'You host while seated. When you leave, another seated player becomes host.':seated?'The host can name this table.':'Walk to this table and tap Sit on an available chair.';
    el<HTMLButtonElement>('table-round').disabled=!online||!seated||roundPending;
    el<HTMLInputElement>('table-link').value=inviteUrl(room,selected);
  }
  function close(){dialog.close();}
  el('close-table-social').onclick=close;
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  el('table-name-form').onsubmit=event=>{event.preventDefault();if(send({type:'table-name',name:el<HTMLInputElement>('table-name-input').value}))feedback('Table name sent.');};
  el('table-round').onclick=()=>{if(send({type:'table-round'})){roundPending=true;render(true);feedback('Teh tarik coming up!');setTimeout(()=>{roundPending=false;render(true);},10000);}};
  el('copy-table-link').onclick=async()=>{try{await navigator.clipboard.writeText(inviteUrl(room,selected));feedback('Link copied. Jom, ajak member!');}catch{el<HTMLInputElement>('table-link').select();feedback('Select and copy this invitation link.');}};
  el('get-receipt').onclick=()=>{feedback('Preparing your receipt…');if(!send({type:'receipt'}))feedback('Reconnect to the city first.');};
  const blob=()=>new Promise<Blob>((resolve,reject)=>el<HTMLCanvasElement>('receipt-canvas').toBlob(b=>b?resolve(b):reject(new Error('Could not create image')),'image/png'));
  async function download(){try{const url=URL.createObjectURL(await blob());const a=document.createElement('a');a.href=url;a.download='resit-lepak.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('Receipt downloaded.');}catch{feedback('Could not save the receipt. Try again.');}}
  el('download-receipt').onclick=download;
  el('share-receipt').onclick=async()=>{if(!receipt)return;try{const file=new File([await blob()],'resit-lepak.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Resit Lepak',text:`Jom mamak! ${inviteUrl(room,receipt.tableId)}`});}else{await download();feedback('Receipt downloaded. Share it with your table link.');}}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))feedback('Sharing failed. Try Download PNG.');}};
  return {
    open(tableId?:string){selected=tableId||tables.find(t=>t.occupants.some(p=>p.id===selfId))?.id||selected;releaseInput();if(!dialog.open)dialog.showModal();render(true);el('close-table-social').focus();},
    close,
    game(value:any){lukis.state(value,selfId);},
    poker(value:any){poker.state(value,selfId);},
    gameLine(value:any){lukis.line(value);},
    get opened(){return dialog.open;},
    state(value:TableState[],id:string,connected:boolean){tables=value;selfId=id;online=connected;poker.context(selected,connected&&!!tables.find(t=>t.id===selected)?.occupants.some(p=>p.id===id),id);render();},
    offline(){lukis.state(null,selfId);poker.state(null,selfId);online=false;tables=[];receipt=null;el('receipt-view').hidden=true;roundPending=false;render(true);},
    receipt(value:Receipt){receipt=value;drawReceipt(el('receipt-canvas'),value,inviteUrl(room,value.tableId));el('receipt-view').hidden=false;feedback('Your receipt is ready.');el('receipt-view').scrollIntoView({block:'nearest'});},
  };
}
