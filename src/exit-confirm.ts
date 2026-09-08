export function setupExitConfirmation(onExit:()=>void|Promise<void>){
 const dialog=document.createElement('dialog');dialog.id='exit-confirm';dialog.setAttribute('aria-labelledby','exit-confirm-title');
 dialog.innerHTML='<div class="exit-confirm-card"><span aria-hidden="true">☕</span><h2 id="exit-confirm-title">Keluar dari game?</h2><p>Character anda akan keluar dari bandar dan kawan-kawan akan nampak anda offline.</p><p id="exit-confirm-status" role="status"></p><div><button id="exit-cancel" type="button">Cancel</button><button id="exit-yes" type="button">Keluar game</button></div></div>';
 document.body.append(dialog);
 const cancel=dialog.querySelector<HTMLButtonElement>('#exit-cancel')!,confirm=dialog.querySelector<HTMLButtonElement>('#exit-yes')!,status=dialog.querySelector<HTMLElement>('#exit-confirm-status')!;
 let busy=false;
 function close(){if(!busy)dialog.close();}
 cancel.onclick=close;
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('keydown',event=>event.stopPropagation());
 confirm.onclick=async()=>{if(busy)return;busy=true;cancel.disabled=confirm.disabled=true;confirm.textContent='Keluar…';status.textContent='';try{await onExit();dialog.close();}catch(error){status.textContent=error instanceof Error?error.message:'Tidak dapat keluar. Cuba lagi.';}finally{busy=false;cancel.disabled=confirm.disabled=false;confirm.textContent='Keluar game';}};
 return{get opened(){return dialog.open;},close,open(){if(dialog.open)return;status.textContent='';dialog.showModal();cancel.focus();}};
}
